import { RATE_PRESETS } from '../config/defaults.js';
import { slider, checkbox, debounce, bindRange, bindCheckbox } from './field-controls.js';

const ACTIONS = ['throttle', 'yaw', 'pitch', 'roll'];
const NUM_CHANNELS = 8;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const TAB_LABELS = {
  general: 'General',
  flight: 'Flight',
  camera: 'Camera',
  controls: 'Controls',
};

const TAB_CONTENT = {
  general: `
    <h3>Persistence</h3>
    <p class="key-list" style="margin-top:0">Every change on these tabs saves automatically — there's nothing to apply.</p>
    <div class="preset-row">
      <button data-action="export" class="btn subtle">Export settings…</button>
      <button data-action="import" class="btn subtle">Import settings…</button>
    </div>
    <input type="file" data-role="importFile" accept="application/json" hidden>
    <div data-role="ioStatus" class="load-status"></div>
    <h3>Reset</h3>
    <button data-action="reset" class="btn ghost" style="width:100%">Reset everything to defaults</button>
  `,
  flight: `
    <h3>Rate profile</h3>
    <div class="preset-row">
      <button class="btn subtle" data-preset="cinematic">Cinematic</button>
      <button class="btn subtle" data-preset="sport">Sport</button>
      <button class="btn subtle" data-preset="race">Race</button>
    </div>
    <h3>Rates &amp; response</h3>
    ${slider('Max roll rate', 90, 1200, 10, 'flight', 'maxRoll')}
    ${slider('Max pitch rate', 90, 1200, 10, 'flight', 'maxPitch')}
    ${slider('Max yaw rate', 60, 900, 10, 'flight', 'maxYaw')}
    ${slider('Stick expo', 0, 0.8, 0.05, 'flight', 'rateExpo')}
    ${slider('Rate response', 4, 40, 1, 'flight', 'response')}
    ${slider('Angular damping', 0, 8, 0.5, 'flight', 'angularDrag')}
    <h3>Physics</h3>
    ${slider('Thrust : weight', 1.1, 5, 0.1, 'flight', 'twr')}
    ${slider('Air drag', 0.05, 2, 0.05, 'flight', 'drag')}
    ${slider('Mass (kg)', 0.3, 1.5, 0.05, 'flight', 'mass')}
    ${slider('Motor spool', 4, 30, 1, 'flight', 'motorResponse')}
    ${slider('World scale', 0.1, 10, 0.1, 'flight', 'worldScale')}
    ${checkbox('Hover assist', 'flight', 'hoverAssist')}
    ${slider('Hover assist strength', 0, 1, 0.05, 'flight', 'hoverStrength')}
  `,
  camera: `
    ${slider('FPV camera tilt', 0, 50, 1, 'camera', 'camTilt')}
    ${slider('FPV field of view', 70, 150, 1, 'camera', 'camFov')}
    ${slider('Chase distance', 0.5, 10, 0.1, 'camera', 'chaseDist')}
    ${slider('Chase height ratio', 0.1, 1, 0.05, 'camera', 'chaseHeight')}
  `,
  controls: `
    <h3>HUD</h3>
    ${checkbox('Show stick preview', 'controls', 'showStickPreview')}
    <h3>Keyboard</h3>
    ${checkbox('Invert pitch', 'controls', 'invertPitch')}
    ${checkbox('Invert roll', 'controls', 'invertRoll')}
    ${checkbox('Invert yaw', 'controls', 'invertYaw')}
    ${slider('Keyboard sensitivity', 0.5, 2, 0.1, 'controls', 'keyboardSensitivity')}
    <div class="field mapping-row">
      <span>Throttle mode</span>
      <select data-role="throttleMode">
        <option value="hold">Hold (W/S ratchet)</option>
        <option value="spring">Spring back</option>
      </select>
    </div>
    <h3>Shortcuts</h3>
    <div class="key-list">
      <b>W/S</b> throttle &nbsp; <b>A/D</b> yaw<br>
      <b>↑↓</b> pitch &nbsp; <b>←→</b> roll<br>
      <b>SPACE</b> launch · <b>R</b> reset<br>
      <b>C</b> toggle camera &nbsp; <b>ESC</b> preview orbit
    </div>
    <h3>Gamepad</h3>
    ${checkbox('Gamepad input', 'gamepad', 'enabled')}
    <button data-action="openWizard" class="btn primary" style="width:100%;margin:10px 0">Calibrate controller</button>
    <div data-role="calSummary" class="cal-summary-box">Not calibrated yet.</div>
    ${slider('Deadzone', 0.02, 0.3, 0.01, 'gamepad', 'deadzone')}
    ${slider('Yaw sensitivity', 0.5, 2, 0.1, 'gamepad', 'sensYaw')}
    ${slider('Pitch sensitivity', 0.5, 2, 0.1, 'gamepad', 'sensPitch')}
    ${slider('Roll sensitivity', 0.5, 2, 0.1, 'gamepad', 'sensRoll')}
    ${slider('Throttle sensitivity', 0.5, 2, 0.1, 'gamepad', 'sensThrottle')}
    <h3>Gamepad inversions</h3>
    ${checkbox('Invert throttle', 'gamepad', 'invertThrottle')}
    ${checkbox('Invert yaw', 'gamepad', 'invertYaw')}
    ${checkbox('Invert pitch', 'gamepad', 'invertPitch')}
    ${checkbox('Invert roll', 'gamepad', 'invertRoll')}
  `,
};

