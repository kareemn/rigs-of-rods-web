#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
sdk_args=()
if [ -n "${SDKROOT:-}" ]; then
  sdk_args=(-isysroot "$SDKROOT" -isystem "$SDKROOT/usr/include/c++/v1")
fi
"${CXX:-c++}" -std=c++17 -O2 "${sdk_args[@]}" tests/physics-native.cpp -o build/physics-native
./build/physics-native
