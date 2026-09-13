// SPDX-License-Identifier: GPL-3.0-only
// Copyright 2026 kareemn. Original, synthetic assets; no real vehicle calibration.
export const PRESETS = {
  offset: "Offset frontal",
  headon: "Full frontal",
  side: "Side impact",
  barrier: "Rigid barrier",
};

export function createScenario({
  preset = "offset",
  speed = 35,
  stiffness = 1,
  offset = 0.75,
} = {}) {
  const nodes = [],
    beams = [],
    triangles = [],
    panels = [],
    vehicles = [];
  const addCar = (id, position, angle, speedKmh, color) => {
    const start = nodes.length,
      startBeam = beams.length;
    const xs = [-2.2, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.2];
    const tops = [0.78, 0.9, 1.0, 1.4, 1.48, 1.48, 1.37, 0.98, 0.9, 0.76];
    const ca = Math.cos(angle),
      sa = Math.sin(angle);
    const transform = ([x, y, z]) => [
      position[0] + ca * x - sa * z,
      y,
      position[1] + sa * x + ca * z,
    ];
    for (let i = 0; i < xs.length; i++) {
      const upperWidth = tops[i] > 1.1 ? 0.72 : 0.88;
      for (const local of [
        [xs[i], 0.42, -0.9],
        [xs[i], 0.42, 0.9],
        [xs[i], tops[i], 0 === i ? 0.8 : upperWidth],
        [xs[i], tops[i], -(0 === i ? 0.8 : upperWidth)],
      ]) {
        nodes.push({
          position: transform(local),
          velocity: [(ca * speedKmh) / 3.6, 0, (sa * speedKmh) / 3.6],
          mass: 1500 / 40,
          body: id,
        });
      }
    }
    const unique = new Set();
    function beam(a, b) {
      a += start;
      b += start;
      const key = [Math.min(a, b), Math.max(a, b)].join(":");
      if (unique.has(key)) return;
      unique.add(key);
      const stationA = Math.floor((a - start) / 4),
        stationB = Math.floor((b - start) / 4);
      const cabin =
        stationA >= 3 && stationA <= 6 && stationB >= 3 && stationB <= 6;
      beams.push({
        a,
        b,
        stiffness: stiffness * (cabin ? 700000 : 230000),
        damping: cabin ? 900 : 500,
        yield: cabin ? 110000 : 17000,
        strength: cabin ? 800000 : 180000,
        plastic: 0.55,
      });
    }
    function face(indices, material) {
      const corners = indices.map((i) => i + start);
      // Correct outward winding for each face of this convex-ish synthetic body.
      const [a, b, c] = corners.map((i) => nodes[i].position);
      const cross = (u, v) => [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const sub = (u, v) => u.map((x, i) => x - v[i]);
      const normal = cross(sub(b, a), sub(c, a));
      const center = corners.reduce(
        (s, i) => s.map((v, j) => v + nodes[i].position[j] / 4),
        [0, 0, 0],
      );
      const outward = sub(center, [position[0], 0.8, position[1]]);
      if (normal.reduce((s, v, i) => s + v * outward[i], 0) < 0)
        corners.reverse();
      const first = triangles.length;
      triangles.push(
        [corners[0], corners[1], corners[2]],
        [corners[0], corners[2], corners[3]],
      );
      panels.push({ first, count: 2, body: id, material });
    }
    for (let i = 0; i < 10; i++) {
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 4; b++) beam(i * 4 + a, i * 4 + b);
      if (i < 9) {
        for (let a = 0; a < 4; a++)
          for (let b = 0; b < 4; b++) beam(i * 4 + a, (i + 1) * 4 + b);
        for (let side = 0; side < 4; side++) {
          const glass =
            (side === 2 && (i === 2 || i === 6)) ||
            ((side === 1 || side === 3) && i >= 3 && i <= 5);
          face(
            [
              i * 4 + side,
              (i + 1) * 4 + side,
              (i + 1) * 4 + ((side + 1) % 4),
              i * 4 + ((side + 1) % 4),
            ],
            glass ? "glass" : side === 0 ? "underbody" : "paint",
          );
        }
      }
    }
    face([0, 1, 2, 3], "rear");
    face([36, 37, 38, 39], "front");
    vehicles.push({
      id,
      name: id === 0 ? "Vehicle A" : "Vehicle B",
      color,
      nodeStart: start,
      nodeCount: 40,
      beamStart: startBeam,
      beamCount: beams.length - startBeam,
      wheelStations: [1, 7],
    });
  };
  if (preset === "side") {
    addCar(0, [-7, 0], 0, speed, "#2778d8");
    addCar(1, [0, 0], Math.PI / 2, 0, "#e28b36");
  } else if (preset === "barrier") addCar(0, [-6, 0], 0, speed, "#2778d8");
  else {
    addCar(0, [-6, 0], 0, speed, "#2778d8");
    addCar(1, [6, preset === "offset" ? offset : 0], Math.PI, speed, "#e28b36");
  }
  return {
    version: 1,
    name: PRESETS[preset],
    description:
      "Synthetic 1500 kg vehicles. Uncalibrated research fixture. Gravity and tire dynamics disabled.",
    environment: { barrier: preset === "barrier", barrierX: 0, gravity: false },
    nodes,
    beams,
    triangles,
    panels,
    vehicles,
  };
}

