// Procedural motor + wind audio — synthesized from live flight state rather
// than sampled recordings, so it automatically tracks whatever TWR/rates/
// mass a given setup is tuned to instead of only sounding right at one
// specific RPM.
//
// Motor layer: 4 independent oscillators, one per physical motor position
// (front-left/front-right/rear-left/rear-right), each panned to its actual
// side and individually pitched by a simple mixer — yaw/roll/pitch stick
// input speeds up one side's motors and slows the other, same as a real
// quad's motor mixer, so e.g. yawing right audibly raises the right motors'
// pitch above the left ones. Each motor is a sawtooth (real motor/ESC whine
// is harmonically rich, not a clean tone) through its own lowpass filter to
// keep the top end buzzy rather than harsh, plus a subtle tremolo at a
// "blade pass"-like rate so it reads as a spinning prop instead of a static
// pitch, and a slow independent random pitch drift per motor so it doesn't
// sound perfectly locked/synthetic. Real motors don't fully stop spinning
// at zero stick either — an idle floor keeps a bit of spin/pitch/volume
// rather than true silence at 0%.
//
// The combined motor signal runs through a drive/soft-clip stage (real
// motors sound more strained/gritty under load, not just louder) before
// hitting a shared bus, which also gets a touch of procedurally generated
// reverb — a raw dry synth tone has no sense of happening in outdoor space,
// which is most of what reads as "too clean" about pure oscillators.
//
// Wind layer: filtered white noise, loudness/brightness tracking airspeed.
const IDLE_FLOOR = 0.15;
const BASE_FREQ = 260;
const MAX_FREQ = 980;
const SMOOTH_TIME = 0.18;
const WIND_SMOOTH_TIME = 0.12;
const WIND_MAX_SPEED = 25; // m/s at which wind noise reaches full volume/brightness
const DRIFT_MAX_CENTS = 3.5;
const TURB_SMOOTH_TIME = 0.05; // short — turbulence should read as choppy/irregular, not a slow swell

const YAW_MIX = 0.22;
const ROLL_MIX = 0.10;
const PITCH_MIX = 0.06;

// side: -1 = left, +1 = right. front: +1 = front, -1 = rear.
const MOTORS = [
  { name: 'FL', pan: -0.6, side: -1, front: 1, cents: -3, driftRate: 0.31 },
  { name: 'FR', pan: 0.6, side: 1, front: 1, cents: 3, driftRate: 0.47 },
  { name: 'RL', pan: -0.6, side: -1, front: -1, cents: -2, driftRate: 0.23 },
  { name: 'RR', pan: 0.6, side: 1, front: -1, cents: 2, driftRate: 0.39 },
];

