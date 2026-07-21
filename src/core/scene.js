import { Entity } from './app.js';

let splatEntity = null;
let currentBlobUrl = null;

export function createSceneManager(app) {
  let onReadyCallback = () => {};

  function fileNameFromUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : 'scene.ply';
    } catch {
      return 'scene.ply';
    }
  }

  function applySplatTransform(world) {
    if (!splatEntity || !world) return;
    splatEntity.setLocalPosition(world.splatPosX, world.splatPosY, world.splatPosZ);
    splatEntity.setLocalEulerAngles(world.splatRotX, world.splatRotY, world.splatRotZ);
    splatEntity.setLocalScale(world.splatScale, world.splatScale, world.splatScale);
  }

  function placeSplat(asset, world) {
    if (splatEntity) {
      splatEntity.destroy();
      splatEntity = null;
    }
    splatEntity = new Entity('Splat');
    splatEntity.addComponent('gsplat', { asset });
    if (world) applySplatTransform(world);
    app.root.addChild(splatEntity);
    onReadyCallback();
  }

  function revokeBlobUrl() {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
  }

  function loadFromUrl(url, label, setStatus, world) {
    setStatus(`Loading ${label || url}…`);
    const filename = fileNameFromUrl(url);
    app.assets.loadFromUrlAndFilename(url, filename, 'gsplat', (err, asset) => {
      if (err) {
        setStatus(`Failed: ${err}`);
        return;
      }
      setStatus('');
      placeSplat(asset, world);
    });
  }

  function loadFromFile(file, world, setStatus) {
    setStatus(`Loading ${file.name}…`);
    revokeBlobUrl();
    currentBlobUrl = URL.createObjectURL(file);
    app.assets.loadFromUrlAndFilename(currentBlobUrl, file.name, 'gsplat', (err, asset) => {
      if (err) {
        setStatus(`Failed: ${err}`);
        return;
      }
      setStatus('');
      placeSplat(asset, world);
    });
  }

  function unload() {
    if (splatEntity) {
      splatEntity.destroy();
      splatEntity = null;
    }
    revokeBlobUrl();
  }

  return {
    get entity() { return splatEntity; },
    applySplatTransform,
    loadFromUrl,
    loadFromFile,
    unload,
    set onReady(fn) { onReadyCallback = fn; },
  };
}
