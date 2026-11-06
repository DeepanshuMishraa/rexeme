import { Color, type Hex } from "./Color.ts"
import type { RexTheme } from "./RexTheme.ts"

/**
 * The semantic colors every target renders from. Terminal colors come straight
 * from the Rex theme; surfaces, text levels and the accent come from Rex's own
 * interface tokens, so tools look like part of Rex rather than a lookalike.
 */
export interface Palette {
  readonly id: string
  readonly name: string
  readonly appearance: RexTheme.Appearance
  readonly bg: Hex
  /** A step further from `fg` than `bg`: inactive panes, status bars. */
  readonly bgDim: Hex
  /** Popups, menus, cursor line. */
  readonly surface0: Hex
  /** Selected rows, hovered items. */
  readonly surface1: Hex
  readonly border: Hex
  readonly borderStrong: Hex
  readonly fg: Hex
  readonly subtext: Hex
  /** Comments, line numbers, inactive text. */
  readonly muted: Hex
  readonly accent: Hex
  readonly cursor: Hex
  readonly cursorText: Hex
  readonly selection: Hex
  readonly selectionFg: Hex
  readonly red: Hex
  readonly green: Hex
  readonly yellow: Hex
  readonly blue: Hex
  readonly magenta: Hex
  readonly cyan: Hex
  readonly orange: Hex
  readonly error: Hex
  readonly warning: Hex
  readonly success: Hex
  readonly info: Hex
  /** The 16 terminal colors, unchanged. */
  readonly ansi: ReadonlyArray<Hex>
}

const BLACK = Color.Hex.make("#000000")

export const fromTheme = (theme: RexTheme.RexTheme): Palette => {
  const { terminal, ui } = theme
  const ansi = (index: number): Hex => terminal.ansi[index] ?? terminal.foreground
  const bg = terminal.background
  const fg = terminal.foreground
  const red = ansi(1)
  const yellow = ansi(3)
  return {
    id: theme.id,
    name: theme.name,
    appearance: theme.appearance,
    bg,
    bgDim: theme.appearance === "dark" ? Color.mix(bg, BLACK, 0.25) : Color.mix(bg, fg, 0.04),
    surface0: ui.raised ?? Color.mix(bg, fg, 0.08),
    surface1: Color.mix(bg, fg, 0.14),
    border: ui.border ?? Color.mix(bg, fg, 0.18),
    borderStrong: ui["border-strong"] ?? Color.mix(bg, fg, 0.28),
    fg,
    subtext: ui["text-secondary"] ?? Color.mix(fg, bg, 0.35),
    muted: ui["text-tertiary"] ?? Color.mix(fg, bg, 0.5),
    accent: ui.accent ?? ansi(4),
    cursor: terminal.cursor,
    cursorText: terminal.cursorText,
    selection: terminal.selectionBackground,
    selectionFg: terminal.selectionForeground,
    red,
    green: ansi(2),
    yellow,
    blue: ansi(4),
    magenta: ansi(5),
    cyan: ansi(6),
    orange: Color.mix(red, yellow, 0.5),
    error: ui.danger ?? red,
    warning: ui.warning ?? yellow,
    success: ui.success ?? ansi(2),
    info: ui.info ?? ansi(4),
    ansi: terminal.ansi,
  }
}

/** Blends `color` over the background: a tinted surface for diffs and badges. */
export const tint = (palette: Palette, color: Hex, amount: number) => Color.mix(palette.bg, color, amount)

export * as Palette from "./Palette.ts"
