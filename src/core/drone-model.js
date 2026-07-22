import { Entity, StandardMaterial, Color, Layer } from './app.js';

// Procedural quad body (no external model asset — everything here runs
// from local geometry/materials, same as the rest of the sim). Sized like
// a typical 5" freestyle frame. Rendered on its own layer so it can be
// excluded from the FPV camera specifically (seeing your own airframe
// through its own lens doesn't make sense) while still showing up in
// preview/chase view.
const ARM_LENGTH = 0.11;
const ARM_THICKNESS = 0.013;
const BODY_SIZE = 0.07;
const BODY_HEIGHT = 0.022;
const MOTOR_RADIUS = 0.014;
const MOTOR_HEIGHT = 0.022;
const PROP_RADIUS = 0.063; // ~5in props
const PROP_THICKNESS = 0.006;
const CORNER_ANGLES = [45, 135, 225, 315]; // X-frame, degrees from forward

function material(color, opts = {}) {
  const mat = new StandardMaterial();
  mat.diffuse = color;
  mat.useMetalness = true;
  mat.metalness = opts.metalness ?? 0.3;
  mat.gloss = opts.gloss ?? 0.5;
  mat.update();
  return mat;
}

export const DRONE_MODEL_LAYER_NAME = 'DroneModel';

export function createDroneModelLayer(app) {
  const layer = new Layer({ name: DRONE_MODEL_LAYER_NAME });
  app.scene.layers.push(layer);
  return layer;
}

export function createDroneModel(layer) {
  const frameMat = material(new Color(0.05, 0.05, 0.06), { metalness: 0.4, gloss: 0.6 });
  const motorMat = material(new Color(0.12, 0.12, 0.13), { metalness: 0.7, gloss: 0.7 });
  const propMat = material(new Color(0.03, 0.03, 0.03), { metalness: 0.1, gloss: 0.2 });
  const canopyMat = material(new Color(0.85, 0.18, 0.12), { metalness: 0.1, gloss: 0.6 });

  const root = new Entity('DroneModel');

  const setLayer = (entity) => { entity.render.layers = [layer.id]; };

  const body = new Entity('Body');
  body.addComponent('render', { type: 'box', material: frameMat });
  body.setLocalScale(BODY_SIZE, BODY_HEIGHT, BODY_SIZE);
  root.addChild(body);
  setLayer(body);

  const canopy = new Entity('Canopy');
  canopy.addComponent('render', { type: 'box', material: canopyMat });
  canopy.setLocalScale(BODY_SIZE * 0.55, BODY_HEIGHT * 0.7, BODY_SIZE * 0.5);
  canopy.setLocalPosition(0, BODY_HEIGHT * 0.6, -BODY_SIZE * 0.45);
  root.addChild(canopy);
  setLayer(canopy);

  CORNER_ANGLES.forEach((angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    const cx = Math.sin(rad) * ARM_LENGTH;
    const cz = -Math.cos(rad) * ARM_LENGTH;

    const arm = new Entity('Arm');
    root.addChild(arm);
    arm.lookAt(cx, 0, cz);

    const armMesh = new Entity('ArmMesh');
    armMesh.addComponent('render', { type: 'box', material: frameMat });
    armMesh.setLocalScale(ARM_THICKNESS, ARM_THICKNESS, ARM_LENGTH);
    armMesh.setLocalPosition(0, 0, -ARM_LENGTH / 2);
    arm.addChild(armMesh);
    setLayer(armMesh);

    const motor = new Entity('Motor');
    motor.addComponent('render', { type: 'cylinder', material: motorMat });
    motor.setLocalScale(MOTOR_RADIUS * 2, MOTOR_HEIGHT, MOTOR_RADIUS * 2);
    motor.setLocalPosition(cx, MOTOR_HEIGHT * 0.5, cz);
    root.addChild(motor);
    setLayer(motor);

    const prop = new Entity('Prop');
    prop.addComponent('render', { type: 'cylinder', material: propMat });
    prop.setLocalScale(PROP_RADIUS * 2, PROP_THICKNESS, PROP_RADIUS * 2);
    prop.setLocalPosition(cx, MOTOR_HEIGHT + PROP_THICKNESS, cz);
    root.addChild(prop);
    setLayer(prop);
  });

  return root;
}
