import {
  DIR_DELTA,
  DIR_ORDER,
  cloneFaces,
  facesKey,
  identityFaces,
  isClear,
  orientations,
  replay,
  rollFaces,
  solve,
} from '../src/logic.js';

const INV = { E: 'W', W: 'E', S: 'N', N: 'S' };

function undoMove(die, dir) {
  return {
    x: die.x - DIR_DELTA[dir].x,
    z: die.z - DIR_DELTA[dir].z,
    faces: rollFaces(die.faces, INV[dir]),
  };
}

function walkBack(end, path) {
  let die = { x: end.x, z: end.z, faces: cloneFaces(end.faces) };
  for (let i = path.length - 1; i >= 0; i -= 1) die = undoMove(die, path[i]);
  return die;
}

function topOnes() {
  return orientations().filter((f) => f.top === 1);
}

function fmtFaces(f) {
  return `{ top: ${f.top}, bottom: ${f.bottom}, east: ${f.east}, west: ${f.west}, south: ${f.south}, north: ${f.north} }`;
}

function ascii(level, marks = []) {
  const cells = [...level.ground];
  const xs = cells.map((c) => c.x);
  const zs = cells.map((c) => c.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const ground = new Set(level.ground.map((c) => `${c.x},${c.z}`));
  const lines = [];
  for (let z = minZ; z <= maxZ; z += 1) {
    let row = '';
    for (let x = minX; x <= maxX; x += 1) {
      const key = `${x},${z}`;
      if (!ground.has(key)) {
        row += ' .';
        continue;
      }
      const mark = marks.find((m) => m.x === x && m.z === z);
      const die = level.dice.find((d) => d.x === x && d.z === z);
      const goal = level.goals.some((g) => g.x === x && g.z === z);
      if (mark) row += mark.ch;
      else if (die && goal) row += ' X';
      else if (die) row += ' A';
      else if (goal) row += ' G';
      else row += ' #';
    }
    lines.push(row);
  }
  return lines.join('\n');
}

function summarize(label, level) {
  const solved = solve(level, level.moves);
  console.log('\n==', label, '==');
  console.log(ascii(level));
  console.log('moves', level.moves, 'optimal', solved && solved.map((m) => `${m.dir}[${m.selected.join('+')}]`).join(' '));
  console.log(level.dice.map((d) => `(${d.x},${d.z}) ${fmtFaces(d.faces)}`).join('\n'));
  if (solved) {
    const played = replay(level, solved);
    console.log('clear', played.clear, 'end top', played.dice.map((d) => d.faces.top).join(','));
  }
  return solved;
}

function cellsOf(list) {
  return list.map(([x, z]) => ({ x, z }));
}

const stage1Faces = rollFaces(identityFaces(), 'S');
const stage1 = {
  name: 'ひところ',
  moves: 5,
  ground: cellsOf([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]),
  goals: [{ x: 1, z: 0 }],
  dice: [{ x: 1, z: 1, faces: stage1Faces }],
};
summarize('stage1 front-1 roll north', stage1);

const stage2Faces = rollFaces(rollFaces(identityFaces(), 'E'), 'E');
const stage2 = {
  name: 'うらがえし',
  moves: 4,
  ground: cellsOf([[0, 0], [1, 0], [2, 0]]),
  goals: [{ x: 2, z: 0 }],
  dice: [{ x: 0, z: 0, faces: stage2Faces }],
};
summarize('stage2 two east', stage2);

const stage3Ground = cellsOf([[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]);
let stage3 = null;
for (const faces of topOnes()) {
  const die = walkBack({ x: 0, z: 2, faces }, ['E', 'S', 'S', 'W']);
  const level = {
    name: 'まわり道',
    moves: 6,
    ground: stage3Ground,
    goals: [{ x: 0, z: 2 }],
    dice: [die],
  };
  if (isClear(level.dice, level.goals)) continue;
  const solved = solve(level, 6);
  if (solved && solved.length === 4 && solved.map((m) => m.dir).join('') === 'ESSW') {
    stage3 = level;
    break;
  }
}
summarize('stage3 hole', stage3);

const stage4Faces = stage1Faces;
const stage4 = {
  name: 'いっしょ',
  moves: 2,
  ground: cellsOf([[0, 0], [1, 0], [0, 1], [1, 1]]),
  goals: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
  dice: [
    { x: 0, z: 1, faces: cloneFaces(stage4Faces) },
    { x: 1, z: 1, faces: cloneFaces(stage4Faces) },
  ],
};
summarize('stage4 together', stage4);

const stage5A = stage1Faces;
const stage5B = orientations().find((f) => f.east === 1 && f.top !== 1);
const stage5 = {
  name: 'ばらばら',
  moves: 4,
  ground: cellsOf([[0, 0], [0, 1], [1, 1], [2, 1]]),
  goals: [{ x: 0, z: 0 }, { x: 1, z: 1 }],
  dice: [
    { x: 0, z: 1, faces: cloneFaces(stage5A) },
    { x: 2, z: 1, faces: cloneFaces(stage5B) },
  ],
};
const solved5 = summarize('stage5 split', stage5);
if (solved5) {
  for (const dir of DIR_ORDER) {
    const both = replay(stage5, [{ dir, selected: [0, 1] }]);
    console.log(' both', dir, both.ok ? 'ok' : both.trace.at(-1)?.reason);
  }
}

function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grow(rng, n) {
  const cells = [[0, 0]];
  const set = new Set(['0,0']);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let guard = 0;
  while (cells.length < n && guard < 400) {
    guard += 1;
    const base = cells[Math.floor(rng() * cells.length)];
    const d = dirs[Math.floor(rng() * 4)];
    const nx = base[0] + d[0];
    const nz = base[1] + d[1];
    if (Math.abs(nx) > 4 || Math.abs(nz) > 4) continue;
    const key = `${nx},${nz}`;
    if (set.has(key)) continue;
    set.add(key);
    cells.push([nx, nz]);
  }
  const minX = Math.min(...cells.map((c) => c[0]));
  const minZ = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, z]) => ({ x: x - minX, z: z - minZ }));
}

