import { DEMO_SPLAT_URL } from '../config/defaults.js';
import { slider, checkbox, colorPicker, debounce, bindRange, bindCheckbox, bindColor } from './field-controls.js';

// The scene/ground fields — rendered once into #sceneSetupFields, which
// starts dimmed (nothing loaded yet) and lights up once a splat is loaded.
const FIELDS_HTML = `
  <h3 class="menu-section-label">Sky</h3>
  ${colorPicker('Sky color', 'world', 'skyColor')}
  <h3 class="menu-section-label">Scene transform</h3>
  ${slider('Scale', 0.05, 8, 0.05, 'world', 'splatScale')}
  ${slider('Position X', -30, 30, 0.1, 'world', 'splatPosX')}
  ${slider('Position Y', -30, 30, 0.1, 'world', 'splatPosY')}
  ${slider('Position Z', -30, 30, 0.1, 'world', 'splatPosZ')}
  ${slider('Rotation X', -180, 180, 1, 'world', 'splatRotX')}
  ${slider('Rotation Y', -180, 180, 1, 'world', 'splatRotY')}
  ${slider('Rotation Z', -180, 180, 1, 'world', 'splatRotZ')}
  <h3 class="menu-section-label">Ground collision</h3>
  <p class="key-list" style="margin-top:0">Off by default — fly freely through the scene with no floor.</p>
  ${checkbox('Enable ground collision', 'world', 'groundEnabled')}
  <div data-role="groundFields">
    ${slider('Ground height', -50, 50, 0.1, 'world', 'groundHeight')}
    ${checkbox('Auto-set ground on launch', 'world', 'autoGround')}
  </div>
`;

export function initSetupScreen(sceneManager, settingsStore, callbacks) {
  const screen = document.getElementById('setupScreen');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const statusEl = document.getElementById('loadStatus');
  const fieldsEl = document.getElementById('sceneSetupFields');
  const launchBtn = document.getElementById('launchBtn');
  const backBtn = document.getElementById('setupBackBtn');

  fieldsEl.innerHTML = FIELDS_HTML;

  const applyTransform = () => sceneManager.applySplatTransform(settingsStore.world);
  const saveDebounced = debounce(() => settingsStore.save(), 150);
  const groundFieldsEl = fieldsEl.querySelector('[data-role="groundFields"]');

  bindColor(fieldsEl, settingsStore, 'world', 'skyColor', {
    onChange: (hex) => { callbacks.onSkyChange?.(hex); saveDebounced(); },
  });
  bindRange(fieldsEl, settingsStore, 'world', 'splatScale', { onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatPosX', { onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatPosY', { onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatPosZ', { onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatRotX', { fmt: (v) => v.toFixed(0) + '°', onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatRotY', { fmt: (v) => v.toFixed(0) + '°', onChange: () => { applyTransform(); saveDebounced(); } });
  bindRange(fieldsEl, settingsStore, 'world', 'splatRotZ', { fmt: (v) => v.toFixed(0) + '°', onChange: () => { applyTransform(); saveDebounced(); } });

  function updateGroundVisibility() {
    groundFieldsEl.classList.toggle('field-disabled', !settingsStore.world.groundEnabled);
  }
  bindCheckbox(fieldsEl, settingsStore, 'world', 'groundEnabled', {
    onChange: () => { settingsStore.save(); updateGroundVisibility(); },
  });
  bindRange(fieldsEl, settingsStore, 'world', 'groundHeight', { fmt: (v) => v.toFixed(1) + ' m', onChange: () => saveDebounced() });
  bindCheckbox(fieldsEl, settingsStore, 'world', 'autoGround', { onChange: () => settingsStore.save() });
  updateGroundVisibility();

  function setSceneLoadedUI(loaded) {
    fieldsEl.classList.toggle('field-disabled', !loaded);
    launchBtn.disabled = !loaded;
  }
  setSceneLoadedUI(!!sceneManager.entity);

  const setStatus = (text) => {
    statusEl.textContent = text;
    statusEl.classList.toggle('busy', /loading/i.test(text));
    statusEl.classList.toggle('error', /failed/i.test(text));
  };

  sceneManager.onReady = () => setSceneLoadedUI(true);

  const loadFile = (file) => sceneManager.loadFromFile(file, settingsStore.world, setStatus);

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadFile(file);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  });

  document.getElementById('loadUrlBtn').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value.trim();
    if (url) sceneManager.loadFromUrl(url, url, setStatus, settingsStore.world);
  });
  document.getElementById('urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loadUrlBtn').click();
  });
  document.getElementById('demoBtn').addEventListener('click', () => {
    sceneManager.loadFromUrl(DEMO_SPLAT_URL, 'demo', setStatus, settingsStore.world);
  });

  backBtn.addEventListener('click', () => {
    settingsStore.save(); // flush in case a debounced slider save hasn't fired yet
    sceneManager.unload();
    setSceneLoadedUI(false);
    setStatus('');
    callbacks.onBack?.();
  });

  launchBtn.addEventListener('click', () => {
    if (!sceneManager.entity) return;
    settingsStore.save();
    callbacks.onLaunch?.();
  });

  const qp = new URLSearchParams(window.location.search);
  const deepLinkUrl = qp.get('content');
  if (deepLinkUrl) {
    sceneManager.loadFromUrl(deepLinkUrl, deepLinkUrl, setStatus, settingsStore.world);
  }

  return {
    show() { screen.hidden = false; },
    hide() { screen.hidden = true; },
    hasDeepLink: !!deepLinkUrl,
    // Called when returning here from in-game "back to menu" — the scene
    // was already torn down by the caller, just reset this screen's UI.
    reset() {
      setSceneLoadedUI(false);
      setStatus('');
      document.getElementById('urlInput').value = '';
    },
  };
}
