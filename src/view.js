import * as THREE from 'three';
import { DIR_DELTA, cloneFaces, identityFaces, rollFaces } from './logic.js';
import { ROLL_TURN, quaternionForFaces } from './orient.js';

const DIE_SCALE = 0.78;
const DIE_Y = DIE_SCALE / 2;
const TITLE_ROLL = 0.72;
const TITLE_PAUSE = 0.16;
const AZIMUTHS = [0.58, 0.58 + Math.PI / 2, 0.58 + Math.PI, 0.58 + (3 * Math.PI) / 2];
const ELEV_DEFAULT = Math.atan(1.18);
const ELEV_MIN = 0.34;
const ELEV_MAX = 1.25;

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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 240);
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

  const dieGeo = new THREE.BoxGeometry(DIE_SCALE, DIE_SCALE, DIE_SCALE);
  const edgeGeo = new THREE.EdgesGeometry(dieGeo);
  const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(DIE_SCALE * 1.08, DIE_SCALE * 1.08, DIE_SCALE * 1.08));
  const tileGeo = new THREE.BoxGeometry(0.94, 0.22, 0.94);
  const shadowGeo = new THREE.PlaneGeometry(DIE_SCALE * 0.92, DIE_SCALE * 0.92);
  const selectMat = new THREE.MeshBasicMaterial({
    color: 0xf2c14b,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cageMat = new THREE.LineBasicMaterial({ color: 0xffe7a3, transparent: true, opacity: 1 });
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
  let azimuth = AZIMUTHS[0];
  let elev = ELEV_DEFAULT;
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

  function currentLook() {
    if (!camAnim) return lookTarget;
    const k = smooth(Math.min(1, camAnim.t));
    return camAnim.fromTarget.clone().lerp(camAnim.nextTarget, k);
  }

  function nudgeOrbit(dAz, dElev) {
    if (mode !== 'board') return;
    const look = currentLook();
    const rel = camera.position.clone().sub(look);
    if (rel.lengthSq() > 1e-8) {
      azimuth = Math.atan2(rel.x, rel.z);
      elev = Math.atan2(rel.y, Math.hypot(rel.x, rel.z));
    }
    camAnim = null;
    azimuth += dAz;
    elev = Math.min(ELEV_MAX, Math.max(ELEV_MIN, elev + dElev));
    placeCamera(false);
  }

  function viewFit() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    let top = Math.max(0, insets.top);
    let bottom = Math.max(0, insets.bottom);
    let left = Math.max(0, insets.left);
    let right = Math.max(0, insets.right);
    const sumH = top + bottom;
    if (sumH > h * 0.82 && sumH > 0) {
      const scale = (h * 0.82) / sumH;
      top *= scale;
      bottom *= scale;
    }
    const sumW = left + right;
    if (sumW > w * 0.82 && sumW > 0) {
      const scale = (w * 0.82) / sumW;
      left *= scale;
      right *= scale;
    }
    return { top, bottom, left, right, w, h };
  }

  function placeCamera(animate) {
    const offset = new THREE.Vector3(
      Math.cos(elev) * Math.sin(azimuth),
      Math.sin(elev),
      Math.cos(elev) * Math.cos(azimuth),
    );
    const dest = center.clone().addScaledVector(offset, dist);
    const fit = viewFit();
    const vFov = (camera.fov * Math.PI) / 180;
    const worldH = 2 * Math.tan(vFov / 2) * dist;
    const worldW = worldH * (fit.w / fit.h);
    const panX = ((fit.left - fit.right) / 2 / fit.w) * worldW;
    const panY = ((fit.top - fit.bottom) / 2 / fit.h) * worldH;
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
      const fit = viewFit();
      const fov = (camera.fov * Math.PI) / 180;
      const distH = radius / Math.tan(fov / 2);
      const hFov = 2 * Math.atan(Math.tan(fov / 2) * (fit.w / fit.h));
      const distW = radius / Math.tan(hFov / 2);
      const freeW = Math.max(0.18, 1 - (fit.left + fit.right) / fit.w);
      const freeH = Math.max(0.18, 1 - (fit.top + fit.bottom) / fit.h);
      dist = (Math.max(distH, distW) * 1.12) / Math.min(freeW, freeH);
    }
    camera.far = Math.max(80, dist + 48);
    camera.updateProjectionMatrix();
    const s = Math.max(4, dist);
    const cam = sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = dist + 48;
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    spin.add(mesh, edges);
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -DIE_Y + 0.014;
    shadow.raycast = () => {};
    anchor.add(spin, shadow);
    return { anchor, spin };
  }

  function rollPose(x, z, dir, t, pos) {
    const h = DIE_Y;
    const turn = ROLL_TURN[dir];
    const step = DIR_DELTA[dir];
    const signX = dir === 'E' ? 1 : dir === 'W' ? -1 : 0;
    const signZ = dir === 'S' ? 1 : dir === 'N' ? -1 : 0;
    const startPivot = new THREE.Vector3(x + signX * h, 0, z + signZ * h);
    const endPivot = new THREE.Vector3(x + step.x - signX * h, 0, z + step.z - signZ * h);
    const offset = new THREE.Vector3(x, DIE_Y, z).sub(startPivot);
    const k = smooth(Math.min(1, Math.max(0, t)));
    const pivot = startPivot.lerp(endPivot, k);
    const spin = new THREE.Quaternion().setFromAxisAngle(turn.axis, turn.angle * k);
    pos.copy(pivot).add(offset.applyQuaternion(spin));
    return spin;
  }

  function restTitle(actor) {
    actor.anchor.position.set(actor.x, DIE_Y, actor.z);
    actor.spin.quaternion.copy(quaternionForFaces(actor.faces));
  }

  function rollTitle(actor, u) {
    const pos = new THREE.Vector3();
    const spin = rollPose(actor.x, actor.z, actor.dir, u, pos);
    actor.anchor.position.copy(pos);
    actor.spin.quaternion.copy(spin).multiply(quaternionForFaces(actor.faces));
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
        rollTitle(actor, u);
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = mesh.raycast.bind(mesh);
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.raycast = () => {};
    const cage = new THREE.LineSegments(cageGeo, cageMat);
    cage.raycast = () => {};
    cage.visible = false;
    spin.add(mesh, edges, cage);
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -DIE_Y + 0.014;
    shadow.raycast = () => {};
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), selectMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -DIE_Y + 0.02;
    plate.raycast = () => {};
    plate.visible = false;
    const spriteMat = new THREE.SpriteMaterial({ map: numberTex[1], transparent: true, depthTest: false });
    const label = new THREE.Sprite(spriteMat);
    label.position.set(0, DIE_Y + 0.32, 0);
    label.scale.set(0.42, 0.42, 0.42);
    label.visible = false;
    label.raycast = () => {};
    anchor.add(spin, shadow, plate, label);
    return { anchor, spin, mats, plate, cage, label };
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
      obj.plate.visible = on;
      obj.cage.visible = on;
      obj.mats.forEach((m) => {
        m.color.set(on ? 0xffffff : 0x9c948b);
        m.emissive.setRGB(on ? 0.28 : 0, on ? 0.16 : 0, on ? 0.03 : 0);
      });
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

  function arrowMark(dir, color) {
    const mark = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.1), mat);
    shaft.position.x = -0.05;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), mat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.22;
    mark.add(shaft, head);
    const yaw = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }[dir] ?? 0;
    mark.rotation.y = yaw;
    mark.position.y = 0.14;
    mark.raycast = () => {};
    shaft.raycast = () => {};
    head.raycast = () => {};
    return mark;
  }

  function shuttleMark(dir) {
    const mark = new THREE.Group();
    const backDir = { E: 'W', W: 'E', S: 'N', N: 'S' }[dir];
    const fore = arrowMark(dir, 0x083833);
    const back = arrowMark(backDir, 0x146e66);
    const axis = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] }[dir] || [1, 0];
    fore.position.x += axis[0] * 0.08;
    fore.position.z += axis[1] * 0.08;
    back.position.x -= axis[0] * 0.2;
    back.position.z -= axis[1] * 0.2;
    back.scale.set(0.55, 0.55, 0.55);
    mark.add(fore, back);
    mark.userData.shuttle = true;
    mark.raycast = () => {};
    return mark;
  }

  function flipMark() {
    const mark = new THREE.Group();
    const fore = arrowMark('E', 0x3b1460);
    const back = arrowMark('W', 0x3b1460);
    fore.position.z = -0.16;
    back.position.z = 0.16;
    mark.add(fore, back);
    mark.position.y = 0;
    mark.raycast = () => {};
    return mark;
  }

  function crackMark() {
    const mark = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a2216 });
    const specs = [
      { w: 0.72, rot: 0.45, x: 0, z: 0 },
      { w: 0.42, rot: -0.9, x: 0.1, z: 0.02 },
      { w: 0.34, rot: 1.35, x: -0.06, z: -0.14 },
    ];
    for (const spec of specs) {
      const piece = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.045, 0.04), mat);
      piece.rotation.y = spec.rot;
      piece.position.set(spec.x, 0.14, spec.z);
      piece.raycast = () => {};
      mark.add(piece);
    }
    mark.raycast = () => {};
    return mark;
  }

  async function animateCarry(moves, before, after, reduced) {
    if (!moves?.length || reduced) return;
    const tiles = new Map();
    board.traverse((node) => {
      if (node.userData?.kind === 'cell') tiles.set(`${node.userData.x},${node.userData.z}`, node);
    });
    for (const move of moves) {
      if (!move.turned) continue;
      const tile = board.children.find((node) => node.userData?.kind === 'cell' && node.userData.x === move.x && node.userData.z === move.z);
      tile?.traverse((node) => {
        if (node.userData?.shuttle) node.rotation.y += Math.PI;
      });
    }
    await tween(280, (t) => {
      const k = t * t * (3 - 2 * t);
      for (const move of moves) {
        const tile = tiles.get(`${move.x},${move.z}`);
        if (!tile) continue;
        tile.position.x = move.x + (move.nx - move.x) * k;
        tile.position.z = move.z + (move.nz - move.z) * k;
      }
      before.forEach((die, index) => {
        const next = after[index];
        if (!next || (die.x === next.x && die.z === next.z)) return;
        const obj = diceObjs[index];
        if (!obj) return;
        obj.anchor.position.set(die.x + (next.x - die.x) * k, DIE_Y, die.z + (next.z - die.z) * k);
      });
    });
  }

  async function animateCrumble(keys, reduced) {
    if (!keys?.length) return;
    const gone = new Set(keys);
    const tiles = [];
    board.traverse((node) => {
      if (node.userData?.kind === 'cell' && gone.has(`${node.userData.x},${node.userData.z}`)) tiles.push(node);
    });
    if (!tiles.length || reduced) return;
    await tween(240, (t) => {
      for (const tile of tiles) {
        tile.position.y = -0.11 - t * 0.9;
        tile.material.transparent = true;
        tile.material.opacity = 1 - t;
      }
    });
  }

  function setWorld({ ground, goals, dice, ghosts, selected, numbers }) {
    showNumbers = !!numbers;
    clearGroup(board);
    diceObjs = [];
    const goalSet = new Set(goals.map((g) => `${g.x},${g.z}`));
    for (const cell of ground) {
      const tint = cell.kind === 'slide' ? 0x3ecfc2 : cell.kind === 'flip' ? 0xc9a0ef : cell.kind === 'crumb' ? 0xe39a4a : 0xffffff;
      const mat = cell.kind
        ? new THREE.MeshStandardMaterial({
          color: tint,
          roughness: 0.62,
          metalness: 0.04,
          emissive: cell.kind === 'slide' ? 0x0c4f4a : cell.kind === 'flip' ? 0x3a1860 : 0x6a3a12,
          emissiveIntensity: 0.55,
        })
        : tileMat;
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(cell.x, -0.11, cell.z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      tile.userData = { kind: 'cell', x: cell.x, z: cell.z };
      if (cell.kind === 'slide') tile.add(shuttleMark(cell.dir));
      if (cell.kind === 'flip') tile.add(flipMark());
      if (cell.kind === 'crumb') tile.add(crackMark());
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

  function inkRight(root) {
    if (!root) return 0;
    const range = document.createRange();
    let right = 0;
    for (const node of root.querySelectorAll('.eyebrow, .logo, .lede')) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
    }
    for (const button of root.querySelectorAll('button')) {
      right = Math.max(right, button.getBoundingClientRect().right);
    }
    return right;
  }

  function frameTitle() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    title.position.set(0, 0, 0);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    const boardCenter = new THREE.Vector3(2.5, 0.2, 1.5);
    const dir = new THREE.Vector3(0.62, 0.95, 1).normalize();
    const corners = [];
    for (const x of [-1.7, 6.7]) {
      for (const z of [-1.7, 4.7]) {
        corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 1.25, z));
      }
    }
    const copy = document.querySelector('.title-copy');
    const landscape = w > h;
    const desktop = landscape && w >= 900;
    // 横画面は文字ブロックの右、縦画面はボタンの下に盤面を収める。
    let topLimit = 0.78;
    let bottomLimit = -0.9;
    let leftLimit = -0.9;
    let rightLimit = 0.92;
    let dist = desktop ? 13 : 16;
    let fill = false;
    if (desktop) {
      leftLimit = -0.02;
    } else if (landscape) {
      const ink = inkRight(copy);
      const px = Math.min(Math.max(ink, w * 0.32) + 18, w * 0.7);
      leftLimit = (2 * px) / w - 1;
      rightLimit = 0.9;
      if (rightLimit - leftLimit < 0.52) leftLimit = rightLimit - 0.52;
      topLimit = 0.86;
      bottomLimit = -0.86;
      dist = 12;
      fill = true;
    } else {
      const copyBottom = copy ? copy.getBoundingClientRect().bottom : h * 0.38;
      topLimit = 1 - (2 * Math.min(copyBottom + 8, h * 0.62)) / h;
    }
    let shiftX = 0;
    let shiftY = 0;

    function place(nextDist, nextShiftX, nextShiftY) {
      const focus = boardCenter.clone();
      camera.position.copy(focus).addScaledVector(dir, nextDist);
      camera.up.set(0, 1, 0);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const pan = right.multiplyScalar(nextShiftX).add(up.multiplyScalar(nextShiftY));
      camera.position.add(pan);
      const look = focus.add(pan);
      lookTarget.copy(look);
      camera.lookAt(lookTarget);
      camera.updateMatrixWorld();
    }

    function bounds() {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const corner of corners) {
        const p = corner.clone().project(camera);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, maxX, minY, maxY };
    }

    for (let i = 0; i < 6; i += 1) {
      place(dist, shiftX, shiftY);
      const box = bounds();
      const allowX = Math.max(0.45, rightLimit - leftLimit);
      const allowY = Math.max(0.4, topLimit - bottomLimit);
      const spanX = box.maxX - box.minX;
      const spanY = box.maxY - box.minY;
      const need = Math.max(spanX / allowX, spanY / allowY);
      if (fill) dist *= Math.pow(need / 0.94, 0.8);
      else if (need > 1.01) dist *= need;
      const vFov = (camera.fov * Math.PI) / 180;
      const worldH = 2 * Math.tan(vFov / 2) * dist;
      const worldW = worldH * camera.aspect;
      const midX = (box.minX + box.maxX) / 2;
      const midY = (box.minY + box.maxY) / 2;
      const goalX = (leftLimit + rightLimit) / 2;
      const goalY = landscape ? (bottomLimit + topLimit) / 2 : topLimit - spanY / 2 - 0.04;
      shiftX += (midX - goalX) * worldW / 2;
      shiftY += (midY - goalY) * worldH / 2;
    }
    place(dist, shiftX, shiftY);
    const s = 12;
    const cam = sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 0.5;
    cam.far = dist + 30;
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
    if (Math.abs(vector.x) >= Math.abs(vector.z)) return vector.x >= 0 ? 'E' : 'W';
    return vector.z > 0 ? 'S' : 'N';
  }

  async function animateRoll({ before, after, dir, dirs, falling, reduced }) {
    const fallSet = new Set(falling || []);
    const jobs = [];
    for (let i = 0; i < after.length; i += 1) {
      if (before[i].x === after[i].x && before[i].z === after[i].z) continue;
      jobs.push(rollOne(i, before[i], after[i], dirs?.[i] || dir, fallSet.has(i), reduced));
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
    const pos = new THREE.Vector3();
    return tween(340, (t) => {
      const spin = rollPose(from.x, from.z, dir, t, pos);
      obj.anchor.position.copy(pos);
      obj.spin.quaternion.copy(spin).multiply(startQ);
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
    const pulse = reducedMotion ? 0.85 : 0.62 + Math.sin(titleTime * 5) * 0.38;
    selectMat.opacity = 0.42 + pulse * 0.45;
    cageMat.opacity = 0.7 + pulse * 0.3;
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
    animateCarry,
    animateCrumble,
    shake,
    setNumbers(v) {
      showNumbers = v;
    },
    setReduced(v) {
      reducedMotion = !!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    setFlip(v) {
      const next = !!v;
      if (next === flip) return;
      flip = next;
      azimuth += next ? Math.PI : -Math.PI;
      if (mode === 'board') placeCamera(false);
    },
    cycleCamera() {
      azimuth += Math.PI / 2;
      if (mode === 'board') placeCamera(true);
    },
    dragOrbit(dx, dy) {
      const h = canvas.clientHeight || 800;
      nudgeOrbit((-dx / h) * Math.PI * 1.35, (-dy / h) * Math.PI * 0.85);
    },
    wheelOrbit(deltaY) {
      const capped = Math.max(-160, Math.min(160, deltaY));
      nudgeOrbit(-capped * 0.0032, 0);
    },
    cameraBusy() {
      return !!camAnim;
    },
  };
}
