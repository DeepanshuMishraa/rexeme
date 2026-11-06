import { Effect, Option, Result, Schema } from "effect"
import { Color, Hex } from "./Color.ts"

export const Appearance = Schema.Literals(["dark", "light"])
export type Appearance = typeof Appearance.Type

/** One entry of Rex's bundled themes.json, limited to the fields rexeme reads. */
export const CatalogEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  appearance: Appearance,
  source: Schema.Struct({
    background: Hex,
    foreground: Hex,
    cursor: Hex,
    cursorText: Hex,
    selectionBackground: Hex,
    selectionForeground: Hex,
    ansi: Schema.Array(Hex).check(Schema.isBetweenLength(16, 16)),
  }),
  cssVariables: Schema.Record(Schema.String, Schema.String),
})
export interface CatalogEntry extends Schema.Schema.Type<typeof CatalogEntry> {}

/** The header every catalog entry must have, used for listing without decoding palettes. */
export const Summary = Schema.Struct({ id: Schema.String, name: Schema.String, appearance: Appearance })
export interface Summary extends Schema.Schema.Type<typeof Summary> {}

/** A Rex theme: its terminal palette plus Rex's own interface colors. */
export interface RexTheme {
  readonly id: string
  readonly name: string
  readonly appearance: Appearance
  /** Shipped in Rex's catalog, or made or imported by the user in Rex > Settings > Themes. */
  readonly origin: "built-in" | "custom"
  readonly terminal: CatalogEntry["source"]
  /** Interface colors from the `--super-*` CSS variables, keyed without the prefix. */
  readonly ui: Readonly<Record<string, Hex>>
}

const UI_PREFIX = "--super-"

export const fromEntry = (entry: CatalogEntry): RexTheme => ({
  origin: "built-in",
  id: entry.id,
  name: entry.name,
  appearance: entry.appearance,
  terminal: entry.source,
  ui: Object.fromEntries(
    Object.entries(entry.cssVariables).flatMap(([key, value]) =>
      key.startsWith(UI_PREFIX)
        ? Option.match(Color.parseCss(value), { onNone: () => [], onSome: (hex) => [[key.slice(UI_PREFIX.length), hex]] })
        : [],
    ),
  ),
})

export const decodeEntry = Schema.decodeUnknownEffect(CatalogEntry)
export const decodeSummary = Schema.decodeUnknownOption(Summary)

/** Decodes the catalog entry for `id`, or None when the catalog has no such id. */
export const findInCatalog = Effect.fn("RexTheme.findInCatalog")(function* (catalog: ReadonlyArray<unknown>, id: string) {
  const entry = catalog.find((candidate) => Option.exists(decodeSummary(candidate), (summary) => summary.id === id))
  if (entry === undefined) return Option.none<RexTheme>()
  return Option.some(fromEntry(yield* decodeEntry(entry)))
})

/**
 * A color as Rex for Mac stores it in custom themes: 0–1 channels plus a
 * color space (seen as "srgb"; Display P3 is converted).
 */
export const StoredColor = Schema.Struct({
  red: Schema.Number,
  green: Schema.Number,
  blue: Schema.Number,
  colorSpace: Schema.optionalKey(Schema.String),
})
export interface StoredColor extends Schema.Schema.Type<typeof StoredColor> {}

export const toHex = (color: StoredColor): Hex =>
  /p3/i.test(color.colorSpace ?? "") ? Color.fromDisplayP3(color.red, color.green, color.blue) : Color.fromUnit(color.red, color.green, color.blue)

/**
 * One entry of Rex's `Workspace.customThemes` preference (a JSON array saved
 * as Data): themes the user made, forked or imported. Colors live in
 * `palette`; `source` only records where the theme came from (for example
 * `{ ghosttyFile: { fileName } }`), and `paletteBase` is Rex's generated
 * 256-color extension, which no target needs.
 */
