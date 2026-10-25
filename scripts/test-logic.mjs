import assert from 'node:assert/strict';
import {
  DIR_DELTA,
  DIR_ORDER,
  canonical,
  cloneFaces,
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

assert.ok(STAGES.length >= 6, 'builtin stages exist');
for (const stage of STAGES) {
  assert.equal(issues(stage).length, 0, `${stage.id} issues ${issues(stage).join(',')}`);
  assert.equal(isClear(stage.dice, stage.goals), false, `${stage.id} is not pre-solved`);
  const solved = solve(stage, stage.moves);
  assert.ok(solved && solved.length >= 1, `${stage.id} is solvable within ${stage.moves}`);
  assert.ok(solved.length <= stage.moves);
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
  const solved = solve(stage, stage.moves);
  console.log(`${stage.id} ${stage.name} optimal ${solved.length}/${stage.moves} ${solved.map((m) => `${m.dir}[${m.selected}]`).join(' ')}`);
}
