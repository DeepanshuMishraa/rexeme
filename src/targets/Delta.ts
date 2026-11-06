import { Effect } from "effect"
import { Shell } from "../Shell.ts"
import { Target } from "../Target.ts"

const name = "delta"

const gitConfig = (key: string, value: string) =>
  Shell.exitCode("git", ["config", "--global", key, value]).pipe(
    Effect.orElseSucceed(() => 1),
    Effect.flatMap((code) =>
      code === 0
        ? Effect.void
        : Effect.fail(
            new Target.Failed({ target: name, operation: "set", path: "~/.gitconfig", reason: `\`git config --global ${key} ${value}\` exited ${code}` }),
          ),
    ),
  )

/** delta highlights with bat's theme cache, so the bat target supplies the "rex" theme. */
export const target: Target.Target = {
  name,
  detect: Target.onPath("delta"),
  apply: Effect.fn("Delta.apply")(function* (palette) {
    yield* gitConfig("delta.syntax-theme", "rex")
    yield* gitConfig(palette.appearance === "dark" ? "delta.dark" : "delta.light", "true")
    yield* Shell.exitCode("git", ["config", "--global", "--unset", palette.appearance === "dark" ? "delta.light" : "delta.dark"]).pipe(
      Effect.ignore,
    )
    return (yield* Target.onPath("bat")) ? "uses bat's rex theme" : "install bat so delta can load the rex theme"
  }),
}

export * as Delta from "./Delta.ts"
