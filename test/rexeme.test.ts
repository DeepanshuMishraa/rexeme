import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Option } from "effect"
import { Color } from "../src/Color.ts"
import { Palette } from "../src/Palette.ts"
import { Rex } from "../src/Rex.ts"
import { RexTheme } from "../src/RexTheme.ts"
import { Text } from "../src/Text.ts"

const entry = {
  id: "charcoal-atelier",
  name: "Charcoal Atelier",
  appearance: "dark",
  source: {
    background: "#161616",
    foreground: "#d6d2cc",
    cursor: "#e05d3a",
    cursorText: "#161616",
    selectionBackground: "#3a3835",
    selectionForeground: "#efece7",
    ansi: ["#222222", "#d96a4d", "#9aab84", "#cfae7a", "#8aa0b4", "#b193a8", "#8fafa8", "#b5b1ab",
      "#5f5c58", "#e8886e", "#b3c39d", "#e0c493", "#a4b9cc", "#c8adc0", "#a8c7c0", "#efece7"],
  },
  cssVariables: { "--super-accent": "rgb(230 101 67)", "--super-raised": "38 38 38", "--other": "1 2 3" },
}

describe("Color", () => {
  it("parses Rex's CSS colors", () => {
    expect(Color.parseCss("rgb(230 101 67)")).toEqual(Option.some("#e66543"))
    expect(Color.parseCss("rgb(214 210 204 / 0.04)")).toEqual(Option.some("#d6d2cc"))
    expect(Color.parseCss("38 38 38")).toEqual(Option.some("#262626"))
    expect(Color.parseCss("nope")).toEqual(Option.none())
  })
})

describe("RexTheme", () => {
  it.effect("finds and decodes a catalog entry with its interface colors", () =>
    Effect.gen(function* () {
      const theme = yield* RexTheme.findInCatalog([{ id: "other" }, entry], "charcoal-atelier")
      expect(Option.map(theme, (t) => t.ui)).toEqual(Option.some({ accent: "#e66543", raised: "#262626" }))
      const palette = Palette.fromTheme(Option.getOrThrow(theme))
      expect([palette.bg, palette.accent, palette.surface0, palette.red]).toEqual(["#161616", "#e66543", "#262626", "#d96a4d"])
    }),
  )

  it.effect("returns None for an id that isn't in the catalog", () =>
    Effect.gen(function* () {
      expect(yield* RexTheme.findInCatalog([entry], "custom-theme")).toEqual(Option.none())
    }),
  )

  it.effect("rejects an entry with a short ANSI palette", () =>
    Effect.gen(function* () {
      const broken = { ...entry, source: { ...entry.source, ansi: ["#000000"] } }
      const exit = yield* Effect.exit(RexTheme.findInCatalog([broken], "charcoal-atelier"))
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )
})

describe("Rex appearance", () => {
  it("follows macOS only in system mode", () => {
    expect(Rex.parseAppearanceMode("light")).toBe("light")
    expect(Rex.parseAppearanceMode("")).toBe("system")
    expect(Rex.resolveAppearance("system", "light")).toBe("light")
    expect(Rex.resolveAppearance("dark", "light")).toBe("dark")
    expect(Rex.themeIdFor({ mode: "system", darkThemeId: "d", lightThemeId: "l" }, "light")).toBe("l")
  })
})

describe("Text", () => {
  it("sets key/value lines in place or appends them", () => {
    expect(Text.setKeyValue('a = 1\ncolor_theme = "x"\n', "color_theme", '"y"')).toBe('a = 1\ncolor_theme = "y"\n')
    expect(Text.setKeyValue("a=1\n", "color_scheme", "0", "=")).toBe("a=1\ncolor_scheme=0\n")
  })

  it("sets a TOML value inside its section only", () => {
    const toml = 'theme = "top"\n[tui]\ntheme = "old"\n[other]\ntheme = "keep"\n'
    expect(Text.setTomlValue(toml, "tui", "theme", '"rex"')).toBe('theme = "top"\n[tui]\ntheme = "rex"\n[other]\ntheme = "keep"\n')
    expect(Text.setTomlValue("a = 1\n", "tui", "theme", '"rex"')).toBe('a = 1\n\n[tui]\ntheme = "rex"\n')
  })

  const markers = { begin: "# >>> rexeme >>>", end: "# <<< rexeme <<<" }
  const legacy = [{ begin: "# >>> hued >>>", end: "# <<< hued <<<" }]
  const block = `${markers.begin}\ngui:\n  theme: {}\n${markers.end}\n`

  it.effect("replaces a legacy hued block with rexeme's", () =>
    Effect.gen(function* () {
      const old = "# >>> hued >>>\ngui:\n  theme: old\n# <<< hued <<<\nos:\n  edit: nvim\n"
      expect(yield* Text.replaceYamlBlock(old, block, "gui", markers, legacy)).toBe(`os:\n  edit: nvim\n\n${block}`)
    }),
  )

  it.effect("refuses to add a second top-level gui key", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Text.replaceYamlBlock("gui:\n  nerdFontsVersion: 3\n", block, "gui", markers))
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )
})