function keyOf(level) {
  return JSON.stringify({
    g: level.ground.map((c) => [c.x, c.z]),
    d: level.dice.map((d) => [d.x, d.z, facesKey(d.faces)]),
    o: level.goals.map((c) => [c.x, c.z]),
  });
}

const orients = orientations();
const found = [];
const seen = new Set();
const rng = mulberry32(11);

for (let i = 0; i < 400 && found.length < 12; i += 1) {
  const two = i % 2 === 1;
  const ground = grow(rng, two ? 8 + Math.floor(rng() * 4) : 7 + Math.floor(rng() * 5));
  if (ground.length < (two ? 8 : 7)) continue;
  const pick = () => ground[Math.floor(rng() * ground.length)];
  const dice = [];
  const goals = [];
  const used = new Set();
  const take = () => {
    for (let t = 0; t < 20; t += 1) {
      const c = pick();
      const k = `${c.x},${c.z}`;
      if (used.has(k)) continue;
      used.add(k);
      return c;
    }
    return null;
  };
  const count = two ? 2 : 1;
  let bad = false;
  for (let d = 0; d < count; d += 1) {
    const c = take();
    const g = take();
    if (!c || !g) bad = true;
    else {
      dice.push({ x: c.x, z: c.z, faces: cloneFaces(orients[Math.floor(rng() * orients.length)]) });
      goals.push(g);
    }
  }
  if (bad) continue;
  if (dice.some((d) => d.faces.top === 1 && goals.some((g) => g.x === d.x && g.z === d.z))) continue;
  const level = { name: '候補', moves: 10, ground, goals, dice };
  if (isClear(dice, goals)) continue;
  const solved = solve(level, two ? 7 : 8, 80000);
  if (!solved) continue;
  const optimal = solved.length;
  if (two) {
    if (optimal < 4 || optimal > 7) continue;
    const together = solved.some((m) => m.selected.length === 2);
    const single = solved.some((m) => m.selected.length === 1);
    if (!together || !single) continue;
  } else if (optimal < 5 || optimal > 8) continue;
  const dirsUsed = new Set(solved.map((m) => m.dir));
  if (dirsUsed.size < 2) continue;
  const id = keyOf(level);
  if (seen.has(id)) continue;
  seen.add(id);
  level.moves = optimal + (two ? 1 : 2);
  found.push({ level, solved, optimal });
}

found.sort((a, b) => a.optimal - b.optimal || a.level.ground.length - b.level.ground.length);
console.log('\n\n##### CANDIDATES', found.length);
for (const item of found.slice(0, 8)) {
  summarize(`cand opt ${item.optimal}`, item.level);
}

function dump(level) {
  const dice = level.dice
    .map((d) => `      { x: ${d.x}, z: ${d.z}, faces: ${fmtFaces(d.faces)} },`)
    .join('\n');
  const ground = level.ground.map((c) => `[${c.x},${c.z}]`).join(', ');
  const goals = level.goals.map((c) => `[${c.x},${c.z}]`).join(', ');
  console.log(`ground: [${ground}]`);
  console.log(`goals: [${goals}]`);
  console.log(dice);
}

if (stage3) {
  console.log('\nDUMP3');
  dump(stage3);
}
