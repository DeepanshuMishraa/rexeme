import { Context, Effect, Option, Schema } from "effect"
import * as fs from "node:fs"
import { dirname } from "node:path"

/**
 * File operations for app configs, done synchronously on purpose: each call
 * takes tens of microseconds, while an async call hops through the thread
 * pool and back (~0.3ms). A theme switch writes a few small files per app, so
 * synchronous I/O finishes every app inside one turn of the event loop.
 */

/** A side effect a target performs besides writing files, captured while recording. */
export type Action =
  | { readonly _tag: "Signal"; readonly process: string; readonly signal: string }
  | { readonly _tag: "Run"; readonly command: string; readonly args: ReadonlyArray<string> }
  | { readonly _tag: "Notify"; readonly key: string }
  | { readonly _tag: "Remove"; readonly path: string }

/** One file a recorded sync would write, with the content it was computed from. */
export interface Write {
  readonly path: string
  readonly content: string
  /** The file as it was when recorded; a commit only proceeds if it's unchanged. */
  readonly base: Option.Option<string>
}

/**
 * What one target would do for a palette, without doing it. Recording runs
 * the target's real code against real files, but writes, removals, spawned
 * commands and reload signals go here instead of happening.
 */
export class Recording {
  readonly writes = new Map<string, Write>()
  readonly actions: Array<Action> = []
}

/** Set while recording; fiber-scoped, so a recording can never affect a real sync running alongside it. */
export const Recorder = Context.Reference<Option.Option<Recording>>("rexeme/Recorder", { defaultValue: () => Option.none() })

/** Records `action` when recording; returns whether it did (so the caller must not perform it). */
export const record = Effect.fn("Files.record")(function* (action: Action) {
  const recorder = yield* Recorder
  if (Option.isNone(recorder)) return false
  recorder.value.actions.push(action)
  return true
})

export class FileError extends Schema.TaggedError<FileError>()("Files.FileError", {
  operation: Schema.String,
  path: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `${this.operation} ${this.path} failed: ${this.reason}`
  }
}

const attempt = <A>(operation: string, path: string, run: () => A) =>
  Effect.try({
    try: run,
    catch: (error) => new FileError({ operation, path, reason: error instanceof Error ? error.message : String(error) }),
  })

const missing = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"

const readDisk = (path: string) =>
  Effect.try({
    try: () => Option.some(fs.readFileSync(path, "utf8")),
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) =>
      missing(error)
        ? Effect.succeed(Option.none<string>())
        : Effect.fail(new FileError({ operation: "read", path, reason: error instanceof Error ? error.message : String(error) })),
    ),
  )

/** Reads a file, or None when it doesn't exist. While recording, a file the target already "wrote" reads back as written. */
export const readOptional = Effect.fn("Files.readOptional")(function* (path: string) {
  const recorder = yield* Recorder
  if (Option.isSome(recorder)) {
    const written = recorder.value.writes.get(path)
    if (written) return Option.some(written.content)
  }
  return yield* readDisk(path)
})

/** Reads a file that must exist. */
export const read = (path: string) =>
  Effect.flatMap(readOptional(path), (content) =>
    Option.match(content, {
      onNone: () => Effect.fail(new FileError({ operation: "read", path, reason: "no such file" })),
      onSome: Effect.succeed,
    }),
  )

/** True when `path` exists. */
export const exists = (path: string) => Effect.sync(() => fs.existsSync(path))

/** The permissions a new or replaced file at `path` should get. */
export const modeFor = (path: string) => {
  try {
    return fs.statSync(path).mode & 0o777
  } catch {
    return 0o644
  }
}

/**
 * Atomically replaces `path` with `content`, keeping its permissions. Skips the
 * write when the content is unchanged so tools' file watchers don't fire for
 * nothing. Returns whether the file changed.
 */
export const writeIfChanged = Effect.fn("Files.writeIfChanged")(function* (path: string, content: string) {
  const existing = yield* readOptional(path)
  if (Option.contains(existing, content)) return false
  const recorder = yield* Recorder
  if (Option.isSome(recorder)) {
    const earlier = recorder.value.writes.get(path)
    recorder.value.writes.set(path, { path, content, base: earlier ? earlier.base : existing })
    return true
  }
  return yield* attempt("write", path, () => {
    const mode = Option.isSome(existing) ? modeFor(path) : 0o644
    fs.mkdirSync(dirname(path), { recursive: true })
    const temporary = `${path}.rexeme-${process.pid}`
    fs.writeFileSync(temporary, content, { mode })
    try {
      fs.renameSync(temporary, path)
    } catch (error) {
      fs.rmSync(temporary, { force: true })
      throw error
    }
    return true
  })
})

/** Removes `path` when it exists. Returns whether it did. */
export const removeIfExists = Effect.fn("Files.removeIfExists")(function* (path: string) {
  if (!fs.existsSync(path)) return false
  if (yield* record({ _tag: "Remove", path })) return true
  return yield* attempt("remove", path, () => {
    fs.rmSync(path, { force: true })
    return true
  })
})

export * as Files from "./Files.ts"
