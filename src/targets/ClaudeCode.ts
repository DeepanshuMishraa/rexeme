import { Effect, Schema } from "effect"
import { join } from "node:path"
import { Color } from "../Color.ts"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "claude-code"
const SELECTION = "custom:rex"

export const render = (p: Palette.Palette) => {
  const shimmer = (color: Color.Hex) => Color.mix(color, p.fg, 0.35)
  const tint = (color: Color.Hex, amount: number) => Palette.tint(p, color, amount)
  const pink = p.ansi[13] ?? p.magenta
  return {
    name: `Rex – ${p.name}`,
    base: p.appearance,
    overrides: {
      claude: p.accent, claudeShimmer: shimmer(p.accent),
      clawd_body: p.accent, clawd_background: p.bg,
      briefLabelClaude: p.accent, briefLabelYou: p.blue,
      claudeBlue_FOR_SYSTEM_SPINNER: p.blue, claudeBlueShimmer_FOR_SYSTEM_SPINNER: shimmer(p.blue),
      permission: p.blue, permissionShimmer: shimmer(p.blue),
      suggestion: p.blue, remember: p.blue, ide: p.blue, professionalBlue: p.blue,
      autoAccept: p.magenta, autoAcceptShimmer: shimmer(p.magenta), skill: p.magenta,
      merged: p.magenta, effortUltra: p.magenta, bashBorder: pink,
      planMode: p.cyan, background: p.cyan,
      fastMode: p.orange, fastModeShimmer: shimmer(p.orange),
      promptBorder: p.borderStrong, promptBorderShimmer: p.muted,
      text: p.fg, inverseText: p.bg,
      inactive: p.muted, inactiveShimmer: p.subtext, subtle: p.surface1,
      success: p.success, error: p.error, warning: p.warning, warningShimmer: shimmer(p.warning),
      diffAdded: tint(p.green, 0.25), diffRemoved: tint(p.red, 0.25),
      diffAddedDimmed: tint(p.green, 0.12), diffRemovedDimmed: tint(p.red, 0.12),
      diffAddedWord: tint(p.green, 0.5), diffRemovedWord: tint(p.red, 0.5),
      red_FOR_SUBAGENTS_ONLY: p.red, blue_FOR_SUBAGENTS_ONLY: p.blue,
      green_FOR_SUBAGENTS_ONLY: p.green, yellow_FOR_SUBAGENTS_ONLY: p.yellow,
      purple_FOR_SUBAGENTS_ONLY: p.magenta, orange_FOR_SUBAGENTS_ONLY: p.orange,
      pink_FOR_SUBAGENTS_ONLY: pink, cyan_FOR_SUBAGENTS_ONLY: p.cyan,
      userMessageBackground: p.surface0, userMessageBackgroundHover: p.surface1,
      composerSidebarBackground: p.bgDim, selectionBg: p.selection,
      bashMessageBackgroundColor: tint(pink, 0.08), memoryBackgroundColor: tint(p.cyan, 0.08),
      rate_limit_fill: p.accent, rate_limit_empty: p.surface1,
    },
  }
}

const Selected = Schema.Struct({ theme: Schema.optionalKey(Schema.String) })

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.home, ".claude.json"))
  }),
  apply: Effect.fn("ClaudeCode.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const themePath = join(paths.home, ".claude", "themes", "rex.json")
    yield* Files.writeIfChanged(themePath, `${JSON.stringify(render(palette), null, 2)}\n`).pipe(Target.step(name, "write", themePath))

    // Running sessions rewrite ~/.claude.json constantly, so only touch it when
    // the selection needs to change; after that the themes watcher does the rest.
    const configPath = join(paths.home, ".claude.json")
    const current = yield* Files.read(configPath).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Selected))),
      Target.step(name, "read", configPath),
    )
    if (current.theme === SELECTION) return "running sessions reload it live"
    yield* Target.updateJson(name, configPath, (settings) => ({ ...settings, theme: SELECTION }))
    return `selected ${SELECTION}; open sessions switch after /theme or a restart`
  }),
}

export * as ClaudeCode from "./ClaudeCode.ts"
