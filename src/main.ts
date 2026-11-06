#!/usr/bin/env bun
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Effect, Layer, Option } from "effect"
import { Command, Flag } from "effect/cli"
import { LaunchAgent } from "./LaunchAgent.ts"
import { Palette } from "./Palette.ts"
import { Paths } from "./Paths.ts"
import { Prefs } from "./Prefs.ts"
import { RexPlugin } from "./RexPlugin.ts"
import { Rex } from "./Rex.ts"
import { Sync } from "./Sync.ts"
import { Watch } from "./Watch.ts"

const VERSION = "0.1.0"

/** Prints an expected failure as plain text and exits 1, instead of a stack trace. */
const reportFailure = <A, E extends { readonly message: string }, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catch((error) =>
      Console.error(`rexeme: ${error.message}`).pipe(Effect.andThen(Effect.sync(() => void (process.exitCode = 1)))),
    ),
  )

const parseOnly = (value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => Effect.succeed(Sync.targets),
    onSome: (list) => {
      const names = list.split(",").map((name) => name.trim()).filter((name) => name !== "")
      const unknown = names.filter((name) => !Sync.targetNames.includes(name))
      return unknown.length > 0
        ? Effect.fail({ message: `unknown target ${unknown.join(", ")}. Choose from: ${Sync.targetNames.join(", ")}` })
        : Effect.succeed(Sync.targets.filter((target) => names.includes(target.name)))
    },
  })

const sync = Command.make(
  "sync",
  {
    only: Flag.String("only").pipe(
      Flag.withDescription(`Comma-separated targets to sync (${Sync.targetNames.join(", ")})`),
      Flag.optional,
    ),
  },
  Effect.fn("cli.sync")(function* ({ only }) {
    yield* reportFailure(
      Effect.gen(function* () {
        const selected = yield* parseOnly(only)
        const rex = yield* Rex.Service
        const active = yield* rex.active()
        yield* Console.log(`Rex theme: ${active.theme.name} (${active.appearance}, ${active.theme.origin})`)
        const outcomes = yield* Sync.apply(Palette.fromTheme(active.theme), selected)
        for (const outcome of outcomes) yield* Console.log(Sync.describe(outcome))
        if (outcomes.some((outcome) => outcome._tag === "Failed")) process.exitCode = 1
      }),
    )
  }),
).pipe(Command.withDescription("Apply Rex's current theme to every installed tool"))

const watch = Command.make("watch", {}, () => Watch.run()).pipe(
  Command.withDescription("Sync now, then again whenever Rex's theme or light/dark mode changes"),
)

const status = Command.make(
  "status",
  {},
  Effect.fn("cli.status")(function* () {
    yield* reportFailure(
      Effect.gen(function* () {
        const rex = yield* Rex.Service
        const selection = yield* rex.selection()
        yield* Console.log(`Appearance: ${selection.mode}`)
        yield* Console.log(`Dark theme: ${selection.darkThemeId}`)
        yield* Console.log(`Light theme: ${selection.lightThemeId}`)
        const active = yield* rex.active()
        yield* Console.log(`Showing: ${active.theme.name} (${active.appearance}, ${active.theme.origin})`)
        yield* Console.log("\nTargets:")
        for (const target of Sync.targets) {
          yield* Console.log(`  ${target.name.padEnd(16)} ${(yield* target.detect) ? "installed" : "not installed"}`)
        }
      }),
    )
  }),
).pipe(Command.withDescription("Show Rex's theme choice and which tools rexeme can theme"))

const themes = Command.make(
  "themes",
  {},
  Effect.fn("cli.themes")(function* () {
    yield* reportFailure(
      Effect.gen(function* () {
        const rex = yield* Rex.Service
        const active = yield* Effect.option(rex.active())
        const activeId = Option.map(active, (current) => current.theme.id)
        for (const theme of yield* rex.themes()) {
          const marker = Option.contains(activeId, theme.id) ? "*" : " "
          yield* Console.log(`${marker} ${theme.id.padEnd(34)} ${theme.appearance.padEnd(6)} ${theme.origin.padEnd(9)} ${theme.name}`)
        }
      }),
    )
  }),
).pipe(Command.withDescription("List Rex's built-in and custom themes (* marks the one showing)"))

