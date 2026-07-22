import { createApp, createDrone, attachCameraControls } from './core/app.js';
import { createCameras, createFlightState } from './core/cameras.js';
import { createDroneModel } from './core/drone-model.js';
import { createSceneManager } from './core/scene.js';
import { settingsStore } from './storage/settings-store.js';
import { PhysicsEngine, syncDroneEntity } from './physics/physics.js';
import { InputManager } from './input/input-manager.js';
import { FlightController } from './flight/flight-controller.js';
import { initMainMenu } from './ui/main-menu.js';
import { initSetupScreen } from './ui/setup-screen.js';
import { Hud } from './ui/hud.js';
import { createSettingsUI } from './ui/settings-panel.js';
import { initCalibrationWizard } from './ui/calibration-wizard.js';
import { AudioEngine } from './audio/audio-engine.js';

const canvas = document.getElementById('glcanvas');
const app = createApp(canvas);
const drone = createDrone(app);
const cameras = createCameras(app, settingsStore);
const state = createFlightState();
const sceneManager = createSceneManager(app);
const physics = new PhysicsEngine(state, settingsStore);
const input = new InputManager(settingsStore);
const flight = new FlightController(state, settingsStore, cameras, drone);
const hud = new Hud(settingsStore);
const audio = new AudioEngine();

drone.addChild(cameras.fpvCamera);
drone.addChild(createDroneModel(cameras.droneModelLayer));

attachCameraControls(app, cameras.previewCamera);
cameras.applyFpvSettings(settingsStore.camera);

const calWizard = initCalibrationWizard(input, settingsStore);

// --- Quick-access mute toggle — sits next to the settings gear rather than
// a full volume slider, which was wide enough to overlap the top-right
// telemetry readout. Volume itself is still adjusted from Settings →
// Controls; this only flips settingsStore.controls.muted, so unmuting
// always restores whatever level was set there.
const muteToggle = document.getElementById('muteToggle');
function applyVolume() {
  const muted = settingsStore.controls.muted;
  audio.setMasterVolume(muted ? 0 : settingsStore.controls.audioVolume);
  muteToggle.classList.toggle('is-muted', muted);
}
muteToggle.addEventListener('click', () => {
  settingsStore.controls.muted = !settingsStore.controls.muted;
  applyVolume();
  settingsStore.save();
});
applyVolume();

// --- In-game settings (gear icon) — Flight / Camera / Controls only -------
const gameSettings = createSettingsUI(
  document.getElementById('settingsPanel'),
  ['flight', 'camera', 'controls'],
  settingsStore,
  {
    onCameraChange() { cameras.applyFpvSettings(settingsStore.camera); },
    onWorldChange() { sceneManager.applySplatTransform(settingsStore.world); },
    onOpenWizard() { calWizard.open(); },
    onStickPreviewChange(visible) { hud.setStickPreviewVisible(visible); },
    // Dragging the volume slider implicitly unmutes — matches most players'
    // expectation that touching volume means "I want sound."
    onVolumeChange() { settingsStore.controls.muted = false; applyVolume(); },
  }
);

function openGameSettings() {
  document.getElementById('settingsPanel').hidden = false;
  gameSettings.sync();
}
function closeGameSettings() {
  document.getElementById('settingsPanel').hidden = true;
  settingsStore.save(); // flush in case a debounced slider save hasn't fired yet
}
document.getElementById('settingsToggle').addEventListener('click', () => {
  const hidden = document.getElementById('settingsPanel').hidden;
  if (hidden) openGameSettings(); else closeGameSettings();
});
document.getElementById('closeSettings').addEventListener('click', closeGameSettings);

// --- Main-menu settings (dedicated full screen) — General / Controls ------
const menuSettings = createSettingsUI(
  document.getElementById('mainSettingsScreen'),
  ['general', 'controls'],
  settingsStore,
  {
    onOpenWizard() { calWizard.open(); },
    onVolumeChange() { settingsStore.controls.muted = false; applyVolume(); },
  }
);

