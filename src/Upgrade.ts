import { Effect, Schema } from "effect"
import { dirname } from "node:path"
import { Shell } from "./Shell.ts"

const BASE_URL = process.env.REXEME_BASE_URL ?? "https://rexeme.dipxsy.app"

export class FromSource extends Schema.TaggedError<FromSource>()("Upgrade.FromSource", {
  main: Schema.String,
}) {
  override get message() {
    return `this rexeme runs from source (${this.main}), so there's no binary to replace. Update it with: git pull && bun install`
  }
}

export class LatestUnknown extends Schema.TaggedError<LatestUnknown>()("Upgrade.LatestUnknown", {
  url: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `couldn't find the latest version at ${this.url} (${this.reason}). Nothing was changed. Check your connection and try again.`
  }
}

export class InstallFailed extends Schema.TaggedError<InstallFailed>()("Upgrade.InstallFailed", {
  version: Schema.String,
  exitCode: Schema.Number,
  output: Schema.String,
}) {
  override get message() {
    return `installing ${this.version} failed (exit ${this.exitCode}). The installer only swaps the binary after a verified download, so your current rexeme is still in place.\n${this.output}`
  }
}

/** The newest published version, e.g. "v0.2.0". */
const latest = Effect.fn("Upgrade.latest")(function* () {
  const url = `${BASE_URL}/latest/VERSION`
  const response = yield* Effect.tryPromise({
    try: () => fetch(url),
    catch: (error) => new LatestUnknown({ url, reason: String(error) }),
  })
  if (!response.ok) return yield* new LatestUnknown({ url, reason: `HTTP ${response.status}` })
  const text = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (error) => new LatestUnknown({ url, reason: String(error) }),
  })
  const version = text.trim()
  if (!/^v\d+\.\d+\.\d+$/.test(version)) return yield* new LatestUnknown({ url, reason: `unexpected contents "${version.slice(0, 40)}"` })
  return version
})

/**
 * Replaces the running binary with the latest release through install.sh,
 * which verifies the checksum and swaps the file atomically.
 */
export const run = Effect.fn("Upgrade.run")(function* (current: string) {
  if (!Bun.main.startsWith("/$bunfs/")) return yield* new FromSource({ main: Bun.main })
  const version = yield* latest()
  if (version === `v${current}`) return { _tag: "UpToDate" as const, version }
  const { code, output } = yield* Shell.combined("/usr/bin/env", [
    `REXEME_VERSION=${version}`,
    `REXEME_INSTALL_DIR=${dirname(process.execPath)}`,
    "REXEME_SETUP=0",
    `REXEME_BASE_URL=${BASE_URL}`,
    "/bin/sh",
    "-c",
    'curl -fsSL "$1/install.sh" | sh',
    "sh",
    BASE_URL,
  ])
  if (code !== 0) return yield* new InstallFailed({ version, exitCode: code, output })
  return { _tag: "Upgraded" as const, version, output }
})

export * as Upgrade from "./Upgrade.ts"
