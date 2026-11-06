# rexeme

A [Rex](https://www.superlogical.com/rex) plugin that puts your editors, terminals and CLI tools on Rex's theme. Pick a theme or switch light/dark in Rex, and 52 apps change with it within a few milliseconds: VS Code and its forks, Zed, JetBrains IDEs, Xcode, Neovim, Ghostty, fish, Starship, lazygit, Obsidian, Discord, Spotify, your coding agents and more.

Colors come from Rex itself: the built-in catalog inside the app bundle (terminal palette plus Rex's interface tokens: surfaces, borders, accent), and the custom themes you make or import in Rex.

## Install

### Requirements

- macOS with [Rex for Mac](https://www.superlogical.com/rex), and its server running
- [Bun](https://bun.sh) 1.3 or newer
- The `rex` CLI on your `PATH` (`rex whoami` should answer)
- In Rex, pick a theme once in Settings > Themes, so there's a saved choice to follow

### Steps

1. Clone the repo and install its dependencies:

   ```sh
   git clone https://github.com/DeepanshuMishraa/rexeme.git ~/Code/rexeme
   cd ~/Code/rexeme
   bun install
   ```

2. Put `rexeme` on your `PATH`. `bun link` adds it to `~/.bun/bin`:

   ```sh
   bun link
   rexeme --version
   ```

3. Check that rexeme can see Rex and your apps:

   ```sh
   rexeme status
   ```

   It prints Rex's light and dark themes and lists every supported app as installed or not installed.

4. Apply Rex's current theme once:

   ```sh
   rexeme sync
   ```

   Each installed app gets a line with how long it took and any one-time step it needs (see below).

5. Add the Rexeme actions to Rex:

   ```sh
   rexeme plugin install
   ```

   This copies the Lua plugin to `~/.config/rex/plugins/rexeme/init.lua` and adds a marked block to your Rex `init.lua` that loads it. Then it runs `rex config check` and reloads Rex. If the check fails, Rex isn't reloaded and keeps its old config. Search "Rexeme" in the command palette to confirm the actions are there.

6. Follow Rex in the background:

   ```sh
   rexeme install
   ```

   This starts a login agent (`dev.rexeme.watch`) that re-themes your apps within a few milliseconds of every theme or light/dark switch. Its log is at `~/Library/Logs/rexeme.log`, or run the **Rexeme: Show Watcher Log** action.

Steps 5 and 6 save the absolute paths of `bun` and this checkout. If you move the folder or reinstall Bun, run both again.

### One-time steps for some apps

Most apps need nothing more. A few can't be switched from outside, and `rexeme sync` reminds you about them:

| App | Do once |
| --- | --- |
| fzf | Add `export FZF_DEFAULT_OPTS_FILE=~/.config/fzf/rex.fzfrc` to your shell config |
| WezTerm | Set `config.color_scheme = "rex"` in `wezterm.lua` |
| Warp | Pick "Rex" in Settings > Appearance |
| iTerm2 | Pick the "Rex" profile in Settings > Profiles |
| Vim | Add `colorscheme rex` to `~/.vimrc` |
| Spotify | Run `spicetify apply` |
| BetterDiscord | Enable "Rex" in its Themes settings |
| k9s | Set `k9s.ui.skin: rex` in its `config.yaml`, if it has no `skin:` line yet |

### Update

```sh
cd ~/Code/rexeme
git pull
bun install
rexeme plugin install   # picks up plugin changes
rexeme install          # restarts the watcher on the new code
```

### Uninstall

```sh
rexeme uninstall          # stop the background watcher
rexeme plugin uninstall   # remove the Rex actions and the init.lua block
bun unlink                # take rexeme off your PATH (run inside the checkout)
```

Apps keep their current Rex colors. Each app's generated `rex` theme file stays where it is, so switch each app back to another theme if you want.

### With Amber

The plugin is an ordinary Rex Lua module (`lua/rexeme/init.lua`, `setup(opts)`), so [Amber](https://github.com/rawnly/amber) can manage it:

```lua
amber.setup({
  plugins = {
    { "DeepanshuMishraa/rexeme", opts = { keys = { sync = "opt+space>t" } } },
  },
})
```

Or load it yourself: `dofile("/path/to/rexeme/lua/rexeme/init.lua").setup({})`.

| Option | Default | Meaning |
| --- | --- | --- |
| `bin` | `{ "rexeme" }` | Command that runs the CLI, e.g. `{ "/opt/homebrew/bin/bun", "/path/src/main.ts" }` |
| `path` | Homebrew, `~/.bun/bin`, `~/.local/bin`, system dirs | `PATH` for the CLI. Rex's server doesn't inherit your shell's |
| `keys` | none | Bindings by short name: `sync`, `status`, `follow`, `unfollow`, `log` |
| `log` | `~/Library/Logs/rexeme.log` | Log the `log` action tails |

### Rex actions

Search "Rexeme" in the command palette, or run them with `rex do`:

| Action | Does |
| --- | --- |
| `rexeme_sync` (`only=` optional) | Apply Rex's theme now |
| `rexeme_status` | Pane beside you with Rex's choice and the apps found |
| `rexeme_follow` / `rexeme_unfollow` | Start or stop the background watcher |
| `rexeme_log` | Tail the watcher log in a pane below |

## CLI

```sh
rexeme sync [--only zed,neovim]   # apply Rex's current theme once
rexeme status                     # Rex's choice and which apps were found
rexeme themes                     # built-in and custom themes (* is the one showing)
rexeme install | uninstall        # background watcher (launchd)
rexeme plugin install | uninstall # Rex palette actions
```

## Apps

| App | Writes | Live? |
| --- | --- | --- |
| VS Code, Insiders, VSCodium, Cursor, Windsurf, Antigravity, Kiro, Trae | `settings.json`: base theme + `workbench.colorCustomizations` / `editor.tokenColorCustomizations` scoped to it. Comments kept | Yes |
| Zed | `themes/rex.json`, `"theme": "Rex"` | Yes |
| Sublime Text | `Rex.sublime-color-scheme`, `color_scheme` | Yes |
| Neovim | `colors/rex.lua` + `plugin/rexeme.lua` | Yes, file watcher |
| Vim | `~/.vim/colors/rex.vim` | `colorscheme rex` |
| Helix | `themes/rex.toml`, `theme = "rex"` | Yes, `SIGUSR1` |
| Ghostty | `themes/rex`, `theme = rex` | Yes, `SIGUSR2` |
| kitty | `rex-theme.conf` + `include` | Yes, `SIGUSR1` |
| Alacritty | `rex.toml` in `general.import` | Yes |
| WezTerm | `colors/rex.toml` | Set `color_scheme = "rex"` |
| iTerm2 | dynamic profile "Rex" | Yes |
| Warp | `~/.warp/themes/rex.yaml` | Pick "Rex" once |
| tmux | `~/.config/tmux/rex.conf` + `source-file` | Yes, applied to the running server |
| Zellij | `themes/rex.kdl`, `theme "rex"` | Yes |
| fish | universal `fish_color_*` variables | Yes, every shell |
| fzf | `~/.config/fzf/rex.fzfrc` | Set `FZF_DEFAULT_OPTS_FILE` to it |
| bat, delta | `themes/rex.tmTheme` + cache rebuild; `delta.syntax-theme` | New runs |
| yazi | `flavors/rex.yazi` | Next launch |
| btop | `themes/rex.theme` | Yes, `SIGUSR2` |
| htop | `color_scheme=0` | Uses Rex's terminal colors |
| lazygit, lazydocker | marked `gui.theme` block | Focus / next launch |
| OpenCode | `themes/rex.json` | Yes, `SIGUSR2` |
| Claude Code | `~/.claude/themes/rex.json`, `custom:rex` | Yes |
| pi | `~/.pi/agent/themes/rex.json` | Yes |
| Codex | `themes/rex.tmTheme`, `[tui] theme` | New sessions |
| Gemini CLI, Qwen Code | `ui.customThemes.Rex` | New sessions |
| JetBrains IDEs, Android Studio | `colors/Rex.icls` + global scheme, per IDE | Next launch |
| Xcode | `FontAndColorThemes/Rex.xccolortheme`, light and dark selection | Next launch |
| Emacs | `themes/rex-theme.el` | Yes via `emacsclient` when a server runs |
| micro | `colorschemes/rex.micro`, `colorscheme` | Next launch |
| Rio | `themes/rex.toml`, `theme = "rex"` | Yes |
| herdr | `[theme.custom]` colors | Yes, `herdr server reload-config` |
| Starship | `[palettes.rex]`, `palette = "rex"` (shadows `green`, `cyan`, …) | Next prompt |
| eza | `theme.yml` | New runs |
| lsd | `colors.yaml` (only if rexeme or Hued generated it) | New runs |
| Television | `themes/rex.toml`, `[ui] theme` | New runs |
| gitui | `theme.ron` | Next launch |
| k9s | `skins/rex.yaml` (+ `skin:` when one is set) | Yes |
| Obsidian | `snippets/rex.css` enabled in every vault | Yes |
| Discord | `rex.theme.css` for Vencord, Equicord (enabled), BetterDiscord | Yes (Vencord, Equicord) |
| Spotify | Spicetify `Themes/Rex/color.ini` | After `spicetify apply` once, then `spicetify refresh` |
| JankyBorders | `borders active_color=… inactive_color=…` | Yes |

Apps that aren't installed are skipped. One app failing never stops the others.

## Custom themes

Themes you create, fork or import (Ghostty, iTerm) in Rex > Settings > Themes work like built-in ones. Rex for Mac saves them as a JSON array in the `Workspace.customThemes` preference, with each color as `{ red, green, blue, alpha, colorSpace }`. rexeme reads it in-process and treats it as a second catalog after the built-ins. Display P3 colors are converted to sRGB, and ANSI colors you edit by hand (`paletteOverrides`) win over the imported ones.

Custom themes have terminal colors but none of Rex's interface tokens, so rexeme fills them in:

- **Accent**: the cursor color when it's clearly colorful (Rex's own themes use the cursor as their accent), otherwise ANSI blue. Tested with Tokyo Night, whose pale cursor gives its signature `#7aa2f7`.
- **Surfaces, borders, text levels**: mixed from the background and foreground.
- **Light or dark**: Rex's stored value, or the background's luminance.

Editing a custom theme keeps its id, so the watcher also fingerprints the stored themes and re-syncs when their colors change. A custom theme rexeme can't read is reported by name and skipped. Your apps keep their last colors.

## How switching stays instant

Measured on a live Rex: a switch lands every app's files 1.2–2.5 ms after rexeme notices it, and sends reload signals 0.1–0.3 ms later.

- **Noticing.** Rex saves its choice in macOS preferences (`com.superlogical.rex`). macOS writes the plist lazily, so watching the file misses changes. `rexeme watch` reads the values in-process through CoreFoundation, about 10 µs per poll, every 2 ms.
- **Staging.** A switch comes after the machine has been idle, when the CPU is clocked down and the same sync is 5–7x slower than in a warm loop. So after every switch, and every 5 s, rexeme renders all apps' files for both of Rex's selected themes ahead of time. It does this in a recording mode, with real reads and no side effects, and stages the results in `~/Library/Caches/rexeme/staged`.
- **Switching.** rexeme checks each config with a `stat`. If it's unchanged since staging, rexeme `rename()`s the staged file into place. Then it replays reload signals from a cached process list (libproc, no `pkill`), and fish's notification (notifyd, no `fish` spawn).
- **Your edits are safe.** If you edited a config after it was staged, that app gets a normal live sync instead, so the edit is kept.

Commands that apps need run (tmux, herdr, bat, Spicetify) go last, after every file is in place.

## Coming from rexhue or Hued

`rexeme install` stops and removes the old `dev.rexhue.watch` agent. Sync takes over lazygit's old `rexhue` and `hued` blocks, deletes Neovim's `plugin/rexhue.lua`, replaces Hued's generated lsd colors, and turns off Hued's Obsidian snippet.

## Develop

```sh
bun run check   # typecheck + tests
```
