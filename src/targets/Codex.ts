import { Effect } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { TmTheme } from "../TmTheme.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "codex"

/** Codex draws the rest of its UI with the terminal's ANSI colors, which Rex sets. */
export const render = TmTheme.render

export const target: Target.Target = {
  name,
  detect: Effect.gen(function* () {
    const paths = yield* Paths.Service
    return yield* Target.exists(join(paths.codex, "config.toml"))
  }),
  apply: Effect.fn("Codex.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const themePath = join(paths.codex, "themes", "rex.tmTheme")
    const configPath = join(paths.codex, "config.toml")
    yield* Files.writeIfChanged(themePath, render(palette)).pipe(Target.step(name, "write", themePath))
    const config = yield* Files.read(configPath).pipe(Target.step(name, "read", configPath))
    yield* Files.writeIfChanged(configPath, Text.setTomlValue(config, "tui", "theme", '"rex"')).pipe(
      Target.step(name, "write", configPath),
    )
    return "new sessions use it; running sessions pick it up with /theme"
  }),
}

export * as Codex from "./Codex.ts"
