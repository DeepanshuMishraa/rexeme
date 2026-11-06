import { Effect, FileSystem, Option, Result, Schema } from "effect"
import type { ChildProcessSpawner } from "effect/process"
import * as Jsonc from "jsonc-parser"
import { Files } from "./Files.ts"
import type { Palette } from "./Palette.ts"
import type { Paths } from "./Paths.ts"
import { Processes } from "./Processes.ts"

/** Services a target may use. */
export type Env = FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner | Paths.Service

/** A tool rexeme themes. */
export interface Target {
  /** Stable id used by `--only`. */
  readonly name: string
  /** True when the tool is installed or configured on this machine. */
  readonly detect: Effect.Effect<boolean, never, Env>
  /** Writes the palette into the tool's config and reloads running instances. Returns a short note. */
  readonly apply: (palette: Palette) => Effect.Effect<string, Failed, Env>
}

export class Failed extends Schema.TaggedError<Failed>()("Target.Failed", {
  target: Schema.String,
  operation: Schema.String,
  path: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `${this.target}: couldn't ${this.operation} ${this.path}: ${this.reason}`
  }
}

/** Maps any error from `effect` into `Failed` with the operation and path that failed. */
export const step =
  (target: string, operation: string, path: string) =>
  <A, E extends { readonly message: string }, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.mapError(effect, (error) => new Failed({ target, operation, path, reason: error.message }))

export const exists = (path: string) => Files.exists(path)

/** True when `binary` is on PATH. Looked up in-process: spawning `which` costs milliseconds per target. */
export const onPath = (binary: string) => Effect.sync(() => Bun.which(binary) !== null)

/** Signals running instances of `name`; never fails, since a missed reload isn't worth failing a sync for. */
export const reload = (name: string, signal: string) => Processes.signal(name, signal)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Reads a JSON object file, applies `update` and writes it back with two-space
 * indentation, keeping key order. A missing file starts as `{}`.
 */
export const updateJson = Effect.fn("Target.updateJson")(function* (
  target: string,
  path: string,
  update: (settings: Record<string, unknown>) => Record<string, unknown>,
) {
  const text = yield* Files.readOptional(path).pipe(step(target, "read", path))
  const current = yield* Option.match(text, {
    onNone: () => Effect.succeed<Record<string, unknown>>({}),
    onSome: (raw) =>
      Effect.try({
        try: (): unknown => JSON.parse(raw),
        catch: (error) => new Failed({ target, operation: "parse", path, reason: `invalid JSON: ${String(error)}. Fix the file, then run rexeme sync` }),
      }).pipe(
        Effect.flatMap((parsed) =>
          isObject(parsed)
            ? Effect.succeed(parsed)
            : Effect.fail(new Failed({ target, operation: "parse", path, reason: "expected a JSON object at the top level" })),
        ),
      ),
  })
  return yield* Files.writeIfChanged(path, `${JSON.stringify(update(current), null, 2)}\n`).pipe(step(target, "write", path))
})

/** One JSONC edit: the key path to set and its new value. */
export type JsoncEdit = readonly [path: ReadonlyArray<string>, value: unknown]

/**
 * Sets values in a JSON-with-comments file (VS Code, Zed and Sublime settings)
 * without disturbing the user's comments, ordering or formatting. A missing
 * file starts as `{}`.
 */
export const updateJsonc = Effect.fn("Target.updateJsonc")(function* (
  target: string,
  path: string,
  edits: ReadonlyArray<JsoncEdit>,
) {
  const text = Option.getOrElse(yield* Files.readOptional(path).pipe(step(target, "read", path)), () => "{}\n")
  const updated = yield* Result.match(editJsonc(text, edits), {
    onSuccess: Effect.succeed,
    onFailure: (reason) => Effect.fail(new Failed({ target, operation: "parse", path, reason })),
  })
  return yield* Files.writeIfChanged(path, updated).pipe(step(target, "write", path))
})

/** Applies `edits` to JSONC text, keeping comments and layout; fails with a reason when the text isn't a JSONC object. */
export const editJsonc = (text: string, edits: ReadonlyArray<JsoncEdit>): Result.Result<string, string> => {
  const errors: Array<Jsonc.ParseError> = []
  const parsed: unknown = Jsonc.parse(text, errors, { allowTrailingComma: true })
  const first = errors[0]
  if (first) return Result.fail(`${Jsonc.printParseErrorCode(first.error)} at offset ${first.offset}. Fix the file, then run rexeme sync`)
  if (!isObject(parsed)) return Result.fail("expected a JSON object at the top level")
  const tabSize = detectIndent(text)
  const formattingOptions = { insertSpaces: true, tabSize, eol: "\n" }
  return Result.succeed(
    edits.reduce((current, [keys, value]) => {
      // Fast path for every sync after the first: the key exists, so splice the
      // pretty-printed value over its old range. Jsonc.modify re-runs its
      // formatter on each edit, which takes milliseconds on large values.
      const tree = Jsonc.parseTree(current)
      const node = tree ? Jsonc.findNodeAtLocation(tree, [...keys]) : undefined
      if (node) {
        const keyStart = node.parent?.offset ?? node.offset
        const lineStart = current.lastIndexOf("\n", keyStart) + 1
        const indent = /^[ \t]*/.exec(current.slice(lineStart))?.[0] ?? ""
        const pretty = JSON.stringify(value, null, tabSize).split("\n").join(`\n${indent}`)
        return current.slice(0, node.offset) + pretty + current.slice(node.offset + node.length)
      }
      return Jsonc.applyEdits(current, Jsonc.modify(current, [...keys], value, { formattingOptions }))
    }, text),
  )
}

const detectIndent = (text: string) => {
  const match = /^( +)\S/m.exec(text)
  return match?.[1] ? match[1].length : 2
}

/** Reads a nested object field, treating anything else as empty. */
export const objectField = (settings: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = settings[key]
  return isObject(value) ? value : {}
}

export * as Target from "./Target.ts"
