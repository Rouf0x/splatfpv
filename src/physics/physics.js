import { Vec3 } from 'playcanvas';
import { GRAVITY } from '../config/defaults.js';
import { clamp, lerp, integrateBodyRates, wrapDeg, DEG2RAD } from '../utils/math.js';

const tmpUp = new Vec3();
const tmpAccel = new Vec3();
const tmpEuler = new Vec3();

// Fixed physics substep — decouples simulation accuracy/stability from the
// render frame rate. A single variable-length step (especially after a tab
// stall or a frame drop) can push the semi-implicit Euler integrator into
// visibly wrong trajectories at high rotation rates; substepping keeps each
// integration step small and consistent regardless of display FPS.
const SUBSTEP = 1 / 240;
const MAX_FRAME_DT = 0.1; // clamp huge stalls (tab refocus) to 100ms of sim time

// Angle mode gains (not user-facing — the tunable knobs are the max tilt
// angle / max climb rate themselves, these just control how snappily the
// craft tracks them). deg/s commanded per degree of tilt error, and m/s^2
// commanded per m/s of climb-rate error.
const ANGLE_KP = 8;
const CLIMB_KP = 4;

export class PhysicsEngine {
  constructor(state, settingsStore) {
    this.state = state;
    this.settingsStore = settingsStore;
  }

