import { Data, Effect, Result } from "effect"
import type { Palette } from "./Palette.ts"
import { Target } from "./Target.ts"
import { Btop } from "./targets/Btop.ts"
import { ClaudeCode } from "./targets/ClaudeCode.ts"
import { Codex } from "./targets/Codex.ts"
import { Gemini } from "./targets/Gemini.ts"
import { Htop } from "./targets/Htop.ts"
import { Lazygit } from "./targets/Lazygit.ts"
import { Neovim } from "./targets/Neovim.ts"
import { OpenCode } from "./targets/OpenCode.ts"
import { Pi } from "./targets/Pi.ts"
import { Alacritty } from "./targets/Alacritty.ts"
import { Bat } from "./targets/Bat.ts"
import { Delta } from "./targets/Delta.ts"
import { Fish } from "./targets/Fish.ts"
import { Fzf } from "./targets/Fzf.ts"
import { Ghostty } from "./targets/Ghostty.ts"
import { Helix } from "./targets/Helix.ts"
import { ITerm2 } from "./targets/ITerm2.ts"
import { Kitty } from "./targets/Kitty.ts"
import { Lazydocker } from "./targets/Lazydocker.ts"
import { Sublime } from "./targets/Sublime.ts"
import { Tmux } from "./targets/Tmux.ts"
import { Vim } from "./targets/Vim.ts"
import { VsCode } from "./targets/VsCode.ts"
import { Warp } from "./targets/Warp.ts"
import { WezTerm } from "./targets/WezTerm.ts"
import { Yazi } from "./targets/Yazi.ts"
import { Zed } from "./targets/Zed.ts"
import { Zellij } from "./targets/Zellij.ts"
import { Borders } from "./targets/Borders.ts"
import { Discord } from "./targets/Discord.ts"
import { Emacs } from "./targets/Emacs.ts"
import { Eza } from "./targets/Eza.ts"
import { Gitui } from "./targets/Gitui.ts"
import { Herdr } from "./targets/Herdr.ts"
import { JetBrains } from "./targets/JetBrains.ts"
import { K9s } from "./targets/K9s.ts"
import { Lsd } from "./targets/Lsd.ts"
import { Micro } from "./targets/Micro.ts"
import { Obsidian } from "./targets/Obsidian.ts"
import { Rio } from "./targets/Rio.ts"
import { Spicetify } from "./targets/Spicetify.ts"
import { Starship } from "./targets/Starship.ts"
import { Television } from "./targets/Television.ts"
import { Xcode } from "./targets/Xcode.ts"

export const targets: ReadonlyArray<Target.Target> = [
  // Editors and IDEs
  ...VsCode.targets,
  Zed.target,
  JetBrains.target,
  Xcode.target,
  Sublime.target,
  Neovim.target,
  Vim.target,
  Helix.target,
  Emacs.target,
  Micro.target,
  // Terminal emulators and multiplexers
  Ghostty.target,
  Kitty.target,
  Alacritty.target,
  WezTerm.target,
  Rio.target,
  ITerm2.target,
  Warp.target,
  Tmux.target,
  Zellij.target,
  Herdr.target,
  // Shell and terminal tools
  Fish.target,
  Starship.target,
  Fzf.target,
  Bat.target,
  Delta.target,
  Eza.target,
  Lsd.target,
  Yazi.target,
  Television.target,
  Btop.target,
  Htop.target,
  Lazygit.target,
  Lazydocker.target,
  Gitui.target,
  K9s.target,
  // Desktop apps
  Obsidian.target,
  Discord.target,
  Spicetify.target,
  Borders.target,
  // Coding agents
  OpenCode.target,
  ClaudeCode.target,
  Codex.target,
  Pi.target,
  Gemini.target,
  Gemini.qwen,
]

export const targetNames = targets.map((target) => target.name)

export type Outcome = Data.TaggedEnum<{
  Applied: { readonly target: string; readonly note: string; readonly ms: number; readonly finishedAt: number }
  NotInstalled: { readonly target: string }
  Failed: { readonly target: string; readonly error: Target.Failed; readonly ms: number; readonly finishedAt: number }
}>
export const Outcome = Data.taggedEnum<Outcome>()

/** Which of `selected` are installed on this machine. Cheap (no processes spawned), but the watcher caches it anyway. */
export const detect = Effect.fn("Sync.detect")(function* (selected: ReadonlyArray<Target.Target> = targets) {
  const flags = yield* Effect.forEach(selected, (target) => target.detect, { concurrency: "unbounded" })
  return selected.filter((_, index) => flags[index] === true)
})

/**
 * Applies `palette` to already-detected targets concurrently, timing each.
 * One target failing never stops the others.
 */
export const applyTo = Effect.fn("Sync.applyTo")(function* (palette: Palette.Palette, installed: ReadonlyArray<Target.Target>) {
  return yield* Effect.forEach(
    installed,
    (target) =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* Effect.result(target.apply(palette))
        const finishedAt = performance.now()
        const ms = finishedAt - start
        return Result.match(result, {
          onSuccess: (note): Outcome => Outcome.Applied({ target: target.name, note, ms, finishedAt }),
          onFailure: (error): Outcome => Outcome.Failed({ target: target.name, error, ms, finishedAt }),
        })
      }),
    { concurrency: "unbounded" },
  )
})

/** Detects, then applies: every selected target gets an outcome. */
export const apply = Effect.fn("Sync.apply")(function* (palette: Palette.Palette, selected: ReadonlyArray<Target.Target> = targets) {
  const installed = yield* detect(selected)
  const applied = yield* applyTo(palette, installed)
  const missing = selected.filter((target) => !installed.includes(target)).map((target) => Outcome.NotInstalled({ target: target.name }))
  return [...applied, ...missing]
})

const ms = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)}ms`.padStart(7)

export const describe = (outcome: Outcome) =>
  Outcome.$match(outcome, {
    Applied: ({ target, note, ms: took }) => `✓ ${target.padEnd(16)} ${ms(took)}  ${note}`,
    NotInstalled: ({ target }) => `– ${target.padEnd(16)}          not installed`,
    Failed: ({ target, error, ms: took }) => `✗ ${target.padEnd(16)} ${ms(took)}  ${error.message.replace(`${target}: `, "")}`,
  })

export * as Sync from "./Sync.ts"
