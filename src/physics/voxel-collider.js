import { Vec3 } from 'playcanvas';

// Experimental — turns a splat's point cloud into a sparse grid of solid
// voxel cubes for collision. Deliberately coarse: it tests the drone's exact
// position against occupied cells rather than sweeping a volume, same level
// of fidelity as the existing ground-plane collision.
//
// Cell coordinates are packed into a single non-negative safe integer rather
// than a string key, so the occupancy set stays cheap to build and query
// even for scenes with several million splats. 17 bits/axis (±65536 cells)
// comfortably covers any realistic scan at any voxel size the UI allows.
const AXIS_BITS = 17;
const AXIS_RANGE = 1 << AXIS_BITS;
const AXIS_OFFSET = AXIS_RANGE >> 1;

function cellKey(ix, iy, iz) {
  const cx = ix + AXIS_OFFSET;
  const cy = iy + AXIS_OFFSET;
  const cz = iz + AXIS_OFFSET;
  if (cx < 0 || cx >= AXIS_RANGE || cy < 0 || cy >= AXIS_RANGE || cz < 0 || cz >= AXIS_RANGE) {
    return null;
  }
  return (cx * AXIS_RANGE + cy) * AXIS_RANGE + cz;
}

// Returns null when the loaded splat doesn't expose CPU-side point centers
// (currently only .lod-meta.json streamed octrees, whose points live in a
// dynamically-populated GPU work buffer rather than a static array).
export function buildVoxelCollider(splatEntity, voxelSize) {
  const resource = splatEntity?.gsplat?.resource;
  const centers = resource?.centers;
  if (!centers || !centers.length) return null;

  const size = Math.max(voxelSize, 0.01);
  const worldMat = splatEntity.getWorldTransform();
  const numSplats = resource.numSplats ?? Math.floor(centers.length / 3);

  const cells = new Set();
  const p = new Vec3();
  for (let i = 0; i < numSplats; i++) {
    p.set(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
    worldMat.transformPoint(p, p);
    const key = cellKey(Math.floor(p.x / size), Math.floor(p.y / size), Math.floor(p.z / size));
    if (key !== null) cells.add(key);
  }

  return {
    size,
    cellCount: cells.size,
    occupied(wx, wy, wz) {
      const key = cellKey(Math.floor(wx / size), Math.floor(wy / size), Math.floor(wz / size));
      return key !== null && cells.has(key);
    },
  };
}
