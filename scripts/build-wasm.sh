#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v em++ >/dev/null; then
  echo "Emscripten missing. Install emsdk 6.0.9, activate it, and source emsdk_env.sh." >&2
  exit 1
fi
mkdir -p public/wasm
em++ physics/api.cpp -std=c++17 -O3 -msimd128 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=16777216 -sMAXIMUM_MEMORY=67108864 \
  -sEXPORTED_RUNTIME_METHODS=HEAPF32 -o public/wasm/ror.js
printf '%s\n' 'Built public/wasm/ror.js and ror.wasm'
