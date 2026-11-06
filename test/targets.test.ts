import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Option, Result } from "effect"
import { ChildProcessSpawner } from "effect/process"
import * as Jsonc from "jsonc-parser"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Files } from "../src/Files.ts"
import { Stage } from "../src/Stage.ts"
import { Color } from "../src/Color.ts"
import { Palette } from "../src/Palette.ts"
import { Paths } from "../src/Paths.ts"
import { RexTheme } from "../src/RexTheme.ts"
import { Target } from "../src/Target.ts"
import { Text } from "../src/Text.ts"
import { Borders } from "../src/targets/Borders.ts"
import { Fish } from "../src/targets/Fish.ts"
import { JetBrains } from "../src/targets/JetBrains.ts"
import { Starship } from "../src/targets/Starship.ts"
import { Ghostty } from "../src/targets/Ghostty.ts"
import { Vim } from "../src/targets/Vim.ts"
import { VsCode } from "../src/targets/VsCode.ts"
import { Zed } from "../src/targets/Zed.ts"

// Tokyo Night (folke/tokyonight.nvim's Ghostty port) imported through Rex's
// Import Theme File and read back from Workspace.customThemes, minus its
// generated 256-color paletteBase.
const tokyoNight: unknown = JSON.parse(readFileSync(new URL("./fixtures/rex-custom-tokyonight.json", import.meta.url), "utf8"))

const ansi = ["#222222", "#d96a4d", "#9aab84", "#cfae7a", "#8aa0b4", "#b193a8", "#8fafa8", "#b5b1ab",
  "#5f5c58", "#e8886e", "#b3c39d", "#e0c493", "#a4b9cc", "#c8adc0", "#a8c7c0", "#efece7"]

/** A hex color in Rex's stored form. */
const stored = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16)
  return { alpha: 1, colorSpace: "srgb", red: ((value >> 16) & 0xff) / 255, green: ((value >> 8) & 0xff) / 255, blue: (value & 0xff) / 255 }
}

const custom = (palette: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: "custom-0B7C2D1E-0000-4000-8000-000000000001",
  name: "My Theme",
  palette: { background: stored("#101418"), foreground: stored("#e0e0e0"), ansi: ansi.map(stored), ...palette },
  source: { ghosttyFile: { fileName: "my-theme" } },
  ...extra,
})

describe("custom Rex themes", () => {
  it("reads Tokyo Night exactly as Rex saved it", () => {
    const theme = Result.getOrThrow(RexTheme.decodeCustom(tokyoNight))
    expect(theme).toMatchObject({ origin: "custom", name: "tokyonight_night", appearance: "dark" })
    expect(theme.terminal).toMatchObject({
      background: "#1a1b26",
      foreground: "#c0caf5",
      cursor: "#c0caf5",
      selectionBackground: "#283457",
    })
    expect(theme.terminal.ansi).toEqual([
      "#15161e", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#a9b1d6",
      "#414868", "#ff899d", "#9fe044", "#faba4a", "#8db0ff", "#c7a9ff", "#a4daff", "#c0caf5",
    ])
    // Its cursor is the pale foreground, so the accent is its blue.
    expect(Palette.fromTheme(theme).accent).toBe("#7aa2f7")
  })

  it("uses a clearly colored cursor as the accent", () => {
    const theme = Result.getOrThrow(RexTheme.decodeCustom(custom({ cursor: stored("#ff8800") })))
    expect(Palette.fromTheme(theme).accent).toBe("#ff8800")
    expect(theme.terminal.cursorText).toBe("#101418")
  })

  it("applies hand-edited ANSI colors and infers light themes", () => {
    const theme = Result.getOrThrow(
      RexTheme.decodeCustom(
        custom({ background: stored("#fafafa"), foreground: stored("#202020"), paletteOverrides: { "1": stored("#ff0000") } }),
      ),
    )
    expect(theme.appearance).toBe("light")
    expect(theme.terminal.ansi[1]).toBe("#ff0000")
  })

  it("converts Display P3 colors to sRGB", () => {
    expect(RexTheme.toHex({ red: 0.5, green: 0.5, blue: 0.5, colorSpace: "displayP3" })).toBe("#808080")
    expect(RexTheme.toHex({ red: 1, green: 0, blue: 0, colorSpace: "displayP3" })).toBe("#ff0000")
    expect(Color.fromUnit(1, 0.5, 0)).toBe("#ff8000")
  })

  it("names the theme when it can't be used", () => {
    const short = RexTheme.decodeCustom(custom({ ansi: [stored("#000000")] }))
    expect(Result.isFailure(short) && short.failure.message).toContain("1 ANSI colors instead of 16")
    const broken = RexTheme.decodeCustom({ id: "custom-broken", palette: { background: "#000000" } })
    expect(Result.isFailure(broken) && broken.failure.message).toContain('"custom-broken"')
  })
})

const palette = Palette.fromTheme(Result.getOrThrow(RexTheme.decodeCustom(custom({ cursor: stored("#ff8800") }))))

describe("Target.editJsonc", () => {
  it("sets nested keys and keeps the user's comments", () => {
    const text = '{\n  // my font\n  "editor.fontSize": 14,\n}\n'
    const updated = Result.getOrThrow(Target.editJsonc(text, [[["workbench.colorTheme"], "X"], [["a", "[b]"], { c: 1 }]]))
    expect(updated).toContain("// my font")
    expect(Jsonc.parse(updated)).toEqual({ "editor.fontSize": 14, "workbench.colorTheme": "X", a: { "[b]": { c: 1 } } })
  })

  it("refuses files that aren't JSONC objects", () => {
    expect(Result.isFailure(Target.editJsonc("{ nope", []))).toBe(true)
    expect(Result.isFailure(Target.editJsonc("[]", []))).toBe(true)
  })
})

