import { Vec3 } from 'playcanvas';

export class FlightController {
  constructor(state, settingsStore, cameras, drone) {
    this.state = state;
    this.settingsStore = settingsStore;
    this.cameras = cameras;
    this.drone = drone;

    this.mode = 'preview';
    this.camView = 'fpv';
    this.spawnPos = new Vec3(0, 1.5, 0);
    this.spawnYaw = 0;
  }

  updateModeUI(hud) {
    hud.setMode(this.mode, this.camView);
    this.cameras.setActive(this.mode === 'preview' ? 'preview' : this.camView);
  }

  launchFrom(pos, yawDeg) {
    const s = this.state;
    s.pos.copy(pos);
    s.vel.set(0, 0, 0);
    s.angVel.set(0, 0, 0);
    s.quat.setFromEulerAngles(0, yawDeg, 0);
    s.throttle = 0;
    s.throttleTarget = 0;
    s.crashed = false;
    s.onGround = false;
    this.drone.enabled = true;
    this.cameras.resetChase();
  }

  // Motors go live the instant you launch — there's no separate arm step.
  launch(previewCamera) {
    if (this.mode !== 'preview') return;
    const p = previewCamera.getPosition();
    const yaw = previewCamera.getEulerAngles().y;
    this.spawnPos.copy(p);
    this.spawnYaw = yaw;

    const world = this.settingsStore.world;
    if (world.groundEnabled && world.autoGround) {
      world.groundHeight = p.y - 1.5;
    }

    this.launchFrom(this.spawnPos, this.spawnYaw);
    this.mode = 'flying';
  }

  reset() {
    if (this.mode !== 'flying') return;
    this.launchFrom(this.spawnPos, this.spawnYaw);
  }

  goToPreview() {
    if (this.mode === 'flying') {
      const p = this.state.pos;
      this.cameras.previewCamera.setPosition(p.x, p.y + 0.5, p.z + 2.5);
      this.cameras.previewCamera.lookAt(p.x, p.y, p.z);
    }
    this.mode = 'preview';
  }

  cycleCamera() {
    if (this.mode !== 'flying') return;
    this.camView = this.camView === 'fpv' ? 'chase' : 'fpv';
    this.cameras.setActive(this.camView);
    this.cameras.resetChase();
  }
}
