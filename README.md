# NULL//ASCENT

A premium sci-fi dark-fantasy action roguelite built for the browser, with WebGPU-first rendering and WebGL fallback.

> **Project status:** active development. The repository starts empty; the first implementation is being built as a cohesive playable game, not as an inline ChatGPT visualization.

## Vision

A fast, readable, high-impact arena roguelite. The player is an exiled breach-runner fighting through a collapsing megastructure. Combat is deliberate: movement, dash timing, aiming, weapon cadence, enemy telegraphs, and build synergies all matter. Visual direction is grounded sci-fi dark fantasy: dark brushed metal, ceramic armor, translucent energy, physically based materials, restrained emissive accents, volumetric atmosphere, contact shadows, and strong composition. No 8-bit/pixel-art presentation.

## Technology

- Babylon.js with asynchronous WebGPU initialization and a WebGL fallback.
- Vite for development and production builds.
- JavaScript ES modules, Vitest for deterministic gameplay tests, Playwright for browser smoke tests.
- Web Audio API for original synthesized ambience, combat feedback, and adaptive layers. No external account, MCP approval, or paid service is required.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Chrome/Edge with WebGPU support uses WebGPU; other supported browsers use WebGL fallback.

## Controls

- WASD: move
- Mouse: aim
- Left mouse button: fire
- Space / Shift: dash
- E: special ability
- P / Escape: pause

## Verification

```bash
npm test
npm run build
npm run test:e2e
```

## Asset policy

Prefer original procedural game assets and CC0 resources. Poly Haven HDRIs, models, and PBR textures are CC0; see [Poly Haven license](https://polyhaven.com/license). Third-party art and audio must have an explicit compatible license recorded in `ASSETS.md`.

## Project documents

- [Game design](docs/GAME_DESIGN.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Asset and audio credits](ASSETS.md)
- [Changelog](CHANGELOG.md)
