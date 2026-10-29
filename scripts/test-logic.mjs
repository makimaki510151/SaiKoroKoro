import assert from 'node:assert/strict';
import {
  DIR_DELTA,
  DIR_ORDER,
  canonical,
  cloneFaces,
  cloneGround,
  facesKey,
  groundSet,
  identityFaces,
  isClear,
  issues,
  orientIndex,
  orientations,
  parseLevel,
  replay,
  rollFaces,
  serializeLevel,
  solve,
  step,
  turn,
} from '../src/logic.js';
import { pivotedCenter, quaternionForFaces, worldFaces } from '../src/orient.js';
import { STAGES } from '../src/levels.js';

const id = identityFaces();

{
  let faces = cloneFaces(id);
  faces = rollFaces(faces, 'E');
  faces = rollFaces(faces, 'E');
  assert.equal(faces.top, id.bottom, 'two east rolls bring the original bottom to the top');
  assert.equal(faces.bottom, id.top, 'two east rolls send the original top to the bottom');
  assert.equal(faces.south, id.south);
  assert.equal(faces.north, id.north);
}

for (const dir of DIR_ORDER) {
  let faces = cloneFaces(id);
  for (let i = 0; i < 4; i += 1) faces = rollFaces(faces, dir);
  assert.equal(facesKey(faces), facesKey(id), `${dir} four times returns`);
  const back = rollFaces(rollFaces(id, dir), dir === 'E' ? 'W' : dir === 'W' ? 'E' : dir === 'S' ? 'N' : 'S');
  assert.equal(facesKey(back), facesKey(id), `${dir} reverses`);
}

assert.equal(orientations().length, 24);
for (const faces of orientations()) {
  assert.equal(faces.top + faces.bottom, 7);
  assert.equal(faces.east + faces.west, 7);
  assert.equal(faces.south + faces.north, 7);
  assert.ok(orientIndex(faces) >= 0);
  const quat = quaternionForFaces(faces);
  const shown = worldFaces(id, quat);
  assert.deepEqual(shown, faces, `mesh faces match ${facesKey(faces)}`);
}

for (const dir of DIR_ORDER) {
  const end = pivotedCenter(dir, 2, 5, 0.5);
  const delta = DIR_DELTA[dir];
  assert.ok(Math.abs(end.x - (2 + delta.x)) < 1e-6, `${dir} pivot x`);
  assert.ok(Math.abs(end.z - (5 + delta.z)) < 1e-6, `${dir} pivot z`);
  assert.ok(Math.abs(end.y - 0.5) < 1e-6, `${dir} pivot y`);
}

{
  const ground = groundSet([
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ]);
  const dice = [{ x: 0, z: 0, faces: identityFaces() }];
  const fell = step(dice, ground, [0], 'N');
  assert.equal(fell.ok, false);
  assert.equal(fell.reason, 'fall');
  assert.deepEqual(fell.falling, [0]);
  assert.equal(dice[0].x, 0, 'failed step does not mutate the caller');

  const moved = step(dice, ground, [0], 'E');
  assert.equal(moved.ok, true);
  assert.equal(moved.dice[0].x, 1);
  assert.equal(moved.dice[0].faces.top, identityFaces().west);
}

{
  const ground = groundSet([
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ]);
  const dice = [
    { x: 0, z: 0, faces: identityFaces() },
    { x: 1, z: 0, faces: identityFaces() },
  ];
  const blocked = step(dice, ground, [0], 'E');
  assert.equal(blocked.reason, 'blocked');
  const both = step(dice, ground, [0, 1], 'E');
  assert.equal(both.ok, true);
  assert.equal(both.dice[0].x, 1);
  assert.equal(both.dice[1].x, 2);
}

{
  const goals = [{ x: 1, z: 0 }];
  const die = { x: 1, z: 0, faces: identityFaces() };
  assert.equal(isClear([die], goals), true);
  assert.equal(isClear([{ ...die, faces: rollFaces(die.faces, 'E') }], goals), false);
  assert.equal(isClear([{ ...die, x: 0 }], goals), false);
  assert.equal(
    isClear(
      [
        { x: 0, z: 0, faces: identityFaces() },
        { x: 1, z: 0, faces: identityFaces() },
      ],
      [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 2, z: 0 },
      ],
    ),
    true,
  );
  assert.equal(
    isClear(
      [
        { x: 0, z: 0, faces: identityFaces() },
        { x: 2, z: 0, faces: identityFaces() },
      ],
      [{ x: 0, z: 0 }],
    ),
    false,
  );
}