export function validateScenario(s) {
  const fail = (m) => {
    throw new Error(`Invalid scenario: ${m}`);
  };
  if (!s || s.version !== 1) fail("expected version 1");
  const vector = (v, max) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((x) => Number.isFinite(x) && Math.abs(x) <= max);
  if (!Array.isArray(s.nodes) || s.nodes.length < 2 || s.nodes.length > 512)
    fail("2–512 nodes required");
  if (!Array.isArray(s.beams) || s.beams.length > 4096)
    fail("at most 4096 beams");
  if (!Array.isArray(s.triangles) || s.triangles.length > 2048)
    fail("at most 2048 triangles");
  for (const n of s.nodes)
    if (
      !vector(n.position, 100) ||
      !vector(n.velocity, 40) ||
      !Number.isFinite(n.mass) ||
      n.mass < 5 ||
      n.mass > 10000 ||
      !Number.isInteger(n.body) ||
      n.body < 0 ||
      n.body > 7
    )
      fail("node position, velocity, mass or body out of bounds");
  const index = (i) => Number.isInteger(i) && i >= 0 && i < s.nodes.length;
  for (const b of s.beams) {
    if (!index(b.a) || !index(b.b) || b.a === b.b)
      fail("invalid beam endpoint");
    if (s.nodes[b.a].body !== s.nodes[b.b].body)
      fail("inter-vehicle beams are not supported");
    for (const [key, min, max] of [
      ["stiffness", 1, 1000000],
      ["damping", 0, 2000],
      ["yield", 1, 10000000],
      ["strength", 1, 100000000],
      ["plastic", 0, 1],
    ])
      if (!Number.isFinite(b[key]) || b[key] < min || b[key] > max)
        fail(`beam ${key} out of bounds`);
    if (b.strength < b.yield)
      fail("breaking force must be at least the yield force");
    const length = Math.hypot(
      ...s.nodes[b.a].position.map((x, i) => x - s.nodes[b.b].position[i]),
    );
    if (length < 0.1) fail("beam shorter than the port’s 0.1 m minimum");
  }
  for (const t of s.triangles)
    if (
      !Array.isArray(t) ||
      t.length !== 3 ||
      !t.every(index) ||
      new Set(t).size !== 3 ||
      new Set(t.map((i) => s.nodes[i].body)).size !== 1
    )
      fail("invalid triangle");
  if (
    !s.environment ||
    typeof s.environment.barrier !== "boolean" ||
    typeof s.environment.gravity !== "boolean" ||
    !Number.isFinite(s.environment.barrierX) ||
    Math.abs(s.environment.barrierX) > 100
  )
    fail("invalid environment");
  // Visualization metadata is deliberately derived rather than trusted from a file.
  return s;
}