describe("Text", () => {
  it("sets top-level TOML keys above the first section", () => {
    expect(Text.setTomlTopLevel('[editor]\ntheme = "x"\n', "theme", '"rex"')).toBe('theme = "rex"\n[editor]\ntheme = "x"\n')
    expect(Text.setTomlTopLevel('theme = "old"\n[editor]\n', "theme", '"rex"')).toBe('theme = "rex"\n[editor]\n')
    expect(Text.setTomlTopLevel("", "theme", '"rex"')).toBe('theme = "rex"\n')
  })

  it("replaces or appends a whole line", () => {
    expect(Text.setLine('a\ntheme "old"\n', /^theme\s+"[^"]*"$/, 'theme "rex"')).toBe('a\ntheme "rex"\n')
    expect(Text.setLine("a\n", /^theme .*$/, 'theme "rex"')).toBe('a\ntheme "rex"\n')
  })
})

describe("renderers", () => {
  it("VS Code scopes its overrides to the base theme it selects", () => {
    const edits = VsCode.edits(palette)
    expect(edits[0]).toEqual([["workbench.colorTheme"], "Default Dark Modern"])
    expect(edits[1]?.[0]).toEqual(["workbench.colorCustomizations", "[Default Dark Modern]"])
    expect(edits[1]?.[1]).toMatchObject({ "editor.background": "#101418", "terminal.ansiBrightWhite": ansi[15] })
  })

  it("Zed sets all 16 terminal colors", () => {
    expect(Zed.render(palette).themes[0]?.style).toMatchObject({
      "terminal.ansi.bright_white": ansi[15],
      "terminal.ansi.black": ansi[0],
    })
  })

  it("Ghostty and fish write every color", () => {
    expect(Ghostty.render(palette)).toContain(`palette = 15=${ansi[15]}`)
    expect(Fish.script(palette)).toContain("set -U fish_color_command 8aa0b4")
  })

  it("Vim skips Neovim-only groups", () => {
    const vim = Vim.render(palette)
    expect(vim).toContain("hi Normal guifg=#e0e0e0 guibg=#101418")
    expect(vim).not.toContain("@")
    expect(Option.isSome(Option.fromNullishOr(/hi! link \w+ \w+/.exec(vim)))).toBe(true)
  })
})

// Staging only touches files synchronously; spawning in a test would be a bug.
const TestEnv = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(() => Effect.die("spawned a process in a test"))),
  Paths.layerAt(tmpdir()),
)

describe("Stage", () => {
  const fixture = () => {
    const dir = mkdtempSync(join(tmpdir(), "rexeme-stage-"))
    const config = join(dir, "app", "theme.conf")
    mkdirSync(join(dir, "app"))
    writeFileSync(config, "old\n")
    const target: Target.Target = {
      name: "fake",
      detect: Effect.succeed(true),
      apply: (p) => Files.writeIfChanged(config, `bg=${p.bg}\n`).pipe(Effect.as("ok"), Target.step("fake", "write", config)),
    }
    return { dir, config, target }
  }

  it.effect("swaps staged files in on commit", () =>
    Effect.gen(function* () {
      const { dir, config, target } = fixture()
      const staged = yield* Stage.prepare("t", palette, [target], join(dir, "staged"))
      // Recording wrote nothing yet.
      expect(readFileSync(config, "utf8")).toBe("old\n")
      const result = yield* Stage.commit(staged)
      expect(result.committed.map(({ plan }) => plan.target.name)).toEqual(["fake"])
      expect(readFileSync(config, "utf8")).toBe(`bg=${palette.bg}\n`)
    }).pipe(Effect.provide(TestEnv)),
  )

  it.effect("never overwrites a config edited after staging", () =>
    Effect.gen(function* () {
      const { dir, config, target } = fixture()
      const staged = yield* Stage.prepare("t", palette, [target], join(dir, "staged"))
      writeFileSync(config, "edited by hand\n")
      const result = yield* Stage.commit(staged)
      expect(result.stale.map((t) => t.name)).toEqual(["fake"])
      expect(readFileSync(config, "utf8")).toBe("edited by hand\n")
    }).pipe(Effect.provide(TestEnv)),
  )
})

describe("new targets", () => {
  it("Starship selects a palette above the first section and fills it", () => {
    const updated = Starship.colors(palette).reduce(
      (text, [key, value]) => Text.setTomlValue(text, "palettes.rex", key, `"${value}"`),
      Text.setTomlTopLevel('add_newline = false\n[git_branch]\nstyle = "bold purple"\n', "palette", '"rex"'),
    )
    expect(updated.indexOf('palette = "rex"')).toBeLessThan(updated.indexOf("[git_branch]"))
    expect(updated).toContain(`purple = "${palette.magenta}"`)
  })

  it("JetBrains builds on Darcula for dark themes", () => {
    expect(JetBrains.render(palette)).toContain('parent_scheme="Darcula"')
    expect(JetBrains.render(palette)).toContain(`<option name="CONSOLE_WHITE_OUTPUT">`)
  })

  it("JankyBorders gets ARGB colors", () => {
    expect(Borders.args(palette)).toEqual([`active_color=0xff${palette.accent.slice(1)}`, `inactive_color=0xff${palette.border.slice(1)}`])
  })
})
