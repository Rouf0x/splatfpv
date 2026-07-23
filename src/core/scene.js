import { Entity } from './app.js';
import { isSplatFilename, convertSplatToPly } from '../utils/splat-to-ply.js';

let splatEntity = null;
let currentBlobUrl = null;

// superspl.at share links (e.g. https://superspl.at/scene/<hash>) point at an
// HTML viewer page, not a splat file. The page embeds the real asset at a
// fixed CDN location we can construct directly from the scene hash, but the
// filename depends on how the scene was published (plain "sog" vs LOD-chunked
// "ssog"), so we probe candidates rather than assuming one.
const SUPERSPLAT_CDN_BASE = 'https://d28zzqy0iyovbz.cloudfront.net';
const SUPERSPLAT_CONTENT_CANDIDATES = ['lod-meta.json', 'meta.json', 'scene.compressed.ply'];

function extractSuperSplatHash(url) {
  let u;
  try {
    u = new URL(url, window.location.href);
  } catch {
    return null;
  }
  if (!/(^|\.)superspl\.at$/i.test(u.hostname)) return null;
  const idParam = u.searchParams.get('id');
  if (idParam) return idParam;
  const match = u.pathname.match(/\/scene\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function resolveSuperSplatUrl(url) {
  const hash = extractSuperSplatHash(url);
  if (!hash) return url;
  for (const filename of SUPERSPLAT_CONTENT_CANDIDATES) {
    const candidate = `${SUPERSPLAT_CDN_BASE}/${hash}/v1/${filename}`;
    try {
      const res = await fetch(candidate, { method: 'HEAD' });
      if (res.ok) return candidate;
    } catch {
      // network/CORS error on this candidate - try the next one
    }
  }
  throw new Error('Could not find a SuperSplat asset for this link');
}

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

  // Distance-based LOD only exists for formats that actually carry multiple
  // levels (.compressed.ply / .lod-meta.json octrees) — a no-op otherwise.
  // Disabling it clamps the selectable range to LOD 0 (the component's own
  // finest level), rather than the full 0-99 range it defaults to.
  function applyLod(world) {
    if (!splatEntity || !world) return;
    splatEntity.gsplat.lodRangeMax = world.lodDisabled ? 0 : 99;
  }

  function placeSplat(asset, world) {
    if (splatEntity) {
      splatEntity.destroy();
      splatEntity = null;
    }
    splatEntity = new Entity('Splat');
    splatEntity.addComponent('gsplat', { asset });
    if (world) {
      applySplatTransform(world);
      applyLod(world);
    }
    app.root.addChild(splatEntity);
    onReadyCallback();
  }

  function revokeBlobUrl() {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
  }

  function loadAsset(url, filename, world, setStatus) {
    app.assets.loadFromUrlAndFilename(url, filename, 'gsplat', (err, asset) => {
      if (err) {
        setStatus(`Failed: ${err}`);
        return;
      }
      setStatus('');
      placeSplat(asset, world);
    });
  }

  // PlayCanvas has no native ".splat" parser, so convert it to an in-memory
  // PLY (which it does support) and load that instead.
  function loadConvertedSplat(buffer, originalName, world, setStatus) {
    let plyBuffer;
    try {
      plyBuffer = convertSplatToPly(buffer);
    } catch (err) {
      setStatus(`Failed: ${err.message || err}`);
      return;
    }
    revokeBlobUrl();
    currentBlobUrl = URL.createObjectURL(new Blob([plyBuffer], { type: 'application/octet-stream' }));
    loadAsset(currentBlobUrl, originalName.replace(/\.splat$/i, '.ply'), world, setStatus);
  }

  async function loadFromUrl(url, label, setStatus, world) {
    setStatus(`Loading ${label || url}…`);
    let resolvedUrl;
    try {
      resolvedUrl = await resolveSuperSplatUrl(url);
    } catch (err) {
      setStatus(`Failed: ${err.message || err}`);
      return;
    }
    const filename = fileNameFromUrl(resolvedUrl);
    if (isSplatFilename(filename)) {
      fetch(resolvedUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buffer) => loadConvertedSplat(buffer, filename, world, setStatus))
        .catch((err) => setStatus(`Failed: ${err.message || err}`));
      return;
    }
    loadAsset(resolvedUrl, filename, world, setStatus);
  }

  function loadFromFile(file, world, setStatus) {
    setStatus(`Loading ${file.name}…`);
    if (isSplatFilename(file.name)) {
      file.arrayBuffer()
        .then((buffer) => loadConvertedSplat(buffer, file.name, world, setStatus))
        .catch((err) => setStatus(`Failed: ${err.message || err}`));
      return;
    }
    revokeBlobUrl();
    currentBlobUrl = URL.createObjectURL(file);
    loadAsset(currentBlobUrl, file.name, world, setStatus);
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
    applyLod,
    loadFromUrl,
    loadFromFile,
    unload,
    set onReady(fn) { onReadyCallback = fn; },
  };
}
