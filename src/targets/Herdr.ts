import { Effect } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Shell } from "../Shell.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "herdr"

/** herdr's `[theme.custom]` colors, which override its base theme. */
export const colors = (p: Palette): ReadonlyArray<readonly [string, string]> => [
  ["accent", p.accent], ["panel_bg", p.bg], ["sidebar_bg", p.bgDim], ["active_row_bg", p.surface0],
  ["selection_bg", p.selection], ["surface0", p.surface0], ["surface1", p.surface1], ["surface_dim", p.bgDim],
  ["overlay0", p.muted], ["overlay1", p.subtext], ["text", p.fg], ["subtext0", p.subtext],
  ["mauve", p.magenta], ["green", p.green], ["yellow", p.yellow], ["red", p.red],
  ["blue", p.blue], ["teal", p.cyan], ["peach", p.orange],
]

export const target: Target.Target = {
  name,
  detect: Target.onPath("herdr"),
  apply: Effect.fn("Herdr.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const path = join(paths.config, "herdr", "config.toml")
    const current = yield* Files.read(path).pipe(Target.step(name, "read", path))
    const updated = colors(palette).reduce((text, [key, value]) => Text.setTomlValue(text, "theme.custom", key, `"${value}"`), current)
    if (!(yield* Files.writeIfChanged(path, updated).pipe(Target.step(name, "write", path)))) return "up to date"
    const code = yield* Shell.exitCode("herdr", ["server", "reload-config"]).pipe(Effect.orElseSucceed(() => 1))
    return code === 0 ? "reloaded the running herdr server" : "applies when herdr starts"
  }),
}

export * as Herdr from "./Herdr.ts"
