import { Effect } from "effect"
import type { Hex } from "../Color.ts"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "neovim"

export type Style = {
  readonly fg?: string
  readonly bg?: string
  readonly sp?: string
  readonly bold?: true
  readonly italic?: true
  readonly underline?: true
  readonly undercurl?: true
  readonly strikethrough?: true
  readonly link?: string
}

export const highlights = (p: Palette.Palette): ReadonlyArray<readonly [string, Style]> => {
  const diff = (color: Hex, amount: number) => Palette.tint(p, color, amount)
  return [
    // Editor
    ["Normal", { fg: p.fg, bg: p.bg }],
    ["NormalNC", { fg: p.fg, bg: p.bg }],
    ["NormalFloat", { fg: p.fg, bg: p.surface0 }],
    ["FloatBorder", { fg: p.borderStrong, bg: p.surface0 }],
    ["FloatTitle", { fg: p.accent, bg: p.surface0, bold: true }],
    ["Cursor", { fg: p.cursorText, bg: p.cursor }],
    ["TermCursor", { fg: p.cursorText, bg: p.cursor }],
    ["CursorLine", { bg: p.surface0 }],
    ["CursorColumn", { bg: p.surface0 }],
    ["ColorColumn", { bg: p.surface0 }],
    ["CursorLineNr", { fg: p.accent, bold: true }],
    ["LineNr", { fg: p.muted }],
    ["SignColumn", { bg: p.bg }],
    ["FoldColumn", { fg: p.muted, bg: p.bg }],
    ["Folded", { fg: p.subtext, bg: p.surface0 }],
    ["WinSeparator", { fg: p.border }],
    ["VertSplit", { link: "WinSeparator" }],
    ["StatusLine", { fg: p.fg, bg: p.surface0 }],
    ["StatusLineNC", { fg: p.muted, bg: p.bgDim }],
    ["TabLine", { fg: p.muted, bg: p.bgDim }],
    ["TabLineFill", { bg: p.bgDim }],
    ["TabLineSel", { fg: p.fg, bg: p.bg, bold: true }],
    ["WinBar", { fg: p.subtext }],
    ["WinBarNC", { fg: p.muted }],
    ["Visual", { fg: p.selectionFg, bg: p.selection }],
    ["Search", { fg: p.bg, bg: p.yellow }],
    ["IncSearch", { fg: p.bg, bg: p.accent }],
    ["CurSearch", { link: "IncSearch" }],
    ["Substitute", { fg: p.bg, bg: p.red }],
    ["MatchParen", { fg: p.accent, bold: true, underline: true }],
    ["Pmenu", { fg: p.fg, bg: p.surface0 }],
    ["PmenuSel", { fg: p.fg, bg: p.surface1, bold: true }],
    ["PmenuSbar", { bg: p.surface0 }],
    ["PmenuThumb", { bg: p.borderStrong }],
    ["NonText", { fg: p.border }],
    ["Whitespace", { fg: p.border }],
    ["EndOfBuffer", { fg: p.bg }],
    ["SpecialKey", { fg: p.muted }],
    ["Directory", { fg: p.blue }],
    ["Title", { fg: p.accent, bold: true }],
    ["Question", { fg: p.blue }],
    ["MoreMsg", { fg: p.green }],
    ["ModeMsg", { fg: p.fg, bold: true }],
    ["ErrorMsg", { fg: p.error }],
    ["WarningMsg", { fg: p.warning }],
    ["WildMenu", { link: "PmenuSel" }],
    ["QuickFixLine", { bg: p.surface1, bold: true }],
    ["SpellBad", { sp: p.error, undercurl: true }],
    ["SpellCap", { sp: p.warning, undercurl: true }],
    ["SpellLocal", { sp: p.info, undercurl: true }],
    ["SpellRare", { sp: p.magenta, undercurl: true }],
    // Syntax
    ["Comment", { fg: p.muted, italic: true }],
    ["Constant", { fg: p.orange }],
    ["String", { fg: p.green }],
    ["Character", { fg: p.green }],
    ["Number", { fg: p.orange }],
    ["Boolean", { fg: p.orange }],
    ["Float", { fg: p.orange }],
    ["Identifier", { fg: p.fg }],
    ["Function", { fg: p.blue }],
    ["Statement", { fg: p.magenta }],
    ["Keyword", { fg: p.magenta }],
    ["Conditional", { fg: p.magenta }],
    ["Repeat", { fg: p.magenta }],
    ["Label", { fg: p.magenta }],
    ["Exception", { fg: p.magenta }],
    ["Operator", { fg: p.cyan }],
    ["PreProc", { fg: p.yellow }],
    ["Include", { fg: p.magenta }],
    ["Define", { fg: p.magenta }],
    ["Macro", { fg: p.yellow }],
    ["Type", { fg: p.yellow }],
    ["StorageClass", { fg: p.magenta }],
    ["Structure", { fg: p.yellow }],
    ["Typedef", { fg: p.yellow }],
    ["Special", { fg: p.cyan }],
    ["SpecialChar", { fg: p.cyan }],
    ["Tag", { fg: p.red }],
    ["Delimiter", { fg: p.subtext }],
    ["SpecialComment", { fg: p.subtext, italic: true }],
    ["Debug", { fg: p.red }],
    ["Underlined", { underline: true }],
    ["Error", { fg: p.error }],
    ["Todo", { fg: p.bg, bg: p.accent, bold: true }],
    // Treesitter and LSP
    ["@variable", { fg: p.fg }],
    ["@variable.builtin", { fg: p.red }],
    ["@variable.parameter", { fg: p.fg, italic: true }],
    ["@variable.member", { fg: p.cyan }],
    ["@property", { fg: p.cyan }],
    ["@constant", { link: "Constant" }],
    ["@constant.builtin", { fg: p.orange }],
    ["@module", { fg: p.yellow }],
    ["@string", { link: "String" }],
    ["@string.escape", { fg: p.cyan }],
    ["@string.special", { fg: p.cyan }],
    ["@string.regexp", { fg: p.cyan }],
    ["@character", { link: "Character" }],
    ["@number", { link: "Number" }],
    ["@boolean", { link: "Boolean" }],
    ["@type", { link: "Type" }],
    ["@type.builtin", { fg: p.yellow, italic: true }],
    ["@attribute", { fg: p.yellow }],
    ["@function", { link: "Function" }],
    ["@function.builtin", { fg: p.blue, italic: true }],
    ["@function.method", { fg: p.blue }],
    ["@constructor", { fg: p.yellow }],
    ["@operator", { link: "Operator" }],
    ["@keyword", { link: "Keyword" }],
    ["@keyword.return", { fg: p.magenta, italic: true }],
    ["@punctuation", { fg: p.subtext }],
    ["@punctuation.bracket", { fg: p.subtext }],
    ["@punctuation.delimiter", { fg: p.subtext }],
    ["@comment", { link: "Comment" }],
    ["@tag", { fg: p.red }],
    ["@tag.attribute", { fg: p.yellow, italic: true }],
    ["@tag.delimiter", { fg: p.subtext }],
    ["@markup.heading", { fg: p.accent, bold: true }],
    ["@markup.strong", { bold: true }],
    ["@markup.italic", { italic: true }],
    ["@markup.strikethrough", { strikethrough: true }],
    ["@markup.link", { fg: p.blue, underline: true }],
    ["@markup.link.url", { fg: p.blue, underline: true }],
    ["@markup.raw", { fg: p.green }],
    ["@markup.list", { fg: p.accent }],
    ["@markup.quote", { fg: p.subtext, italic: true }],
    ["@diff.plus", { fg: p.green }],
    ["@diff.minus", { fg: p.red }],
    ["@diff.delta", { fg: p.yellow }],
    ["LspReferenceText", { bg: p.surface1 }],
    ["LspReferenceRead", { bg: p.surface1 }],
    ["LspReferenceWrite", { bg: p.surface1, bold: true }],
    ["LspInlayHint", { fg: p.muted, italic: true }],
    // Diagnostics
    ["DiagnosticError", { fg: p.error }],
    ["DiagnosticWarn", { fg: p.warning }],
    ["DiagnosticInfo", { fg: p.info }],
    ["DiagnosticHint", { fg: p.cyan }],
    ["DiagnosticOk", { fg: p.success }],
    ["DiagnosticVirtualTextError", { fg: p.error, bg: diff(p.error, 0.1) }],
    ["DiagnosticVirtualTextWarn", { fg: p.warning, bg: diff(p.warning, 0.1) }],
    ["DiagnosticVirtualTextInfo", { fg: p.info, bg: diff(p.info, 0.1) }],
    ["DiagnosticVirtualTextHint", { fg: p.cyan, bg: diff(p.cyan, 0.1) }],
    ["DiagnosticUnderlineError", { sp: p.error, undercurl: true }],
    ["DiagnosticUnderlineWarn", { sp: p.warning, undercurl: true }],
    ["DiagnosticUnderlineInfo", { sp: p.info, undercurl: true }],
    ["DiagnosticUnderlineHint", { sp: p.cyan, undercurl: true }],
    // Diffs and git
    ["DiffAdd", { bg: diff(p.green, 0.18) }],
    ["DiffChange", { bg: diff(p.yellow, 0.12) }],
    ["DiffDelete", { fg: p.red, bg: diff(p.red, 0.18) }],
    ["DiffText", { bg: diff(p.yellow, 0.3) }],
    ["Added", { fg: p.green }],
    ["Changed", { fg: p.yellow }],
    ["Removed", { fg: p.red }],
    ["GitSignsAdd", { fg: p.green }],
    ["GitSignsChange", { fg: p.yellow }],
    ["GitSignsDelete", { fg: p.red }],
    // Common plugins
    ["TelescopeNormal", { link: "NormalFloat" }],
    ["TelescopeBorder", { link: "FloatBorder" }],
    ["TelescopeTitle", { link: "FloatTitle" }],
    ["TelescopeSelection", { link: "PmenuSel" }],
    ["TelescopeMatching", { fg: p.accent, bold: true }],
    ["SnacksPickerMatch", { fg: p.accent, bold: true }],
    ["WhichKey", { fg: p.accent }],
    ["WhichKeyDesc", { fg: p.fg }],
    ["WhichKeyGroup", { fg: p.blue }],
    ["IblIndent", { fg: p.border }],
    ["IblScope", { fg: p.borderStrong }],
    ["NeoTreeNormal", { fg: p.fg, bg: p.bgDim }],
    ["NeoTreeNormalNC", { fg: p.fg, bg: p.bgDim }],
    ["NvimTreeNormal", { fg: p.fg, bg: p.bgDim }],
    ["MiniStatuslineModeNormal", { fg: p.bg, bg: p.accent, bold: true }],
  ]
}

