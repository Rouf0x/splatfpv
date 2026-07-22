export const STORAGE_KEY = 'splatfpv-settings-v2';

export const DEFAULT_SETTINGS = {
  flight: {
    maxRoll: 660,
    maxPitch: 660,
    maxYaw: 660,
    rateExpo: 0.55,
    response: 14,
    angularDrag: 0,
    twr: 3.3,
    drag: 0.09,
    vertDrag: 0.17,
    mass: 0.377,
    motorResponse: 30,
    worldScale: 1,
    hoverAssist: false,
    hoverStrength: 0.35,
    // 'acro' = stick sets rotation rate, no self-level (current behavior).
    // 'angle' = stick sets a target lean angle and climb rate, closed-loop
    // corrected each frame — matches how GPS/camera drones (e.g. Avata 2 in
    // Normal/Sport mode) actually fly, rather than raw open-loop thrust.
    controlMode: 'acro',
    maxTiltAngle: 35,
    maxClimbRate: 9.5,
  },
  camera: {
    camTilt: 10,
    camFov: 110,
    chaseDist: 2.8,
    chaseHeight: 0.4,
    fisheye: false,
  },
  world: {
    // Shows through anywhere the splat itself doesn't cover — camera clear
    // color, effectively, but framed as "sky" since that's what it reads as
    // for an outdoor scan with open space above/around it.
    skyColor: '#87ceeb',
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
    // Only affects formats that actually carry multiple detail levels
    // (.compressed.ply / .lod-meta.json) — forces the finest level at any
    // distance instead of coarsening farther splats for performance.
    lodDisabled: false,
  },
  controls: {
    keyboardThrottleMode: 'hold',
    invertPitch: false,
    invertRoll: false,
    invertYaw: false,
    keyboardSensitivity: 1,
    showStickPreview: true,
    audioVolume: 0.7,
    muted: false,
  },
  gamepad: {
    enabled: true,
    deadzone: 0.02,
    sensitivity: { throttle: 0.8, yaw: 0.8, pitch: 0.8, roll: 0.8 },
    invert: { throttle: false, yaw: true, pitch: true, roll: true },
    // One entry per raw gp.axes[N]. "action" is what it controls (or 'none').
    // min/center/max are raw stick-position calibration, captured via the
    // Settings → Gamepad calibration wizard — not assumed to be -1..1. Left
    // as 'none' by default (rather than baking in any one controller's axis
    // order) so every new gamepad still goes through the calibration wizard
    // instead of silently inheriting a mapping tuned for different hardware.
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