{
  const raw = parseLevel(JSON.parse(serializeLevel({
    name: 'ためし',
    moves: 3,
    ground: [{ x: 1, z: 0 }, { x: 0, z: 0 }],
    goals: [{ x: 1, z: 0 }],
    dice: [{ x: 0, z: 0, faces: identityFaces() }],
  })));
  assert.equal(raw.ok, true);
  assert.equal(raw.level.dice[0].faces.top, 1);
  assert.equal(parseLevel({ name: 'x', moves: 1, ground: [[0, 0]], goals: [[0, 0]], dice: [] }).ok, false);
  const bad = parseLevel({
    name: 'x',
    moves: 1,
    ground: [[0, 0]],
    goals: [[0, 0]],
    dice: [{ x: 0, z: 0, top: 1, bottom: 6, east: 2, west: 5, south: 3, north: 4 }],
  });
  assert.equal(bad.ok, false);
}

{
  const level = {
    name: '線',
    moves: 2,
    ground: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }],
    goals: [{ x: 2, z: 0 }],
    dice: [{ x: 0, z: 0, faces: rollFaces(rollFaces(identityFaces(), 'E'), 'E') }],
  };
  assert.equal(level.dice[0].faces.top, 6);
  assert.equal(level.dice[0].faces.bottom, 1);
  const solved = solve(level, 4);
  assert.ok(solved);
  assert.deepEqual(solved.map((m) => m.dir), ['E', 'E']);
  const played = replay(level, solved);
  assert.equal(played.clear, true);
  assert.equal(played.dice[0].faces.top, 1);
  assert.equal(canonical(level), canonical(level));
  assert.equal(issues(level).length, 0);
}

{
  const many = {
    name: 'たくさん',
    moves: 1,
    ground: Array.from({ length: 6 }, (_, i) => ({ x: i, z: 0 })),
    goals: Array.from({ length: 6 }, (_, i) => ({ x: i, z: 0 })),
    dice: Array.from({ length: 5 }, (_, i) => ({ x: i, z: 0, faces: identityFaces() })),
  };
  assert.equal(issues(many).length, 0, 'five dice are allowed');
  const parsed = parseLevel(JSON.parse(serializeLevel(many)));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.level.dice.length, 5);
}

{
  const faces = identityFaces();
  const ground = [
    { x: 0, z: 0 },
    { x: 1, z: 0, kind: 'slide', dir: 'E' },
    { x: 2, z: 1 },
  ];
  const dice = [{ x: 0, z: 0, faces }];
  const moved = turn(dice, ground, [0], 'E');
  assert.equal(moved.ok, true);
  assert.equal(moved.actualDir, 'E');
  assert.deepEqual([moved.dice[0].x, moved.dice[0].z], [2, 0], 'landing on a slide carries the die');
  assert.ok(moved.ground.some((cell) => cell.kind === 'slide' && cell.x === 2 && cell.z === 0));
  const off = turn(moved.dice, moved.ground, [0], 'S');
  assert.equal(off.ok, true);
  assert.deepEqual([off.dice[0].x, off.dice[0].z], [2, 1]);
  assert.ok(off.ground.some((cell) => cell.kind === 'slide' && cell.x === 3 && cell.z === 0));

  const blocked = turn(
    [{ x: 0, z: 0, faces }],
    [{ x: 0, z: 0 }, { x: 1, z: 0, kind: 'slide', dir: 'E' }, { x: 2, z: 0 }],
    [0],
    'E',
  );
  assert.equal(blocked.dice[0].x, 1, 'a slide stays when both ways are walled in');
  const stayed = blocked.ground.find((cell) => cell.kind === 'slide');
  assert.equal(stayed.x, 1);
  assert.equal(stayed.dir, 'W', 'a walled-in slide turns around for the next move');

  const returned = turn(
    [{ x: 2, z: 0, faces }],
    [{ x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 0, kind: 'slide', dir: 'E' }],
    [0],
    'W',
  );
  assert.equal(returned.ok, true);
  assert.deepEqual([returned.dice[0].x, returned.dice[0].z], [0, 0], 'a blocked slide reverses and carries the die');
  const shuttle = returned.ground.find((cell) => cell.kind === 'slide');
  assert.deepEqual([shuttle.x, shuttle.z, shuttle.dir], [0, 0, 'W']);
  assert.equal(returned.slides[0].turned, true);
  const onward = turn(returned.dice, returned.ground, [0], 'S');
  assert.equal(onward.ok, false, 'stepping off the returned tile into empty space falls');
}

{
  const ground = [
    { x: 0, z: 0 },
    { x: 1, z: 0, kind: 'flip' },
    { x: 2, z: 0 },
  ];
  const dice = [{ x: 1, z: 0, faces: identityFaces() }];
  const reversed = turn(dice, ground, [0], 'E');
  assert.equal(reversed.actualDir, 'W');
  assert.equal(reversed.dice[0].x, 0);
  const normal = turn(dice, ground, [0], 'W');
  assert.equal(normal.actualDir, 'E');
  assert.equal(normal.dice[0].x, 2);

  const mixed = turn(
    [
      { x: 0, z: 0, faces: identityFaces() },
      { x: 3, z: 0, faces: identityFaces() },
    ],
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0, kind: 'flip' },
    ],
    [0, 1],
    'E',
  );
  assert.equal(mixed.ok, true);
  assert.deepEqual(mixed.dirs, ['E', 'W']);
  assert.deepEqual([mixed.dice[0].x, mixed.dice[0].z], [1, 0], 'a die on a plain floor keeps the pressed direction');
  assert.deepEqual([mixed.dice[1].x, mixed.dice[1].z], [2, 0], 'a die on a flip floor rolls the other way in the same action');
  assert.equal(mixed.dice[0].faces.top, 4);
  assert.equal(mixed.dice[1].faces.top, 3);
}

