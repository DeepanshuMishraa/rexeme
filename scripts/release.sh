#!/bin/sh
# Builds rexeme for macOS and publishes it to the R2 bucket behind install.sh.
#
#   scripts/release.sh            # version from package.json
#
# Uploads to <version>/ (kept forever) and latest/, plus install.sh at the root.
# Needs bun, wrangler (logged in) and write access to the "rexeme" bucket.
set -eu

BUCKET="${REXEME_BUCKET:-rexeme}"
cd "$(dirname "$0")/.."
version="v$(bun -e 'console.log(require("./package.json").version)')"
out=dist

bun run check
rm -rf "$out" && mkdir -p "$out"
for arch in arm64 x64; do
  bun build src/main.ts --compile --minify --target="bun-darwin-$arch" --outfile "$out/rexeme-darwin-$arch"
  gzip -9 -f "$out/rexeme-darwin-$arch"
done
(cd "$out" && shasum -a 256 rexeme-darwin-*.gz > SHA256SUMS)

put() { # key file content-type cache-control
  wrangler r2 object put "$BUCKET/$1" --file "$2" --content-type "$3" --cache-control "$4" --remote
}

for prefix in "$version" latest; do
  # A version's files never change; latest/ is re-checked every few minutes.
  cache=$([ "$prefix" = latest ] && echo "public, max-age=300" || echo "public, max-age=31536000, immutable")
  for file in rexeme-darwin-arm64.gz rexeme-darwin-x64.gz; do
    put "$prefix/$file" "$out/$file" application/gzip "$cache"
  done
  put "$prefix/SHA256SUMS" "$out/SHA256SUMS" text/plain "$cache"
done
put install.sh scripts/install.sh text/x-shellscript "public, max-age=300"
echo "Published $version. Install with: curl -fsSL https://rexeme.dipxsy.app/install.sh | sh"
