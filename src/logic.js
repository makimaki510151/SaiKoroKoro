/** Grid dice rules. Coordinates are integer cells. +X east, +Z south, -Z north. */

export const DIR_ORDER = ['E', 'W', 'S', 'N'];

export const DIR_DELTA = {
  E: { x: 1, z: 0 },
  W: { x: -1, z: 0 },
  S: { x: 0, z: 1 },
  N: { x: 0, z: -1 },
};

export function identityFaces() {
  return { top: 1, bottom: 6, east: 3, west: 4, south: 2, north: 5 };
}

export function cloneFaces(faces) {
  return {
    top: faces.top,
    bottom: faces.bottom,
    east: faces.east,
    west: faces.west,
    south: faces.south,
    north: faces.north,
  };
}

export function facesKey(faces) {
  return `${faces.top}${faces.bottom}${faces.east}${faces.west}${faces.south}${faces.north}`;
}

export function cellKey(x, z) {
  return `${x},${z}`;
}

/** Tip the die one quarter-turn. Two tips in the same direction swap top and bottom. */
export function rollFaces(faces, dir) {
  const f = faces;
  switch (dir) {
    case 'E':
      return { top: f.west, bottom: f.east, east: f.top, west: f.bottom, south: f.south, north: f.north };
    case 'W':
      return { top: f.east, bottom: f.west, west: f.top, east: f.bottom, south: f.south, north: f.north };
    case 'S':
      return { top: f.north, bottom: f.south, south: f.top, north: f.bottom, east: f.east, west: f.west };
    case 'N':
      return { top: f.south, bottom: f.north, north: f.top, south: f.bottom, east: f.east, west: f.west };
    default:
      throw new Error(`unknown dir ${dir}`);
  }
}

function buildOrientations() {
  const list = [];
  const index = new Map();
  const queue = [identityFaces()];
  while (queue.length) {
    const faces = queue.pop();
    const key = facesKey(faces);
    if (index.has(key)) continue;
    index.set(key, list.length);
    list.push(faces);
    for (const dir of DIR_ORDER) queue.push(rollFaces(faces, dir));
  }
  const rollTable = list.map((faces) => DIR_ORDER.map((dir) => index.get(facesKey(rollFaces(faces, dir)))));
  return { list, index, rollTable };
}

const ORIENT = buildOrientations();

export function orientations() {
  return ORIENT.list;
}

export function orientIndex(faces) {
  const id = ORIENT.index.get(facesKey(faces));
  return id === undefined ? -1 : id;
}

export function facesFromIndex(index) {
  return cloneFaces(ORIENT.list[index]);
}

export function cloneDie(die) {
  return { x: die.x, z: die.z, faces: cloneFaces(die.faces) };
}

export function cloneDice(dice) {
  return dice.map(cloneDie);
}

export function groundSet(cells) {
  return new Set(cells.map((c) => cellKey(c.x, c.z)));
}

export function isClear(dice, goals) {
  if (!dice.length || goals.length < dice.length) return false;
  const goal = groundSet(goals);
  const used = new Set();
  for (const die of dice) {
    if (die.faces.top !== 1) return false;
    const key = cellKey(die.x, die.z);
    if (!goal.has(key) || used.has(key)) return false;
    used.add(key);
  }
  return true;
}

/**
 * Roll the selected dice one step in the same direction.
 * A roll onto a cell without ground falls. Overlap with a die that stays is blocked.
 */
export function step(dice, ground, selected, dir) {
  const sel = selected instanceof Set ? selected : new Set(selected);
  if (sel.size === 0) return { ok: false, reason: 'empty' };
  const delta = DIR_DELTA[dir];
  if (!delta) throw new Error(`unknown dir ${dir}`);
  const next = cloneDice(dice);
  const falling = [];
  for (const i of sel) {
    const die = next[i];
    die.x += delta.x;
    die.z += delta.z;
    die.faces = rollFaces(die.faces, dir);
    if (!ground.has(cellKey(die.x, die.z))) falling.push(i);
  }
  if (falling.length) return { ok: false, reason: 'fall', falling, dice: next };
  const seen = new Set();
  for (const die of next) {
    const key = cellKey(die.x, die.z);
    if (seen.has(key)) return { ok: false, reason: 'blocked' };
    seen.add(key);
  }
  return { ok: true, dice: next };
}

function cmpCell(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}

