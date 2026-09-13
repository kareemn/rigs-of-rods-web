# GPL and a separate commercial application

Engineering guidance prepared 2026-09-13; not a legal opinion. Have open-source counsel review an intended proprietary integration before shipping it.

## What this repository does

The entire standalone web application—including the C++ port, worker, JavaScript renderer, UI and build scripts—is provided under GPL v3. The complete corresponding source is available. It works without any proprietary product and accepts user-selected scenario files. No commercial application code or data is included.

GPL allows charging money and commercial use. The question is whether distributed components are separate programs or one combined work, not whether the product is commercial.

## Boundaries are about substance

| Proposed integration | Assessment to take to counsel |
| --- | --- |
| Import the GPL WASM library into a proprietary frontend and exchange internal node/beam buffers every frame | Strong combined-work concern. Publishing only the solver source is not a sound assumption. |
| Put the same tight API in a worker, iframe, separate domain, or a separate repository | These technical boundaries do not automatically change the combined-work analysis. |
| Use the standalone GPL simulator with manual import/export of documented scenario and motion files | Stronger independent-program design, but the actual workflow and exchanged content still matter. This is the implemented approach. |
| Run an independent GPL simulator as a server-side process and return data or video | GPL v3 generally does not impose AGPL's network-source requirement solely for remote interaction. Any distribution of GPL code, proprietary linking, asset terms and actual integration still need review. This is not implemented here. |

A permissive wrapper cannot grant an exception to upstream GPL rights. We can license our own original contributions differently in principle, but we cannot unilaterally relicense upstream code or add a proprietary-linking exception for it.

## Distribution obligations

Serving a WASM executable to a browser delivers a copy to the user. Supply the matching complete corresponding source, notices, build scripts and instructions using a GPL-compliant method. Keep the source accessible with the binary version. The GitHub release workflow attaches source alongside the built site and adds a matching source archive to the static distribution. A link to an unrelated or outdated source tree is not sufficient.

This project pins npm dependencies in `package-lock.json`; their licenses remain in the dependency source distributions. The release packaging copies the Three.js MIT notice into the site. No proprietary vehicle mods are included. A vehicle mesh/model's asset license is a separate question from the simulator's code license.

Simulation output is not automatically GPL-covered just because a GPL tool produced it. If the output contains copyrighted code, artwork or model content, those materials can carry their own terms. Do not assume all exported vehicle data is unrestricted.

## Primary references

- [RoR license notice](https://github.com/RigsOfRods/rigs-of-rods#license)
- [GNU GPL v3, especially sections 1, 5 and 6](https://www.gnu.org/licenses/gpl-3.0.html)
- [FSF FAQ: GPL software in a proprietary system](https://www.gnu.org/licenses/gpl-faq.html#GPLInProprietarySystem)
- [FSF FAQ: aggregation vs a combined program](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation)
- [FSF FAQ: wrappers](https://www.gnu.org/licenses/gpl-faq.html#GPLWrapper)
- [FSF FAQ: program output](https://www.gnu.org/licenses/gpl-faq.html#WhatCaseIsOutputGPL)

The FSF FAQ describes the FSF's interpretation; it is not a ruling that resolves every browser/WASM arrangement. No proprietary integration has been approved by this document.
