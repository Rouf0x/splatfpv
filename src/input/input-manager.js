import { applyDeadzone, applyExpo, clamp, normalizeAxis } from '../utils/math.js';

const MAX_CHANNELS = 8;

export class InputManager {
  constructor(settingsStore) {
    this.settingsStore = settingsStore;
    this.keys = new Set();
    this.gamepadIndex = null;
    this.prevGpButtons = {};
    this.touch = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, active: false };
    this.rangeCapture = null;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
    });

    this.setupTouch();
  }

  setupTouch() {
    const left = document.getElementById('stickLeft');
    const right = document.getElementById('stickRight');
    if (!left || !right) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      document.getElementById('touchControls').hidden = false;
    }

    const bindStick = (el, target) => {
      const knob = el.querySelector('.stick-knob');
      const radius = 38;
      let touchId = null;

      const update = (cx, cy) => {
        const rect = el.getBoundingClientRect();
        const cx0 = rect.left + rect.width / 2;
        const cy0 = rect.top + rect.height / 2;
        let dx = cx - cx0;
        let dy = cy - cy0;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) {
          dx = (dx / dist) * radius;
          dy = (dy / dist) * radius;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        target.x = dx / radius;
        target.y = -dy / radius;
        this.touch.active = true;
      };

      const reset = () => {
        knob.style.transform = 'translate(-50%, -50%)';
        target.x = 0;
        target.y = 0;
        touchId = null;
      };

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        touchId = t.identifier;
        update(t.clientX, t.clientY);
      }, { passive: false });

      el.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) update(t.clientX, t.clientY);
        }
      }, { passive: false });

      el.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) reset();
        }
      });
    };

    bindStick(left, this.touch.left);
    bindStick(right, this.touch.right);
  }

  readGamepad() {
    const pads = navigator.getGamepads?.() || [];
    if (this.gamepadIndex !== null && pads[this.gamepadIndex]) {
      return pads[this.gamepadIndex];
    }
    return Array.from(pads).find(Boolean) || null;
  }

  // Each raw gp.axes[N] is an independently calibrated + assignable channel
  // (see defaults.js gamepad.channels) — there's no assumption of a
  // "standard" 2-stick layout, since real hardware (RC transmitters via USB
  // dongle, HOTAS throttles, etc.) routinely reports axes in a different
  // order, with different polarity, and non-symmetric ranges (e.g. a
  // trigger-style throttle reporting 0..1 instead of -1..1).
  readGamepadSticks(gp, cfg) {
    const out = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };

    cfg.channels.forEach((ch, i) => {
      if (ch.action === 'none') return;
      const raw = gp.axes[i];
      if (raw === undefined) return;

      const normalized = normalizeAxis(raw, ch);
      let value = applyDeadzone(normalized, cfg.deadzone);
      // Throttle is unipolar (0-100%) and must always be able to reach both
      // ends of its range — unlike yaw/pitch/roll, a sensitivity multiplier
      // here would make full-stick throttle permanently unreachable (e.g.
      // 0.8 sensitivity caps it to 10%-90% no matter how well calibrated).
      if (ch.action !== 'throttle') value *= cfg.sensitivity[ch.action];
      if (cfg.invert[ch.action]) value = -value;
      value = clamp(value, -1, 1);

      if (ch.action === 'throttle') {
        // Calibrated min = 0% throttle, calibrated max = 100%. Works for a
        // friction-held stick (min ~= center, idle at one end) and for a
        // spring-centered stick (min/max are the true -1..1 extremes).
        out.throttle = clamp((value + 1) / 2, 0, 1);
      } else {
        out[ch.action] = value;
      }
    });

    return out;
  }

  readKeyboardSticks(controls, state, dt) {
    const sens = controls.keyboardSensitivity;
    let throttle = state.throttleTarget;
    const rate = 1.2 * sens;

    if (this.keys.has('KeyW')) throttle = clamp(throttle + rate * dt, 0, 1);
    if (this.keys.has('KeyS')) throttle = clamp(throttle - rate * dt, 0, 1);

    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    if (this.keys.has('KeyA')) yaw -= 1;
    if (this.keys.has('KeyD')) yaw += 1;
    if (this.keys.has('ArrowUp')) pitch -= 1;
    if (this.keys.has('ArrowDown')) pitch += 1;
    if (this.keys.has('ArrowLeft')) roll -= 1;
    if (this.keys.has('ArrowRight')) roll += 1;

    if (controls.invertPitch) pitch = -pitch;
    if (controls.invertRoll) roll = -roll;
    if (controls.invertYaw) yaw = -yaw;

    return { throttle, yaw, pitch, roll };
  }

  // Fixed on-screen touch layout (left stick = throttle/yaw, right stick =
  // pitch/roll — matches the THR/YAW and PITCH/ROLL labels in the HUD).
  // Independent of gamepad channel calibration since it's a virtual control
  // with a known, fixed -1..1 range.
  readTouchSticks() {
    const lx = this.touch.left.x;
    const ly = this.touch.left.y;
    const rx = this.touch.right.x;
    const ry = this.touch.right.y;
    return {
      throttle: clamp((ly + 1) / 2, 0, 1),
      yaw: lx,
      roll: rx,
      pitch: ry,
    };
  }

  poll(state, dt) {
    const controls = this.settingsStore.controls;
    const gpCfg = this.settingsStore.gamepad;
    const flight = this.settingsStore.flight;

    let sticks = { throttle: state.throttleTarget, yaw: 0, pitch: 0, roll: 0 };
    let source = 'keyboard';
    let gp = null;

    if (gpCfg.enabled) {
      gp = this.readGamepad();
      if (gp) {
        if (this.rangeCapture) this.sampleRange(gp);
        sticks = this.readGamepadSticks(gp, gpCfg);
        source = 'gamepad';
      }
    }

    if (source === 'keyboard') {
      if (this.touch.active) {
        sticks = this.readTouchSticks();
        source = 'touch';
      } else {
        sticks = this.readKeyboardSticks(controls, state, dt);
        if (controls.keyboardThrottleMode === 'hold') {
          state.throttleTarget = sticks.throttle;
        }
      }
    } else {
      state.throttleTarget = sticks.throttle;
    }

    const expo = flight.rateExpo;
    sticks.yaw = applyExpo(sticks.yaw, expo);
    sticks.pitch = applyExpo(sticks.pitch, expo);
    sticks.roll = applyExpo(sticks.roll, expo);

    return { sticks, source, gp };
  }

  pollButtons(gp, handlers) {
    if (!gp) return;
    const btn = (i) => !!(gp.buttons[i]?.pressed);
    if (btn(0) && !this.prevGpButtons[0]) handlers.onArmToggle?.();
    if (btn(1) && !this.prevGpButtons[1]) handlers.onReset?.();
    if (btn(3) && !this.prevGpButtons[3]) handlers.onCycleCamera?.();
    for (let i = 0; i < gp.buttons.length; i++) {
      this.prevGpButtons[i] = btn(i);
    }
  }

  // --- Calibration wizard -------------------------------------------------
  // 1. captureCenter(gp): call while all sticks/throttle are at rest.
  // 2. startRangeCapture() / stopRangeCapture(): call start, then have the
  //    user sweep every control through its full travel, then call stop —
  //    every channel's observed min/max across that window is recorded.

  captureCenter(gp) {
    if (!gp) return null;
    return Array.from(gp.axes).slice(0, MAX_CHANNELS);
  }

  startRangeCapture() {
    this.rangeCapture = {
      min: new Array(MAX_CHANNELS).fill(Infinity),
      max: new Array(MAX_CHANNELS).fill(-Infinity),
    };
  }

  sampleRange(gp) {
    const { min, max } = this.rangeCapture;
    for (let i = 0; i < MAX_CHANNELS; i++) {
      const v = gp.axes[i];
      if (v === undefined) continue;
      if (v < min[i]) min[i] = v;
      if (v > max[i]) max[i] = v;
    }
  }

  stopRangeCapture() {
    const result = this.rangeCapture;
    this.rangeCapture = null;
    return result;
  }
}
