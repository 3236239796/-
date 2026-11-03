# Asset and Audio Credits

## Music: Dark Sci-Fi Audio Pack
- **Creator:** SRG774
- **Source:** https://opengameart.org/content/dark-sci-fi-audio-pack
- **License:** CC0 1.0 Universal / Public Domain Dedication. Commercial use, modification and redistribution are permitted.
- **Original production:** Hand-produced in Ableton Live Suite.
- **Tracks used:** Sector (exploration), Airy (menu / low-threat ambience), Urgent (combat), Pulse (boss / high-threat layer), Transmission (defeat / release), Victory (win result).
- **Original download URLs and integrity checks:** maintained in `scripts/fetch-audio.mjs`. The script verifies the downloaded byte count and SHA-256 where the source metadata provides one.
- **Delivery:** Audio is downloaded into ignored `public/audio/` before Vite dev and production builds. It is not committed as opaque binary blobs. When the OpenGameArt host is unavailable, the script uses verified CC0 loop-conditioned mirrors for Sector, Airy and Transmission, or documented CC0 re-encodes for the remaining tracks.
- **Looping note:** The pack author describes the tracks as loopable and recommends engine-side crossfading for the smoothest joins. The fallback mirrors for Sector, Airy and Transmission are 128 kbps, normalized and 2-second crossfaded; source originals remain preferred when their integrity checks pass.

## PBR texture
- **Metal Plate 02** by Rob Tuytel, Poly Haven. CC0.
  - Source: https://polyhaven.com/a/metal_plate_02
  - Used for industrial steel surfaces. Runtime source maps are loaded by the scene.
  
## Environment HDRI
- **Industrial Workshop Foundry** by Dimitrios Savva (photography) and Jarod Guest (processing), Poly Haven. CC0.
  - Source: https://polyhaven.com/a/industrial_workshop_foundry
  - Used for image-based lighting and the arena skybox at 1K resolution.

## Fonts
- Barlow Condensed and DM Sans from Google Fonts, distributed under the SIL Open Font License. Local system fallbacks are provided.

## Original assets
The player, enemies, arena architecture, weapon geometry, UI, particles, combat sound effects and environmental drone are original procedural work created for NULL//ASCENT.

## Asset policy
Only assets with explicit redistribution-compatible licenses are included. Source URL, creator, license, and any processing are documented. The project does not claim authorship of third-party recordings.
