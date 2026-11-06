import { Effect, Option } from "effect"
import { join } from "node:path"
import { Files } from "../Files.ts"
import { Paths } from "../Paths.ts"
import { Target } from "../Target.ts"
import { Text } from "../Text.ts"

const name = "htop"

/**
 * htop can't load custom colors; its Default scheme (0) draws with the
 * terminal's ANSI palette, which Rex already sets. So rexeme only makes sure
 * that scheme is selected.
 */
export const target: Target.Target = {
  name,
  detect: Target.onPath("htop"),
  apply: Effect.fn("Htop.apply")(function* () {
    const paths = yield* Paths.Service
    const path = join(paths.config, "htop", "htoprc")
    const current = yield* Files.readOptional(path).pipe(Target.step(name, "read", path))
    if (Option.isNone(current)) return "no htoprc; htop's default scheme already uses Rex's terminal colors"
    const changed = yield* Files.writeIfChanged(path, Text.setKeyValue(current.value, "color_scheme", "0", "=")).pipe(
      Target.step(name, "write", path),
    )
    return changed ? "switched to the Default scheme (Rex's terminal colors); restart htop" : "uses Rex's terminal colors"
  }),
}

export * as Htop from "./Htop.ts"
