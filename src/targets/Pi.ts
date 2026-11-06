import { Effect } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "pi"

/** A theme matching https://pi.dev/schemas/theme.schema.json; every required color is set. */
export const render = (p: Palette.Palette) => ({
  $schema: "https://pi.dev/schemas/theme.schema.json",
  name: "rex",
  appearance: p.appearance,
  colors: {
    accent: p.accent, border: p.border, borderAccent: p.accent, borderMuted: p.surface1,
    success: p.success, error: p.error, warning: p.warning,
    muted: p.subtext, dim: p.muted, text: p.fg, thinkingText: p.subtext,
    selectedBg: p.surface1, userMessageBg: p.surface0, userMessageText: p.fg,
    customMessageBg: p.bgDim, customMessageText: p.fg, customMessageLabel: p.magenta,
    toolPendingBg: p.bgDim, toolSuccessBg: Palette.tint(p, p.green, 0.06), toolErrorBg: Palette.tint(p, p.red, 0.1),
    toolTitle: p.accent, toolOutput: p.subtext,
    mdHeading: p.accent, mdLink: p.blue, mdLinkUrl: p.cyan, mdCode: p.green, mdCodeBlock: p.fg,
    mdCodeBlockBorder: p.border, mdQuote: p.yellow, mdQuoteBorder: p.yellow, mdHr: p.border, mdListBullet: p.accent,
    toolDiffAdded: p.green, toolDiffRemoved: p.red, toolDiffContext: p.muted,
    syntaxComment: p.muted, syntaxKeyword: p.magenta, syntaxFunction: p.blue, syntaxVariable: p.fg,
    syntaxString: p.green, syntaxNumber: p.orange, syntaxType: p.yellow, syntaxOperator: p.cyan,
    syntaxPunctuation: p.subtext,
    thinkingOff: p.border, thinkingMinimal: p.muted, thinkingLow: p.blue, thinkingMedium: p.cyan,
    thinkingHigh: p.magenta, thinkingXhigh: p.accent, bashMode: p.orange,
  },
  export: { pageBg: p.bgDim, cardBg: p.bg, infoBg: p.surface0 },
})

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.home, ".pi", "agent", "settings.json"))
  }),
  apply: Effect.fn("Pi.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const dir = join(paths.home, ".pi", "agent")
    const themePath = join(dir, "themes", "rex.json")
    yield* Files.writeIfChanged(themePath, `${JSON.stringify(render(palette), null, 2)}\n`).pipe(Target.step(name, "write", themePath))
    yield* Target.updateJson(name, join(dir, "settings.json"), (settings) => ({ ...settings, theme: "rex" }))
    return "running sessions reload it live"
  }),
}

export * as Pi from "./Pi.ts"
