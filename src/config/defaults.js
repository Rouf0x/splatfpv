export const STORAGE_KEY = 'splatfpv-settings-v2';

export const DEFAULT_SETTINGS = {
  flight: {
    maxRoll: 680,
    maxPitch: 680,
    maxYaw: 320,
    rateExpo: 0.25,
    response: 18,
    angularDrag: 2.5,
    twr: 2.4,
    drag: 0.35,
    mass: 0.65,
    motorResponse: 12,
    worldScale: 1,
    hoverAssist: false,
    hoverStrength: 0.35,
  },
  camera: {
    camTilt: 25,
    camFov: 110,
    chaseDist: 2.8,
    chaseHeight: 0.4,
  },
  world: {
    groundEnabled: false,
    groundHeight: 0,
    autoGround: true,
    splatScale: 1,
    splatPosX: 0,
    splatPosY: 0,
    splatPosZ: 0,
    splatRotX: 0,
    splatRotY: 0,
    // Imported splats commonly come in facing backwards relative to the
    // FPV camera/flight axes — 180° on Z corrects that on load by default.
    splatRotZ: 180,
  },
  controls: {
    keyboardThrottleMode: 'hold',
    invertPitch: false,
    invertRoll: false,
    invertYaw: false,
    keyboardSensitivity: 1,
    showStickPreview: true,
  },
  gamepad: {
    enabled: true,
    deadzone: 0.08,
    sensitivity: { throttle: 1, yaw: 1, pitch: 1, roll: 1 },
    invert: { throttle: false, yaw: true, pitch: true, roll: true },
    // One entry per raw gp.axes[N]. "action" is what it controls (or 'none').
    // min/center/max are raw stick-position calibration, captured via the
    // Settings → Gamepad calibration wizard — not assumed to be -1..1.
    channels: [
      { action: 'yaw', min: -1, center: 0, max: 1 },
      { action: 'throttle', min: -1, center: 0, max: 1 },
      { action: 'roll', min: -1, center: 0, max: 1 },
      { action: 'pitch', min: -1, center: 0, max: 1 },
      { action: 'none', min: -1, center: 0, max: 1 },
      { action: 'none', min: -1, center: 0, max: 1 },
      { action: 'none', min: -1, center: 0, max: 1 },
      { action: 'none', min: -1, center: 0, max: 1 },
    ],
  },
};

// Quick-select rate profiles, mirroring the difficulty/rate presets found in
// most FPV sims (Liftoff, Velocidrone) — a fast starting point, not a limit;
// every value stays adjustable on the sliders below.
export const RATE_PRESETS = {
  cinematic: { maxRoll: 220, maxPitch: 220, maxYaw: 160, rateExpo: 0.45, response: 10, angularDrag: 3.5 },
  sport:     { maxRoll: 450, maxPitch: 450, maxYaw: 250, rateExpo: 0.3, response: 15, angularDrag: 2.5 },
  race:      { maxRoll: 680, maxPitch: 680, maxYaw: 320, rateExpo: 0.2, response: 22, angularDrag: 1.8 },
};

export const DEMO_SPLAT_URL = 'https://developer.playcanvas.com/assets/toy-cat.sog';

export const GRAVITY = -9.81;
export const DRONE_MASS_KG = 0.65;
