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

// Reaching this fraction of the calibrated span already counts as full
// deflection. The calibration wizard records whatever min/max it observes
// during a live sweep, which routinely includes a brief overshoot/bounce
// (or plain driver noise) a little past where the stick actually sits under
// normal, deliberate full-stick pressure — without this margin, every
// calibrated axis feels like it caps out around 90%/10% and never quite
// reaches 0%/100% in real play.
const AXIS_SATURATION_MARGIN = 0.92;

// Maps a raw axis reading through a calibrated min/center/max into -1..1.
// Handles asymmetric or unipolar hardware (e.g. a trigger-style throttle
// that natively reports 0..1 instead of -1..1) correctly, since each side
// of center is scaled independently.
export function normalizeAxis(raw, cal) {
  if (raw >= cal.center) {
    const span = (cal.max - cal.center) * AXIS_SATURATION_MARGIN;
    return span <= 0 ? 0 : clamp((raw - cal.center) / span, 0, 1);
  }
  const span = (cal.center - cal.min) * AXIS_SATURATION_MARGIN;
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

// Wraps a degree value into (-180, 180] so angle errors near the +/-180
// boundary don't produce a spurious near-360-degree correction.
export function wrapDeg(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}