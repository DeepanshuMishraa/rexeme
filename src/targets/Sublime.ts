import { Effect } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "sublime-text"
const SCHEME = "Rex.sublime-color-scheme"

/** A .sublime-color-scheme. Sublime Text reloads it and its settings live. */
export const render = (p: Palette.Palette) => {
  const rule = (scope: string, foreground: string, font_style?: string) =>
    font_style ? { scope, foreground, font_style } : { scope, foreground }
  return {
    name: "Rex",
    author: "rexeme",
    globals: {
      background: p.bg, foreground: p.fg, caret: p.cursor, invisibles: p.border,
      line_highlight: p.surface0, selection: p.selection, selection_foreground: p.selectionFg,
      gutter: p.bg, gutter_foreground: p.muted, gutter_foreground_highlight: p.accent,
      find_highlight: p.yellow, find_highlight_foreground: p.bg,
      brackets_foreground: p.accent, bracket_contents_foreground: p.accent,
      accent: p.accent, guide: p.border, active_guide: p.borderStrong,
      line_diff_added: p.green, line_diff_modified: p.yellow, line_diff_deleted: p.red,
      popup_css: `html { background-color: ${p.surface0}; color: ${p.fg}; }`,
    },
    rules: [
      rule("comment, punctuation.definition.comment", p.muted, "italic"),
      rule("string, constant.other.symbol", p.green),
      rule("constant.numeric, constant.language, constant.character, constant.other", p.orange),
      rule("keyword, storage, storage.type, storage.modifier", p.magenta),
      rule("keyword.operator", p.cyan),
      rule("entity.name.function, support.function, meta.function-call variable.function", p.blue),
      rule("entity.name.type, entity.name.class, support.type, support.class", p.yellow),
      rule("entity.name.tag", p.red),
      rule("entity.other.attribute-name", p.yellow),
      rule("variable, variable.parameter", p.fg),
      rule("punctuation", p.subtext),
      rule("markup.heading, entity.name.section", p.accent, "bold"),
      rule("markup.underline.link", p.blue, "underline"),
      rule("markup.inserted, diff.inserted", p.green),
      rule("markup.deleted, diff.deleted", p.red),
      rule("markup.changed, diff.changed", p.yellow),
      rule("invalid", p.error),
    ],
  }
}

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.appSupport, "Sublime Text"))
  }),
  apply: Effect.fn("Sublime.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const user = join(paths.appSupport, "Sublime Text", "Packages", "User")
    const schemePath = join(user, SCHEME)
    yield* Files.writeIfChanged(schemePath, `${JSON.stringify(render(palette), null, 2)}\n`).pipe(Target.step(name, "write", schemePath))
    yield* Target.updateJsonc(name, join(user, "Preferences.sublime-settings"), [
      [["color_scheme"], SCHEME],
      [["theme"], palette.appearance === "dark" ? "Default Dark.sublime-theme" : "Default.sublime-theme"],
    ])
    return "reloads live"
  }),
}

export * as Sublime from "./Sublime.ts"
