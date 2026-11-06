import { Effect, Option } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "lazygit"

const markers = { begin: "# >>> rexeme >>>", end: "# <<< rexeme <<<" }
// Earlier names of this tool (`hued`, `rexhue`) wrote the same gui.theme block; rexeme takes it over.
const legacy = [
  { begin: "# >>> hued >>>", end: "# <<< hued <<<" },
  { begin: "# >>> rexhue >>>", end: "# <<< rexhue <<<" },
]

export const render = (p: Palette): string => {
  const entries: ReadonlyArray<readonly [string, string]> = [
    ["activeBorderColor", `["${p.accent}", bold]`],
    ["inactiveBorderColor", `["${p.borderStrong}"]`],
    ["searchingActiveBorderColor", `["${p.yellow}", bold]`],
    ["optionsTextColor", `["${p.accent}"]`],
    ["selectedLineBgColor", `["${p.surface1}"]`],
    ["inactiveViewSelectedLineBgColor", `["${p.surface0}"]`],
    ["cherryPickedCommitFgColor", `["${p.accent}"]`],
    ["cherryPickedCommitBgColor", `["${p.surface1}"]`],
    ["markedBaseCommitFgColor", `["${p.blue}"]`],
    ["markedBaseCommitBgColor", `["${p.yellow}"]`],
    ["unstagedChangesColor", `["${p.red}"]`],
    ["defaultFgColor", `["${p.fg}"]`],
  ]
  return [markers.begin, "gui:", "  theme:", ...entries.map(([key, value]) => `    ${key}: ${value}`), markers.end].join("\n") + "\n"
}

// lazygit reads $XDG_CONFIG_HOME/lazygit when it exists, else its macOS default.
const configPath = Effect.fn("Lazygit.configPath")(function* () {
  const paths = yield* Paths.Service
  const xdg = join(paths.config, "lazygit", "config.yml")
  return (yield* Target.exists(xdg)) ? xdg : join(paths.home, "Library", "Application Support", "lazygit", "config.yml")
})

export const target: Target.Target = {
  name,
  detect: Target.onPath("lazygit"),
  apply: Effect.fn("Lazygit.apply")(function* (palette) {
    const path = yield* configPath()
    const current = yield* Files.readOptional(path).pipe(Target.step(name, "read", path))
    const updated = yield* Text.replaceYamlBlock(Option.getOrElse(current, () => ""), render(palette), "gui", markers, legacy).pipe(
      Effect.mapError(
        () =>
          new Target.Failed({
            target: name,
            operation: "update",
            path,
            reason: `it already has a hand-written top-level \`gui:\` key. Move those settings inside the "${markers.begin}" block (or delete them), then run rexeme sync`,
          }),
      ),
    )
    yield* Files.writeIfChanged(path, updated).pipe(Target.step(name, "write", path))
    return "lazygit reloads it when its window regains focus"
  }),
}

export * as Lazygit from "./Lazygit.ts"
