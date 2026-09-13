// SPDX-License-Identifier: GPL-3.0-only
// Copyright 2026 kareemn. This worker and its WASM runtime belong to the GPL app.
import { validateScenario } from "./scenarios.js";
let engine,
  scenario,
  generation = 0;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const { default: createEngine } = await import(
        /* @vite-ignore */ data.moduleUrl
      );
      engine = await createEngine({
        locateFile: (name) => new URL(name, data.moduleUrl).href,
      });
      postMessage({ type: "ready" });
    } else if (data.type === "load") {
      generation = data.generation;
      generation = data.generation;
      scenario = validateScenario(data.scenario);
      engine._reset_world();
      for (const n of scenario.nodes)
        if (engine._add_node(...n.position, ...n.velocity, n.mass, n.body) < 0)
          throw new Error("Physics rejected a node");
      for (const b of scenario.beams)
        if (
          engine._add_beam(
            b.a,
            b.b,
            b.stiffness,
            b.damping,
            b.yield,
            b.strength,
            b.plastic,
          ) < 0
        )
          throw new Error("Physics rejected a beam");
      for (const t of scenario.triangles)
        if (engine._add_triangle(...t) < 0)
          throw new Error("Physics rejected a triangle");
      engine._set_environment(
        +scenario.environment.barrier,
        scenario.environment.barrierX,
        +scenario.environment.gravity,
      );
      engine._step_world(0);
      sendFrame("loaded", 0);
    } else if (data.type === "step") {
      const start = performance.now();
      if (engine._step_world(data.ticks) < 0)
        throw new Error("Physics timestep exceeds allowed batch");
      sendFrame("frame", performance.now() - start);
    }
  } catch (error) {
    postMessage({ type: "error", message: error.message, generation });
  }
};
function sendFrame(type, elapsed) {
  const copy = (ptr, length) => engine.HEAPF32.slice(ptr / 4, ptr / 4 + length);
  const positions = copy(engine._get_positions(), scenario.nodes.length * 3);
  const velocities = copy(engine._get_velocities(), scenario.nodes.length * 3);
  const damage = copy(engine._get_damage(), scenario.beams.length);
  const stats = copy(engine._get_stats(), 8);
  if (
    !positions.every(Number.isFinite) ||
    !stats.every(Number.isFinite) ||
    stats[7] > 500
  )
    throw new Error(
      "Simulation became unstable. Reset and reduce speed or stiffness.",
    );
  postMessage(
    { type, positions, velocities, damage, stats, elapsed, generation },
    [positions.buffer, velocities.buffer, damage.buffer, stats.buffer],
  );
}
