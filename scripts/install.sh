#!/bin/sh
# Installs rexeme, the Rex plugin that keeps your apps on Rex's theme.
#
#   curl -fsSL https://rexeme.dipxsy.app/install.sh | sh
#
# Options (environment variables):
#   REXEME_VERSION=v0.1.0       install a specific release instead of the latest
#   REXEME_INSTALL_DIR=/path    where to put the binary (default ~/.local/bin)
#   REXEME_SETUP=0              only install the binary; skip the Rex plugin,
#                               the first sync and the background watcher
set -eu

BASE_URL="${REXEME_BASE_URL:-https://rexeme.dipxsy.app}"
VERSION="${REXEME_VERSION:-latest}"
INSTALL_DIR="${REXEME_INSTALL_DIR:-$HOME/.local/bin}"
SETUP="${REXEME_SETUP:-1}"

say() { printf 'rexeme: %s\n' "$*"; }
fail() { printf 'rexeme: %s\n' "$*" >&2; exit 1; }

if [ "$(uname -s)" != "Darwin" ]; then
  fail "rexeme runs on macOS only. It follows Rex for Mac's theme through macOS preferences and runs as a launchd agent. Nothing was installed."
fi

case "$(uname -m)" in
  arm64) arch=arm64 ;;
  x86_64) arch=x64 ;;
  *) fail "no rexeme build for CPU $(uname -m). Nothing was installed. Build from source instead: https://github.com/DeepanshuMishraa/rexeme" ;;
esac
# An x86_64 shell under Rosetta on Apple Silicon still gets the native build.
if [ "$arch" = x64 ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
  arch=arm64
fi

for tool in curl shasum gunzip; do
  command -v "$tool" >/dev/null 2>&1 || fail "needs $tool, which isn't on PATH. Nothing was installed."
done

asset="rexeme-darwin-$arch.gz"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

say "downloading $VERSION for macOS $arch"
curl -fsSL "$BASE_URL/$VERSION/$asset" -o "$tmp/$asset" \
  || fail "couldn't download $BASE_URL/$VERSION/$asset. Check the version name and your connection. Nothing was installed."
curl -fsSL "$BASE_URL/$VERSION/SHA256SUMS" -o "$tmp/SHA256SUMS" \
  || fail "couldn't download the checksums for $VERSION. Nothing was installed."

expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$tmp/SHA256SUMS")
actual=$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')
[ -n "$expected" ] || fail "$asset isn't listed in SHA256SUMS for $VERSION. Nothing was installed."
[ "$expected" = "$actual" ] || fail "checksum mismatch for $asset (expected $expected, got $actual). The download may be corrupt or tampered with. Nothing was installed."

gunzip "$tmp/$asset"
chmod +x "$tmp/rexeme-darwin-$arch"
mkdir -p "$INSTALL_DIR"
# Replaces any earlier copy atomically; a running watcher keeps its old binary until it restarts below.
mv -f "$tmp/rexeme-darwin-$arch" "$INSTALL_DIR/rexeme"
say "installed $INSTALL_DIR/rexeme ($("$INSTALL_DIR/rexeme" --version))"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) say "$INSTALL_DIR isn't on your PATH. Add it, for example: fish_add_path $INSTALL_DIR  or  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc" ;;
esac

if [ "$SETUP" != 1 ]; then
  say "skipped setup (REXEME_SETUP=$SETUP). Next: rexeme sync, rexeme plugin install, rexeme install"
  exit 0
fi

if ! command -v rex >/dev/null 2>&1; then
  say "the Rex CLI isn't on PATH, so setup was skipped. Install Rex for Mac (https://www.superlogical.com/rex), then run: rexeme sync && rexeme plugin install && rexeme install"
  exit 0
fi

say "applying Rex's current theme"
"$INSTALL_DIR/rexeme" sync || say "some apps couldn't be themed (see above); the others were. Fix those and run rexeme sync again."
say "adding the Rexeme actions to Rex's command palette"
"$INSTALL_DIR/rexeme" plugin install || say "couldn't add the Rex plugin (see above). Your Rex config is unchanged or was left as Rex last loaded it; retry with: rexeme plugin install"
say "starting the background watcher"
"$INSTALL_DIR/rexeme" install || say "couldn't start the watcher (see above). Retry with: rexeme install"
say "done. Switch themes in Rex and your apps follow. Uninstall: rexeme uninstall && rexeme plugin uninstall && rm $INSTALL_DIR/rexeme"
