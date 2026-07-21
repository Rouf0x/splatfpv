# FPV Splat Sim

Browser-based FPV drone simulator for flying through 3D Gaussian Splat scenes.

## Quick start

Serve the project over HTTP (required for ES modules):

```bash
cd splatfpv
python3 -m http.server 8080
```

Open [http://localhost:8080/](http://localhost:8080/)

Load a splat via drag-and-drop, URL, or the demo button. Orbit the scene in preview mode, then press **SPACE** to launch.

## Controls

| Input | Action |
|-------|--------|
| W/S | Throttle up/down |
| A/D | Yaw |
| Arrow keys | Pitch / roll |
| SPACE | Arm/disarm · launch from preview |
| R | Reset drone |
| C | Toggle FPV / chase camera |
| ESC | Return to preview orbit |

Gamepad: configurable axis mapping in Settings → Gamepad. Supports Mode 1/2/3 presets and stick center calibration.

## Settings

Open via the **Settings** tile on the main menu, or the gear icon (top-right) once a scene is loaded:

- **General** — export/import settings as JSON, reset to defaults
- **Flight** — rates, expo, TWR, drag, hover assist
- **Camera** — FPV tilt, FOV, chase cam
- **World** — ground collision (off by default), splat scale/position/rotation
- **Controls** — keyboard inversions and sensitivity
- **Gamepad** — enable/disable, sensitivity, deadzone, inversions; controller calibration wizard is on the main menu

Every change saves to `localStorage` immediately — there's no separate "apply" step, and nothing is lost if you close the panel.

## Supported formats

`.ply`, `.compressed.ply`, `.sog`, `.meta.json`, `.lod-meta.json`

## URL parameter

```
?content=https://example.com/scene.sog
```

## Project structure

```
index.html          Entry point
css/                Stylesheets
src/
  main.js           App bootstrap
  config/           Defaults
  core/             PlayCanvas scene, cameras, splat loading
  physics/          Quadcopter physics
  input/            Keyboard, gamepad, touch
  flight/           Flight mode / arm state
  ui/               HUD, settings, load screen
  storage/          Settings persistence
```

## Notes

- No scene collision — an optional, off-by-default ground plane (Settings → World) is the only collision available
- Imported splats are rotated 180° on Z by default (Settings → World → Rotation Z) to correct for how most exports are oriented
- Requires network for PlayCanvas CDN on first load
- Original single-file version kept as `fpv-splat-drone.html`

## License

MIT — see [LICENSE](LICENSE).
