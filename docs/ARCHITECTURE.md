# Architecture

```text
Standalone GPL browser application
    Scenario editor / JSON files
              |
       validateScenario()
              |
      physics-worker.js
              |
       C ABI -> WASM
       world.hpp (new host + experimental contact)
       beam.hpp  (RoR-derived normal-beam solver)
              |
    transferable frame snapshots
              |
      Three.js WebGPU renderer
        WebGL 2 fallback
```

Everything shown above is part of this GPL application. Worker messages and the C ABI are internal implementation interfaces, not a licensing exception for proprietary callers.

## Physics

The world advances at 0.0005 s. A step clears forces, accumulates equal/opposite beam forces, advances velocity and position, then resolves contact. Ordinary beams have elastic stiffness, damping, compressive and tensile yield forces, permanent rest length, plastic coefficient, and breaking strength. A simplified connectivity guard protects surface nodes from complete disconnection.

Contact uses body bounds followed by node/triangle closest points. A swept entry check detects some face crossings within a substep. Contact corrections and zero-restitution impulses are distributed using node inverse masses and triangle barycentric weights. This is a new prototype contact system with the limitations listed in the README. Contact-event counters count solver contacts, including repeated iterations, not unique real-world collisions.

## Runtime and performance

The WASM binary uses SIMD and runs in one worker. The renderer stays on the browser main thread. Each request advances at most 200 ticks (100 ms); snapshots are transferred rather than JSON-encoded per frame. Browser time is accumulated separately from fixed physics time. Backlog is capped to avoid runaway catch-up; under sustained load the visualization advances more slowly. The UI reports worker batch duration, not frames per second.

Changing the scenario increments a generation token; results from an earlier generation are ignored. The demo retains up to three simulated seconds of frames for scrubbing. Hidden tabs pause. The initial implementation does not interpolate snapshots, replay arbitrary rigid-body state, or support rewind-and-continue; playing from a scrubbed frame starts a fresh run.

## Data and security

The app makes no API calls for simulation and has no account system or credentials. Initial JS/WASM assets come from the site's origin. Imported JSON has a 2 MB limit and bounded node/beam/triangle counts and values; it cannot execute scripts or specify a WASM URL. Imported render metadata is discarded. The C ABI also checks counts and indices. Input checks reduce accidental invalid scenarios, but this numerical prototype is not an adversarial sandbox or a production service.

## Rendering

Synthetic body faces follow solver node positions. The beam overlay displays changed rest length and breaking, not elastic stress. Wheels indicate scale/location only. Vehicle make/model geometry, tire deformation, advanced suspension and realistic panel detachment remain future work. Three.js/WebGPU handles lighting and shading; it does not execute the C++ physics on the GPU.
