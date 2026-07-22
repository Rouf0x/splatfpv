import { Entity, Vec3, Quat, Color } from './app.js';
import { attachFisheye } from './postfx.js';
import { createDroneModelLayer } from './drone-model.js';

// Sky is just the cameras' clear color — whatever the splat itself doesn't
// cover shows through as this, which for an outdoor scan with open space
// reads as sky rather than a rendering void.
const skyColor = new Color();
function applySkyColor(cameras, hex) {
  skyColor.fromString(hex);
  cameras.forEach((cam) => { cam.camera.clearColor = skyColor.clone(); });
}

export function createCameras(app, settings) {
  const previewCamera = new Entity('PreviewCamera');
  previewCamera.setPosition(0, 1.6, 4);
  previewCamera.addComponent('camera', { fov: 65 });
  app.root.addChild(previewCamera);

  const fpvCamera = new Entity('FPVCamera');
  fpvCamera.addComponent('camera', { fov: settings.camera.camFov });
  fpvCamera.setLocalPosition(0, 0.035, 0.025);

  // Fisheye — only on the pilot's actual view, not the spectator chase cam,
  // since it's meant to read as a lens characteristic rather than a
  // scene-wide filter.
  const fpvFx = attachFisheye(app, fpvCamera);

  const chaseCamera = new Entity('ChaseCamera');
  chaseCamera.addComponent('camera', { fov: 72 });
  app.root.addChild(chaseCamera);

  const allCameras = [previewCamera, fpvCamera, chaseCamera];
  applySkyColor(allCameras, settings.world.skyColor);

  // The drone body model (see drone-model.js) renders on its own layer,
  // added here to preview/chase only — fpvCamera keeps its default layer
  // set, which excludes it, so the pilot never sees their own airframe.
  const droneModelLayer = createDroneModelLayer(app);
  previewCamera.camera.layers = [...previewCamera.camera.layers, droneModelLayer.id];
  chaseCamera.camera.layers = [...chaseCamera.camera.layers, droneModelLayer.id];

  let active = 'preview';
  let fisheyeEnabled = settings.camera.fisheye !== false;

  // Only call this while fpvCamera is already enabled — either it was just
  // turned on (setActive), or it's staying on while the setting itself
  // changes (applyFpvSettings). Never call it as part of turning the
  // camera off; see the ordering note in setActive for why.
  function syncFisheyeAttachment() {
    if (fisheyeEnabled) fpvFx.attach(); else fpvFx.detach();
  }

  // Post effects on fpvCamera must be added/removed in lockstep with the
  // camera's own enabled state rather than left attached across disables —
  // PlayCanvas's PostEffectQueue destroys its offscreen target on
  // camera.onDisable() but doesn't recreate it on the next onEnable(), so a
  // post effect left attached through a disable/enable cycle renders into a
  // stale target (shows up as a solid/garbage-colored frame) the next time
  // the camera comes back up.
  function setActive(which) {
    active = which;
    previewCamera.camera.enabled = which === 'preview';
    chaseCamera.camera.enabled = which === 'chase';
    if (which === 'fpv') {
      fpvCamera.camera.enabled = true;
      syncFisheyeAttachment();
    } else {
      fpvFx.detach();
      fpvCamera.camera.enabled = false;
    }
  }

  setActive('preview');

  const chasePos = new Vec3();
  let chaseInit = false;

  function applyFpvSettings(cam) {
    fpvCamera.setLocalEulerAngles(cam.camTilt, 0, 0);
    fpvCamera.camera.fov = cam.camFov;
    fisheyeEnabled = cam.fisheye !== false;
    if (active === 'fpv') syncFisheyeAttachment();
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

  function setSky(hex) {
    applySkyColor(allCameras, hex);
  }

  return {
    previewCamera,
    fpvCamera,
    chaseCamera,
    droneModelLayer,
    setActive,
    get active() { return active; },
    applyFpvSettings,
    updateChase,
    resetChase,
    setSky,
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
    // Normalized 0..1 actual motor power delivered this substep — unlike
    // `throttle` (only meaningful in acro mode), this is derived from the
    // real thrust output either way, so audio/UI can read one consistent
    // signal regardless of acro vs angle mode.
    effectiveThrottle: 0,
    crashed: false,
    onGround: false,
  };
}
