import * as THREE from 'three';
import { DIR_ORDER, facesKey, identityFaces, rollFaces } from './logic.js';

/** World-axis quarter turns. Premultiply so the mesh matches rollFaces. */
export const ROLL_TURN = {
  E: { axis: new THREE.Vector3(0, 0, 1), angle: -Math.PI / 2 },
  W: { axis: new THREE.Vector3(0, 0, 1), angle: Math.PI / 2 },
  S: { axis: new THREE.Vector3(1, 0, 0), angle: Math.PI / 2 },
  N: { axis: new THREE.Vector3(1, 0, 0), angle: -Math.PI / 2 },
};

export const ROLL_DELTA = Object.fromEntries(
  Object.entries(ROLL_TURN).map(([dir, turn]) => [
    dir,
    new THREE.Quaternion().setFromAxisAngle(turn.axis, turn.angle),
  ]),
);

const LOCAL_NORMAL = {
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
  south: new THREE.Vector3(0, 0, 1),
  north: new THREE.Vector3(0, 0, -1),
};

const cache = new Map();

function build() {
  const startFaces = identityFaces();
  const startQ = new THREE.Quaternion();
  const queue = [{ faces: startFaces, quat: startQ }];
  cache.set(facesKey(startFaces), startQ);
  while (queue.length) {
    const cur = queue.pop();
    for (const dir of DIR_ORDER) {
      const faces = rollFaces(cur.faces, dir);
      const key = facesKey(faces);
      if (cache.has(key)) continue;
      const quat = ROLL_DELTA[dir].clone().multiply(cur.quat);
      cache.set(key, quat);
      queue.push({ faces, quat });
    }
  }
}

export function quaternionForFaces(faces) {
  if (cache.size === 0) build();
  const quat = cache.get(facesKey(faces));
  if (!quat) throw new Error(`unknown orientation ${facesKey(faces)}`);
  return quat.clone();
}

const WORLD_AXES = [
  ['top', new THREE.Vector3(0, 1, 0)],
  ['bottom', new THREE.Vector3(0, -1, 0)],
  ['east', new THREE.Vector3(1, 0, 0)],
  ['west', new THREE.Vector3(-1, 0, 0)],
  ['south', new THREE.Vector3(0, 0, 1)],
  ['north', new THREE.Vector3(0, 0, -1)],
];

/** Value that would show on each world direction after the quaternion is applied. */
export function worldFaces(faces, quat) {
  const inv = quat.clone().invert();
  const out = {};
  for (const [name, normal] of WORLD_AXES) {
    const local = normal.clone().applyQuaternion(inv);
    let best = null;
    let bestDot = -Infinity;
    for (const [localName, localNormal] of Object.entries(LOCAL_NORMAL)) {
      const dot = local.dot(localNormal);
      if (dot > bestDot) {
        bestDot = dot;
        best = localName;
      }
    }
    out[name] = faces[best];
  }
  return out;
}

/**
 * Pivot a unit die around its bottom edge. Returns the center after a full quarter turn.
 * East/west pivot on Z, north/south pivot on X. +Y is up.
 */
export function pivotedCenter(dir, x, z, centerY = 0.5) {
  const half = 0.5;
  const turn = ROLL_TURN[dir];
  if (!turn) throw new Error(dir);
  const pivot = new THREE.Vector3(x, 0, z);
  if (dir === 'E') pivot.x += half;
  else if (dir === 'W') pivot.x -= half;
  else if (dir === 'S') pivot.z += half;
  else pivot.z -= half;
  const quat = new THREE.Quaternion().setFromAxisAngle(turn.axis, turn.angle);
  const center = new THREE.Vector3(x, centerY, z);
  return pivot.clone().add(center.sub(pivot).applyQuaternion(quat));
}
