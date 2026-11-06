import { Effect } from "effect"
import { join } from "node:path"
import type { Hex } from "../Color.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

/**
 * VS Code and its forks. Each keeps a JSONC settings.json under
 * ~/Library/Application Support/<dir>/User and applies setting changes live,
 * so rexeme sets a built-in base theme for Rex's appearance and overrides its
 * colors there, scoped to that base theme so other customizations stay put.
 */
export interface Variant {
  readonly name: string
  /** The folder under Application Support. */
  readonly dir: string
}

export const variants: ReadonlyArray<Variant> = [
  { name: "vscode", dir: "Code" },
  { name: "vscode-insiders", dir: "Code - Insiders" },
  { name: "vscodium", dir: "VSCodium" },
  { name: "cursor", dir: "Cursor" },
  { name: "windsurf", dir: "Windsurf" },
  { name: "antigravity", dir: "Antigravity" },
  { name: "kiro", dir: "Kiro" },
  { name: "trae", dir: "Trae" },
]

export const baseTheme = (p: Palette.Palette) => (p.appearance === "dark" ? "Default Dark Modern" : "Default Light Modern")

const ANSI_NAMES = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"] as const

/** Appends an alpha byte, which VS Code accepts as #rrggbbaa. */
const alpha = (color: Hex, value: string) => `${color}${value}`

export const colors = (p: Palette.Palette): Record<string, string> => ({
  foreground: p.fg,
  descriptionForeground: p.muted,
  errorForeground: p.error,
  focusBorder: p.accent,
  "selection.background": p.selection,
  "widget.border": p.border,
  "widget.shadow": alpha(p.bg, "80"),
  // Buttons, badges, inputs
  "button.background": p.accent,
  "button.foreground": p.bg,
  "button.hoverBackground": p.accent,
  "button.secondaryBackground": p.surface1,
  "button.secondaryForeground": p.fg,
  "badge.background": p.accent,
  "badge.foreground": p.bg,
  "input.background": p.surface0,
  "input.foreground": p.fg,
  "input.border": p.border,
  "input.placeholderForeground": p.muted,
  "inputOption.activeBorder": p.accent,
  "dropdown.background": p.surface0,
  "dropdown.border": p.border,
  "dropdown.foreground": p.fg,
  "checkbox.background": p.surface0,
  "checkbox.border": p.border,
  "progressBar.background": p.accent,
  "textLink.foreground": p.blue,
  "textLink.activeForeground": p.accent,
  // Lists and menus
  "list.activeSelectionBackground": p.surface1,
  "list.activeSelectionForeground": p.fg,
  "list.inactiveSelectionBackground": p.surface0,
  "list.hoverBackground": p.surface0,
  "list.focusOutline": p.accent,
  "list.highlightForeground": p.accent,
  "quickInput.background": p.surface0,
  "quickInputList.focusBackground": p.surface1,
  "menu.background": p.surface0,
  "menu.foreground": p.fg,
  "menu.selectionBackground": p.surface1,
  "menu.border": p.border,
  "scrollbarSlider.background": alpha(p.borderStrong, "60"),
  "scrollbarSlider.hoverBackground": alpha(p.borderStrong, "90"),
  "scrollbarSlider.activeBackground": alpha(p.borderStrong, "c0"),
  // Workbench chrome
  "titleBar.activeBackground": p.bgDim,
  "titleBar.activeForeground": p.fg,
  "titleBar.inactiveBackground": p.bgDim,
  "titleBar.inactiveForeground": p.muted,
  "titleBar.border": p.border,
  "activityBar.background": p.bgDim,
  "activityBar.foreground": p.fg,
  "activityBar.inactiveForeground": p.muted,
  "activityBar.border": p.border,
  "activityBar.activeBorder": p.accent,
  "activityBarBadge.background": p.accent,
  "activityBarBadge.foreground": p.bg,
  "sideBar.background": p.bgDim,
  "sideBar.foreground": p.subtext,
  "sideBar.border": p.border,
  "sideBarTitle.foreground": p.fg,
  "sideBarSectionHeader.background": p.bgDim,
  "sideBarSectionHeader.foreground": p.fg,
  "sideBarSectionHeader.border": p.border,
  "statusBar.background": p.bgDim,
  "statusBar.foreground": p.subtext,
  "statusBar.border": p.border,
  "statusBar.noFolderBackground": p.bgDim,
  "statusBar.debuggingBackground": p.orange,
  "statusBar.debuggingForeground": p.bg,
  "statusBarItem.remoteBackground": p.accent,
  "statusBarItem.remoteForeground": p.bg,
  "panel.background": p.bg,
  "panel.border": p.border,
  "panelTitle.activeBorder": p.accent,
  "panelTitle.activeForeground": p.fg,
  "panelTitle.inactiveForeground": p.muted,
  "editorGroupHeader.tabsBackground": p.bgDim,
  "editorGroupHeader.tabsBorder": p.border,
  "editorGroup.border": p.border,
  "tab.activeBackground": p.bg,
  "tab.activeForeground": p.fg,
  "tab.activeBorderTop": p.accent,
  "tab.inactiveBackground": p.bgDim,
  "tab.inactiveForeground": p.muted,
  "tab.border": p.border,
  "tab.hoverBackground": p.surface0,
  "breadcrumb.foreground": p.muted,
  "breadcrumb.focusForeground": p.fg,
  "notifications.background": p.surface0,
  "notifications.border": p.border,
  "notificationCenterHeader.background": p.surface0,
  // Editor
  "editor.background": p.bg,
  "editor.foreground": p.fg,
  "editorCursor.foreground": p.cursor,
  "editor.selectionBackground": p.selection,
  "editor.selectionForeground": p.selectionFg,
  "editor.inactiveSelectionBackground": alpha(p.selection, "80"),
  "editor.selectionHighlightBackground": alpha(p.selection, "60"),
  "editor.wordHighlightBackground": alpha(p.surface1, "c0"),
  "editor.findMatchBackground": alpha(p.yellow, "60"),
  "editor.findMatchHighlightBackground": alpha(p.yellow, "30"),
  "editor.lineHighlightBackground": p.surface0,
  "editor.lineHighlightBorder": p.surface0,
  "editorLineNumber.foreground": p.muted,
  "editorLineNumber.activeForeground": p.accent,
  "editorIndentGuide.background1": p.border,
  "editorIndentGuide.activeBackground1": p.borderStrong,
  "editorWhitespace.foreground": p.border,
  "editorRuler.foreground": p.border,
  "editorBracketMatch.background": p.surface1,
  "editorBracketMatch.border": p.accent,
  "editorGutter.background": p.bg,
  "editorGutter.addedBackground": p.green,
  "editorGutter.modifiedBackground": p.yellow,
  "editorGutter.deletedBackground": p.red,
  "editorWidget.background": p.surface0,
  "editorWidget.border": p.border,
  "editorSuggestWidget.background": p.surface0,
  "editorSuggestWidget.border": p.border,
  "editorSuggestWidget.selectedBackground": p.surface1,
  "editorSuggestWidget.highlightForeground": p.accent,
  "editorHoverWidget.background": p.surface0,
  "editorHoverWidget.border": p.border,
  "peekView.border": p.accent,
  "peekViewEditor.background": p.bgDim,
  "peekViewResult.background": p.surface0,
  "peekViewTitle.background": p.surface0,
  "minimap.background": p.bg,
  "editorError.foreground": p.error,
  "editorWarning.foreground": p.warning,
  "editorInfo.foreground": p.info,
  "editorHint.foreground": p.cyan,
  "editorInlayHint.foreground": p.muted,
  "editorInlayHint.background": p.surface0,
  // Diffs and git
  "diffEditor.insertedTextBackground": alpha(p.green, "30"),
  "diffEditor.removedTextBackground": alpha(p.red, "30"),
  "diffEditor.insertedLineBackground": alpha(p.green, "18"),
  "diffEditor.removedLineBackground": alpha(p.red, "18"),
  "gitDecoration.addedResourceForeground": p.green,
  "gitDecoration.modifiedResourceForeground": p.yellow,
  "gitDecoration.deletedResourceForeground": p.red,
  "gitDecoration.untrackedResourceForeground": p.green,
  "gitDecoration.ignoredResourceForeground": p.muted,
  "gitDecoration.conflictingResourceForeground": p.orange,
  // Integrated terminal: the same colors as a Rex pane.
  "terminal.background": p.bg,
  "terminal.foreground": p.fg,
  "terminalCursor.foreground": p.cursor,
  "terminal.selectionBackground": p.selection,
  ...Object.fromEntries(
    p.ansi.map((color, index) => [`terminal.ansi${index < 8 ? "" : "Bright"}${ANSI_NAMES[index % 8] ?? "White"}`, color]),
  ),
})