// launchd needs a command that runs without this shell: the compiled binary
// itself, or bun plus this script's absolute path.
const selfInvocation = () => (Bun.main.startsWith("/$bunfs/") ? [process.execPath] : [process.execPath, Bun.main])

const install = Command.make(
  "install",
  {},
  Effect.fn("cli.install")(function* () {
    const paths = yield* Paths.Service
    const environment: Record<string, string> = {
      HOME: paths.home,
      PATH: [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        `${paths.home}/.local/bin`,
        `${paths.home}/.bun/bin`,
        `${paths.home}/.cargo/bin`,
        `${paths.home}/.spicetify`,
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ].join(":"),
    }
    for (const key of ["XDG_CONFIG_HOME", "CODEX_HOME", "REX_APP_PATH"]) {
      const value = process.env[key]
      if (value) environment[key] = value
    }
    yield* reportFailure(
      LaunchAgent.install([...selfInvocation(), "watch"], environment).pipe(
        Effect.flatMap(({ plist, log }) =>
          Console.log(`Installed ${plist}\nrexeme now follows Rex in the background and starts at login. Log: ${log}`),
        ),
      ),
    )
  }),
).pipe(Command.withDescription("Run `rexeme watch` in the background at login"))

const uninstall = Command.make(
  "uninstall",
  {},
  Effect.fn("cli.uninstall")(function* () {
    const { plist, existed } = yield* LaunchAgent.uninstall()
    yield* Console.log(existed ? `Removed ${plist}. Tools keep their current Rex colors.` : "rexeme wasn't installed.")
  }),
).pipe(Command.withDescription("Stop the background watcher"))

const pluginInstall = Command.make(
  "install",
  {},
  Effect.fn("cli.plugin.install")(function* () {
    yield* reportFailure(
      RexPlugin.install(selfInvocation()).pipe(
        Effect.flatMap(({ config, pluginPath, reloaded, reloadOutput }) =>
          Console.log(
            [
              `Installed the Rex plugin at ${pluginPath} and loaded it from ${config}.`,
              reloaded
                ? "Rex reloaded its config: search \"Rexeme\" in the command palette, or run `rex do rexeme_sync`."
                : `Rex didn't reload (${reloadOutput || "no output"}). Run \`rex config reload\` on this Mac to load it.`,
            ].join("\n"),
          ),
        ),
      ),
    )
  }),
).pipe(Command.withDescription("Add rexeme's actions to Rex's command palette (writes a marked block in init.lua)"))

const pluginUninstall = Command.make(
  "uninstall",
  {},
  Effect.fn("cli.plugin.uninstall")(function* () {
    yield* reportFailure(
      RexPlugin.uninstall().pipe(
        Effect.flatMap(({ config, removed, reloaded }) =>
          Console.log(
            !removed
              ? "The rexeme Rex plugin wasn't installed."
              : `Removed the rexeme block from ${config}${reloaded ? " and reloaded Rex." : ". Run `rex config reload` to drop the actions."}`,
          ),
        ),
      ),
    )
  }),
).pipe(Command.withDescription("Remove rexeme's actions from Rex"))

const plugin = Command.make("plugin").pipe(
  Command.withDescription("Manage the rexeme Rex plugin"),
  Command.withSubcommands([pluginInstall, pluginUninstall]),
)

const rexeme =Command.make("rexeme").pipe(
  Command.withDescription("A Rex plugin that keeps your editors, terminals and CLI tools on Rex's theme"),
  Command.withSubcommands([sync, watch, status, themes, install, uninstall, plugin]),
)

const MainLayer = Rex.layer.pipe(
  Layer.provideMerge(Paths.layer),
  Layer.provideMerge(Prefs.layer),
  Layer.provideMerge(BunServices.layer),
)

Command.run(rexeme, { version: VERSION }).pipe(Effect.provide(MainLayer), BunRuntime.runMain)
