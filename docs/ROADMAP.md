# Port roadmap

## Available in 0.1

- Compile the extracted RoR ordinary-beam solver to real WASM.
- Demonstrate permanent crush with synthetic structures in a standalone browser app.
- Publish the complete GPL source, upstream provenance and build/test tooling.

## Next: compatibility and contact

- Create a strict parser for a documented subset of RoR `.truck`: nodes, ordinary beams, material defaults and collision faces. Reject unsupported sections explicitly.
- Port or replace the production contact mechanisms with attribution and tests. Add edge/edge CCD, self-collision, friction and persistent contact constraints.
- Add deformation-aware contact surfaces and correct topological updates after fracture.
- Test side and corner impacts with geometry-based penetration tolerances, conservation checks and energy accounting.

## Next: vehicle structure and rendering

- Support authored node/beam cages with independently licensed detailed outer meshes.
- Port suspension, tire and wheel dynamics and relevant special beams.
- Map panels to structural nodes; handle detached parts rather than keeping broken surfaces attached.
- Interpolate visual snapshots while keeping physics fixed-step.
- Benchmark and validate on physical iPhones, Android devices and desktop browsers.

## Calibration and real cases

- Compare native RoR and ported trajectories on matching supported structures.
- Establish regression cases against independently measured crash data.
- Keep observed acceleration/delta-V curves immutable and clearly distinguish simulated predictions from measurements.
- Fit uncertain model parameters against evidence; never present visual damage as proof of a unique reconstruction.

## Commercial interoperability

- Have counsel review any specific proposed integration. The current standalone app/file workflow does not grant a proprietary-linking exception.
- Prefer a documented exchange of useful files between independent applications when that fits the product. Do not equate a worker or iframe boundary with a legal determination.