const luaValue = (value: string | true) => (value === true ? "true" : JSON.stringify(value))

export const renderColorscheme = (p: Palette.Palette): string => {
  const lines = [
    `-- Generated by rexeme from Rex's "${p.name}" theme. Changes are overwritten on the next sync.`,
    `vim.cmd("highlight clear")`,
    `if vim.fn.exists("syntax_on") == 1 then vim.cmd("syntax reset") end`,
    `vim.o.termguicolors = true`,
    `vim.o.background = ${JSON.stringify(p.appearance)}`,
    `vim.g.colors_name = "rex"`,
    "",
    ...p.ansi.map((color, index) => `vim.g.terminal_color_${index} = ${JSON.stringify(color)}`),
    "",
    "local hl = vim.api.nvim_set_hl",
    ...highlights(p).map(([group, style]) => {
      const fields = Object.entries(style).map(([key, value]) => `${key} = ${luaValue(value)}`)
      return `hl(0, ${JSON.stringify(group)}, { ${fields.join(", ")} })`
    }),
  ]
  return lines.join("\n") + "\n"
}

/** Selects the colorscheme on startup and reapplies it whenever rexeme rewrites it. */
export const PLUGIN = `-- Generated by rexeme. Uses the "rex" colorscheme and reloads it live when Rex's theme changes.
-- Delete this file to stop Neovim following Rex.
if vim.g.rexeme_loaded then return end
vim.g.rexeme_loaded = true

local path = vim.fn.stdpath("config") .. "/colors/rex.lua"

local function apply()
  if not vim.uv.fs_stat(path) then return end
  local ok, err = pcall(vim.cmd.colorscheme, "rex")
  if not ok then vim.notify("rexeme: couldn't load the rex colorscheme: " .. tostring(err), vim.log.levels.ERROR) end
end

apply()
-- Plugins configured later in startup may pick another colorscheme; Rex wins.
vim.api.nvim_create_autocmd("VimEnter", { once = true, callback = apply })

local watcher, timer = vim.uv.new_fs_event(), vim.uv.new_timer()
if watcher and timer then
  watcher:start(vim.fs.dirname(path), {}, function(err, filename)
    if err or filename ~= "rex.lua" then return end
    timer:stop()
    timer:start(10, 0, vim.schedule_wrap(apply))
  end)
end
`

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.config, "nvim"))
  }),
  apply: Effect.fn("Neovim.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const colors = join(paths.config, "nvim", "colors", "rex.lua")
    const plugin = join(paths.config, "nvim", "plugin", "rexeme.lua")
    yield* Files.writeIfChanged(plugin, PLUGIN).pipe(Target.step(name, "write", plugin))
    // Under its old name this tool wrote plugin/rexhue.lua; two watchers would reload twice.
    const legacy = join(paths.config, "nvim", "plugin", "rexhue.lua")
    yield* Files.removeIfExists(legacy).pipe(Target.step(name, "remove", legacy))
    yield* Files.writeIfChanged(colors, renderColorscheme(palette)).pipe(Target.step(name, "write", colors))
    return "running Neovim reloads it live"
  }),
}

export * as Neovim from "./Neovim.ts"
