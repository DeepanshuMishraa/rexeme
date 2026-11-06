import { Effect, Option } from "effect"
import { join } from "node:path"
import type { Hex } from "../Color.ts"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Notify } from "../Notify.ts"
import { Paths } from "../Paths.ts"
import { Shell } from "../Shell.ts"
import { Target } from "../Target.ts"

const name = "fish"

const bare = (hex: Hex) => hex.slice(1)

/** fish's syntax-highlighting universal variables, each a list of words. */
export const variables = (p: Palette): ReadonlyArray<readonly [string, ReadonlyArray<string>]> => [
  ["fish_color_normal", [bare(p.fg)]],
  ["fish_color_command", [bare(p.blue)]],
  ["fish_color_keyword", [bare(p.magenta)]],
  ["fish_color_param", [bare(p.fg)]],
  ["fish_color_option", [bare(p.cyan)]],
  ["fish_color_quote", [bare(p.green)]],
  ["fish_color_redirection", [bare(p.magenta)]],
  ["fish_color_end", [bare(p.orange)]],
  ["fish_color_error", [bare(p.error)]],
  ["fish_color_comment", [bare(p.muted)]],
  ["fish_color_operator", [bare(p.cyan)]],
  ["fish_color_escape", [bare(p.cyan)]],
  ["fish_color_autosuggestion", [bare(p.muted)]],
  ["fish_color_valid_path", ["--underline"]],
  ["fish_color_cwd", [bare(p.accent)]],
  ["fish_color_user", [bare(p.green)]],
  ["fish_color_host", [bare(p.blue)]],
  ["fish_color_cancel", [bare(p.red)]],
  ["fish_color_search_match", [`--background=${bare(p.surface1)}`]],
  ["fish_color_selection", [`--background=${bare(p.selection)}`]],
  ["fish_pager_color_prefix", [bare(p.accent), "--bold"]],
  ["fish_pager_color_completion", [bare(p.fg)]],
  ["fish_pager_color_description", [bare(p.muted)]],
  ["fish_pager_color_progress", [bare(p.accent)]],
  ["fish_pager_color_selected_background", [`--background=${bare(p.surface1)}`]],
]

/** The same assignments as fish commands, for machines without a fish_variables file yet. */
export const script = (p: Palette) =>
  variables(p)
    .map(([key, value]) => `set -U ${key} ${value.join(" ")}`)
    .join("; ")

// fish's uvar encoding: list items joined by \x1e, other bytes as \xNN escapes.
const escape = (value: string) =>
  [...value].map((char) => (/[A-Za-z0-9/]/.test(char) ? char : `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`)).join("")

export const line = (key: string, value: ReadonlyArray<string>) => `SETUVAR ${key}:${value.map(escape).join("\\x1e")}`

/** Sets each variable in fish_variables text, keeping everything else (including `--export` flags on other lines). */
export const updateVariables = (content: string, p: Palette) =>
  variables(p).reduce((current, [key, value]) => {
    const pattern = new RegExp(`^SETUVAR (--export )?${key}:.*$`, "m")
    const next = line(key, value)
    return pattern.test(current) ? current.replace(pattern, next) : `${current.replace(/\n*$/, "\n")}${next}\n`
  }, content)

// Running fish shells listen on this notifyd key and reread fish_variables
// when it fires (see fish's universal_notifier/notifyd.rs).
const notifyKey = () => `user.uid.${process.getuid?.() ?? 0}.fish.uvars`

const notifyShells = Effect.gen(function* () {
  const key = notifyKey()
  if (yield* Files.record({ _tag: "Notify", key })) return
  yield* Notify.post(key)
})

export const target: Target.Target = {
  name,
  detect: Target.onPath("fish"),
  apply: Effect.fn("Fish.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const path = join(paths.config, "fish", "fish_variables")
    const current = yield* Files.readOptional(path).pipe(Target.step(name, "read", path))
    if (Option.isSome(current)) {
      // Writing the file and posting fish's notification takes well under a
      // millisecond; spawning fish -c takes tens.
      yield* Files.writeIfChanged(path, updateVariables(current.value, palette)).pipe(Target.step(name, "write", path))
      yield* notifyShells
      return "running shells update live (a global set in config.fish still wins)"
    }
    const code = yield* Shell.exitCode("fish", ["-c", script(palette)]).pipe(Effect.orElseSucceed(() => 1))
    if (code !== 0) {
      return yield* new Target.Failed({
        target: name,
        operation: "set universal colors in",
        path,
        reason: `fish exited ${code}. Run \`fish -c 'set -U fish_color_command blue'\` to check fish works`,
      })
    }
    return "running shells update live (a global set in config.fish still wins)"
  }),
}

export * as Fish from "./Fish.ts"
