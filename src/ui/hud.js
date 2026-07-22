import { hoverThrottle } from '../utils/math.js';

const SP_RADIUS = 30; // px — half the travel of a .sp-gimbal box, minus dot size

export class Hud {
  constructor(settingsStore) {
    this.settingsStore = settingsStore;
    this.el = document.getElementById('hud');
    this.el.classList.toggle('no-stick-preview', !settingsStore.controls.showStickPreview);
  }

  setStickPreviewVisible(visible) {
    this.el.classList.toggle('no-stick-preview', !visible);
  }

  setMode(mode, camView) {
    this.el.classList.toggle('flying', mode === 'flying');
    document.getElementById('camLabel').textContent = camView.toUpperCase();
  }

  // Uses sticks.raw (pre-invert) rather than the top-level, possibly-inverted
  // values — this is meant to read as "where is my thumb", so it shouldn't
  // flip just because an invert setting was turned on to fix flight
  // direction on a backwards-wired axis.
  updateStickPreview(sticks) {
    const raw = sticks.raw;
    const throttleY = (1 - 2 * raw.throttle) * SP_RADIUS;
    const yawX = raw.yaw * SP_RADIUS;
    document.getElementById('spLeftDot').style.transform =
      `translate(calc(-50% + ${yawX}px), calc(-50% + ${throttleY}px))`;
    document.getElementById('spLeftReadout').textContent =
      `T ${(raw.throttle * 100).toFixed(0)}% · Y ${raw.yaw.toFixed(2)}`;

    const rollX = raw.roll * SP_RADIUS;
    const pitchY = raw.pitch * SP_RADIUS;
    document.getElementById('spRightDot').style.transform =
      `translate(calc(-50% + ${rollX}px), calc(-50% + ${pitchY}px))`;
    document.getElementById('spRightReadout').textContent =
      `R ${raw.roll.toFixed(2)} · P ${raw.pitch.toFixed(2)}`;
  }

  update(state, sticks) {
    const world = this.settingsStore.world;
    const flight = this.settingsStore.flight;

    document.getElementById('alt').textContent = (state.pos.y - world.groundHeight).toFixed(1);
    document.getElementById('spd').textContent = (state.vel.length() * flight.worldScale).toFixed(1);
    document.getElementById('vsi').textContent = state.vel.y.toFixed(1);

    if (sticks) this.updateStickPreview(sticks);

    const hover = hoverThrottle(flight.twr);
    document.getElementById('hoverThr').textContent = `${(hover * 100).toFixed(0)}%`;

    document.getElementById('crashBanner').hidden = !state.crashed;
  }
}
