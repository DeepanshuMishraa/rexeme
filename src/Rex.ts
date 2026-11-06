import { Context, Effect, FileSystem, Layer, Option, Result, Schema } from "effect"
import { ChildProcessSpawner } from "effect/process"
import { join } from "node:path"
import { Paths } from "./Paths.ts"
import { Prefs } from "./Prefs.ts"
import { RexTheme } from "./RexTheme.ts"
import { Shell } from "./Shell.ts"

export const DEFAULTS_DOMAIN = "com.superlogical.rex"
const CATALOG_IN_APP = "Contents/Resources/SuperUI_SuperDesignTokens.bundle/Contents/Resources/themes.json"

/** Rex's Settings > Themes choice: a fixed appearance, or follow macOS. */
export type AppearanceMode = RexTheme.Appearance | "system"

export interface Selection {
  readonly mode: AppearanceMode
  readonly darkThemeId: string
  readonly lightThemeId: string
}

/** The theme Rex is showing right now, and why. */
export interface Active {
  readonly selection: Selection
  readonly appearance: RexTheme.Appearance
  readonly theme: RexTheme.RexTheme
}

export class AppNotFound extends Schema.TaggedError<AppNotFound>()("Rex.AppNotFound", {
  searched: Schema.Array(Schema.String),
}) {
  override get message() {
    return `Couldn't find the Rex app. Looked in ${this.searched.join(", ")} and asked Spotlight. Set REX_APP_PATH to Rex's .app path and try again.`
  }
}

export class CatalogUnreadable extends Schema.TaggedError<CatalogUnreadable>()("Rex.CatalogUnreadable", {
  path: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `Couldn't read Rex's theme catalog at ${this.path}: ${this.reason}. A Rex update may have changed its format. No tool configs were changed.`
  }
}

export class SelectionMissing extends Schema.TaggedError<SelectionMissing>()("Rex.SelectionMissing", {}) {
  override get message() {
    return `Rex hasn't saved a theme choice yet (no Workspace.darkThemeID/lightThemeID in ${DEFAULTS_DOMAIN}). Pick a theme once in Rex > Settings > Themes, then run rexeme again.`
  }
}

export class ThemeUnsupported extends Schema.TaggedError<ThemeUnsupported>()("Rex.ThemeUnsupported", {
  id: Schema.String,
}) {
  override get message() {
    return `Rex's selected theme "${this.id}" isn't in Rex's built-in catalog or its saved custom themes (${CUSTOM_THEMES_KEY}). If you just created it, save it in Rex > Settings > Themes and rexeme picks it up. Your tools keep their current colors.`
  }
}

export class CustomThemesUnreadable extends Schema.TaggedError<CustomThemesUnreadable>()("Rex.CustomThemesUnreadable", {
  reason: Schema.String,
}) {
  override get message() {
    return `Couldn't read Rex's custom themes (${DEFAULTS_DOMAIN} ${CUSTOM_THEMES_KEY}): ${this.reason}. A Rex update may have changed how they're stored. Built-in themes still sync; no tool configs were changed for this theme.`
  }
}

export type RexError =
  | AppNotFound
  | CatalogUnreadable
  | SelectionMissing
  | ThemeUnsupported
  | CustomThemesUnreadable
  | RexTheme.CustomThemeInvalid

/** Where Rex for Mac saves themes the user made or imported. */
export const CUSTOM_THEMES_KEY = "Workspace.customThemes"

/** A theme as listed by `rexeme themes`. */
export interface Listed extends RexTheme.Summary {
  readonly origin: RexTheme.RexTheme["origin"]
}

export const parseAppearanceMode = (value: string): AppearanceMode =>
  value === "dark" || value === "light" ? value : "system"

export const resolveAppearance = (mode: AppearanceMode, system: RexTheme.Appearance): RexTheme.Appearance =>
  mode === "system" ? system : mode

export const themeIdFor = (selection: Selection, appearance: RexTheme.Appearance) =>
  appearance === "dark" ? selection.darkThemeId : selection.lightThemeId

export interface Interface {
  /** Rex's saved theme choice. */
  readonly selection: () => Effect.Effect<Selection, SelectionMissing>
  /** macOS's current appearance, used when Rex follows the system. */
  readonly systemAppearance: () => Effect.Effect<RexTheme.Appearance>
  /** Every built-in theme, then every usable custom theme, for listing. */
  readonly themes: () => Effect.Effect<ReadonlyArray<Listed>, AppNotFound | CatalogUnreadable | CustomThemesUnreadable>
  /** Changes whenever the user adds, edits or removes a custom theme. */
  readonly customFingerprint: () => Effect.Effect<string>
  /** A built-in theme with its palette. */
  readonly theme: (id: string) => Effect.Effect<RexTheme.RexTheme, RexError>
  /** The theme Rex is showing right now. */
  readonly active: () => Effect.Effect<Active, RexError>
}

