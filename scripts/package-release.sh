#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Build first, then run from a committed source tree with emsdk activated.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f dist/wasm/ror.wasm
test -n "${EMSDK:-}"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo 'Commit the exact source before packaging a release.' >&2; exit 1
fi
revision=$(git rev-parse HEAD)
mkdir -p build dist/licenses
release_source=$(mktemp -d build/release-source.XXXXXX)
git archive HEAD | tar -x -C "$release_source"
mkdir -p "$release_source/vendor"
# Include runtime dependency source, not only links, with the source offer.
tar -czf "$release_source/vendor/three-source.tar.gz" -C node_modules three
tar -czf "$release_source/vendor/emscripten-runtime-source.tar.gz" \
  -C "$EMSDK/upstream/emscripten" system src LICENSE
cp node_modules/three/LICENSE dist/licenses/THREE-LICENSE.txt
cp "$EMSDK/upstream/emscripten/LICENSE" dist/licenses/EMSCRIPTEN-LICENSE.txt
cp "$EMSDK/upstream/emscripten/system/lib/libcxx/LICENSE.TXT" dist/licenses/LIBCXX-LICENSE.txt
cp "$EMSDK/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT" dist/licenses/COMPILER-RT-LICENSE.txt
cp LICENSE dist/LICENSE.txt
cp THIRD_PARTY_NOTICES.md dist/THIRD_PARTY_NOTICES.md
printf 'Source revision: %s\nEmscripten: 6.0.9\n' "$revision" > "$release_source/BUILD-REVISION.txt"
tar -czf dist/corresponding-source.tar.gz -C "$release_source" .
cat > dist/SOURCE.html <<EOF
<!doctype html><html lang="en"><meta charset="utf-8"><title>Source and licenses</title>
<h1>Rigs of Rods Web — source and licenses</h1>
<p>GPL v3. Source revision: <code>$revision</code>.</p>
<p><a href="corresponding-source.tar.gz">Download the matching corresponding source</a>, including Three.js and Emscripten runtime source.</p>
<p><a href="LICENSE.txt">GPL license</a> · <a href="THIRD_PARTY_NOTICES.md">Third-party notices</a> · <a href="https://github.com/kareemn/rigs-of-rods-web/tree/$revision">Browse source</a></p>
<p>Build instructions are in README.md. No warranty. Independent experimental project.</p></html>
EOF
node -e "const fs=require('node:fs'); const p='dist/index.html'; fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('</footer>','<a href=\"./SOURCE.html\">Matching source &amp; licenses</a></footer>'));"
tar -czf build/rigs-of-rods-web-site.tar.gz -C dist .
cp dist/corresponding-source.tar.gz build/rigs-of-rods-web-source.tar.gz
echo "Packaged source and site for $revision"
