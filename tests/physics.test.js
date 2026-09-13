// SPDX-License-Identifier: GPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import createEngine from "../public/wasm/ror.js";
import { createScenario, validateScenario } from "../src/scenarios.js";
const wasmBinary = await readFile(
  new URL("../public/wasm/ror.wasm", import.meta.url),
);
async function load(scenario) {
  validateScenario(scenario);
  const m = await createEngine({ wasmBinary });
  m._reset_world();
  for (const n of scenario.nodes)
    assert(m._add_node(...n.position, ...n.velocity, n.mass, n.body) >= 0);
  for (const b of scenario.beams)
    assert(
      m._add_beam(
        b.a,
        b.b,
        b.stiffness,
        b.damping,
        b.yield,
        b.strength,
        b.plastic,
      ) >= 0,
    );
  for (const tri of scenario.triangles) assert(m._add_triangle(...tri) >= 0);
  m._set_environment(
    +scenario.environment.barrier,
    scenario.environment.barrierX,
    +scenario.environment.gravity,
  );
  m._step_world(0);
  return m;
}
const values = (m, method, count) =>
  m.HEAPF32.slice(m[method]() / 4, m[method]() / 4 + count);
test("scenario validator rejects invalid and non-finite input", () => {
  for (const field of ["mass", "body"]) {
    const s = createScenario();
    s.nodes[0][field] = -1;
    assert.throws(() => validateScenario(s));
  }
  const s = createScenario();
  s.nodes[0].position[0] = Infinity;
  assert.throws(() => validateScenario(s));
  const t = createScenario();
  t.triangles[0][0] = 9999;
  assert.throws(() => validateScenario(t));
});
test("C ABI rejects malformed indices and unbounded stepping", async () => {
  const m = await load(createScenario());
  assert.equal(m._add_triangle(-1, 1, 2), -1);
  assert.equal(m._step_world(201), -1);
  assert.equal(m._step_world(-1), -1);
});
for (const preset of ["headon", "offset", "side", "barrier"])
  test(`${preset}: actual WASM reaches contact, yields, and stays finite`, async () => {
    const s = createScenario({ preset });
    const m = await load(s);
    // Cars begin several metres apart. No crush or contacts are permitted before arrival.
    m._step_world(200);
    let stats = values(m, "_get_stats", 8);
    assert.equal(stats[3], 0, "contact while vehicles separated");
    assert.equal(stats[4], 0, "crush before contact");
    for (let i = 0; i < 29; i++) m._step_world(200);
    stats = values(m, "_get_stats", 8);
    const positions = values(m, "_get_positions", s.nodes.length * 3);
    assert(stats[3] > 0, "no contact detected");
    assert(stats[4] > 0, "no permanent deformation");
    assert(positions.every(Number.isFinite));
    assert(Math.max(...positions.map(Math.abs)) < 100, "unstable displacement");
    assert(stats[7] < 100, "unstable velocities");
    console.log(
      preset,
      JSON.stringify({
        contacts: stats[3],
        yielded: stats[4],
        broken: stats[5],
        maxSpeed: stats[7],
        maxStrain: stats[6],
      }),
    );
  });
test("WASM trajectory is independent of rendering batch size and reset restores the pristine cage", async () => {
  const s = createScenario({ preset: "offset" }),
    a = await load(s),
    b = await load(s);
  for (let i = 0; i < 10; i++) a._step_world(200);
  for (let i = 0; i < 200; i++) b._step_world(10);
  assert.deepEqual(
    values(a, "_get_positions", s.nodes.length * 3),
    values(b, "_get_positions", s.nodes.length * 3),
  );
  const reset = await load(s);
  assert.equal(values(reset, "_get_stats", 8)[4], 0);
});