export class Service extends Context.Service<Service, Interface>()("rexeme/Rex") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const paths = yield* Paths.Service
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const shell = <A, E>(effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>) =>
      Effect.provideService(effect, ChildProcessSpawner.ChildProcessSpawner, spawner)

    const prefs = yield* Prefs.Service
    const readDefault = (key: string, domain = DEFAULTS_DOMAIN) =>
      prefs.string(domain, key).pipe(Effect.map(Option.getOrElse(() => "")))

    const findApp = Effect.fn("Rex.findApp")(function* () {
      const candidates = Option.match(paths.rexApp, {
        onSome: (path) => [path],
        onNone: () =>
          ["Rex Beta.app", "Rex.app"].flatMap((name) => [join("/Applications", name), join(paths.home, "Applications", name)]),
      })
      for (const candidate of candidates) {
        if (yield* fs.exists(join(candidate, CATALOG_IN_APP)).pipe(Effect.orElseSucceed(() => false))) return candidate
      }
      if (Option.isNone(paths.rexApp)) {
        const found = yield* shell(Shell.output("/usr/bin/mdfind", [`kMDItemCFBundleIdentifier == "${DEFAULTS_DOMAIN}"`])).pipe(
          Effect.orElseSucceed(() => ""),
        )
        for (const candidate of found.split("\n").filter((line) => line !== "")) {
          if (yield* fs.exists(join(candidate, CATALOG_IN_APP)).pipe(Effect.orElseSucceed(() => false))) return candidate
        }
      }
      return yield* new AppNotFound({ searched: candidates })
    })

    // The catalog ships inside the app and only changes when Rex updates, so
    // it is read once per path for the life of the process.
    const loadCatalog = Effect.fn("Rex.loadCatalog")(function* () {
      const path = join(yield* findApp(), CATALOG_IN_APP)
      const text = yield* fs
        .readFileString(path)
        .pipe(Effect.mapError((error) => new CatalogUnreadable({ path, reason: error.message })))
      const parsed = yield* Effect.try({
        try: (): unknown => JSON.parse(text),
        catch: (error) => new CatalogUnreadable({ path, reason: `invalid JSON (${String(error)})` }),
      })
      if (!Array.isArray(parsed)) return yield* new CatalogUnreadable({ path, reason: "expected a JSON array of themes" })
      const entries: ReadonlyArray<unknown> = parsed
      return { path, entries }
    })
    const catalog = yield* Effect.cached(loadCatalog())

    const selection = Effect.fn("Rex.selection")(function* () {
      const [darkThemeId, lightThemeId, mode] = yield* Effect.all(
        [readDefault("Workspace.darkThemeID"), readDefault("Workspace.lightThemeID"), readDefault("Workspace.appearance")],
        { concurrency: "unbounded" },
      )
      if (darkThemeId === "" || lightThemeId === "") return yield* new SelectionMissing()
      return { mode: parseAppearanceMode(mode), darkThemeId, lightThemeId }
    })

    const systemAppearance = Effect.fn("Rex.systemAppearance")(function* () {
      // AppleInterfaceStyle exists only in dark mode.
      const style = yield* readDefault("AppleInterfaceStyle", Prefs.GLOBAL)
      return style === "Dark" ? ("dark" as const) : ("light" as const)
    })

    // Rex for Mac saves custom themes as a JSON array in a Data preference.
    // Read on demand (it's small), so a theme saved a moment ago is found.
    const customEntries = Effect.fn("Rex.customEntries")(function* () {
      const stored = yield* prefs.value(DEFAULTS_DOMAIN, CUSTOM_THEMES_KEY)
      if (Option.isNone(stored)) return []
      if (stored.value._tag !== "Data") {
        return yield* new CustomThemesUnreadable({ reason: "expected JSON data, found another kind of preference value" })
      }
      const text = new TextDecoder().decode(stored.value.bytes)
      const parsed = yield* Effect.try({
        try: (): unknown => JSON.parse(text),
        catch: (error) => new CustomThemesUnreadable({ reason: `invalid JSON (${String(error)})` }),
      })
      if (!Array.isArray(parsed)) return yield* new CustomThemesUnreadable({ reason: "expected a JSON array of themes" })
      const entries: ReadonlyArray<unknown> = parsed
      return entries
    })

    const themes = Effect.fn("Rex.themes")(function* () {
      const { entries } = yield* catalog
      const builtIn = entries.flatMap((entry) =>
        Option.toArray(RexTheme.decodeSummary(entry)).map((summary): Listed => ({ ...summary, origin: "built-in" })),
      )
      const custom = (yield* customEntries()).flatMap((entry) =>
        Result.match(RexTheme.decodeCustom(entry), {
          onSuccess: (decoded): Array<Listed> => [{ id: decoded.id, name: decoded.name, appearance: decoded.appearance, origin: "custom" }],
          onFailure: () => [],
        }),
      )
      return [...builtIn, ...custom]
    })

    const customFingerprint = () => Effect.map(prefs.value(DEFAULTS_DOMAIN, CUSTOM_THEMES_KEY), Prefs.fingerprint)

    const theme = Effect.fn("Rex.theme")(function* (id: string) {
      const { path, entries } = yield* catalog
      const found = yield* RexTheme.findInCatalog(entries, id).pipe(
        Effect.mapError((error) => new CatalogUnreadable({ path, reason: `theme "${id}" is malformed: ${error.message}` })),
      )
      if (Option.isSome(found)) return found.value
      const custom = (yield* customEntries()).find((entry) => Option.contains(RexTheme.customId(entry), id))
      if (custom === undefined) return yield* new ThemeUnsupported({ id })
      return yield* Result.match(RexTheme.decodeCustom(custom), { onSuccess: Effect.succeed, onFailure: Effect.fail })
    })

    const active = Effect.fn("Rex.active")(function* () {
      const current = yield* selection()
      const appearance = resolveAppearance(current.mode, current.mode === "system" ? yield* systemAppearance() : current.mode)
      return { selection: current, appearance, theme: yield* theme(themeIdFor(current, appearance)) }
    })

    return Service.of({ selection, systemAppearance, themes, customFingerprint, theme, active })
  }),
)

export * as Rex from "./Rex.ts"