export function canonical(level) {
  const norm = {
    moves: level.moves,
    ground: level.ground.map((c) => [c.x, c.z]).sort(cmpCell),
    goals: level.goals.map((c) => [c.x, c.z]).sort(cmpCell),
    dice: level.dice
      .map((d) => ({
        x: d.x,
        z: d.z,
        top: d.faces.top,
        bottom: d.faces.bottom,
        east: d.faces.east,
        west: d.faces.west,
        south: d.faces.south,
        north: d.faces.north,
      }))
      .sort((a, b) => a.x - b.x || a.z - b.z || a.top - b.top),
  };
  return JSON.stringify(norm);
}

export function issues(level) {
  const out = [];
  if (!level.ground.length) out.push('地面を置いてください');
  if (!level.dice.length) out.push('ダイスを1つ以上置いてください');
  if (level.dice.length > 4) out.push('ダイスは4つまでです');
  if (level.ground.length > 40) out.push('地面が多すぎます');
  if (!Number.isInteger(level.moves) || level.moves < 1 || level.moves > 30) {
    out.push('手数は1から30にしてください');
  }
  if (level.goals.length < level.dice.length) out.push('ゴールがダイスより少ないです');
  const ground = groundSet(level.ground);
  const seen = new Set();
  for (const die of level.dice) {
    const key = cellKey(die.x, die.z);
    if (!ground.has(key)) out.push('地面のないマスにダイスがあります');
    if (seen.has(key)) out.push('ダイスが重なっています');
    seen.add(key);
    if (orientIndex(die.faces) < 0) out.push('あり得ない面の組み合わせです');
  }
  for (const goal of level.goals) {
    if (!ground.has(cellKey(goal.x, goal.z))) out.push('地面のないマスがゴールです');
  }
  const name = level.name ?? '';
  if (!String(name).trim()) out.push('名前を入れてください');
  if (String(name).length > 24) out.push('名前は24文字までです');
  return out;
}

function asCell(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const x = pair[0];
  const z = pair[1];
  if (!Number.isInteger(x) || !Number.isInteger(z)) return null;
  if (x < -8 || x > 16 || z < -8 || z > 16) return null;
  return { x, z };
}

function asFaces(raw) {
  const faces = {
    top: raw.top,
    bottom: raw.bottom,
    east: raw.east,
    west: raw.west,
    south: raw.south,
    north: raw.north,
  };
  for (const key of Object.keys(faces)) {
    if (!Number.isInteger(faces[key]) || faces[key] < 1 || faces[key] > 6) return null;
  }
  if (faces.top + faces.bottom !== 7) return null;
  if (faces.east + faces.west !== 7) return null;
  if (faces.south + faces.north !== 7) return null;
  if (orientIndex(faces) < 0) return null;
  return faces;
}

export function parseLevel(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: '形式が正しくありません' };
  const ground = [];
  const goals = [];
  const dice = [];
  const seenG = new Set();
  for (const pair of data.ground || []) {
    const cell = asCell(pair);
    if (!cell) return { ok: false, error: '地面の座標が不正です' };
    const key = cellKey(cell.x, cell.z);
    if (seenG.has(key)) continue;
    seenG.add(key);
    ground.push(cell);
  }
  for (const pair of data.goals || []) {
    const cell = asCell(pair);
    if (!cell) return { ok: false, error: 'ゴールの座標が不正です' };
    goals.push(cell);
  }
  for (const raw of data.dice || []) {
    if (!raw || !Number.isInteger(raw.x) || !Number.isInteger(raw.z)) {
      return { ok: false, error: 'ダイスの座標が不正です' };
    }
    const faces = asFaces(raw);
    if (!faces) return { ok: false, error: 'ダイスの面が不正です' };
    dice.push({ x: raw.x, z: raw.z, faces });
  }
  const moves = data.moves;
  const name = String(data.name ?? '').slice(0, 24);
  const level = {
    v: 1,
    name,
    blurb: typeof data.blurb === 'string' ? data.blurb : '',
    moves,
    ground,
    goals,
    dice,
  };
  const problems = issues({ ...level, name: name.trim() || 'ステージ' });
  const hard = problems.filter((p) => !p.startsWith('名前') && !p.startsWith('手数') && !p.startsWith('ゴールが'));
  if (hard.length) return { ok: false, error: hard[0] };
  if (!Number.isInteger(moves) || moves < 1 || moves > 30) {
    return { ok: false, error: '手数は1から30にしてください' };
  }
  if (goals.length < dice.length) return { ok: false, error: 'ゴールがダイスより少ないです' };
  if (!name.trim()) return { ok: false, error: '名前を入れてください' };
  level.name = name.trim();
  return { ok: true, level };
}

