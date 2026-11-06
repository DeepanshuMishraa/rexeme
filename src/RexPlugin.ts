import { Effect, Option, Schema } from "effect"
import { dirname, join } from "node:path"
// Embedded so a compiled rexeme binary can install the plugin without its source tree.
import PLUGIN_SOURCE from "../lua/rexeme/init.lua" with { type: "text" }
import { Files } from "./Files.ts"
import { Paths } from "./Paths.ts"
import { Shell } from "./Shell.ts"

/**
 * Installs rexeme as a Rex plugin: the Lua module goes beside Rex's config,
 * and a marked block in init.lua loads it with the command that runs this
 * rexeme. Rex then lists the Rexeme actions in its command palette.
 */

const markers = { begin: "-- >>> rexeme >>>", end: "-- <<< rexeme <<<" }

export class ConfigRejected extends Schema.TaggedError<ConfigRejected>()("RexPlugin.ConfigRejected", {
  config: Schema.String,
  output: Schema.String,
}) {
  override get message() {
    return `Rex rejected ${this.config} after rexeme added its plugin block, so Rex wasn't reloaded and keeps its previous config loaded:\n${this.output}\nFix the reported line (or run \`rexeme plugin uninstall\`), then run \`rex config reload\`.`
  }
}

/** Rex's config file: $REX_CONFIG, else $XDG_CONFIG_HOME/rex/init.lua. */
export const configPath = Effect.gen(function* () {
  const paths = yield* Paths.Service
  return process.env["REX_CONFIG"] ?? join(paths.config, "rex", "init.lua")
})

const lua = (value: string) => JSON.stringify(value)

export const loaderBlock = (pluginPath: string, bin: ReadonlyArray<string>) =>
  [
    markers.begin,
    `-- Managed by \`rexeme plugin install\`; \`rexeme plugin uninstall\` removes it.`,
    `dofile(${lua(pluginPath)}).setup({ bin = { ${bin.map(lua).join(", ")} } })`,
    markers.end,
  ].join("\n") + "\n"

/** Puts `block` where the managed block was, or at the end. */
export const withBlock = (content: string, block: Option.Option<string>) => {
  const start = content.indexOf(markers.begin)
  const end = start === -1 ? -1 : content.indexOf(markers.end, start)
  const replacement = Option.getOrElse(block, () => "")
  if (start !== -1 && end !== -1) {
    const after = content.slice(end + markers.end.length).replace(/^\n/, "")
    return content.slice(0, start) + replacement + after
  }
  if (Option.isNone(block)) return content
  return content.trim() === "" ? replacement : `${content.replace(/\n*$/, "")}\n\n${replacement}`
}

const rexCommand = (args: ReadonlyArray<string>) =>
  Shell.combined("rex", args).pipe(
    Effect.catch((error) =>
      Effect.succeed({ code: 127, output: `couldn't run rex (${error.message}). Is the Rex CLI on PATH?` }),
    ),
  )

export const install = Effect.fn("RexPlugin.install")(function* (bin: ReadonlyArray<string>) {
  const config = yield* configPath
  const pluginPath = join(dirname(config), "plugins", "rexeme", "init.lua")
  yield* Files.writeIfChanged(pluginPath, PLUGIN_SOURCE)
  const current = Option.getOrElse(yield* Files.readOptional(config), () => "")
  yield* Files.writeIfChanged(config, withBlock(current, Option.some(loaderBlock(pluginPath, bin))))
  const check = yield* rexCommand(["config", "check", config])
  if (check.code !== 0) return yield* new ConfigRejected({ config, output: check.output })
  const reload = yield* rexCommand(["config", "reload"])
  return { config, pluginPath, reloaded: reload.code === 0, reloadOutput: reload.output }
})

export const uninstall = Effect.fn("RexPlugin.uninstall")(function* () {
  const config = yield* configPath
  const pluginPath = join(dirname(config), "plugins", "rexeme", "init.lua")
  const current = yield* Files.readOptional(config)
  const changed = Option.isSome(current)
    ? yield* Files.writeIfChanged(config, withBlock(current.value, Option.none()))
    : false
  const removed = yield* Files.removeIfExists(pluginPath)
  const reload = changed ? yield* rexCommand(["config", "reload"]) : { code: 0, output: "" }
  return { config, removed: changed || removed, reloaded: reload.code === 0 }
})

export * as RexPlugin from "./RexPlugin.ts"
