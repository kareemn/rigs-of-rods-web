// SPDX-License-Identifier: GPL-3.0-only
// Copyright 2026 kareemn.
import "./style.css";
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createScenario, validateScenario } from "./scenarios.js";

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e0e7ed");
scene.fog = new THREE.Fog("#e0e7ed", 30, 80);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 150);
camera.position.set(12, 12, 17);
const canvas = $("canvas");
let renderer,
  controls,
  ready = false,
  playing = false,
  pending = false,
  startOnLoad = false,
  scrubbing = false,
  generation = 0,
  accumulator = 0,
  lastNow = 0;
let scenario,
  frames = [],
  viewIndex = 0,
  meshes = [],
  wheels = [],
  beamLines,
  barrierMesh,
  latest,
  frameCount = 0;
const worker = new Worker(new URL("./physics-worker.js", import.meta.url), {
  type: "module",
});
const renderGroup = new THREE.Group();
scene.add(renderGroup);

function fail(message) {
  playing = false;
  pending = false;
  $("error").textContent = message;
  $("error").hidden = false;
  $("play").textContent = "▶ Play";
}
try {
  renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    forceWebGL:
      new URLSearchParams(location.search).get("renderer") === "webgl",
  });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  $("renderer").textContent = renderer.backend.isWebGPUBackend
    ? "WEBGPU · WASM"
    : "WEBGL 2 FALLBACK · WASM";
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.minDistance = 5;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI * 0.48;
  const hemi = new THREE.HemisphereLight("#e3f1ff", "#5b6571", 2.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#fff4e6", 4);
  key.position.set(-4, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  key.shadow.camera.far = 40;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#b9d9ff", 2);
  fill.position.set(5, 6, -10);
  scene.add(fill);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({ color: "#d0dbe2", roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(48, 48, "#aabcc9", "#bfccd6");
  grid.position.y = -0.015;
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  scene.add(grid);
  let previousFit = 1;
  new ResizeObserver(() => {
    const { width, height } = $("stage").getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fit = Math.max(1, 1.15 / camera.aspect);
    camera.position
      .sub(controls.target)
      .multiplyScalar(fit / previousFit)
      .add(controls.target);
    previousFit = fit;
    camera.updateProjectionMatrix();
  }).observe($("stage"));
  renderer.setAnimationLoop(animate);
  worker.postMessage({
    type: "init",
    moduleUrl: new URL("wasm/ror.js", document.baseURI).href,
  });
} catch (error) {
  fail(
    `The 3D renderer could not start: ${error.message}. Try a current browser with WebGPU or WebGL 2 enabled.`,
  );
}

worker.onerror = (event) =>
  fail(`Physics worker could not start: ${event.message}`);
worker.onmessage = ({ data }) => {
  if (data.type === "ready") {
    ready = true;
    loadScenario(createFromControls());
    return;
  }
  if (data.generation !== undefined && data.generation !== generation) return;
  if (data.type === "error") {
    fail(data.message);
    return;
  }
  if (data.type === "loaded" || data.type === "frame") {
    pending = false;
    latest = data;
    frames.push(data);
    $("timeline").max = String(frames.length - 1);
    if (data.type === "loaded") {
      playing = startOnLoad;
      startOnLoad = false;
      $("play").textContent = playing ? "Ⅱ Pause" : "▶ Play";
    }
    // A completed batch is still recorded, but must not move a paused/scrubbed view.
    if (playing || data.type === "loaded") showFrame(frames.length - 1);
    $("recorded").textContent = `${data.stats[0].toFixed(2)} s saved`;
    $("export-replay").disabled = frames.length < 2;
    $("play").disabled = false;
    $("reset").disabled = false;
    if (data.stats[0] >= 3) {
      playing = false;
      accumulator = 0;
      $("play").textContent = "↻ Replay";
    }
  }
};

function createFromControls() {
  return createScenario({
    preset: $("preset").value,
    speed: Number($("speed").value),
    stiffness: Number($("stiffness").value),
    offset: Number($("offset").value),
  });
}
function loadScenario(input, autoplay = false) {
  if (!ready) return;
  try {
    scenario = validateScenario(input);
  } catch (e) {
    fail(e.message);
    return;
  }
  // Ignore imported render metadata. Derive a safe visualization from topology.
  if (
    !Array.isArray(scenario.vehicles) ||
    scenario.vehicles.some(
      (v) =>
        !Number.isInteger(v.nodeStart) ||
        !Number.isInteger(v.nodeCount) ||
        v.nodeStart < 0 ||
        v.nodeCount < 1 ||
        v.nodeStart + v.nodeCount > scenario.nodes.length,
    )
  )
    scenario.vehicles = [];
  playing = false;
  pending = true;
  startOnLoad = autoplay;
  scrubbing = false;
  generation++;
  accumulator = 0;
  frames = [];
  latest = null;
  viewIndex = 0;
  $("play").disabled = true;
  $("play").textContent = "Resetting…";
  $("export-replay").disabled = true;
  $("error").hidden = true;
  $("timeline").max = "0";
  $("timeline").value = "0";
  $("scene-name").textContent = String(
    scenario.name || "Imported structure",
  ).slice(0, 100);
  buildScene();
  worker.postMessage({ type: "load", scenario, generation });
}

function buildScene() {
  renderGroup.traverse((obj) => {
    obj.geometry?.dispose();
    if (obj.material) {
      for (const m of Array.isArray(obj.material)
        ? obj.material
        : [obj.material])
        m.dispose();
    }
  });
  renderGroup.clear();
  meshes = [];
  wheels = [];
  const colors = [
    "#2778d8",
    "#e28b36",
    "#5fa67c",
    "#986ca9",
    "#bb5761",
    "#76a7ae",
    "#afa355",
    "#a1a1a1",
  ];
  const bodyIds = [...new Set(scenario.nodes.map((n) => n.body))];
  for (const body of bodyIds) {
    const tris = scenario.triangles
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => scenario.nodes[t[0]].body === body);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(tris.length * 9), 3),
    );
    const paint = new THREE.MeshPhysicalMaterial({
      color: colors[body],
      metalness: 0.22,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#254050",
      metalness: 0.15,
      roughness: 0.17,
      clearcoat: 1,
      side: THREE.DoubleSide,
    });
    const underbody = new THREE.MeshStandardMaterial({
      color: "#364854",
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    tris.forEach(({ i }, j) => {
      const panel = Array.isArray(scenario.panels)
        ? scenario.panels.find(
            (p) =>
              Number.isInteger(p.first) &&
              Number.isInteger(p.count) &&
              i >= p.first &&
              i < p.first + p.count,
          )
        : null;
      geometry.addGroup(
        j * 3,
        3,
        panel?.material === "glass"
          ? 1
          : panel?.material === "underbody"
            ? 2
            : 0,
      );
    });
    const mesh = new THREE.Mesh(geometry, [paint, glass, underbody]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    renderGroup.add(mesh);
    meshes.push({ mesh, tris });
    // Wheel markers only for our exact synthetic topology. Files need no visual metadata.
    const indices = scenario.nodes
      .map((n, i) => (n.body === body ? i : -1))
      .filter((i) => i >= 0);
    if (indices.length === 40 && indices.every((n, i) => n === indices[0] + i))
      for (const station of [1, 7])
        for (const side of [0, 1]) {
          const group = new THREE.Group();
          const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.33, 0.33, 0.17, 28),
            new THREE.MeshStandardMaterial({
              color: "#202c36",
              roughness: 0.92,
            }),
          );
          tire.rotation.x = Math.PI / 2;
          tire.castShadow = true;
          group.add(tire);
          const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.215, 0.215, 0.18, 12),
            new THREE.MeshStandardMaterial({
              color: "#a8b2bc",
              metalness: 0.7,
              roughness: 0.3,
            }),
          );
          rim.rotation.x = Math.PI / 2;
          group.add(rim);
          renderGroup.add(group);
          wheels.push({
            group,
            node: indices[0] + station * 4 + side,
            next: indices[0] + (station + 1) * 4 + side,
            side,
          });
        }
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(scenario.beams.length * 6), 3),
  );
  lineGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(scenario.beams.length * 6), 3),
  );
  beamLines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    }),
  );
  beamLines.frustumCulled = false;
  renderGroup.add(beamLines);
  if (scenario.environment.barrier) {
    barrierMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.8, 5),
      new THREE.MeshStandardMaterial({ color: "#8e9ca5", roughness: 0.9 }),
    );
    barrierMesh.position.set(scenario.environment.barrierX + 0.25, 0.9, 0);
    barrierMesh.castShadow = true;
    renderGroup.add(barrierMesh);
  }
  const positions = new Float32Array(scenario.nodes.flatMap((n) => n.position));
  applyFrame({
    positions,
    damage: new Float32Array(scenario.beams.length),
    stats: new Float32Array(8),
    elapsed: 0,
  });
}

