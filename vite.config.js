// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1" },
  build: { target: "es2022" },
  worker: { format: "es" },
});
