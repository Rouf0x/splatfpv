import { Entity, Vec3, Quat, Color } from './app.js';

export function createCameras(app, settings) {
  const previewCamera = new Entity('PreviewCamera');
  previewCamera.setPosition(0, 1.6, 4);
  previewCamera.addComponent('camera', {
    fov: 65,
    clearColor: new Color(0.02, 0.03, 0.03),
  });
  app.root.addChild(previewCamera);

  const fpvCamera = new Entity('FPVCamera');
  fpvCamera.addComponent('camera', {
    fov: settings.camera.camFov,
    clearColor: new Color(0.02, 0.03, 0.03),
  });
  fpvCamera.setLocalPosition(0, 0.035, 0.025);

  const chaseCamera = new Entity('ChaseCamera');
  chaseCamera.addComponent('camera', {
    fov: 72,
    clearColor: new Color(0.02, 0.03, 0.03),
  });
  app.root.addChild(chaseCamera);

  let active = 'preview';

  function setActive(which) {
    active = which;
    previewCamera.camera.enabled = which === 'preview';
    fpvCamera.camera.enabled = which === 'fpv';
    chaseCamera.camera.enabled = which === 'chase';
  }

  setActive('preview');

  const chasePos = new Vec3();
  let chaseInit = false;

  function applyFpvSettings(cam) {
    fpvCamera.setLocalEulerAngles(cam.camTilt, 0, 0);
    fpvCamera.camera.fov = cam.camFov;
  }

  function updateChase(drone, cam, dt, mode, camView) {
    if (!(mode === 'flying' && camView === 'chase')) {
      chaseInit = false;
      return;
    }

    const pos = drone.getPosition();
    const back = drone.forward.clone().mulScalar(-1);
    const target = pos.clone()
      .add(back.mulScalar(cam.chaseDist))
      .add(new Vec3(0, cam.chaseDist * cam.chaseHeight, 0));

    if (!chaseInit) {
      chasePos.copy(target);
      chaseInit = true;
    }

    const t = 1 - Math.pow(0.001, dt);
    chasePos.lerp(chasePos, target, t);
    chaseCamera.setPosition(chasePos);
    chaseCamera.lookAt(pos);
  }

  function resetChase() {
    chaseInit = false;
  }

  return {
    previewCamera,
    fpvCamera,
    chaseCamera,
    setActive,
    get active() { return active; },
    applyFpvSettings,
    updateChase,
    resetChase,
  };
}

export function createFlightState() {
  return {
    pos: new Vec3(0, 1.5, 0),
    vel: new Vec3(),
    quat: new Quat(),
    angVel: new Vec3(),
    throttle: 0,
    throttleTarget: 0,
    crashed: false,
    onGround: false,
  };
}
