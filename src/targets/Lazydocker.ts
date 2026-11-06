import { Effect, Option } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import type { Palette } from "../Palette.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "lazydocker"
const markers = { begin: "# >>> rexeme >>>", end: "# <<< rexeme <<<" }

export const render = (p: Palette): string =>
  [
    markers.begin,
    "gui:",
    "  theme:",
    `    activeBorderColor: ["${p.accent}", bold]`,
    `    inactiveBorderColor: ["${p.borderStrong}"]`,
    `    selectedLineBgColor: ["${p.surface1}"]`,
    `    optionsTextColor: ["${p.accent}"]`,
    markers.end,
  ].join("\n") + "\n"

// Like lazygit: $XDG_CONFIG_HOME/lazydocker when present, else the macOS default.
const configPath = Effect.fn("Lazydocker.configPath")(function* () {
  const paths = yield* Paths.Service
  const xdg = join(paths.config, "lazydocker", "config.yml")
  return (yield* Target.exists(xdg)) ? xdg : join(paths.appSupport, "lazydocker", "config.yml")
})

export const target: Target.Target = {
  name,
  detect: Target.onPath("lazydocker"),
  apply: Effect.fn("Lazydocker.apply")(function* (palette) {
    const path = yield* configPath()
    const current = yield* Files.readOptional(path).pipe(Target.step(name, "read", path))
    const updated = yield* Text.replaceYamlBlock(Option.getOrElse(current, () => ""), render(palette), "gui", markers).pipe(
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
    return "applies next launch"
  }),
}

export * as Lazydocker from "./Lazydocker.ts"