function makeNoiseBuffer(ctx, seconds = 2) {
  const bufferSize = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Short synthetic decaying-noise impulse — stands in for an outdoor-space
// reverb tail without needing a recorded impulse response asset.
function makeReverbImpulse(ctx, seconds = 1.3, decay = 2.8) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

// Soft-clip curve — driving a hotter signal into this (via a pre-gain that
// scales with motor power) is what gives high throttle a "working hard"
// grit instead of just being louder.
function makeSaturationCurve(amount = 4) {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.motors = [];
    this.driftPhase = MOTORS.map(() => Math.random() * Math.PI * 2);
    this.turbState = 0.5; // random-walked 0..1, drives irregular turbulence gusting
  }

  // Must be called from inside a user-gesture handler (click/keydown) —
  // browsers block AudioContext creation/autoplay otherwise.
  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.started = true;

    const ctx = new Ctx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    this.master = master;

    // --- Mix bus: everything lands here, then splits into a dry path and a
    // reverb send, so the whole scene shares one sense of space instead of
    // each layer sounding like it's floating in a vacuum.
    const mixBus = ctx.createGain();
    mixBus.gain.value = 1;
    mixBus.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeReverbImpulse(ctx);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.22;
    mixBus.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    // --- Motor bus: drive/soft-clip stage shared by all 4 motors, so high
    // throttle sounds strained rather than just louder.
    const motorBus = ctx.createGain();
    motorBus.gain.value = 1;
    const drive = ctx.createGain();
    drive.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSaturationCurve(3);
    shaper.oversample = '2x';
    const driveOut = ctx.createGain();
    driveOut.gain.value = 0.55;
    motorBus.connect(drive);
    drive.connect(shaper);
    shaper.connect(driveOut);
    driveOut.connect(mixBus);
    this.drive = drive;

    // --- Per-motor tone: sawtooth (buzzy, harmonically rich like a real
    // motor/ESC whine) through a per-motor lowpass to tame the harshness,
    // plus a tremolo LFO for a spinning-blade "chop" rather than a static tone.
    this.motors = MOTORS.map((m) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = BASE_FREQ;
      osc.detune.value = m.cents;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.7;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 25;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0;
      lfo.connect(lfoDepth);
      lfoDepth.connect(gain.gain);
      lfo.start();

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = m.pan;

      osc.connect(filter);
      filter.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(motorBus);
      } else {
        gain.connect(motorBus);
      }
      osc.start();
      return { ...m, osc, filter, gain, lfo, lfoDepth };
    });

    // --- Shared broadband texture: filtered noise keyed to overall motor
    // power, standing in for prop/motor air noise under the tonal layer.
    const propNoise = ctx.createBufferSource();
    propNoise.buffer = makeNoiseBuffer(ctx);
    propNoise.loop = true;
    const propFilter = ctx.createBiquadFilter();
    propFilter.type = 'bandpass';
    propFilter.frequency.value = 900;
    propFilter.Q.value = 0.5;
    const propGain = ctx.createGain();
    propGain.gain.value = 0;
    propNoise.connect(propFilter);
    propFilter.connect(propGain);
    propGain.connect(mixBus);
    propNoise.start();
    this.propGain = propGain;
    this.propFilter = propFilter;

    // --- Wind: filtered noise, tracks airspeed.
    const windSource = ctx.createBufferSource();
    windSource.buffer = makeNoiseBuffer(ctx);
    windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 300;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(mixBus);
    windSource.start();
    this.windGain = windGain;
    this.windFilter = windFilter;

    // --- Ambient floor: very quiet broadband noise so flight never sits in
    // dead digital silence between motor harmonics, even hovering at 0 m/s.
    const ambNoise = ctx.createBufferSource();
    ambNoise.buffer = makeNoiseBuffer(ctx);
    ambNoise.loop = true;
    const ambFilter = ctx.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.frequency.value = 500;
    const ambGain = ctx.createGain();
    ambGain.gain.value = 0;
    ambNoise.connect(ambFilter);
    ambFilter.connect(ambGain);
    ambGain.connect(mixBus);
    ambNoise.start();
    this.ambGain = ambGain;

    // --- Turbulence: irregular buffety noise, strongest at low throttle —
    // a slow-spinning/lightly-loaded prop bites into much less stable,
    // more turbulent air than one spinning fast in clean flow, so this
    // fades out as throttle climbs rather than scaling with it. Driven by
    // a JS-side random walk (updated in update()) with a short smoothing
    // time so it gusts irregularly instead of swelling smoothly.
    const turbNoise = ctx.createBufferSource();
    turbNoise.buffer = makeNoiseBuffer(ctx);
    turbNoise.loop = true;
    const turbFilter = ctx.createBiquadFilter();
    turbFilter.type = 'bandpass';
    turbFilter.frequency.value = 350;
    turbFilter.Q.value = 0.8;
    const turbGain = ctx.createGain();
    turbGain.gain.value = 0;
    turbNoise.connect(turbFilter);
    turbFilter.connect(turbGain);
    turbGain.connect(mixBus);
    turbNoise.start();
    this.turbGain = turbGain;
    this.turbFilter = turbFilter;
  }

  setMasterVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  // Called every frame. `flying` gates all layers to silence outside of
  // actual flight (preview/menus). `state.effectiveThrottle` comes from
  // physics.js and reflects real thrust output in either acro or angle
  // mode, so this doesn't need to know which mode is active. `sticks` is
  // the raw per-frame input (yaw/roll/pitch, -1..1) used to differentially
  // pitch each motor the way a real motor mixer would. `dt` drives the
  // slow per-motor pitch drift.
  update(state, sticks, flying, dt) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;

    const rawThrottle = flying ? state.effectiveThrottle : 0;
    const basePower = flying ? IDLE_FLOOR + rawThrottle * (1 - IDLE_FLOOR) : 0;
    const yaw = flying ? sticks.yaw : 0;
    const roll = flying ? sticks.roll : 0;
    const pitch = flying ? sticks.pitch : 0;

    this.drive.gain.setTargetAtTime(1 + basePower * 1.5, now, SMOOTH_TIME);

    this.motors.forEach((m, i) => {
      const power = Math.min(1, Math.max(0, basePower
        + m.side * YAW_MIX * yaw
        + m.side * ROLL_MIX * roll
        + m.front * PITCH_MIX * pitch));

      this.driftPhase[i] += m.driftRate * (dt || 0.016);
      const drift = Math.sin(this.driftPhase[i]) * DRIFT_MAX_CENTS;

      const freq = BASE_FREQ + power * (MAX_FREQ - BASE_FREQ);
      m.osc.frequency.setTargetAtTime(freq, now, SMOOTH_TIME);
      m.osc.detune.setTargetAtTime(m.cents + drift, now, SMOOTH_TIME);
      m.filter.frequency.setTargetAtTime(700 + power * 2800, now, SMOOTH_TIME);
      const vol = flying ? 0.03 + power * 0.16 : 0;
      m.gain.gain.setTargetAtTime(vol, now, SMOOTH_TIME);
      m.lfo.frequency.setTargetAtTime(22 + power * 38, now, SMOOTH_TIME);
      m.lfoDepth.gain.setTargetAtTime(vol * 0.18, now, SMOOTH_TIME);
    });

    this.propFilter.frequency.setTargetAtTime(500 + basePower * 1800, now, SMOOTH_TIME);
    const propVol = flying ? 0.02 + basePower * 0.12 : 0;
    this.propGain.gain.setTargetAtTime(propVol, now, SMOOTH_TIME);

    const speed = flying ? state.vel.length() : 0;
    const windAmount = Math.min(speed / WIND_MAX_SPEED, 1);
    this.windGain.gain.setTargetAtTime(windAmount * 0.4, now, WIND_SMOOTH_TIME);
    this.windFilter.frequency.setTargetAtTime(300 + windAmount * 1500, now, WIND_SMOOTH_TIME);

    this.ambGain.gain.setTargetAtTime(flying ? 0.015 : 0, now, WIND_SMOOTH_TIME);

    // Random walk, only lightly mean-reverting so it can swing through its
    // full range for distinct gusts instead of hovering near the middle.
    this.turbState += (Math.random() - 0.5) * 0.9 - (this.turbState - 0.5) * 0.05;
    this.turbState = Math.min(1, Math.max(0, this.turbState));
    const throttleFade = 1 - basePower; // strongest at low throttle, fades as it climbs
    const turbAmount = flying ? this.turbState * throttleFade : 0;
    this.turbGain.gain.setTargetAtTime(turbAmount * 0.13, now, TURB_SMOOTH_TIME);
    this.turbFilter.frequency.setTargetAtTime(260 + this.turbState * 320, now, TURB_SMOOTH_TIME);
  }
}
