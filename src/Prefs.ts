import { Context, Effect, Layer, Option } from "effect"

/**
 * Reads macOS preferences in-process through CoreFoundation. One read takes a
 * few microseconds and asks cfprefsd for the current value, so rexeme can
 * check Rex's theme choice every few dozen milliseconds without spawning
 * `defaults`.
 */
export interface Interface {
  /** A string preference, or None when it's missing or not a string. */
  readonly string: (domain: string, key: string) => Effect.Effect<Option.Option<string>>
  /** Any preference, serialized; None when it's missing. */
  readonly value: (domain: string, key: string) => Effect.Effect<Option.Option<Value>>
}

/**
 * A preference value as bytes: a Data value's own bytes (often JSON written
 * by Swift's JSONEncoder), or any other value as an XML property list.
 */
export type Value =
  | { readonly _tag: "Data"; readonly bytes: Uint8Array }
  | { readonly _tag: "PropertyList"; readonly xml: Uint8Array }

/** Changes whenever the value's bytes do; cheap enough to compare every poll. */
export const fingerprint = (value: Option.Option<Value>) =>
  Option.match(value, {
    onNone: () => "none",
    onSome: (v) => `${v._tag}:${Bun.hash(v._tag === "Data" ? v.bytes : v.xml).toString(16)}`,
  })

export class Service extends Context.Service<Service, Interface>()("rexeme/Prefs") {}

/** CFPreferences' name for the global domain (`defaults read -g`). */
export const GLOBAL = "kCFPreferencesAnyApplication"

const UTF8 = 0x08000100

// CF references cross FFI as u64: short CFStrings are tagged pointers with the
// top bit set, which a JS number (and FFIType.ptr) can't hold exactly.
type CFRef = number | bigint

// bun:ffi is imported when the layer is built so modules that depend on Prefs
// still load under Node (vitest).
export const layer = Layer.effect(Service, Effect.gen(function* () {
  const { dlopen, FFIType, ptr, CString } = yield* Effect.promise(() => import("bun:ffi"))
  const cf = dlopen("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation", {
    CFStringCreateWithCString: { args: [FFIType.ptr, FFIType.cstring, FFIType.u32], returns: FFIType.u64 },
    // CF values travel as u64: short strings are tagged pointers with the top bit
    // set, which a JS number can't hold exactly.
    CFPreferencesCopyAppValue: { args: [FFIType.u64, FFIType.u64], returns: FFIType.u64 },
    CFPreferencesAppSynchronize: { args: [FFIType.u64], returns: FFIType.bool },
    CFGetTypeID: { args: [FFIType.u64], returns: FFIType.u64 },
    CFStringGetTypeID: { args: [], returns: FFIType.u64 },
    CFStringGetCString: { args: [FFIType.u64, FFIType.ptr, FFIType.i64, FFIType.u32], returns: FFIType.bool },
    CFRelease: { args: [FFIType.u64], returns: FFIType.void },
    CFDataGetTypeID: { args: [], returns: FFIType.u64 },
    CFDataGetLength: { args: [FFIType.u64], returns: FFIType.i64 },
    CFDataGetBytePtr: { args: [FFIType.u64], returns: FFIType.ptr },
    // (allocator, value, format, options, error) -> CFDataRef
    CFPropertyListCreateData: { args: [FFIType.ptr, FFIType.u64, FFIType.i64, FFIType.u64, FFIType.ptr], returns: FFIType.u64 },
  }).symbols
  const { toArrayBuffer } = yield* Effect.promise(() => import("bun:ffi"))
  const dataType = BigInt(cf.CFDataGetTypeID())
  const XML_FORMAT = 100 // kCFPropertyListXMLFormat_v1_0

  // Copies a CFData's bytes out before it's released.
  const bytesOf = (data: number | bigint): Option.Option<Uint8Array> => {
    const length = Number(cf.CFDataGetLength(data))
    if (length === 0) return Option.some(new Uint8Array())
    const start = cf.CFDataGetBytePtr(data)
    if (start === null) return Option.none()
    return Option.some(new Uint8Array(toArrayBuffer(start, 0, length)).slice())
  }

  const readValue = (domain: string, key: string): Option.Option<Value> => {
    const domainRef = cfString(domain)
    const keyRef = cfString(key)
    if (Option.isNone(domainRef) || Option.isNone(keyRef)) return Option.none()
    cf.CFPreferencesAppSynchronize(domainRef.value)
    const value = cf.CFPreferencesCopyAppValue(keyRef.value, domainRef.value)
    if (BigInt(value) === 0n) return Option.none()
    try {
      if (BigInt(cf.CFGetTypeID(value)) === dataType) {
        return Option.map(bytesOf(value), (bytes) => ({ _tag: "Data" as const, bytes }))
      }
      const xml = cf.CFPropertyListCreateData(null, value, XML_FORMAT, 0, null)
      if (BigInt(xml) === 0n) return Option.none()
      try {
        return Option.map(bytesOf(xml), (bytes) => ({ _tag: "PropertyList" as const, xml: bytes }))
      } finally {
        cf.CFRelease(xml)
      }
    } finally {
      cf.CFRelease(value)
    }
  }

  // CFStrings for domains and keys live as long as the process; there are only a handful.
  const strings = new Map<string, CFRef>()
  const cfString = (value: string) => {
    const existing = strings.get(value)
    if (existing) return Option.some(existing)
    const created = cf.CFStringCreateWithCString(null, encoder.encode(`${value}\0`), UTF8)
    if (BigInt(created) === 0n) return Option.none<CFRef>()
    strings.set(value, created)
    return Option.some(created)
  }
  // A fresh array per string: Buffer.from returns slices of a shared pool, and
  // the FFI call would read from the pool's start rather than the slice.
  const encoder = new TextEncoder()
  const stringType = BigInt(cf.CFStringGetTypeID())
  const buffer = new Uint8Array(1024)

  const read = (domain: string, key: string): Option.Option<string> => {
    const domainRef = cfString(domain)
    const keyRef = cfString(key)
    if (Option.isNone(domainRef) || Option.isNone(keyRef)) return Option.none()
    // Drops the cached copy so the value comes fresh from cfprefsd.
    cf.CFPreferencesAppSynchronize(domainRef.value)
    const value = cf.CFPreferencesCopyAppValue(keyRef.value, domainRef.value)
    if (BigInt(value) === 0n) return Option.none()
    try {
      if (BigInt(cf.CFGetTypeID(value)) !== stringType) return Option.none()
      if (!cf.CFStringGetCString(value, ptr(buffer), buffer.length, UTF8)) return Option.none()
      return Option.some(new CString(ptr(buffer)).toString())
    } finally {
      cf.CFRelease(value)
    }
  }

  return Service.of({
    string: (domain, key) => Effect.sync(() => read(domain, key)),
    value: (domain, key) => Effect.sync(() => readValue(domain, key)),
  })
}))

export * as Prefs from "./Prefs.ts"