  step(dt, sticks, mode) {
    if (dt <= 0) return;
    dt = Math.min(dt, MAX_FRAME_DT);

    if (mode !== 'flying') return;

    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(SUBSTEP, remaining);
      this.substep(h, sticks);
      remaining -= h;
    }
  }

  substep(dt, sticks) {
    const flight = this.settingsStore.flight;
    const s = this.state;
    const angleMode = flight.controlMode === 'angle';
    s.throttleTarget = sticks.throttle;

    // ROTATION: convert stick inputs to angular velocities
    // PlayCanvas: right-handed, Y-up
    //   pitch = rotation around X axis (right)
    //   yaw   = rotation around Y axis (up)
    //   roll  = rotation around Z axis (forward)
    const targetYaw = sticks.yaw * flight.maxYaw * DEG2RAD;
    const rateAlpha = clamp(flight.response * dt, 0, 1);

    if (angleMode) {
      // Self-level: stick sets a target lean angle, not a rotation rate.
      // Closed-loop correct toward it every substep instead of integrating
      // a stick-held rate indefinitely (which is what acro mode does).
      s.quat.getEulerAngles(tmpEuler);
      const pitchError = wrapDeg(sticks.pitch * flight.maxTiltAngle - tmpEuler.x);
      const rollError  = wrapDeg(sticks.roll  * flight.maxTiltAngle - tmpEuler.z);
      const targetPitch = clamp(pitchError * ANGLE_KP, -flight.maxPitch, flight.maxPitch) * DEG2RAD;
      const targetRoll  = clamp(rollError  * ANGLE_KP, -flight.maxRoll,  flight.maxRoll)  * DEG2RAD;

      s.angVel.x = lerp(s.angVel.x, targetPitch, rateAlpha);
      s.angVel.y = lerp(s.angVel.y, targetYaw, rateAlpha);
      s.angVel.z = lerp(s.angVel.z, targetRoll, rateAlpha);
    } else {
      const targetPitch = sticks.pitch * flight.maxPitch * DEG2RAD;
      const targetRoll  = sticks.roll  * flight.maxRoll  * DEG2RAD;

      s.angVel.x = lerp(s.angVel.x, targetPitch, rateAlpha);
      s.angVel.y = lerp(s.angVel.y, targetYaw, rateAlpha);
      s.angVel.z = lerp(s.angVel.z, targetRoll, rateAlpha);

      // Auto-damping when sticks centered (angle mode self-centers via the
      // angle error above instead, so this only applies in acro)
      if (Math.abs(sticks.pitch) < 0.02) s.angVel.x *= Math.exp(-flight.angularDrag * dt);
      if (Math.abs(sticks.roll)  < 0.02) s.angVel.z *= Math.exp(-flight.angularDrag * dt);
    }
    if (Math.abs(sticks.yaw) < 0.02) s.angVel.y *= Math.exp(-flight.angularDrag * dt);

    integrateBodyRates(s.quat, s.angVel, dt);

    // Transform thrust direction by drone orientation
    s.quat.transformVector(Vec3.UP, tmpUp);

    // THRUST: apply force in drone's local UP direction
    const maxThrust = flight.twr * -GRAVITY;
    let thrustMag;
    if (angleMode) {
      // Closed-loop climb-rate control: stick center = hold altitude, like
      // a GPS/camera drone's Normal/Sport mode — the controller solves for
      // whatever thrust is needed to track the commanded climb rate instead
      // of the stick directly setting thrust magnitude.
      const targetClimbRate = (sticks.throttle - 0.5) * 2 * flight.maxClimbRate;
      const climbError = targetClimbRate - s.vel.y;
      const desiredVerticalAccel = climbError * CLIMB_KP - GRAVITY;
      const cosTilt = Math.max(tmpUp.y, 0.2);
      thrustMag = !s.crashed ? clamp(desiredVerticalAccel / cosTilt, 0, maxThrust) : 0;
    } else {
      // Apply throttle (smooth motor response)
      const motorAlpha = clamp(flight.motorResponse * dt, 0, 1);
      s.throttle = lerp(s.throttle, s.throttleTarget, motorAlpha);
      thrustMag = !s.crashed ? s.throttle * maxThrust : 0;
    }
    s.effectiveThrottle = thrustMag / maxThrust;

    tmpAccel.set(tmpUp.x * thrustMag, tmpUp.y * thrustMag, tmpUp.z * thrustMag);

    // Gravity (always world-down)
    tmpAccel.y += GRAVITY;

    // Drag — modeled per-axis, not as one isotropic coefficient: a quad
    // presents a much larger flat area falling belly-down (prop disks +
    // frame) than it does pitched forward for speed, so horizontal drag
    // (top speed) and vertical drag (fall/terminal velocity) are genuinely
    // different on a real airframe and need independent coefficients.
    const horizSpeed = Math.hypot(s.vel.x, s.vel.z);
    if (horizSpeed > 0.01) {
      const k = -flight.drag * horizSpeed / flight.mass;
      tmpAccel.x += s.vel.x * k;
      tmpAccel.z += s.vel.z * k;
    }
    if (Math.abs(s.vel.y) > 0.01) {
      tmpAccel.y += -flight.vertDrag * Math.abs(s.vel.y) * s.vel.y / flight.mass;
    }

    // Hover assist: extra vertical damping so throttle doesn't need to be
    // pinned exactly at the hover point to hold altitude. Angle mode already
    // closed-loop holds altitude, so this would just fight that controller.
    if (flight.hoverAssist && !angleMode) {
      tmpAccel.y -= s.vel.y * flight.hoverStrength * 4;
    }

    // Integrate (simple Euler)
    s.vel.x += tmpAccel.x * dt;
    s.vel.y += tmpAccel.y * dt;
    s.vel.z += tmpAccel.z * dt;
    s.pos.x += s.vel.x * dt * flight.worldScale;
    s.pos.y += s.vel.y * dt * flight.worldScale;
    s.pos.z += s.vel.z * dt * flight.worldScale;

    // Ground collision — optional (Settings → World), off by default so
    // splats can be flown freely without an invisible floor. When enabled,
    // contact only kills the vertical component and bleeds off horizontal
    // speed via friction, instead of a hard full stop.
    const world = this.settingsStore.world;
    if (world.groundEnabled) {
      const groundY = world.groundHeight;
      const clearance = 0.15;
      if (s.pos.y <= groundY + clearance) {
        if (!s.crashed) {
          const impactSpeed = -s.vel.y;
          if (impactSpeed > 4) s.crashed = true;
          s.onGround = true;
        }
        s.pos.y = groundY + clearance;
        s.vel.y = 0;
        const friction = Math.exp(-8 * dt);
        s.vel.x *= friction;
        s.vel.z *= friction;
      } else {
        s.onGround = false;
      }
    } else {
      s.onGround = false;
    }
  }
}

export function syncDroneEntity(drone, state) {
  drone.setPosition(state.pos);
  drone.setRotation(state.quat);
}