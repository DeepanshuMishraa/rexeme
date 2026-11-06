import { Effect } from "effect"

/** Posts Darwin notifyd notifications (notify(3)), in-process. */

let notifyPost: ((key: string) => void) | undefined

const load = async () => {
  const { dlopen, FFIType } = await import("bun:ffi")
  const lib = dlopen("/usr/lib/libSystem.B.dylib", { notify_post: { args: [FFIType.cstring], returns: FFIType.u32 } }).symbols
  const encoder = new TextEncoder()
  const post = (key: string) => void lib.notify_post(encoder.encode(`${key}\0`))
  notifyPost = post
  return post
}

/** Synchronous once loaded, so a sync doesn't yield to the event loop here. */
export const post = Effect.fn("Notify.post")(function* (key: string) {
  const send = notifyPost ?? (yield* Effect.promise(load))
  send(key)
})

export * as Notify from "./Notify.ts"
