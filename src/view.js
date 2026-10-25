import * as THREE from 'three';
import { DIR_DELTA, cloneFaces, identityFaces, rollFaces } from './logic.js';
import { ROLL_TURN, quaternionForFaces } from './orient.js';

const DIE_Y = 0.5;
const TITLE_ROLL = 0.72;
const TITLE_PAUSE = 0.16;
const AZIMUTHS = [0.58, 0.58 + Math.PI / 2, 0.58 + Math.PI, 0.58 + (3 * Math.PI) / 2];

const PIP = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function tween(duration, tick) {
  if (duration <= 0) {
    tick(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      tick(t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

function makePipTexture(value, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f4ecdf';
  g.fillRect(0, 0, 256, 256);
  const shade = g.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)');
  shade.addColorStop(1, 'rgba(90,60,40,0.16)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 256);
  const red = value === 1;
  g.fillStyle = red ? '#c4372a' : '#241c17';
  const radius = red ? 36 : 24;
  for (const [u, v] of PIP[value]) {
    g.beginPath();
    g.arc(u * 256, v * 256, radius, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function makeWoodTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#b48355';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i += 1) {
    const y = (i / 46) * 256 + Math.sin(i * 1.7) * 2;
    g.strokeStyle = `rgba(${70 + (i % 5) * 8}, ${42 + (i % 3) * 6}, 24, 0.18)`;
    g.lineWidth = 1 + (i % 3);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(80, y + 6, 160, y - 5, 256, y + 2);
    g.stroke();
  }
  g.strokeStyle = 'rgba(48,28,16,0.65)';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 242, 242);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function makeBlobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.38)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function makeNumberTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(28,22,18,0.78)';
  g.beginPath();
  g.arc(64, 64, 42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = value === '1' ? '#ffb2a4' : '#fff8ee';
  g.font = '700 68px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(value, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const hemi = new THREE.HemisphereLight(0xfff4e4, 0x3a2c24, 1.35);
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.6);
  sun.position.set(4.5, 9, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.03;
  const fill = new THREE.DirectionalLight(0xd5e4ff, 0.55);
  fill.position.set(-5, 3.5, -2);
  scene.add(hemi, sun, fill, sun.target);

  const board = new THREE.Group();
  const title = new THREE.Group();
  scene.add(board, title);

  const wood = makeWoodTexture(renderer);
  const blob = makeBlobTexture();
  const pipTex = {};
  for (let v = 1; v <= 6; v += 1) pipTex[v] = makePipTexture(v, renderer);
  const numberTex = {};
  for (let v = 1; v <= 6; v += 1) numberTex[v] = makeNumberTexture(String(v));

  const dieGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgeGeo = new THREE.EdgesGeometry(dieGeo);
  const tileGeo = new THREE.BoxGeometry(0.94, 0.22, 0.94);
  const tileMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.86, metalness: 0.02 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a211c, transparent: true, opacity: 0.45 });
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0xd9cbb6,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  const pipMat = {};
  const faceOrder = ['east', 'west', 'top', 'bottom', 'south', 'north'];
  const faceValue = { east: 3, west: 4, top: 1, bottom: 6, south: 2, north: 5 };
  for (const name of faceOrder) {
    pipMat[name] = new THREE.MeshStandardMaterial({
      map: pipTex[faceValue[name]],
      roughness: 0.42,
      metalness: 0.04,
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let diceObjs = [];
  let mode = 'title';
  let showNumbers = false;
  let flip = false;
  let camIndex = 0;
  let center = new THREE.Vector3();
  let dist = 8;
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  let titleTime = 0;
  let titleActors = [];
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let camAnim = null;
  let lookTarget = new THREE.Vector3();
  const basis = new THREE.Object3D();
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (mode === 'board') placeCamera(false);
    else if (mode === 'title') frameTitle();
  }

  function placeCamera(animate) {
    const az = AZIMUTHS[(camIndex + (flip ? 2 : 0)) % 4];
    const offset = new THREE.Vector3(Math.sin(az), 1.18, Math.cos(az)).normalize();
    const dest = center.clone().addScaledVector(offset, dist);
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const worldH = 2 * Math.tan(vFov / 2) * dist;
    const worldW = worldH * (w / h);
    const panX = ((insets.left - insets.right) / 2 / w) * worldW;
    const panY = ((insets.top - insets.bottom) / 2 / h) * worldH;
    basis.position.copy(dest);
    basis.up.set(0, 1, 0);
    basis.lookAt(center);
    basis.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(basis.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(basis.matrixWorld, 1);
    const pan = right.multiplyScalar(panX).add(up.multiplyScalar(panY));
    const nextPos = dest.clone().add(pan);
    const nextTarget = center.clone().add(pan);
    if (!animate) {
      camera.position.copy(nextPos);
      lookTarget.copy(nextTarget);
      camera.lookAt(lookTarget);
      camAnim = null;
      return;
    }
    camAnim = {
      fromPos: camera.position.clone(),
      fromTarget: lookTarget.clone(),
      nextPos,
      nextTarget,
      t: 0,
    };
  }

  function frame(cells, nextInsets) {
    insets = nextInsets || insets;
    if (!cells.length) {
      center.set(1.5, 0.2, 1.5);
      dist = 8;
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const c of cells) {
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        minZ = Math.min(minZ, c.z);
        maxZ = Math.max(maxZ, c.z);
      }
      center.set((minX + maxX) / 2, 0.15, (minZ + maxZ) / 2);
      const span = Math.max(maxX - minX + 1, maxZ - minZ + 1, 2);
      const radius = span * 0.78;
      const w = canvas.clientWidth || window.innerWidth || 1;
      const h = canvas.clientHeight || window.innerHeight || 1;
      const fov = (camera.fov * Math.PI) / 180;
      const distH = radius / Math.tan(fov / 2);
      const hFov = 2 * Math.atan(Math.tan(fov / 2) * (w / h));
      const distW = radius / Math.tan(hFov / 2);
      const freeW = Math.max(0.42, 1 - (insets.left + insets.right) / w);
      const freeH = Math.max(0.42, 1 - (insets.top + insets.bottom) / h);
      dist = (Math.max(distH, distW) * 1.18) / Math.min(freeW, freeH);
    }
    const s = Math.max(4, dist);
    const cam = sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = dist + 20;
    cam.updateProjectionMatrix();
    sun.position.set(center.x + 4.2, 9, center.z + 2.6);
    sun.target.position.copy(center);
    placeCamera(false);
  }

  function clearGroup(group) {
    while (group.children.length) group.remove(group.children[0]);
  }

  function makeTitleDie() {
    const anchor = new THREE.Group();
    const spin = new THREE.Group();
    const mats = faceOrder.map((name) => pipMat[name].clone());
    const mesh = new THREE.Mesh(dieGeo, mats);
    mesh.scale.setScalar(0.98);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.scale.setScalar(0.98);
    spin.add(mesh, edges);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.86),
      new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -DIE_Y + 0.014;
    shadow.raycast = () => {};
    anchor.add(spin, shadow);
    return { anchor, spin };
  }

  function titlePivot(x, z, dir) {
    const pivot = new THREE.Vector3(x, 0, z);
    if (dir === 'E') pivot.x += 0.5;
    else if (dir === 'W') pivot.x -= 0.5;
    else if (dir === 'S') pivot.z += 0.5;
    else pivot.z -= 0.5;
    return pivot;
  }

  function restTitle(actor) {
    actor.anchor.position.set(actor.x, DIE_Y, actor.z);
    actor.spin.quaternion.copy(quaternionForFaces(actor.faces));
  }

  function rollTitle(actor, u) {
    const turn = ROLL_TURN[actor.dir];
    const pivot = titlePivot(actor.x, actor.z, actor.dir);
    const q = new THREE.Quaternion().setFromAxisAngle(turn.axis, turn.angle * u);
    const offset = new THREE.Vector3(actor.x, DIE_Y, actor.z).sub(pivot).applyQuaternion(q);
    actor.anchor.position.copy(pivot).add(offset);
    actor.spin.quaternion.copy(q).multiply(quaternionForFaces(actor.faces));
  }

  function commitTitle(actor) {
    const delta = DIR_DELTA[actor.dir];
    actor.x += delta.x;
    actor.z += delta.z;
    actor.faces = rollFaces(actor.faces, actor.dir);
    actor.cursor = (actor.cursor + 1) % actor.path.length;
    actor.dir = actor.path[actor.cursor];
  }

  function updateTitle(dt) {
    for (const actor of titleActors) {
      if (reducedMotion) {
        restTitle(actor);
        continue;
      }
      actor.t += dt;
      if (actor.t < 0) {
        restTitle(actor);
        continue;
      }
      if (actor.phase === 'pause') {
        restTitle(actor);
        if (actor.t >= TITLE_PAUSE) {
          actor.t = 0;
          actor.phase = 'roll';
        }
      } else {
        const u = Math.min(1, actor.t / TITLE_ROLL);
        rollTitle(actor, smooth(u));
        if (actor.t >= TITLE_ROLL) {
          commitTitle(actor);
          actor.phase = 'pause';
          actor.t = 0;
          restTitle(actor);
        }
      }
    }
  }

  function buildTitle() {
    clearGroup(title);
    titleActors = [];
    for (let z = -1; z <= 4; z += 1) {
      for (let x = -1; x <= 6; x += 1) {
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(x, -0.11, z);
        tile.receiveShadow = true;
        tile.castShadow = true;
        title.add(tile);
      }
    }
    const routes = [
      {
        x: 0,
        z: 3,
        delay: 0,
        faces: identityFaces(),
        path: ['E', 'E', 'E', 'E', 'E', 'N', 'N', 'N', 'W', 'W', 'W', 'W', 'W', 'S', 'S', 'S'],
      },
      {
        x: 2,
        z: 2,
        delay: 0.55,
        faces: rollFaces(identityFaces(), 'E'),
        path: ['E', 'N', 'W', 'S'],
      },
    ];
    for (const route of routes) {
      const die = makeTitleDie();
      title.add(die.anchor);
      const actor = {
        ...die,
        x: route.x,
        z: route.z,
        faces: cloneFaces(route.faces),
        path: route.path,
        cursor: 0,
        dir: route.path[0],
        phase: 'pause',
        t: -route.delay,
      };
      restTitle(actor);
      titleActors.push(actor);
    }
    title.userData.ready = true;
  }

  function kindOf(object) {
    let node = object;
    while (node) {
      if (node.userData && node.userData.kind) return node.userData;
      node = node.parent;
    }
    return null;
  }

  function makeDie(index) {
    const anchor = new THREE.Group();
    anchor.userData = { kind: 'die', index };
    const spin = new THREE.Group();
    const mats = faceOrder.map((name) => pipMat[name].clone());
    const mesh = new THREE.Mesh(dieGeo, mats);
    mesh.scale.setScalar(0.98);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = mesh.raycast.bind(mesh);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.scale.setScalar(0.98);
    edges.raycast = () => {};
    spin.add(mesh, edges);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.86),
      new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -DIE_Y + 0.014;
    shadow.raycast = () => {};
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.55, 40),
      new THREE.MeshBasicMaterial({ color: 0xe2b15a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -DIE_Y + 0.03;
    ring.raycast = () => {};
    ring.visible = false;
    const spriteMat = new THREE.SpriteMaterial({ map: numberTex[1], transparent: true, depthTest: false });
    const label = new THREE.Sprite(spriteMat);
    label.position.set(0, 0.78, 0);
    label.scale.set(0.42, 0.42, 0.42);
    label.visible = false;
    label.raycast = () => {};
    anchor.add(spin, shadow, ring, label);
    return { anchor, spin, mats, ring, label };
  }

  function syncDice(dice, goals, selected) {
    const goalSet = new Set(goals.map((g) => `${g.x},${g.z}`));
    diceObjs.forEach((obj, index) => {
      const die = dice[index];
      obj.anchor.visible = true;
      obj.anchor.position.set(die.x, DIE_Y, die.z);
      obj.spin.quaternion.copy(quaternionForFaces(die.faces));
      obj.mats.forEach((m) => {
        m.opacity = 1;
        m.transparent = false;
      });
      const on = selected.has(index);
      obj.ring.visible = on;
      const warm = on ? 0.18 : 0;
      obj.mats.forEach((m) => m.emissive.setRGB(warm * 0.6, warm * 0.35, warm * 0.12));
      const ok = die.faces.top === 1 && goalSet.has(`${die.x},${die.z}`);
      obj.anchor.userData.ok = ok;
      obj.label.visible = showNumbers;
      obj.label.material.map = numberTex[die.faces.top];
      obj.label.material.opacity = ok ? 1 : 0.92;
    });
    board.traverse((node) => {
      if (node.userData.kind !== 'goal') return;
      const key = `${node.userData.x},${node.userData.z}`;
      const met = dice.some((d) => d.faces.top === 1 && `${d.x},${d.z}` === key);
      node.material.color.set(met ? 0xf0c14a : 0xc4472e);
      node.material.opacity = met ? 0.9 : 0.42;
    });
  }

  function setWorld({ ground, goals, dice, ghosts, selected, numbers }) {
    showNumbers = !!numbers;
    clearGroup(board);
    diceObjs = [];
    const goalSet = new Set(goals.map((g) => `${g.x},${g.z}`));
    for (const cell of ground) {
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.set(cell.x, -0.11, cell.z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      tile.userData = { kind: 'cell', x: cell.x, z: cell.z };
      board.add(tile);
      if (goalSet.has(`${cell.x},${cell.z}`)) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.32, 28),
          new THREE.MeshBasicMaterial({ color: 0xe24b32, transparent: true, opacity: 0.78, depthWrite: false }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(cell.x, 0.012, cell.z);
        disc.userData = { kind: 'goal', x: cell.x, z: cell.z };
        disc.raycast = () => {};
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.34, 0.44, 40),
          new THREE.MeshBasicMaterial({ color: 0xe7a15a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cell.x, 0.02, cell.z);
        ring.raycast = () => {};
        board.add(disc, ring);
      }
    }
    if (ghosts) {
      const solid = new Set(ground.map((c) => `${c.x},${c.z}`));
      for (const cell of ghosts) {
        if (solid.has(`${cell.x},${cell.z}`)) continue;
        const ghost = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), ghostMat);
        ghost.rotation.x = -Math.PI / 2;
        ghost.position.set(cell.x, 0.004, cell.z);
        ghost.userData = { kind: 'cell', x: cell.x, z: cell.z, ghost: true };
        board.add(ghost);
      }
    }
    dice.forEach((_, index) => {
      const obj = makeDie(index);
      board.add(obj.anchor);
      diceObjs.push(obj);
    });
    syncDice(dice, goals, selected);
    mode = 'board';
    title.visible = false;
    board.visible = true;
  }

  function frameTitle() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    const portrait = h > w * 1.05;
    title.position.set(0, 0, 0);
    const focus = portrait
      ? new THREE.Vector3(2.5, 0, 0.15)
      : new THREE.Vector3(0.85, 0.1, 1.45);
    const dist = portrait ? 14.2 : 12.4;
    const offset = new THREE.Vector3(0.62, 0.95, 1).normalize().multiplyScalar(dist);
    camera.position.copy(focus).add(offset);
    lookTarget.copy(focus);
    camera.lookAt(lookTarget);
    const boardCenter = new THREE.Vector3(2.5, 0, 1.5);
    const s = 12;
    const cam = sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = 48;
    cam.updateProjectionMatrix();
    sun.position.set(boardCenter.x + 5.2, 12, boardCenter.z + 3.4);
    sun.target.position.copy(boardCenter);
  }

  function showTitle() {
    mode = 'title';
    camAnim = null;
    board.visible = false;
    title.visible = true;
    if (!title.userData.ready) buildTitle();
    frameTitle();
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(board.children, true);
    for (const hit of hits) {
      const data = kindOf(hit.object);
      if (!data) continue;
      if (data.kind === 'die') return { kind: 'die', index: data.index };
      if (data.kind === 'cell') return { kind: 'cell', x: data.x, z: data.z };
    }
    return null;
  }

  function screenToWorld(screenDir) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return 'N';
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let vector = forward;
    if (screenDir === 'down') vector = forward.clone().negate();
    else if (screenDir === 'right') vector = right;
    else if (screenDir === 'left') vector = right.clone().negate();
    if (Math.abs(vector.x) === Math.abs(vector.z)) return null;
    if (Math.abs(vector.x) > Math.abs(vector.z)) return vector.x > 0 ? 'E' : 'W';
    return vector.z > 0 ? 'S' : 'N';
  }

  async function animateRoll({ before, after, dir, falling, reduced }) {
    const fallSet = new Set(falling || []);
    const jobs = [];
    for (let i = 0; i < after.length; i += 1) {
      if (before[i].x === after[i].x && before[i].z === after[i].z) continue;
      jobs.push(rollOne(i, before[i], after[i], dir, fallSet.has(i), reduced));
    }
    await Promise.all(jobs);
  }

  function rollOne(index, from, to, dir, fall, reduced) {
    const obj = diceObjs[index];
    const startQ = quaternionForFaces(from.faces);
    const endQ = quaternionForFaces(to.faces);
    obj.spin.quaternion.copy(startQ);
    obj.anchor.position.set(from.x, DIE_Y, from.z);
    if (reduced) {
      obj.spin.quaternion.copy(endQ);
      obj.anchor.position.set(to.x, fall ? -6 : DIE_Y, to.z);
      obj.anchor.visible = !fall;
      return Promise.resolve();
    }
    const turn = ROLL_TURN[dir];
    const pivot = new THREE.Vector3(from.x, 0, from.z);
    if (dir === 'E') pivot.x += 0.5;
    else if (dir === 'W') pivot.x -= 0.5;
    else if (dir === 'S') pivot.z += 0.5;
    else pivot.z -= 0.5;
    return tween(320, (t) => {
      const q = new THREE.Quaternion().setFromAxisAngle(turn.axis, turn.angle * smooth(t));
      const offset = new THREE.Vector3(from.x, DIE_Y, from.z).sub(pivot).applyQuaternion(q);
      obj.anchor.position.copy(pivot).add(offset);
      obj.spin.quaternion.copy(q).multiply(startQ);
    }).then(async () => {
      obj.spin.quaternion.copy(endQ);
      obj.anchor.position.set(to.x, DIE_Y, to.z);
      if (!fall) return;
      await tween(460, (t) => {
        const drop = t * t;
        obj.anchor.position.y = DIE_Y - drop * 7.2;
        obj.anchor.position.x = to.x;
        obj.anchor.position.z = to.z;
        obj.mats.forEach((m) => {
          m.transparent = true;
          m.opacity = 1 - t;
        });
      });
      obj.anchor.visible = false;
    });
  }

  async function shake(indices, reduced) {
    if (reduced) return;
    await Promise.all(indices.map((index) => {
      const anchor = diceObjs[index].anchor;
      const { x, z } = anchor.position;
      return tween(200, (t) => {
        anchor.position.x = x + Math.sin(t * Math.PI * 5) * (1 - t) * 0.07;
        anchor.position.z = z;
      }).then(() => {
        anchor.position.x = x;
        anchor.position.z = z;
      });
    }));
  }

  function loop() {
    const dt = clock.getDelta();
    titleTime += dt;
    if (mode === 'title') updateTitle(dt);
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / 0.45);
      const k = smooth(camAnim.t);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.nextPos, k);
      const look = camAnim.fromTarget.clone().lerp(camAnim.nextTarget, k);
      camera.lookAt(look);
      if (camAnim.t >= 1) {
        lookTarget.copy(camAnim.nextTarget);
        camAnim = null;
      }
    }
    const pulse = 0.55 + Math.sin(titleTime * 5) * 0.4;
    for (const obj of diceObjs) {
      if (obj.ring.visible) obj.ring.material.opacity = pulse;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  buildTitle();
  resize();
  showTitle();
  requestAnimationFrame(loop);

  return {
    resize,
    showTitle,
    setWorld,
    syncDice,
    frame,
    pick,
    screenToWorld,
    animateRoll,
    shake,
    setNumbers(v) {
      showNumbers = v;
    },
    setReduced(v) {
      reducedMotion = !!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    setFlip(v) {
      flip = v;
      if (mode === 'board') placeCamera(false);
    },
    cycleCamera() {
      camIndex = (camIndex + 1) % 4;
      if (mode === 'board') placeCamera(true);
    },
    cameraBusy() {
      return !!camAnim;
    },
  };
}