function openMenuSettings() {
  document.getElementById('mainSettingsScreen').hidden = false;
  menuSettings.sync();
}
function closeMenuSettings() {
  document.getElementById('mainSettingsScreen').hidden = true;
  settingsStore.save(); // flush in case a debounced slider save hasn't fired yet
}
document.getElementById('mainSettingsBackBtn').addEventListener('click', closeMenuSettings);

// --- Screens: main menu -> setup -> (optional calibration) -> in-game -----
const mainMenu = initMainMenu({
  onPlay() {
    mainMenu.hide();
    setupScreen.show();
  },
  onSettings: openMenuSettings,
  onCalibrate() { calWizard.open(); },
});

const setupScreen = initSetupScreen(sceneManager, settingsStore, {
  onBack() {
    setupScreen.hide();
    mainMenu.show();
  },
  onLaunch: handleLaunchRequest,
  onSkyChange(hex) { cameras.setSky(hex); },
});

function handleLaunchRequest() {
  audio.start(); // must happen inside a user-gesture handler (browser autoplay policy)
  applyVolume();
  const gp = settingsStore.gamepad.enabled ? input.readGamepad() : null;
  const calibrated = settingsStore.gamepad.channels.some((c) => c.action !== 'none');
  if (gp && !calibrated) {
    calWizard.open(enterGame);
  } else {
    enterGame();
  }
}

let inGame = false;

function enterGame() {
  inGame = true;
  // Camera settings may have changed since app init (e.g. imported from the
  // main-menu Settings screen before any scene was loaded) — refresh here
  // rather than threading a callback through that screen too.
  cameras.applyFpvSettings(settingsStore.camera);
  setupScreen.hide();
  document.getElementById('hud').style.display = 'block';
  document.getElementById('settingsToggle').classList.remove('hidden');
  document.getElementById('backToMenuBtn').classList.remove('hidden');
  muteToggle.classList.remove('hidden');
  flight.updateModeUI(hud);
}

function backToMainMenu() {
  inGame = false;
  flight.goToPreview();
  closeGameSettings();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('settingsToggle').classList.add('hidden');
  document.getElementById('backToMenuBtn').classList.add('hidden');
  muteToggle.classList.add('hidden');
  sceneManager.unload();
  setupScreen.reset();
  // Reframe the orbit camera so the next scene loads into view instead of
  // wherever the previous session's orbit happened to end up.
  cameras.previewCamera.setPosition(0, 1.6, 4);
  cameras.previewCamera.lookAt(0, 0, 0);
  mainMenu.show();
}

document.getElementById('backToMenuBtn').addEventListener('click', backToMainMenu);

if (setupScreen.hasDeepLink) {
  mainMenu.hide();
  setupScreen.show();
} else {
  mainMenu.show();
}

// --- Keyboard shortcuts (only while actually in-game, and not while typing
// into a text field on one of the setup/settings screens) -----------------
window.addEventListener('keydown', (e) => {
  if (!inGame) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    flight.launch(cameras.previewCamera);
    flight.updateModeUI(hud);
  }
  if (e.code === 'KeyR') {
    flight.reset();
    flight.updateModeUI(hud);
  }
  if (e.code === 'KeyC') {
    flight.cycleCamera();
    flight.updateModeUI(hud);
  }
  if (e.code === 'Escape') {
    flight.goToPreview();
    flight.updateModeUI(hud);
  }
});

// --- Sim loop ---------------------------------------------------------------
app.on('update', (dt) => {
  const { sticks, gp } = input.poll(state, dt);

  if (inGame) {
    input.pollButtons(gp, {
      onArmToggle: () => {
        flight.launch(cameras.previewCamera);
        flight.updateModeUI(hud);
      },
      onReset: () => {
        flight.reset();
        flight.updateModeUI(hud);
      },
      onCycleCamera: () => {
        flight.cycleCamera();
        flight.updateModeUI(hud);
      },
    });
  }

  physics.step(dt, sticks, flight.mode);
  audio.update(state, sticks, flight.mode === 'flying', dt);

  syncDroneEntity(drone, state);
  cameras.updateChase(drone, settingsStore.camera, dt, flight.mode, flight.camView);

  if (flight.mode === 'flying') {
    hud.update(state, sticks);
  }
});

flight.updateModeUI(hud);
