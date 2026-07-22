// Shared <input type="range">/checkbox markup + scoped binding helpers, used
// by every settings surface (main-menu Settings, in-game Settings, the setup
// screen's scene/ground fields). Deliberately un-id'd — fields are looked up
// by data-section/data-key scoped to whatever root they're rendered into, so
// the same field can appear in more than one panel at once without DOM id
// collisions.

export function slider(label, min, max, step, section, key) {
  return `
    <div class="field" data-section="${section}" data-key="${key}">
      <label>${label} <span class="val"></span></label>
      <input type="range" min="${min}" max="${max}" step="${step}">
    </div>`;
}

export function checkbox(label, section, key) {
  return `
    <div class="field checkbox-row" data-section="${section}" data-key="${key}">
      <label>${label}</label>
      <input type="checkbox">
    </div>`;
}

export function debounce(fn, ms) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function fieldEl(root, section, key) {
  return root.querySelector(`.field[data-section="${section}"][data-key="${key}"]`);
}

// Binds a slider to settingsStore[section][key] unless get/set are given
// (for nested paths like gamepad.sensitivity.yaw). Returns a resync()
// function so callers can refresh the displayed value after a reset/import.
export function bindRange(root, settingsStore, section, key, opts = {}) {
  const field = fieldEl(root, section, key);
  if (!field) return () => {};
  const input = field.querySelector('input[type="range"]');
  const valEl = field.querySelector('.val');
  const fmt = opts.fmt || ((v) => v.toFixed(1));
  const get = opts.get || (() => settingsStore[section][key]);
  const set = opts.set || ((v) => { settingsStore[section][key] = v; });

  const resync = () => {
    const v = get();
    input.value = v;
    if (valEl) valEl.textContent = fmt(v);
  };
  resync();

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    set(v);
    if (valEl) valEl.textContent = fmt(v);
    opts.onChange?.(v);
  });

  return resync;
}

export function bindCheckbox(root, settingsStore, section, key, opts = {}) {
  const field = fieldEl(root, section, key);
  if (!field) return () => {};
  const input = field.querySelector('input[type="checkbox"]');
  const get = opts.get || (() => settingsStore[section][key]);
  const set = opts.set || ((v) => { settingsStore[section][key] = v; });

  const resync = () => { input.checked = get(); };
  resync();

  input.addEventListener('change', () => {
    set(input.checked);
    opts.onChange?.(input.checked);
  });

  return resync;
}
