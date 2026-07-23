// Converts the antimatter15 ".splat" binary format into an in-memory PLY
// buffer that PlayCanvas's built-in gsplat ply parser understands — the
// engine has no native ".splat" parser, so this is the bridge. Format ref:
// https://github.com/antimatter15/splat (32 bytes/record: pos, scale, rgba, quat).
const SH_C0 = 0.28209479177387814;
const SPLAT_RECORD_SIZE = 32;
const EPS = 1e-6;

export function isSplatFilename(name) {
  return /\.splat$/i.test(name || '');
}

export function convertSplatToPly(buffer) {
  const vertexCount = Math.floor(buffer.byteLength / SPLAT_RECORD_SIZE);
  const src = new DataView(buffer);

  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${vertexCount}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'property float f_dc_0\n' +
    'property float f_dc_1\n' +
    'property float f_dc_2\n' +
    'property float opacity\n' +
    'property float scale_0\n' +
    'property float scale_1\n' +
    'property float scale_2\n' +
    'property float rot_0\n' +
    'property float rot_1\n' +
    'property float rot_2\n' +
    'property float rot_3\n' +
    'end_header\n';
  const headerBytes = new TextEncoder().encode(header);

  const vertexSize = 14 * 4;
  const out = new ArrayBuffer(headerBytes.byteLength + vertexCount * vertexSize);
  new Uint8Array(out).set(headerBytes, 0);
  const dst = new DataView(out, headerBytes.byteLength);

  for (let i = 0; i < vertexCount; i++) {
    const srcOff = i * SPLAT_RECORD_SIZE;
    const x = src.getFloat32(srcOff + 0, true);
    const y = src.getFloat32(srcOff + 4, true);
    const z = src.getFloat32(srcOff + 8, true);
    const sx = src.getFloat32(srcOff + 12, true);
    const sy = src.getFloat32(srcOff + 16, true);
    const sz = src.getFloat32(srcOff + 20, true);
    const r = src.getUint8(srcOff + 24);
    const g = src.getUint8(srcOff + 25);
    const b = src.getUint8(srcOff + 26);
    const a = src.getUint8(srcOff + 27);
    // Quaternion stored as (w, x, y, z), each byte mapped from [0,255] to [-1,1].
    const rw = (src.getUint8(srcOff + 28) - 128) / 128;
    const rx = (src.getUint8(srcOff + 29) - 128) / 128;
    const ry = (src.getUint8(srcOff + 30) - 128) / 128;
    const rz = (src.getUint8(srcOff + 31) - 128) / 128;

    const opacity = Math.min(Math.max(a / 255, EPS), 1 - EPS);

    const dstOff = i * vertexSize;
    dst.setFloat32(dstOff + 0, x, true);
    dst.setFloat32(dstOff + 4, y, true);
    dst.setFloat32(dstOff + 8, z, true);
    // .splat stores plain 0-255 color; PLY expects the SH DC term it's derived from.
    dst.setFloat32(dstOff + 12, (r / 255 - 0.5) / SH_C0, true);
    dst.setFloat32(dstOff + 16, (g / 255 - 0.5) / SH_C0, true);
    dst.setFloat32(dstOff + 20, (b / 255 - 0.5) / SH_C0, true);
    // PLY stores opacity/scale pre-activation (logit/log); .splat stores them linear.
    dst.setFloat32(dstOff + 24, Math.log(opacity / (1 - opacity)), true);
    dst.setFloat32(dstOff + 28, Math.log(Math.max(sx, EPS)), true);
    dst.setFloat32(dstOff + 32, Math.log(Math.max(sy, EPS)), true);
    dst.setFloat32(dstOff + 36, Math.log(Math.max(sz, EPS)), true);
    dst.setFloat32(dstOff + 40, rw, true);
    dst.setFloat32(dstOff + 44, rx, true);
    dst.setFloat32(dstOff + 48, ry, true);
    dst.setFloat32(dstOff + 52, rz, true);
  }

  return out;
}
