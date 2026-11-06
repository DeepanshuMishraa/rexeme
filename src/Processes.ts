import { Effect } from "effect"
import { Files } from "./Files.ts"

/**
 * Finds and signals processes by name in-process through libproc, so a
 * reload costs microseconds instead of spawning pkill (several milliseconds).
 * Names match like `pkill -x`: the executable's short name.
 */

type Libproc = {
  readonly listAllPids: (buffer: Int32Array) => number
  readonly name: (pid: number, buffer: Uint8Array) => number
}

let libproc: Libproc | undefined

// bun:ffi loads lazily so modules that import this still load under vitest.
const load = async (): Promise<Libproc> => {
  if (libproc) return libproc
  const { dlopen, FFIType, ptr } = await import("bun:ffi")
  const lib = dlopen("/usr/lib/libproc.dylib", {
    proc_listallpids: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    proc_name: { args: [FFIType.i32, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
  }).symbols
  libproc = {
    listAllPids: (buffer) => lib.proc_listallpids(ptr(buffer), buffer.byteLength),
    name: (pid, buffer) => lib.proc_name(pid, ptr(buffer), buffer.byteLength),
  }
  return libproc
}

const decoder = new TextDecoder()

// One scan of every process (~0.5ms) serves every reload for a few seconds.
// The watcher re-stages every 5s, which refreshes it, so a theme switch
// signals from memory. A process started since then has already read its new
// config; one that exited just fails the kill, which is ignored.
const SNAPSHOT_TTL_MS = 10_000
let snapshot: { readonly at: number; readonly byName: ReadonlyMap<string, ReadonlyArray<number>> } | undefined

const scan = (lib: Libproc) => {
  let pids = new Int32Array(4096)
  let count = lib.listAllPids(pids)
  while (count >= pids.length) {
    pids = new Int32Array(pids.length * 2)
    count = lib.listAllPids(pids)
  }
  const buffer = new Uint8Array(256)
  const byName = new Map<string, Array<number>>()
  for (const pid of pids.subarray(0, Math.max(0, count))) {
    if (pid <= 0 || pid === process.pid) continue
    const length = lib.name(pid, buffer)
    if (length <= 0) continue
    const name = decoder.decode(buffer.subarray(0, length))
    byName.set(name, [...(byName.get(name) ?? []), pid])
  }
  return byName
}

/** Rescans now; the watcher calls this while staging, off the hot path. */
export const refresh = Effect.gen(function* () {
  const lib = libproc ?? (yield* Effect.promise(load))
  snapshot = { at: performance.now(), byName: scan(lib) }
})

/** Process ids whose name is exactly `name`. */
export const pidsNamed = Effect.fn("Processes.pidsNamed")(function* (name: string) {
  // After the first load this stays synchronous, so a sync never yields here.
  const lib = libproc ?? (yield* Effect.promise(load))
  const now = performance.now()
  if (!snapshot || now - snapshot.at > SNAPSHOT_TTL_MS) snapshot = { at: now, byName: scan(lib) }
  return snapshot.byName.get(name) ?? []
})

/** Sends `signal` (such as "USR2") to every process named `name`; returns whether any received it. */
export const signal = Effect.fn("Processes.signal")(function* (name: string, signal: string) {
  const pids = yield* pidsNamed(name)
  if (yield* Files.record({ _tag: "Signal", process: name, signal })) return pids.length > 0
  let delivered = false
  for (const pid of pids) {
    try {
      process.kill(pid, `SIG${signal}`)
      delivered = true
    } catch {
      // The process exited or belongs to someone else; nothing to reload there.
    }
  }
  return delivered
})

export * as Processes from "./Processes.ts"
