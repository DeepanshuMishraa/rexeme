import { Effect, Option } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "starship"

/**
 * A starship palette named "rex". Palette entries shadow color names, so
 * every module styled "bold green", "cyan" and so on uses Rex's colors.
 */
export const colors = (p: Palette): ReadonlyArray<readonly [string, string]> => [
  ["black", p.ansi[0] ?? p.bg], ["red", p.red], ["green", p.green], ["yellow", p.yellow],
  ["blue", p.blue], ["purple", p.magenta], ["cyan", p.cyan], ["white", p.ansi[7] ?? p.fg],
  ["bright-black", p.ansi[8] ?? p.muted], ["bright-red", p.ansi[9] ?? p.red], ["bright-green", p.ansi[10] ?? p.green],
  ["bright-yellow", p.ansi[11] ?? p.yellow], ["bright-blue", p.ansi[12] ?? p.blue], ["bright-purple", p.ansi[13] ?? p.magenta],
  ["bright-cyan", p.ansi[14] ?? p.cyan], ["bright-white", p.ansi[15] ?? p.fg],
  ["accent", p.accent], ["muted", p.muted], ["orange", p.orange],
]

const configPath = Effect.gen(function* () {
  const paths = yield* Paths.Service
  return process.env["STARSHIP_CONFIG"] ?? join(paths.config, "starship.toml")
})

export const target: Target.Target = {
  name,
  detect: Target.onPath("starship"),
  apply: Effect.fn("Starship.apply")(function* (palette) {
    const path = yield* configPath
    const current = Option.getOrElse(yield* Files.readOptional(path).pipe(Target.step(name, "read", path)), () => "")
    const updated = colors(palette).reduce(
      (text, [key, value]) => Text.setTomlValue(text, "palettes.rex", key, `"${value}"`),
      Text.setTomlTopLevel(current, "palette", '"rex"'),
    )
    yield* Files.writeIfChanged(path, updated).pipe(Target.step(name, "write", path))
    return "the next prompt uses it"
  }),
}

export * as Starship from "./Starship.ts"
