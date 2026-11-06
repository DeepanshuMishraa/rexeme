import { Effect } from "effect"
import { join } from "node:path"
import type { Hex } from "../Color.ts"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"

const name = "iterm2"
// Fixed so iTerm2 updates the same profile on every sync instead of adding one.
const GUID = "6f2d1c1e-7e3a-4c55-9a52-7265786d6501"

const component = (hex: Hex) => {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => ((value >> shift) & 0xff) / 255
  return { "Color Space": "sRGB", "Red Component": channel(16), "Green Component": channel(8), "Blue Component": channel(0), "Alpha Component": 1 }
}

/** A dynamic profile, which iTerm2 loads and refreshes live. */
export const render = (p: Palette) => ({
  Profiles: [
    {
      Name: "Rex",
      Guid: GUID,
      "Background Color": component(p.bg),
      "Foreground Color": component(p.fg),
      "Bold Color": component(p.fg),
      "Cursor Color": component(p.cursor),
      "Cursor Text Color": component(p.cursorText),
      "Selection Color": component(p.selection),
      "Selected Text Color": component(p.selectionFg),
      "Link Color": component(p.blue),
      "Badge Color": component(p.accent),
      "Tab Color": component(p.bgDim),
      ...Object.fromEntries(p.ansi.map((color, index) => [`Ansi ${index} Color`, component(color)])),
    },
  ],
})

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.appSupport, "iTerm2"))
  }),
  apply: Effect.fn("ITerm2.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const path = join(paths.appSupport, "iTerm2", "DynamicProfiles", "rex.json")
    yield* Files.writeIfChanged(path, `${JSON.stringify(render(palette), null, 2)}\n`).pipe(Target.step(name, "write", path))
    return `updated the "Rex" profile live; pick it in iTerm2 > Settings > Profiles`
  }),
}

export * as ITerm2 from "./ITerm2.ts"
