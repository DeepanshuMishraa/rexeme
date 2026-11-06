import { Effect } from "effect"
import type { Hex } from "../Color.ts"
import { Processes } from "../Processes.ts"
import { Shell } from "../Shell.ts"
import { Target } from "../Target.ts"

const name = "jankyborders"

const argb = (hex: Hex) => `0xff${hex.slice(1)}`

/** JankyBorders takes new colors from a second `borders` invocation while it runs. */
export const args = (p: { readonly accent: Hex; readonly border: Hex }) => [`active_color=${argb(p.accent)}`, `inactive_color=${argb(p.border)}`]

export const target: Target.Target = {
  name,
  detect: Target.onPath("borders"),
  apply: Effect.fn("Borders.apply")(function* (palette) {
    if ((yield* Processes.pidsNamed("borders")).length === 0) return "not running; colors apply when rexeme next syncs while it runs"
    const code = yield* Shell.exitCode("borders", args(palette)).pipe(Effect.orElseSucceed(() => 1))
    return code === 0 ? "recolored running borders" : "couldn't reach the running borders"
  }),
}

export * as Borders from "./Borders.ts"
