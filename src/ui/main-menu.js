export function initMainMenu(callbacks) {
  const el = document.getElementById('mainMenu');

  document.getElementById('menuPlayBtn').addEventListener('click', () => callbacks.onPlay?.());
  document.getElementById('menuSettingsBtn').addEventListener('click', () => callbacks.onSettings?.());
  document.getElementById('menuCalibrateBtn').addEventListener('click', () => callbacks.onCalibrate?.());

  return {
    show() { el.hidden = false; },
    hide() { el.hidden = true; },
  };
}