// One instance per settings surface — the dedicated main-menu Settings
// screen (tabs: general, controls) and the small in-game panel (tabs:
// flight, camera, controls) both call this against their own root element,
// so their fields never collide even though "controls" is rendered twice.
export function createSettingsUI(root, tabs, settingsStore, callbacks = {}) {
  const nav = root.querySelector('.settings-tabs');
  const body = root.querySelector('.settings-body');

  nav.innerHTML = tabs.map((t, i) =>
    `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${t}">${TAB_LABELS[t]}</button>`
  ).join('');
  body.innerHTML = tabs.map((t, i) =>
    `<div class="tab-pane${i === 0 ? ' active' : ''}" data-pane="${t}">${TAB_CONTENT[t]}</div>`
  ).join('');

  nav.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      nav.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      body.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      body.querySelector(`[data-pane="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  const saveDebounced = debounce(() => settingsStore.save(), 150);
  const saveNow = () => settingsStore.save();
  const resyncs = [];

  const range = (section, key, fmt, extra) => resyncs.push(
    bindRange(body, settingsStore, section, key, { fmt, onChange: () => {
      if (section === 'camera') callbacks.onCameraChange?.();
      saveDebounced();
      extra?.();
    } })
  );
  const check = (section, key, extra) => resyncs.push(
    bindCheckbox(body, settingsStore, section, key, { onChange: () => { saveNow(); extra?.(); } })
  );

  range('flight', 'maxRoll', (v) => v.toFixed(0) + '°/s');
  range('flight', 'maxPitch', (v) => v.toFixed(0) + '°/s');
  range('flight', 'maxYaw', (v) => v.toFixed(0) + '°/s');
  range('flight', 'rateExpo');
  range('flight', 'response', (v) => v.toFixed(0));
  range('flight', 'angularDrag');
  range('flight', 'twr');
  range('flight', 'drag');
  range('flight', 'mass');
  range('flight', 'motorResponse', (v) => v.toFixed(0));
  range('flight', 'worldScale');
  check('flight', 'hoverAssist');
  range('flight', 'hoverStrength');

  range('camera', 'camTilt', (v) => v.toFixed(0) + '°');
  range('camera', 'camFov', (v) => v.toFixed(0) + '°');
  range('camera', 'chaseDist', (v) => v.toFixed(1) + ' m');
  range('camera', 'chaseHeight');

  check('controls', 'showStickPreview', () => callbacks.onStickPreviewChange?.(settingsStore.controls.showStickPreview));
  check('controls', 'invertPitch');
  check('controls', 'invertRoll');
  check('controls', 'invertYaw');
  range('controls', 'keyboardSensitivity');

  const throttleModeEl = body.querySelector('[data-role="throttleMode"]');
  if (throttleModeEl) {
    throttleModeEl.value = settingsStore.controls.keyboardThrottleMode;
    throttleModeEl.addEventListener('change', (e) => {
      settingsStore.controls.keyboardThrottleMode = e.target.value;
      saveNow();
    });
    resyncs.push(() => { throttleModeEl.value = settingsStore.controls.keyboardThrottleMode; });
  }

  check('gamepad', 'enabled');
  range('gamepad', 'deadzone');
  // Sensitivity fields live at gamepad.sensitivity.<k>, not a flat key,
  // so they need explicit get/set accessors rather than the `range()` shorthand.
  ['yaw', 'pitch', 'roll', 'throttle'].forEach((k) => {
    resyncs.push(bindRange(body, settingsStore, 'gamepad', `sens${cap(k)}`, {
      get: () => settingsStore.gamepad.sensitivity[k],
      set: (v) => { settingsStore.gamepad.sensitivity[k] = v; },
      onChange: () => saveDebounced(),
    }));
  });
  ACTIONS.forEach((action) => {
    resyncs.push(bindCheckbox(body, settingsStore, 'gamepad', `invert${cap(action)}`, {
      get: () => settingsStore.gamepad.invert[action],
      set: (v) => { settingsStore.gamepad.invert[action] = v; },
      onChange: () => saveNow(),
    }));
  });

  body.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Object.assign(settingsStore.flight, RATE_PRESETS[btn.dataset.preset]);
      resyncs.forEach((fn) => fn());
      saveNow();
    });
  });

  function updateCalSummary() {
    const el = body.querySelector('[data-role="calSummary"]');
    if (!el) return;
    const assigned = new Set(
      settingsStore.gamepad.channels.slice(0, NUM_CHANNELS).map((c) => c.action).filter((a) => a !== 'none')
    );
    el.innerHTML = assigned.size
      ? ACTIONS.map((a) => assigned.has(a)
          ? `<span class="ok">✓ ${cap(a)}</span>`
          : `<span class="missing">— ${cap(a)}</span>`
        ).join('&nbsp;&nbsp;&nbsp;')
      : 'Not calibrated yet.';
  }
  updateCalSummary();
  resyncs.push(updateCalSummary);

  const wizardBtn = body.querySelector('[data-action="openWizard"]');
  wizardBtn?.addEventListener('click', () => callbacks.onOpenWizard?.());

  const ioStatusEl = body.querySelector('[data-role="ioStatus"]');
  const setIOStatus = (text, isError) => {
    if (!ioStatusEl) return;
    ioStatusEl.textContent = text;
    ioStatusEl.classList.toggle('error', !!isError);
  };

  body.querySelector('[data-action="export"]')?.addEventListener('click', () => {
    const blob = new Blob([settingsStore.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'splatfpv-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIOStatus('Exported.');
  });

  const importFile = body.querySelector('[data-role="importFile"]');
  body.querySelector('[data-action="import"]')?.addEventListener('click', () => importFile.click());
  importFile?.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      settingsStore.importJSON(text);
      resyncs.forEach((fn) => fn());
      callbacks.onWorldChange?.();
      callbacks.onCameraChange?.();
      setIOStatus('Imported.');
    } catch {
      setIOStatus('Failed to import — not a valid settings file.', true);
    }
  });

  body.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    settingsStore.reset();
    resyncs.forEach((fn) => fn());
    callbacks.onWorldChange?.();
    callbacks.onCameraChange?.();
    setIOStatus('Reset to defaults.');
  });

  function sync() {
    resyncs.forEach((fn) => fn());
    setIOStatus('');
  }

  return { sync };
}
