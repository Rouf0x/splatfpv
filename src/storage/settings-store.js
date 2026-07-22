import { DEFAULT_SETTINGS, STORAGE_KEY } from '../config/defaults.js';
import { deepMerge } from '../utils/math.js';

class SettingsStore {
  constructor() {
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.settings = deepMerge(DEFAULT_SETTINGS, JSON.parse(raw));
      }
    } catch {
      this.settings = structuredClone(DEFAULT_SETTINGS);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* quota exceeded — ignore */
    }
    this.notify();
  }

  reset() {
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.save();
  }

  exportJSON() {
    return JSON.stringify(this.settings, null, 2);
  }

  // Throws on invalid JSON — callers decide how to surface that.
  importJSON(json) {
    const parsed = JSON.parse(json);
    this.settings = deepMerge(DEFAULT_SETTINGS, parsed);
    this.save();
  }

  get section() {
    return this.settings;
  }

  get flight() { return this.settings.flight; }
  get camera() { return this.settings.camera; }
  get world() { return this.settings.world; }
  get controls() { return this.settings.controls; }
  get gamepad() { return this.settings.gamepad; }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.settings);
  }
}

export const settingsStore = new SettingsStore();