export function serializeLevel(level) {
  return JSON.stringify(
    {
      v: 1,
      name: level.name,
      moves: level.moves,
      ground: level.ground.map((c) => [c.x, c.z]).sort(cmpCell),
      goals: level.goals.map((c) => [c.x, c.z]).sort(cmpCell),
      dice: level.dice.map((d) => ({
        x: d.x,
        z: d.z,
        top: d.faces.top,
        bottom: d.faces.bottom,
        east: d.faces.east,
        west: d.faces.west,
        south: d.faces.south,
        north: d.faces.north,
      })),
    },
    null,
    2,
  );
}

/**
 * Shortest solution within maxMoves. Each action rolls one non-empty subset
 * in one shared direction and counts as a single move.
 * Returns the move list, an empty list if already clear, or null.
 */
export function solve(level, maxMoves = level.moves, maxNodes = 250000) {
  const ground = level.ground;
  const cellIndex = new Map(ground.map((c, i) => [cellKey(c.x, c.z), i]));
  const dice0 = level.dice.map((d) => ({
    p: cellIndex.get(cellKey(d.x, d.z)),
    o: orientIndex(d.faces),
  }));
  if (dice0.some((d) => d.p === undefined || d.o < 0)) return null;

  const goalCells = new Set(level.goals.map((g) => cellIndex.get(cellKey(g.x, g.z))).filter((n) => n !== undefined));
  const n = dice0.length;
  const dirs = DIR_ORDER.length;

  const keyOf = (dice) => dice.map((d) => d.p * 24 + d.o).join('.');
  const cleared = (dice) => {
    if (goalCells.size < n) return false;
    const used = new Set();
    for (const d of dice) {
      if (ORIENT.list[d.o].top !== 1) return false;
      if (!goalCells.has(d.p) || used.has(d.p)) return false;
      used.add(d.p);
    }
    return true;
  };

  const startKey = keyOf(dice0);
  if (cleared(dice0)) return [];

  const queue = [{ dice: dice0, path: [] }];
  const seen = new Set([startKey]);
  let qi = 0;
  let nodes = 0;

  while (qi < queue.length) {
    const cur = queue[qi++];
    if (cur.path.length >= maxMoves) continue;
    nodes += 1;
    if (nodes > maxNodes) return null;
    const subsets = (1 << n) - 1;
    for (let mask = 1; mask <= subsets; mask += 1) {
      for (let di = 0; di < dirs; di += 1) {
        const dir = DIR_ORDER[di];
        const delta = DIR_DELTA[dir];
        const next = cur.dice.map((d) => ({ p: d.p, o: d.o }));
        let fell = false;
        for (let i = 0; i < n; i += 1) {
          if ((mask & (1 << i)) === 0) continue;
          const cell = ground[next[i].p];
          const nx = cell.x + delta.x;
          const nz = cell.z + delta.z;
          const np = cellIndex.get(cellKey(nx, nz));
          if (np === undefined) {
            fell = true;
            break;
          }
          next[i] = { p: np, o: ORIENT.rollTable[next[i].o][di] };
        }
        if (fell) continue;
        const dest = new Set();
        let blocked = false;
        for (const d of next) {
          if (dest.has(d.p)) {
            blocked = true;
            break;
          }
          dest.add(d.p);
        }
        if (blocked) continue;
        const key = keyOf(next);
        if (seen.has(key)) continue;
        seen.add(key);
        const selected = [];
        for (let i = 0; i < n; i += 1) if (mask & (1 << i)) selected.push(i);
        const path = cur.path.concat([{ dir, selected }]);
        if (cleared(next)) return path;
        queue.push({ dice: next, path });
      }
    }
  }
  return null;
}

export function replay(level, moves) {
  let dice = cloneDice(level.dice);
  const ground = groundSet(level.ground);
  const trace = [];
  for (const move of moves) {
    const result = step(dice, ground, move.selected, move.dir);
    trace.push(result);
    if (!result.ok) return { ok: false, trace, dice };
    dice = result.dice;
  }
  return { ok: true, trace, dice, clear: isClear(dice, level.goals) };
}
