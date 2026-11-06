import { Effect, Option, Result } from "effect"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { dirname, join } from "node:path"
import { Files } from "./Files.ts"
import { Notify } from "./Notify.ts"
import type { Palette } from "./Palette.ts"
import { Processes } from "./Processes.ts"
import { Shell } from "./Shell.ts"
import type { Target } from "./Target.ts"

/**
 * Pre-staged theme switches.
 *
 * A theme switch happens after the machine has been idle, when the CPU is
 * clocked down and caches are cold; the same sync that takes ~2ms in a warm
 * loop then takes 10-15ms. So the watcher does the expensive part ahead of
 * time: for each theme Rex may switch to next, it runs every target in
 * recording mode (real reads and rendering, no side effects) and writes the
 * resulting files to a staging folder on the same volume. A switch then only
 * checks that each config still looks as it did when staged and rename()s
 * the staged files into place, which takes microseconds even when cold,
 * before replaying reload signals.
 */

export interface StagedWrite {
  readonly path: string
  readonly staged: string
  /** The config's size, mtime and inode when staged; a commit needs the same, which a stat checks in microseconds. */
  readonly signature: string
}

/** Identifies a file's current version without reading it. */
export const signature = (path: string) => {
  try {
    const stat = fs.statSync(path, { bigint: true })
    return `${stat.ino}:${stat.size}:${stat.mtimeNs}`
  } catch {
    return "missing"
  }
}

export interface Plan {
  readonly target: Target.Target
  readonly note: string
  readonly writes: ReadonlyArray<StagedWrite>
  readonly actions: ReadonlyArray<Files.Action>
}

export interface Staged {
  /** The watcher's change key (theme id and custom-theme fingerprint) this stage is for. */
  readonly trigger: string
  /** Identifies the palette; a switch uses a stage only when its palette matches exactly. */
  readonly key: string
  readonly dir: string
  readonly plans: ReadonlyArray<Plan>
}

/** A stable key for a palette's exact colors, so an edited custom theme never reuses an old stage. */
export const keyOf = (palette: Palette.Palette) => createHash("sha1").update(JSON.stringify(palette)).digest("hex").slice(0, 16)

let generation = 0

/** Records every target for `palette` and writes their files to a fresh folder under `root`. */
export const prepare = Effect.fn("Stage.prepare")(function* (
  trigger: string,
  palette: Palette.Palette,
  targets: ReadonlyArray<Target.Target>,
  root: string,
) {
  const key = keyOf(palette)
  // A fresh folder per stage: a commit may still be using the previous one.
  const dir = join(root, `${key}-${process.pid}-${generation++}`)
  fs.mkdirSync(dir, { recursive: true })
  const recorded = yield* Effect.forEach(
    targets,
    (target) => {
      const recording = new Files.Recording()
      return target.apply(palette).pipe(
        Effect.provideService(Files.Recorder, Option.some(recording)),
        Effect.result,
        Effect.map((result) => ({ target, recording, result })),
      )
    },
    { concurrency: "unbounded" },
  )
  const plans: Array<Plan> = []
  let file = 0
  for (const { target, recording, result } of recorded) {
    // A target that fails while recording isn't staged; a switch syncs it live and reports the error.
    if (Result.isFailure(result)) continue
    const all = [...recording.writes.values()]
    // Take each config's signature now, and only if it still holds the content
    // the plan was computed from; otherwise it changed mid-recording, so the
    // target is left to a live sync.
    const signatures = all.map((write) => (matchesBase(write) ? Option.some(signature(write.path)) : Option.none()))
    if (signatures.some(Option.isNone)) continue
    const writes = all.map((write, index): StagedWrite => {
      const staged = join(dir, String(file++))
      fs.writeFileSync(staged, write.content)
      // Created now so the commit is only a stat and a rename per file.
      fs.mkdirSync(dirname(write.path), { recursive: true })
      fs.chmodSync(staged, Option.isSome(write.base) ? Files.modeFor(write.path) : 0o644)
      return { path: write.path, staged, signature: Option.getOrElse(signatures[index] ?? Option.none(), () => "missing") }
    })
    plans.push({ target, note: result.success, writes, actions: [...recording.actions] })
  }
  return { trigger, key, dir, plans } satisfies Staged
})

const matchesBase = (write: Files.Write) => {
  let now: Option.Option<string>
  try {
    now = Option.some(fs.readFileSync(write.path, "utf8"))
  } catch {
    now = Option.none()
  }
  return Option.isSome(now) && Option.isSome(write.base) ? now.value === write.base.value : Option.isNone(now) && Option.isNone(write.base)
}

const unchanged = (write: StagedWrite) => signature(write.path) === write.signature

/**
 * Moves a staged file into place, falling back to a copy across volumes.
 * Returns false when neither works (say, its folder was deleted since
 * staging); the target then gets a live sync, which reports the real error.
 */
const place = (write: StagedWrite) => {
  try {
    fs.renameSync(write.staged, write.path)
    return true
  } catch {
    try {
      fs.copyFileSync(write.staged, write.path)
      fs.rmSync(write.staged, { force: true })
      return true
    } catch {
      return false
    }
  }
}

export interface Committed {
  readonly plan: Plan
  /** Milliseconds after the commit started when this target's files were in place. */
  readonly placedAt: number
}

/**
 * Swaps in every plan whose configs haven't changed since staging. Files for
 * all of them land first, then reload signals and notifications, then
 * spawned commands. Returns what was committed and the targets that must be
 * synced live instead (their configs changed after staging).
 */
export const commit = Effect.fn("Stage.commit")(function* (staged: Staged) {
  const start = performance.now()
  const committed: Array<Committed> = []
  const stale: Array<Target.Target> = []
  // Phase 1 is synchronous, so no other fiber (such as a new stage) runs in between.
  for (const plan of staged.plans) {
    if (!plan.writes.every(unchanged) || !plan.writes.every(place)) {
      stale.push(plan.target)
      continue
    }
    committed.push({ plan, placedAt: performance.now() - start })
  }
  const actions = committed.flatMap(({ plan }) => plan.actions)
  for (const action of actions) {
    if (action._tag === "Remove") fs.rmSync(action.path, { force: true })
    else if (action._tag === "Notify") yield* Notify.post(action.key)
    else if (action._tag === "Signal") yield* Processes.signal(action.process, action.signal)
  }
  const signalledAt = performance.now() - start
  yield* Effect.forEach(
    actions.flatMap((action) => (action._tag === "Run" ? [action] : [])),
    (action) => Shell.exitCode(action.command, action.args).pipe(Effect.ignore),
    { concurrency: "unbounded" },
  )
  return { committed, stale, signalledAt }
})

/** Deletes a stage's leftover files. */
export const discard = (staged: Staged) => Effect.sync(() => fs.rmSync(staged.dir, { recursive: true, force: true }))

export * as Stage from "./Stage.ts"
