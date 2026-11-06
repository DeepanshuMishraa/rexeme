import { Config, Context, Effect, Layer, Option } from "effect"
import { join } from "node:path"

/** Where each tool keeps its configuration, read once from the environment. */
export interface Interface {
  readonly home: string
  /** $XDG_CONFIG_HOME, or ~/.config. */
  readonly config: string
  /** $CODEX_HOME, or ~/.codex. */
  readonly codex: string
  /** ~/Library/Application Support, where macOS GUI apps keep settings. */
  readonly appSupport: string
  /** REX_APP_PATH overrides where to look for the Rex app. */
  readonly rexApp: Option.Option<string>
}

export class Service extends Context.Service<Service, Interface>()("rexeme/Paths") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const home = yield* Config.String("HOME")
    const config = yield* Config.String("XDG_CONFIG_HOME").pipe(Config.withDefault(join(home, ".config")))
    const codex = yield* Config.String("CODEX_HOME").pipe(Config.withDefault(join(home, ".codex")))
    const rexApp = yield* Config.option(Config.String("REX_APP_PATH"))
    return Service.of({ home, config, codex, appSupport: join(home, "Library", "Application Support"), rexApp })
  }),
)

/** A fixed layout rooted at `home`, for tests. */
export const layerAt = (home: string) =>
  Layer.succeed(
    Service,
    Service.of({
      home,
      config: join(home, ".config"),
      codex: join(home, ".codex"),
      appSupport: join(home, "Library", "Application Support"),
      rexApp: Option.none(),
    }),
  )

export * as Paths from "./Paths.ts"
