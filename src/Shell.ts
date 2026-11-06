import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Files } from "./Files.ts"

/** Runs a program and returns its trimmed stdout, whatever its exit code. */
export const output = Effect.fn("Shell.output")(function* (command: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const text = yield* spawner.string(ChildProcess.make(command, [...args], { stderr: "ignore" }))
  return text.trim()
})

/** Runs a program and returns its exit code. */
export const exitCode = Effect.fn("Shell.exitCode")(function* (command: string, args: ReadonlyArray<string>) {
  // Spawning blocks the thread for about a millisecond; let every app that only
  // writes files finish first so a theme switch lands on them without waiting.
  yield* Effect.yieldNow
  if (yield* Files.record({ _tag: "Run", command, args })) return 0
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return yield* spawner.exitCode(ChildProcess.make(command, [...args], { stdout: "ignore", stderr: "ignore" }))
})

/** Runs a program and returns its exit code with stdout and stderr together, for showing to the user. */
export const combined = Effect.fn("Shell.combined")(function* (command: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(ChildProcess.make(command, [...args]))
      const [output, code] = yield* Effect.all([handle.all.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode], {
        concurrency: "unbounded",
      })
      return { code: Number(code), output: output.trim() }
    }),
  )
})

export * as Shell from "./Shell.ts"