{
  const ground = [
    { x: 0, z: 0, kind: 'crumb' },
    { x: 1, z: 0, kind: 'crumb' },
    { x: 2, z: 0 },
  ];
  const dice = [{ x: 0, z: 0, faces: identityFaces() }];
  const first = turn(dice, ground, [0], 'E');
  assert.equal(first.ok, true);
  assert.equal(first.crumbled.join(','), '0,0');
  assert.equal(first.ground.some((cell) => cell.x === 0), false);
  const back = turn(first.dice, first.ground, [0], 'W');
  assert.equal(back.ok, false);
  assert.equal(back.reason, 'fall');
  const stayed = turn(
    [
      { x: 0, z: 0, faces: identityFaces() },
      { x: 1, z: 0, faces: identityFaces() },
    ],
    [
      { x: 0, z: 0 },
      { x: 1, z: 0, kind: 'crumb' },
      { x: 1, z: 1 },
    ],
    [1],
    'S',
  );
  assert.equal(stayed.ok, true);
  assert.equal(stayed.crumbled.length, 1);
  const kept = turn(
    [
      { x: 0, z: 0, faces: identityFaces() },
      { x: 1, z: 0, faces: identityFaces() },
    ],
    [
      { x: 0, z: 0 },
      { x: 1, z: 0, kind: 'crumb' },
      { x: 0, z: 1 },
    ],
    [0],
    'S',
  );
  assert.equal(kept.ok, true);
  assert.equal(kept.crumbled.length, 0, 'a crumb stays while a die remains on it');
}

{
  const raw = {
    name: 'ギミック',
    moves: 2,
    ground: [[0, 0], [1, 0, 'slide', 'E'], [2, 0, 'flip'], [3, 0, 'crumb']],
    goals: [[3, 0]],
    dice: [{ x: 0, z: 0, top: 1, bottom: 6, east: 3, west: 4, south: 2, north: 5 }],
  };
  const parsed = parseLevel(raw);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.level.ground[1].dir, 'E');
  const again = parseLevel(JSON.parse(serializeLevel(parsed.level)));
  assert.equal(again.ok, true);
  assert.deepEqual(cloneGround(again.level.ground), cloneGround(parsed.level.ground));
  assert.equal(parseLevel({ ...raw, ground: [[0, 0, 'slide', 'Q']] }).ok, false);
}

function movesFromExpect(expect) {
  return expect.map((item) => {
    const [dir, selected] = item.split(':');
    return { dir, selected: selected.split('+').map(Number) };
  });
}

assert.equal(STAGES.length, 26, 'builtin stages exist');
for (const stage of STAGES) {
  assert.equal(issues(stage).length, 0, `${stage.id} issues ${issues(stage).join(',')}`);
  assert.equal(isClear(stage.dice, stage.goals), false, `${stage.id} is not pre-solved`);
  if (stage.search === false) {
    assert.equal(stage.expect.length, stage.moves, `${stage.id} scripted line matches the move limit`);
    const played = replay(stage, movesFromExpect(stage.expect));
    assert.equal(played.ok && played.clear, true, `${stage.id} replay clears`);
    continue;
  }
  const solved = solve(stage, stage.moves);
  assert.ok(solved && solved.length >= 1, `${stage.id} is solvable within ${stage.moves}`);
  assert.ok(solved.length <= stage.moves);
  const number = Number(String(stage.id).replace('stage-', ''));
  if (number >= 9) {
    assert.equal(solved.length, stage.moves, `${stage.id} move limit is the shortest solution`);
  }
  const played = replay(stage, solved);
  assert.equal(played.ok && played.clear, true, `${stage.id} replay clears`);
  const shorter = solve(stage, solved.length - 1);
  assert.equal(shorter, null, `${stage.id} move limit is not below the shortest solution`);
  if (stage.expect) {
    assert.deepEqual(
      solved.map((m) => `${m.dir}:${m.selected.join('+')}`),
      stage.expect,
      `${stage.id} intended line`,
    );
  }
}

console.log(`ok ${STAGES.length} stages`);
for (const stage of STAGES) {
  if (stage.search === false) {
    console.log(`${stage.id} ${stage.name} scripted ${stage.expect.length}/${stage.moves} ${stage.expect.join(' ')}`);
    continue;
  }
  const solved = solve(stage, stage.moves);
  console.log(`${stage.id} ${stage.name} optimal ${solved.length}/${stage.moves} ${solved.map((m) => `${m.dir}[${m.selected}]`).join(' ')}`);
}
