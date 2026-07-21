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

  updateStickPreview(sticks) {
    const throttleY = (1 - 2 * sticks.throttle) * SP_RADIUS;
    const yawX = sticks.yaw * SP_RADIUS;
    document.getElementById('spLeftDot').style.transform =
      `translate(calc(-50% + ${yawX}px), calc(-50% + ${throttleY}px))`;
    document.getElementById('spLeftReadout').textContent =
      `T ${(sticks.throttle * 100).toFixed(0)}% · Y ${sticks.yaw.toFixed(2)}`;

    const rollX = sticks.roll * SP_RADIUS;
    const pitchY = sticks.pitch * SP_RADIUS;
    document.getElementById('spRightDot').style.transform =
      `translate(calc(-50% + ${rollX}px), calc(-50% + ${pitchY}px))`;
    document.getElementById('spRightReadout').textContent =
      `R ${sticks.roll.toFixed(2)} · P ${sticks.pitch.toFixed(2)}`;
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
