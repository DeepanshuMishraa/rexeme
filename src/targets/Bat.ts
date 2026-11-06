import { Effect, Option } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Paths } from "../Paths.ts"
import { Shell } from "../Shell.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"
import { TmTheme } from "../TmTheme.ts"

const name = "bat"

export const target: Target.Target = {
  name,
  detect: Target.onPath("bat"),
  apply: Effect.fn("Bat.apply")(function* (palette) {
    const paths = yield* Paths.Service
    const dir = join(paths.config, "bat")
    const themePath = join(dir, "themes", "rex.tmTheme")
    const configPath = join(dir, "config")
    const changed = yield* Files.writeIfChanged(themePath, TmTheme.render(palette)).pipe(Target.step(name, "write", themePath))
    const config = Option.getOrElse(yield* Files.readOptional(configPath).pipe(Target.step(name, "read", configPath)), () => "")
    yield* Files.writeIfChanged(configPath, Text.setLine(config, /^--theme[= ].*$/, `--theme="rex"`)).pipe(
      Target.step(name, "write", configPath),
    )
    if (!changed) return "up to date"
    // bat (and delta) only read themes from its compiled cache.
    const code = yield* Shell.exitCode("bat", ["cache", "--build"]).pipe(Effect.orElseSucceed(() => 1))
    if (code !== 0) {
      return yield* new Target.Failed({
        target: name,
        operation: "rebuild the theme cache for",
        path: themePath,
        reason: `\`bat cache --build\` exited ${code}. The theme file is written; run that command to see why`,
      })
    }
    return "rebuilt bat's theme cache; new runs use it"
  }),
}

export * as Bat from "./Bat.ts"
