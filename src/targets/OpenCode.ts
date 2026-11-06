import { Effect } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "opencode"

// OpenCode 2.x falls back to its default theme unless every token is present.
export const render = (p: Palette.Palette): Record<string, string> => ({
  primary: p.accent, secondary: p.magenta, accent: p.accent,
  error: p.error, warning: p.warning, success: p.success, info: p.info,
  text: p.fg, textMuted: p.muted, selectedListItemText: p.bg,
  background: p.bg, backgroundPanel: p.bgDim, backgroundElement: p.surface0, backgroundMenu: p.surface0,
  border: p.border, borderActive: p.accent, borderSubtle: p.surface0,
  diffAdded: p.green, diffRemoved: p.red, diffContext: p.muted, diffHunkHeader: p.muted,
  diffHighlightAdded: p.green, diffHighlightRemoved: p.red,
  diffAddedBg: Palette.tint(p, p.green, 0.15), diffRemovedBg: Palette.tint(p, p.red, 0.15),
  diffContextBg: p.bgDim, diffLineNumber: p.muted,
  diffAddedLineNumberBg: Palette.tint(p, p.green, 0.22), diffRemovedLineNumberBg: Palette.tint(p, p.red, 0.22),
  markdownText: p.fg, markdownHeading: p.accent, markdownLink: p.blue, markdownLinkText: p.cyan,
  markdownCode: p.green, markdownBlockQuote: p.yellow, markdownEmph: p.yellow, markdownStrong: p.orange,
  markdownHorizontalRule: p.muted, markdownListItem: p.accent, markdownListEnumeration: p.cyan,
  markdownImage: p.blue, markdownImageText: p.cyan, markdownCodeBlock: p.fg,
  syntaxComment: p.muted, syntaxKeyword: p.magenta, syntaxFunction: p.blue, syntaxVariable: p.fg,
  syntaxString: p.green, syntaxNumber: p.orange, syntaxType: p.yellow, syntaxOperator: p.cyan,
  syntaxPunctuation: p.subtext,
})

export const target: Target.Target = {
  name,
  detect: Target.onPath("opencode"),
  apply: Effect.fn("OpenCode.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const dir = join(paths.config, "opencode")
    const themePath = join(dir, "themes", "rex.json")
    yield* Files.writeIfChanged(themePath, `${JSON.stringify({ theme: render(palette) }, null, 2)}\n`).pipe(
      Target.step(name, "write", themePath),
    )
    // 2.x keeps the selection in cli.json as theme.name; 1.x used tui.json's theme.
    yield* Target.updateJson(name, join(dir, "cli.json"), (settings) => ({
      ...settings,
      theme: { ...Target.objectField(settings, "theme"), name: "rex" },
    }))
    const tui = join(dir, "tui.json")
    if (yield* Target.exists(tui)) yield* Target.updateJson(name, tui, (settings) => ({ ...settings, theme: "rex" }))
    // SIGUSR2 makes running OpenCode clients reload their theme.
    return (yield* Target.reload("opencode", "USR2")) ? "reloaded running sessions" : "applies next launch"
  }),
}

export * as OpenCode from "./OpenCode.ts"
