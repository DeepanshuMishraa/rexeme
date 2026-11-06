import { Effect, Ref, Result, Schedule, Stream } from "effect"
import { rmSync } from "node:fs"
import { join } from "node:path"
import { Palette } from "./Palette.ts"
import { Paths } from "./Paths.ts"
import { Processes } from "./Processes.ts"
import { Rex } from "./Rex.ts"
import { Stage } from "./Stage.ts"
import { Sync } from "./Sync.ts"
import type { Target } from "./Target.ts"

const ms = (value: number) => `${value.toFixed(2)}ms`

/** What the watcher compares between polls. Editing a custom theme keeps its id, so its stored colors count too. */
const triggerFor = (themeId: string, customFingerprint: string) => `${themeId}#${customFingerprint}`

/**
 * Switches every installed app to `active`: staged apps by swapping files in,
 * the rest (not staged, or edited since staging) by a live sync. Logs when
 * each group landed, measured from the poll that noticed the change.
 */
export const switchTo = Effect.fn("Watch.switchTo")(function* (
  trigger: string,
  installed: ReadonlyArray<Target.Target>,
  staged: ReadonlyArray<Stage.Staged>,
  noticedAt: number,
) {
  // The stage is found by the key the poll just read, so its files go in
  // before Rex's theme is even looked up.
  const stage = staged.find((candidate) => candidate.trigger === trigger)
  const commitStart = performance.now() - noticedAt
  const swapped = stage ? yield* Stage.commit(stage) : undefined
  const rex = yield* Rex.Service
  const active = yield* rex.active()
  const palette = Palette.fromTheme(active.theme)
  const done = new Set(swapped?.committed.map(({ plan }) => plan.target) ?? [])
  const live = installed.filter((target) => !done.has(target))
  const outcomes = yield* Sync.applyTo(palette, live)
  const total = performance.now() - noticedAt

  const parts = [
    swapped
      ? `files for ${swapped.committed.length} staged apps in place ${ms(commitStart + (swapped.committed.at(-1)?.placedAt ?? 0))} after noticing, reloads sent at ${ms(commitStart + swapped.signalledAt)}`
      : "no stage for this theme yet",
    live.length > 0 ? `${live.length} synced live, all done in ${ms(total)}` : `all done in ${ms(total)}`,
  ]
  yield* Effect.logInfo(`Switched to Rex theme "${active.theme.name}" (${active.appearance}, ${active.theme.origin}): ${parts.join("; ")}`)
  for (const outcome of outcomes) {
    if (outcome._tag === "Failed") yield* Effect.logWarning(Sync.describe(outcome))
  }
})

/**
 * Syncs now, then again every time Rex's theme, light/dark mode or a custom
 * theme's colors change. Runs until interrupted.
 *
 * Rex saves its choice through macOS preferences, and cfprefsd writes the
 * plist to disk lazily, so watching the file misses changes. One poll reads
 * four preferences in-process through CoreFoundation in about 10µs, so
 * polling every 2ms costs under 1% of a core and notices a change within
 * ~1ms on average. The files for both of Rex's selected themes are staged
 * ahead of time (see Stage), so a switch is a few renames.
 */
export const run = Effect.fn("Watch.run")(function* (interval: `${number} millis` = "2 millis") {
  const rex = yield* Rex.Service
  const paths = yield* Paths.Service
  const root = join(paths.home, "Library", "Caches", "rexeme", "staged")
  // Stages left by a watcher that was stopped or crashed.
  yield* Effect.sync(() => rmSync(root, { recursive: true, force: true }))

  const installed = yield* Ref.make(yield* Sync.detect())
  const stages = yield* Ref.make<ReadonlyArray<Stage.Staged>>([])

  // Stages Rex's dark and light themes: the next switch is to one of them.
  // Re-staged after every switch and every few seconds, so a stage reflects
  // the configs as they are now and a switch rarely falls back to a live sync.
  const restage = Effect.gen(function* () {
    const selection = yield* rex.selection()
    const targets = yield* Ref.get(installed)
    const ids = [...new Set([selection.darkThemeId, selection.lightThemeId])]
    const fingerprint = yield* rex.customFingerprint()
    yield* Processes.refresh
    const fresh = yield* Effect.forEach(ids, (id) =>
      Effect.flatMap(rex.theme(id), (theme) => Stage.prepare(triggerFor(id, fingerprint), Palette.fromTheme(theme), targets, root)),
    )
    const old = yield* Ref.getAndSet(stages, fresh)
    yield* Effect.forEach(old, Stage.discard)
  }).pipe(Effect.catch((error) => Effect.logWarning(`Couldn't stage the next theme switch: ${error.message}`)))

  yield* Effect.gen(function* () {
    yield* Ref.set(installed, yield* Sync.detect())
    yield* restage
  }).pipe(Effect.repeat(Schedule.spaced("5 seconds")), Effect.delay("5 seconds"), Effect.forkChild)

  const which = Effect.gen(function* () {
    const selection = yield* rex.selection()
    const appearance = Rex.resolveAppearance(
      selection.mode,
      selection.mode === "system" ? yield* rex.systemAppearance() : selection.mode,
    )
    return triggerFor(Rex.themeIdFor(selection, appearance), yield* rex.customFingerprint())
  }).pipe(Effect.result)

  // Errors keyed by tag so a lasting problem is logged once, not every poll.
  const key = (current: Result.Result<string, Rex.SelectionMissing>) =>
    Result.match(current, { onSuccess: (id) => id, onFailure: (error) => `error:${error._tag}` })

  const handle = (current: Result.Result<string, Rex.SelectionMissing>) =>
    Result.match(current, {
      onFailure: (error) => Effect.logWarning(error.message),
      onSuccess: (trigger) =>
        Effect.gen(function* () {
          const noticedAt = performance.now()
          yield* switchTo(trigger, yield* Ref.get(installed), yield* Ref.get(stages), noticedAt)
          yield* restage
        }).pipe(Effect.catch((error) => Effect.logWarning(error.message))),
    })

  yield* Effect.logInfo(`Watching Rex for theme changes every ${interval}`)
  yield* Stream.tick(interval).pipe(
    Stream.mapEffect(() => which),
    Stream.changesWith((a, b) => key(a) === key(b)),
    Stream.runForEach(handle),
  )
})

export * as Watch from "./Watch.ts"