function applyFrame(frame) {
  const { positions: p, damage, stats } = frame;
  for (const { mesh, tris } of meshes) {
    const attr = mesh.geometry.attributes.position;
    let out = 0;
    for (const { t } of tris)
      for (const index of t)
        for (let j = 0; j < 3; j++) attr.array[out++] = p[index * 3 + j];
    attr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
  if (beamLines) {
    const geometry = beamLines.geometry,
      pos = geometry.attributes.position,
      col = geometry.attributes.color;
    for (let i = 0; i < scenario.beams.length; i++) {
      const { a, b } = scenario.beams[i],
        d = damage[i];
      const rgb =
        d < 0
          ? [0.78, 0.06, 0.12]
          : d > 0.005
            ? [1, Math.max(0.15, 0.55 - d), 0.08]
            : [0.19, 0.29, 0.36];
      for (let j = 0; j < 3; j++) {
        pos.array[i * 6 + j] = p[a * 3 + j];
        pos.array[i * 6 + 3 + j] = p[b * 3 + j];
        col.array[i * 6 + j] = col.array[i * 6 + 3 + j] = rgb[j];
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    beamLines.visible = $("wireframe").checked;
  }
  for (const { group, node, next, side } of wheels) {
    const dx = p[next * 3] - p[node * 3],
      dz = p[next * 3 + 2] - p[node * 3 + 2],
      heading = Math.atan2(dz, dx);
    const offset = side === 0 ? -0.05 : 0.05;
    group.position.set(
      (p[node * 3] + p[next * 3]) / 2 - Math.sin(heading) * offset,
      (p[node * 3 + 1] + p[next * 3 + 1]) / 2 - 0.09,
      (p[node * 3 + 2] + p[next * 3 + 2]) / 2 + Math.cos(heading) * offset,
    );
    group.rotation.y = -heading;
  }
  $("clock").textContent = `${stats[0].toFixed(3)} s`;
  $("yielded").textContent = String(stats[4]);
  $("broken").textContent = String(stats[5]);
  $("contacts").textContent = String(stats[3]);
  $("cost").textContent = frame.elapsed
    ? frame.elapsed.toFixed(1) + " ms"
    : "—";
}

function showFrame(index) {
  if (!frames[index]) return;
  viewIndex = index;
  $("timeline").value = String(index);
  applyFrame(frames[index]);
}

function animate(now) {
  const elapsed = lastNow ? Math.min((now - lastNow) / 1000, 0.1) : 0;
  lastNow = now;
  frameCount++;
  if (playing && ready && latest) {
    accumulator = Math.min(
      accumulator + elapsed * Number($("rate").value),
      0.1,
    );
    const remaining = 3 - latest.stats[0];
    const ticks = Math.min(
      200,
      Math.floor(accumulator / 0.0005),
      Math.ceil(remaining / 0.0005),
    );
    if (!pending && ticks > 0) {
      accumulator -= ticks * 0.0005;
      pending = true;
      worker.postMessage({ type: "step", ticks, generation });
    }
  }
  controls.update();
  renderer.render(scene, camera);
}
function play() {
  if (!ready || !latest) return;
  // Pausing must take effect even while the worker is computing a batch.
  if (playing) {
    playing = false;
    accumulator = 0;
    $("play").textContent = "▶ Play";
    return;
  }
  if (latest.stats[0] >= 3 || scrubbing) {
    loadScenario(scenario, true);
    return;
  }
  playing = true;
  showFrame(frames.length - 1);
  lastNow = 0;
  accumulator = 0;
  $("play").textContent = "Ⅱ Pause";
}
$("play").onclick = play;
$("reset").onclick = () => loadScenario(scenario);
$("wireframe").onchange = () => {
  if (beamLines) beamLines.visible = $("wireframe").checked;
};
for (const id of ["preset", "speed", "stiffness", "offset"])
  $(id).addEventListener("input", () => {
    $("speed-value").textContent = $("speed").value + " km/h";
    $("stiffness-value").textContent =
      Number($("stiffness").value).toFixed(2) + "×";
    $("offset-value").textContent = Number($("offset").value).toFixed(2) + " m";
    $("offset").disabled = $("preset").value !== "offset";
    loadScenario(createFromControls());
  });
$("timeline").oninput = () => {
  playing = false;
  scrubbing = true;
  accumulator = 0;
  $("play").textContent = "↻ Replay";
  showFrame(Number($("timeline").value));
};
function download(name, data) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("export").onclick = () => download("ror-web-scenario.json", scenario);
$("export-replay").onclick = () =>
  download("ror-web-motion.json", {
    format: "ror-web-motion",
    version: 1,
    scenario,
    frames: frames.map((f) => ({
      time: f.stats[0],
      positions: Array.from(f.positions),
      damage: Array.from(f.damage),
    })),
  });
$("import").onclick = () => $("file").click();
$("file").onchange = async () => {
  const file = $("file").files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024)
      throw new Error("Scenario files must be smaller than 2 MB.");
    const input = JSON.parse(await file.text());
    validateScenario(input);
    // Files are data only. Drop optional visual metadata from imported scenarios.
    loadScenario({ ...input, vehicles: [], panels: [] });
  } catch (error) {
    fail(error.message);
  } finally {
    $("file").value = "";
  }
};
document.addEventListener("keydown", (event) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
      document.activeElement?.tagName,
    ) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    play();
  } else if (event.key.toLowerCase() === "r") loadScenario(scenario);
  else if (event.key.toLowerCase() === "w") {
    $("wireframe").checked = !$("wireframe").checked;
    $("wireframe").dispatchEvent(new Event("change"));
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    accumulator = 0;
    $("play").textContent = "▶ Play";
  }
});
// Read-only diagnostics used by the integration tests; no simulation control endpoint.
window.rorWebStatus = () => ({
  ready,
  playing,
  pending,
  frameCount,
  frames: frames.length,
  viewIndex,
  viewedTime: frames[viewIndex]?.stats[0] || 0,
  time: latest?.stats[0] || 0,
  contacts: latest?.stats[3] || 0,
  yielded: latest?.stats[4] || 0,
  broken: latest?.stats[5] || 0,
  renderer: renderer?.backend.isWebGPUBackend ? "webgpu" : "webgl",
  error: $("error").hidden ? null : $("error").textContent,
});
