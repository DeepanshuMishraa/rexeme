import { Effect, FileSystem, Schedule, Schema } from "effect"
import { join } from "node:path"
import { Files } from "./Files.ts"
import { Paths } from "./Paths.ts"
import { Shell } from "./Shell.ts"

export const LABEL = "dev.rexeme.watch"
const LEGACY_LABEL = "dev.rexhue.watch"

export class LaunchctlFailed extends Schema.TaggedError<LaunchctlFailed>()("LaunchAgent.LaunchctlFailed", {
  plist: Schema.String,
  exitCode: Schema.Number,
}) {
  override get message() {
    return `launchctl couldn't load ${this.plist} (exit ${this.exitCode}). The file is in place; check it with \`plutil -lint\` and see ~/Library/Logs/rexeme.log, then run rexeme install again.`
  }
}

// ProcessType is Standard, not Background: launchd throttles a Background
// job's CPU and disk I/O, which would slow the renames that make a theme
// switch instant. The watcher is idle almost all the time, so this costs nothing.
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const string = (value: string) => `<string>${escapeXml(value)}</string>`

export const render = (options: {
  readonly programArguments: ReadonlyArray<string>
  readonly environment: Readonly<Record<string, string>>
  readonly log: string
}) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>${string(LABEL)}
  <key>ProgramArguments</key>
  <array>
${options.programArguments.map((argument) => `    ${string(argument)}`).join("\n")}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(options.environment)
  .map(([key, value]) => `    <key>${escapeXml(key)}</key>${string(value)}`)
  .join("\n")}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key>${string("Standard")}
  <key>StandardOutPath</key>${string(options.log)}
  <key>StandardErrorPath</key>${string(options.log)}
</dict>
</plist>
`

const locations = Effect.gen(function* () {
  const paths = yield* Paths.Service
  const uid = yield* Shell.output("/usr/bin/id", ["-u"])
  return {
    plist: join(paths.home, "Library", "LaunchAgents", `${LABEL}.plist`),
    log: join(paths.home, "Library", "Logs", "rexeme.log"),
    domain: `gui/${uid}`,
    home: paths.home,
  }
})

/** Installs and starts a login agent running `rexeme watch`, replacing any previous one. */
export const install = Effect.fn("LaunchAgent.install")(function* (
  programArguments: ReadonlyArray<string>,
  environment: Readonly<Record<string, string>>,
) {
  const { plist, log, domain, home } = yield* locations
  // The watcher used to run as dev.rexhue.watch; stop it so two don't race.
  yield* Shell.exitCode("/bin/launchctl", ["bootout", `${domain}/${LEGACY_LABEL}`])
  yield* Files.removeIfExists(join(home, "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`))
  yield* Files.writeIfChanged(plist, render({ programArguments, environment, log }))
  // bootout fails when nothing is loaded yet; that's fine.
  yield* Shell.exitCode("/bin/launchctl", ["bootout", `${domain}/${LABEL}`])
  // bootout returns before launchd finishes stopping the old agent, and
  // bootstrap fails (exit 5) until it has; retry for up to ~3 seconds.
  const bootstrap = Shell.exitCode("/bin/launchctl", ["bootstrap", domain, plist]).pipe(
    Effect.flatMap((exitCode) => (exitCode === 0 ? Effect.void : Effect.fail(new LaunchctlFailed({ plist, exitCode })))),
  )
  yield* bootstrap.pipe(
    Effect.retry({ schedule: Schedule.spaced("200 millis"), times: 15, while: (error) => error._tag === "LaunchAgent.LaunchctlFailed" }),
  )
  return { plist, log }
})

/** Stops the login agent and removes its plist. Generated tool themes stay as they are. */
export const uninstall = Effect.fn("LaunchAgent.uninstall")(function* () {
  const fs = yield* FileSystem.FileSystem
  const { plist, domain, home } = yield* locations
  yield* Shell.exitCode("/bin/launchctl", ["bootout", `${domain}/${LABEL}`])
  yield* Shell.exitCode("/bin/launchctl", ["bootout", `${domain}/${LEGACY_LABEL}`])
  yield* Files.removeIfExists(join(home, "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`))
  const existed = yield* fs.exists(plist)
  if (existed) yield* fs.remove(plist)
  return { plist, existed }
})

export * as LaunchAgent from "./LaunchAgent.ts"
