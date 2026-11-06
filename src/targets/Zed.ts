import { Effect } from "effect"
import { join } from "node:path"
import type { Hex } from "../Color.ts"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "zed"
const THEME = "Rex"

const ANSI_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const

const syntax = (p: Palette.Palette) => {
  const s = (color: Hex, font_style?: "italic", font_weight?: number) => ({ color, font_style: font_style ?? null, font_weight: font_weight ?? null })
  return {
    comment: s(p.muted, "italic"), "comment.doc": s(p.muted, "italic"),
    string: s(p.green), "string.escape": s(p.cyan), "string.regex": s(p.cyan), "string.special": s(p.cyan),
    number: s(p.orange), boolean: s(p.orange), constant: s(p.orange),
    keyword: s(p.magenta), operator: s(p.cyan),
    function: s(p.blue), constructor: s(p.yellow), type: s(p.yellow),
    variable: s(p.fg), "variable.special": s(p.red), property: s(p.fg), attribute: s(p.yellow),
    tag: s(p.red), label: s(p.accent),
    punctuation: s(p.subtext), "punctuation.bracket": s(p.subtext), "punctuation.delimiter": s(p.subtext),
    title: s(p.accent, undefined, 700), link_text: s(p.blue), link_uri: s(p.cyan),
    emphasis: s(p.yellow, "italic"), "emphasis.strong": s(p.orange, undefined, 700),
    "text.literal": s(p.green), preproc: s(p.magenta), embedded: s(p.fg), hint: s(p.muted, "italic"),
  }
}

/** A Zed theme family (schema v0.2.0) with one theme in it. */
export const render = (p: Palette.Palette) => ({
  $schema: "https://zed.dev/schema/themes/v0.2.0.json",
  name: THEME,
  author: "rexeme",
  themes: [
    {
      name: THEME,
      appearance: p.appearance,
      style: {
        background: p.bgDim,
        "surface.background": p.bgDim,
        "elevated_surface.background": p.surface0,
        "panel.background": p.bgDim,
        "panel.focused_border": p.accent,
        border: p.border,
        "border.variant": p.border,
        "border.focused": p.accent,
        "border.selected": p.accent,
        "border.disabled": p.surface1,
        text: p.fg,
        "text.muted": p.subtext,
        "text.placeholder": p.muted,
        "text.disabled": p.muted,
        "text.accent": p.accent,
        icon: p.subtext,
        "icon.muted": p.muted,
        "icon.accent": p.accent,
        "element.background": p.surface0,
        "element.hover": p.surface0,
        "element.active": p.surface1,
        "element.selected": p.surface1,
        "ghost_element.hover": p.surface0,
        "ghost_element.active": p.surface1,
        "ghost_element.selected": p.surface1,
        "drop_target.background": p.surface1,
        "title_bar.background": p.bgDim,
        "title_bar.inactive_background": p.bgDim,
        "status_bar.background": p.bgDim,
        "toolbar.background": p.bg,
        "tab_bar.background": p.bgDim,
        "tab.active_background": p.bg,
        "tab.inactive_background": p.bgDim,
        "search.match_background": `${p.yellow}40`,
        "scrollbar.thumb.background": `${p.borderStrong}60`,
        "scrollbar.thumb.hover_background": `${p.borderStrong}90`,
        "scrollbar.track.background": p.bg,
        "editor.background": p.bg,
        "editor.foreground": p.fg,
        "editor.gutter.background": p.bg,
        "editor.active_line.background": p.surface0,
        "editor.line_number": p.muted,
        "editor.active_line_number": p.accent,
        "editor.indent_guide": p.border,
        "editor.indent_guide_active": p.borderStrong,
        "editor.invisible": p.border,
        "editor.wrap_guide": p.border,
        "editor.document_highlight.read_background": `${p.surface1}c0`,
        "terminal.background": p.bg,
        "terminal.foreground": p.fg,
        "terminal.ansi.background": p.bg,
        ...Object.fromEntries(
          p.ansi.map((color, index) => [`terminal.ansi.${index < 8 ? "" : "bright_"}${ANSI_NAMES[index % 8] ?? "white"}`, color]),
        ),
        error: p.error, "error.background": Palette.tint(p, p.error, 0.12), "error.border": p.error,
        warning: p.warning, "warning.background": Palette.tint(p, p.warning, 0.12), "warning.border": p.warning,
        info: p.info, "info.background": Palette.tint(p, p.info, 0.12), "info.border": p.info,
        success: p.success, "success.background": Palette.tint(p, p.success, 0.12), "success.border": p.success,
        hint: p.cyan, "hint.background": Palette.tint(p, p.cyan, 0.12), "hint.border": p.cyan,
        created: p.green, "created.background": Palette.tint(p, p.green, 0.15),
        deleted: p.red, "deleted.background": Palette.tint(p, p.red, 0.15),
        modified: p.yellow, "modified.background": Palette.tint(p, p.yellow, 0.15),
        conflict: p.orange, ignored: p.muted, hidden: p.muted, renamed: p.blue,
        players: [{ cursor: p.cursor, background: p.cursor, selection: `${p.selection}c0` }],
        syntax: syntax(p),
      },
    },
  ],
})

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.config, "zed"))
  }),
  apply: Effect.fn("Zed.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const themePath = join(paths.config, "zed", "themes", "rex.json")
    yield* Files.writeIfChanged(themePath, `${JSON.stringify(render(palette), null, 2)}\n`).pipe(Target.step(name, "write", themePath))
    // A light/dark theme object is replaced: Rex decides the appearance.
    yield* Target.updateJsonc(name, join(paths.config, "zed", "settings.json"), [[["theme"], THEME]])
    return "Zed reloads its themes folder live"
  }),
}

export * as Zed from "./Zed.ts"
