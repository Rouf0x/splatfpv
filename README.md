# FPV Splat Sim

**Live demo: [roufox.dev/splatfpv](https://roufox.dev/splatfpv)**

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

Input | Action
W/S | Throttle up/down
A/D | Yaw
Arrow keys | Pitch / roll
SPACE | Arm/disarm/launch from preview
R | Reset drone
C | Toggle FPV / chase camera
ESC | Return to preview orbit

Gamepad: configurable axis mapping in Settings → Gamepad. Supports Mode 1/2/3 presets and stick center calibration.

## Settings

Open via the **Settings** tile on the main menu, or the gear icon (top-left, next to the mute button) once a scene is loaded:

- **General**: export/import settings as JSON, reset to defaults
- **Flight**: rates, expo, TWR, drag, hover assist
- **Camera**: FPV tilt, FOV, fisheye lens effect, chase cam
- **Controls**: keyboard inversions and sensitivity
- **Gamepad**: enable/disable, sensitivity, deadzone, inversions; controller calibration wizard is on the main menu

**World** settings (sky color, ground collision, splat scale/position/rotation, LOD) live on the scene-setup screen instead, with a live preview behind the sidebar as you adjust them.

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
  core/             PlayCanvas scene, cameras, drone model, post effects, splat loading
  audio/            Procedural motor/wind audio engine
  physics/          Quadcopter physics
  input/            Keyboard, gamepad, touch
  flight/           Flight mode / arm state
  ui/               HUD, settings, load screen
  storage/          Settings persistence
```

## License

MIT — see [LICENSE](LICENSE).