export const tokenRules = (p: Palette.Palette) => {
  const rule = (scope: ReadonlyArray<string>, foreground: Hex, fontStyle?: string) => ({
    scope: [...scope],
    settings: fontStyle ? { foreground, fontStyle } : { foreground },
  })
  return [
    rule(["comment", "punctuation.definition.comment"], p.muted, "italic"),
    rule(["string", "constant.other.symbol"], p.green),
    rule(["constant.numeric", "constant.language", "constant.character", "constant.other"], p.orange),
    rule(["keyword", "keyword.control", "storage", "storage.type", "storage.modifier"], p.magenta),
    rule(["keyword.operator"], p.cyan),
    rule(["entity.name.function", "support.function", "meta.function-call"], p.blue),
    rule(["entity.name.type", "entity.name.class", "support.type", "support.class"], p.yellow),
    rule(["entity.name.tag"], p.red),
    rule(["entity.other.attribute-name"], p.yellow),
    rule(["variable", "variable.parameter", "meta.definition.variable"], p.fg),
    rule(["punctuation"], p.subtext),
    rule(["markup.heading", "entity.name.section"], p.accent, "bold"),
    rule(["markup.underline.link"], p.blue, "underline"),
    rule(["markup.inserted"], p.green),
    rule(["markup.deleted"], p.red),
    rule(["markup.changed"], p.yellow),
  ]
}

export const edits = (p: Palette.Palette): ReadonlyArray<Target.JsoncEdit> => {
  const scope = `[${baseTheme(p)}]`
  return [
    [["workbench.colorTheme"], baseTheme(p)],
    [["workbench.colorCustomizations", scope], colors(p)],
    [["editor.tokenColorCustomizations", scope], { textMateRules: tokenRules(p) }],
  ]
}

export const make = (variant: Variant): Target.Target => {
  const settingsPath = Effect.gen(function* () {
    const paths = yield* Paths.Service
    return join(paths.appSupport, variant.dir, "User", "settings.json")
  })
  return {
    name: variant.name,
    detect: Effect.gen(function* () {
      const paths = yield* Paths.Service
      return yield* Target.exists(join(paths.appSupport, variant.dir, "User"))
    }),
    apply: Effect.fn("VsCode.apply")(function* (palette) {
      const path = yield* settingsPath
      yield* Target.updateJsonc(variant.name, path, edits(palette))
      return `${baseTheme(palette)} with Rex colors; open windows update live`
    }),
  }
}

export const targets = variants.map(make)

export * as VsCode from "./VsCode.ts"
