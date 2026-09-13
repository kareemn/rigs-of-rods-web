# Source provenance

- Project: [RigsOfRods/rigs-of-rods](https://github.com/RigsOfRods/rigs-of-rods)
- Pinned commit: `8c821c05250971d316a75b84a8503b07a65d056d`
- Original file: [`source/main/physics/ActorForcesEuler.cpp`](https://github.com/RigsOfRods/rigs-of-rods/blob/8c821c05250971d316a75b84a8503b07a65d056d/source/main/physics/ActorForcesEuler.cpp)
- The unchanged original is included as `upstream/ActorForcesEuler.cpp` for comparison, not compilation.
- SHA-256: `4fe4f4962892dc340588425dad3c081bf745273e5e6c1b4395309c87d61e2b95`
- Original attribution: Copyright 2005–2012 Pierre-Michel Ricordel; Copyright 2007–2012 Thomas Fischer; additional contributors listed in the preserved upstream authors file.
- Upstream file notice specifies GPL version 3. This distribution uses GPL-3.0-only, consistent with that notice.
- Extraction/modification date: 2026-09-13.

## What was adapted

`physics/beam.hpp::beamForce` adapts the ordinary `BEAM_NORMAL` branch of `Actor::CalcBeams`, principally upstream lines 1210–1459. It preserves the spring/damper force sign convention, compression and extension yield tests, plastic rest-length update, 0.1 m minimum compressed length, hardening rules, expansion strength reduction and break-force attenuation. Tests exercise those behaviors.

The engine's `PHYSICS_DT` value, 0.0005 seconds, comes from `source/main/physics/SimConstants.h`. The host uses semi-implicit Euler integration, matching the integration ordering in `CalcNodes` for unpinned nodes.

## Deliberate differences

- Ogre vectors and `fast_invSqrt` are replaced by a small POD vector and standard square root; near-zero length is guarded.
- Node pointers become bounded array indices. Positions are world coordinates rather than actor-relative positions, limited by the JSON loader to a small world.
- The per-beam cached minimum stress threshold is computed directly.
- `canBreak` is supplied by the standalone host. It conservatively keeps at least two active beam connections at every node, not only collision-cab nodes.
- No shocks, hydros, ropes, support beams, inter-actor beams, wheel detachers, detacher groups, buoyancy, sound, trigger hooks or debug-console integration.
- `world.hpp` is a new host and contact implementation. It is not copied from or equivalent to the full RoR collision implementation.
- No original vehicle model is imported or represented as calibrated.

This is a derived solver extraction, not a clean-room reimplementation and not a successful compilation of the entire RoR desktop source tree. A future upstream update must be pinned, reviewed, attributed, and validated again.