export const CustomEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.optionalKey(Schema.String),
  appearance: Schema.optionalKey(Schema.String),
  palette: Schema.Struct({
    background: StoredColor,
    foreground: StoredColor,
    cursor: Schema.optionalKey(StoredColor),
    cursorText: Schema.optionalKey(StoredColor),
    selectionBackground: Schema.optionalKey(StoredColor),
    selectionForeground: Schema.optionalKey(StoredColor),
    ansi: Schema.Array(StoredColor),
    /** Colors the user changed by hand, keyed by palette index. */
    paletteOverrides: Schema.optionalKey(Schema.Record(Schema.String, StoredColor)),
  }),
})
export interface CustomEntry extends Schema.Schema.Type<typeof CustomEntry> {}

/** The header used to find an entry by id without decoding every theme. */
const CustomId = Schema.Struct({ id: Schema.String })
const decodeCustomId = Schema.decodeUnknownOption(CustomId)

export const decodeCustomEntry = Schema.decodeUnknownResult(CustomEntry)

/** Why one custom theme couldn't be used. Other custom themes still load. */
export class CustomThemeInvalid extends Schema.TaggedError<CustomThemeInvalid>()("RexTheme.CustomThemeInvalid", {
  id: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `Rex's custom theme "${this.id}" can't be used: ${this.reason}. Edit it in Rex > Settings > Themes, or pick another theme. A Rex update may also have changed how custom themes are saved.`
  }
}

/**
 * Custom themes carry no interface tokens. Rex's built-in themes use their
 * cursor as the accent, so a clearly colored cursor becomes the accent;
 * a gray or near-background cursor falls back to ANSI blue.
 */
export const inferAccent = (terminal: CatalogEntry["source"]): Hex => {
  const cursor = terminal.cursor
  const distinct = Math.abs(Color.luminance(cursor) - Color.luminance(terminal.background)) > 0.08
  return Color.chroma(cursor) >= 0.3 && distinct ? cursor : (terminal.ansi[4] ?? terminal.foreground)
}

export const fromCustom = (entry: CustomEntry): Result.Result<RexTheme, CustomThemeInvalid> => {
  const { palette } = entry
  if (palette.ansi.length < 16) {
    return Result.fail(new CustomThemeInvalid({ id: entry.id, reason: `it has ${palette.ansi.length} ANSI colors instead of 16` }))
  }
  const ansi = palette.ansi.slice(0, 16).map((color, index) => toHex(palette.paletteOverrides?.[String(index)] ?? color))
  const bg = toHex(palette.background)
  const fg = toHex(palette.foreground)
  const optional = (color: StoredColor | undefined, fallback: Hex) => (color ? toHex(color) : fallback)
  const appearance: Appearance =
    entry.appearance === "dark" || entry.appearance === "light" ? entry.appearance : Color.luminance(bg) < 0.4 ? "dark" : "light"
  const terminal = {
    background: bg,
    foreground: fg,
    cursor: optional(palette.cursor, fg),
    cursorText: optional(palette.cursorText, bg),
    selectionBackground: optional(palette.selectionBackground, Color.mix(bg, fg, 0.25)),
    selectionForeground: optional(palette.selectionForeground, fg),
    ansi,
  }
  return Result.succeed({
    origin: "custom",
    id: entry.id,
    name: entry.name ?? "Custom theme",
    appearance,
    terminal,
    ui: { accent: inferAccent(terminal) },
  })
}

/** Decodes one stored custom theme, naming it in the error when its shape is wrong. */
export const decodeCustom = (stored: unknown): Result.Result<RexTheme, CustomThemeInvalid> =>
  Result.match(decodeCustomEntry(stored), {
    onFailure: (error) =>
      Result.fail(
        new CustomThemeInvalid({
          id: Option.match(decodeCustomId(stored), { onNone: () => "(no id)", onSome: ({ id }) => id }),
          reason: `its saved data doesn't have the expected shape (${error.message})`,
        }),
      ),
    onSuccess: fromCustom,
  })

/** The id of a stored custom theme, if it has one. */
export const customId = (stored: unknown) => Option.map(decodeCustomId(stored), ({ id }) => id)

export * as RexTheme from "./RexTheme.ts"
