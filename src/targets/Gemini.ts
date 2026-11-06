import { Effect } from "effect"
import { join } from "node:path"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "gemini"
const THEME = "Rex"

export const render = (p: Palette.Palette) => ({
  type: "custom",
  name: THEME,
  Background: p.bg, Foreground: p.fg, LightBlue: p.ansi[12] ?? p.blue,
  AccentBlue: p.blue, AccentPurple: p.magenta, AccentCyan: p.cyan,
  AccentGreen: p.green, AccentYellow: p.yellow, AccentRed: p.red,
  DiffAdded: Palette.tint(p, p.green, 0.25), DiffRemoved: Palette.tint(p, p.red, 0.25),
  Comment: p.muted, Gray: p.subtext, GradientColors: [p.accent, p.magenta],
})

/** Gemini CLI and its forks (Qwen Code) share the settings layout under their own home folder. */
const make = (target: string, dir: string): Target.Target => {
  const settingsPath = Effect.gen(function* () {
    const paths = yield* Paths.Service
    return join(paths.home, dir, "settings.json")
  })
  return {
    name: target,
    detect: Effect.flatMap(settingsPath, Target.exists),
    apply: Effect.fn("Gemini.apply")(function* (palette) {
      const path = yield* settingsPath
      yield* Target.updateJson(target, path, (settings) => {
      const ui = Target.objectField(settings, "ui")
      return {
        ...settings,
        ui: { ...ui, customThemes: { ...Target.objectField(ui, "customThemes"), [THEME]: render(palette) }, theme: THEME },
      }
      })
      return "new sessions use it"
    }),
  }
}

export const target = make(name, ".gemini")
export const qwen = make("qwen-code", ".qwen")

export * as Gemini from "./Gemini.ts"
