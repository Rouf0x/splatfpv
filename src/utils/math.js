export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function applyDeadzone(value, deadzone) {
  if (Math.abs(value) < deadzone) return 0;
  const sign = Math.sign(value);
  return sign * (Math.abs(value) - deadzone) / (1 - deadzone);
}

// Maps a raw axis reading through a calibrated min/center/max into -1..1.
// Handles asymmetric or unipolar hardware (e.g. a trigger-style throttle
// that natively reports 0..1 instead of -1..1) correctly, since each side
// of center is scaled independently.
export function normalizeAxis(raw, cal) {
  if (raw >= cal.center) {
    const span = cal.max - cal.center;
    return span <= 0 ? 0 : clamp((raw - cal.center) / span, 0, 1);
  }
  const span = cal.center - cal.min;
  return span <= 0 ? 0 : clamp((raw - cal.center) / span, -1, 0);
}

export function applyExpo(stick, expo) {
  const a = Math.abs(stick);
  return Math.sign(stick) * (a * a * a * expo + a * (1 - expo));
}

export function integrateBodyRates(quat, bodyRates, dt) {
  const wx = bodyRates.x * dt * 0.5;
  const wy = bodyRates.y * dt * 0.5;
  const wz = bodyRates.z * dt * 0.5;

  const qx = quat.x;
  const qy = quat.y;
  const qz = quat.z;
  const qw = quat.w;

  quat.x += qw * wx + qy * wz - qz * wy;
  quat.y += qw * wy + qz * wx - qx * wz;
  quat.z += qw * wz + qx * wy - qy * wx;
  quat.w += -qx * wx - qy * wy - qz * wz;
  quat.normalize();
}

export function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function hoverThrottle(twr) {
  return clamp(1 / Math.max(twr, 1.01), 0, 1);
}

export function angularDamping(value, damping, dt) {
  return value * Math.exp(-damping * dt);
}