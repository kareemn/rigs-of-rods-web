# Validation status

Initial local verification: 2026-09-13. This tests implementation behavior; it is not validation of real vehicle crashworthiness or equivalence to complete native RoR.

## Automated coverage

Native C++ checks:

- Zero force at rest and elastic force below yield.
- Compression/extension yield, permanent rest-length change, hardening and tensile strength reduction.
- Beam rupture and degenerate-length guard.
- Swept node/triangle contact and conservation of linear momentum for a dynamic point/triangle fixture.
- Identical integration results across different timestep batching.

Actual compiled WASM checks:

- Malformed data and C ABI index/timestep rejection.
- No contact or permanent deformation during the first 100 ms while cars are separated.
- Contact, permanent yielding and finite trajectories in full frontal, offset frontal, side-impact and barrier fixtures, each simulated for three seconds.
- Identical final node positions for the same timestep sequence grouped differently.
- Fresh initialization restores undeformed state.

Browser checks:

- Load the real WASM worker and renderer.
- Play through contact and verify permanent deformation.
- Pause, scrub back to the undeformed state, reset, export scenario data.
- Delay real worker frame delivery to verify that pause/scrub selection and a newer reset survive late replies.
- Check page errors and horizontal overflow at desktop and mobile viewport sizes.

The initial local browser run used Chrome on macOS with a WebGPU renderer. The mobile test is Chromium device emulation; physical iPhone/iOS Safari validation is still outstanding. A production-bundle smoke test and forced WebGL fallback test are also included before release.

Linux CI explicitly selects Chromium's SwiftShader software Vulkan adapter for WebGPU. These tests check function, not GPU performance. Desktop and mobile-layout projects assert that WebGPU was actually selected; the fallback project asserts WebGL 2.

## What remains unproven

- Real make/model response and measured acceleration/delta-V agreement.
- Numerical equivalence to full native RoR, including all collision/special-beam behavior.
- Penetration bounds for all corner, edge, self-contact and fracture cases.
- Accuracy of dissipated energy and contact work over complete crashes.
- Sustained performance, battery/thermal behavior and robustness on physical mobile devices.

Do not translate a passing implementation test into a claim of validated crash reconstruction.
