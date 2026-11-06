import { Option, Schema } from "effect"

/** A lowercase `#rrggbb` sRGB color. */
export const Hex = Schema.String.check(Schema.isPattern(/^#[0-9a-f]{6}$/)).pipe(Schema.brand("Hex"))
export type Hex = typeof Hex.Type

const HEX_INPUT = /^#([0-9a-f]{6})$/i
// Rex's CSS variables use "r g b", "rgb(r g b)" or "rgb(r g b / alpha)".
const CSS_RGB = /^(?:rgb\()?\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*[\d.]+\s*)?\)?$/

type Rgb = readonly [number, number, number]

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

const fromRgb = ([r, g, b]: Rgb): Hex =>
  Hex.make(`#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`)

const toRgb = (hex: Hex): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** An sRGB color from 0–1 channels, as Rex for Mac stores custom theme colors. */
export const fromUnit = (r: number, g: number, b: number): Hex => fromRgb([r * 255, g * 255, b * 255])

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const clamp01 = (c: number) => Math.max(0, Math.min(1, c))

/** A Display P3 color (0–1 channels) converted to the nearest sRGB color. */
export const fromDisplayP3 = (r: number, g: number, b: number): Hex => {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)]
  // Linear Display P3 to linear sRGB (both D65).
  // Each row sums to 1, so grays stay gray.
  const sr = 1.2249401762805598 * lr - 0.22494017628055996 * lg
  const sg = -0.042056954709688163 * lr + 1.0420569547096881 * lg
  const sb = -0.019637554590334432 * lr - 0.07863604555063189 * lg + 1.0982736001409663 * lb
  return fromUnit(clamp01(gamma(sr)), clamp01(gamma(sg)), clamp01(gamma(sb)))
}

/** Parses `#rrggbb` in any case. */
export const parseHex = (value: string): Option.Option<Hex> => {
  const match = HEX_INPUT.exec(value.trim())
  return match?.[1] ? Option.some(Hex.make(`#${match[1].toLowerCase()}`)) : Option.none()
}

/** Parses Rex's CSS color strings, dropping any alpha. */
export const parseCss = (value: string): Option.Option<Hex> => {
  const match = CSS_RGB.exec(value.trim())
  if (!match) return parseHex(value)
  const [, r, g, b] = match
  return Option.some(fromRgb([Number(r), Number(g), Number(b)]))
}

/** Linear blend: amount 0 returns `from`, 1 returns `to`. */
export const mix = (from: Hex, to: Hex, amount: number): Hex => {
  const a = toRgb(from)
  const b = toRgb(to)
  return fromRgb([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount])
}

/**
 * How colorful a color is, from 0 (gray) to 1 (pure hue): the spread between
 * its strongest and weakest channel. Unlike HSL saturation it stays low for
 * pale tints such as Tokyo Night's #c0caf5.
 */
export const chroma = (hex: Hex): number => {
  const channels = toRgb(hex)
  return (Math.max(...channels) - Math.min(...channels)) / 255
}

/** WCAG relative luminance: 0 for black, 1 for white. */
export const luminance = (hex: Hex): number => {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = toRgb(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export * as Color from "./Color.ts"
