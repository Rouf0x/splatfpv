import {
  Application, Asset, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO,
  Vec3, Quat, Color, StandardMaterial, Layer,
} from 'playcanvas';

export function createApp(canvas) {
  const app = new Application(canvas, {
    graphicsDeviceOptions: { antialias: false, alpha: false },
  });
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.start();
  window.addEventListener('resize', () => app.resizeCanvas());
  return app;
}

// Carries the FPV camera and feeds the chase-camera math. The aircraft body
// itself is a separate child model (see drone-model.js) kept out of the FPV
// camera's own view — the goal there is what the pilot's camera sees, not a
// third-person view of the aircraft.
export function createDrone(app) {
  const drone = new Entity('Drone');
  app.root.addChild(drone);
  drone.enabled = false;
  return drone;
}

export function attachCameraControls(app, previewCamera) {
  const controlsAsset = new Asset('camera-controls', 'script', {
    url: 'https://cdn.jsdelivr.net/npm/playcanvas@2.21.0/scripts/esm/camera-controls.mjs',
  });
  app.assets.add(controlsAsset);
  app.assets.load(controlsAsset);
  controlsAsset.ready(() => {
    previewCamera.addComponent('script');
    previewCamera.script.create('cameraControls');
  });
}

export { Entity, Vec3, Quat, Color, Asset, StandardMaterial, Layer };
