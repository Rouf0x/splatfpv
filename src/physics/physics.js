import { Vec3 } from 'playcanvas';
import { GRAVITY } from '../config/defaults.js';
import { clamp, lerp, integrateBodyRates, DEG2RAD } from '../utils/math.js';

const tmpUp = new Vec3();
const tmpAccel = new Vec3();
const tmpDrag = new Vec3();

// Fixed physics substep — decouples simulation accuracy/stability from the
// render frame rate. A single variable-length step (especially after a tab
// stall or a frame drop) can push the semi-implicit Euler integrator into
// visibly wrong trajectories at high rotation rates; substepping keeps each
// integration step small and consistent regardless of display FPS.
const SUBSTEP = 1 / 240;
const MAX_FRAME_DT = 0.1; // clamp huge stalls (tab refocus) to 100ms of sim time

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

    // Apply throttle (smooth motor response)
    s.throttleTarget = sticks.throttle;
    const motorAlpha = clamp(flight.motorResponse * dt, 0, 1);
    s.throttle = lerp(s.throttle, s.throttleTarget, motorAlpha);

    // ROTATION: convert stick inputs to angular velocities
    // PlayCanvas: right-handed, Y-up
    //   pitch = rotation around X axis (right)
    //   yaw   = rotation around Y axis (up)
    //   roll  = rotation around Z axis (forward)
    const targetPitch = sticks.pitch * flight.maxPitch * DEG2RAD;
    const targetYaw   = sticks.yaw   * flight.maxYaw   * DEG2RAD;
    const targetRoll  = sticks.roll  * flight.maxRoll  * DEG2RAD;

    const rateAlpha = clamp(flight.response * dt, 0, 1);
    s.angVel.x = lerp(s.angVel.x, targetPitch, rateAlpha);
    s.angVel.y = lerp(s.angVel.y, targetYaw, rateAlpha);
    s.angVel.z = lerp(s.angVel.z, targetRoll, rateAlpha);

    // Auto-damping when sticks centered
    if (Math.abs(sticks.pitch) < 0.02) s.angVel.x *= Math.exp(-flight.angularDrag * dt);
    if (Math.abs(sticks.yaw)   < 0.02) s.angVel.y *= Math.exp(-flight.angularDrag * dt);
    if (Math.abs(sticks.roll)  < 0.02) s.angVel.z *= Math.exp(-flight.angularDrag * dt);

    integrateBodyRates(s.quat, s.angVel, dt);

    // THRUST: apply force in drone's local UP direction
    const maxThrust = flight.twr * -GRAVITY;
    const thrustMag = !s.crashed ? s.throttle * maxThrust : 0;

    // Transform thrust direction by drone orientation
    s.quat.transformVector(Vec3.UP, tmpUp);
    tmpAccel.set(tmpUp.x * thrustMag, tmpUp.y * thrustMag, tmpUp.z * thrustMag);

    // Gravity (always world-down)
    tmpAccel.y += GRAVITY;

    // Drag
    const speed = s.vel.length();
    if (speed > 0.01) {
      tmpDrag.copy(s.vel).mulScalar(-flight.drag * speed / flight.mass);
      tmpAccel.add(tmpDrag);
    }

    // Hover assist: extra vertical damping so throttle doesn't need to be
    // pinned exactly at the hover point to hold altitude.
    if (flight.hoverAssist) {
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