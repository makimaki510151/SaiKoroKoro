/** Built-in stages. `expect` is the shortest line, checked by the logic tests. */

const F = {
  /** 1 is on the south face, toward the default camera. One north roll brings it to the top. */
  front: { top: 5, bottom: 2, east: 3, west: 4, south: 1, north: 6 },
  /** Two east rolls from the opening pose: top is 6, bottom is 1. */
  flipped: { top: 6, bottom: 1, east: 4, west: 3, south: 2, north: 5 },
  /** Opening pose. Top is already 1. */
  oneUp: { top: 1, bottom: 6, east: 3, west: 4, south: 2, north: 5 },
  /** 1 is on the east face. One west roll brings it to the top. */
  right: { top: 2, bottom: 5, east: 1, west: 6, south: 3, north: 4 },
  /** 1 is on the north face. One south roll brings it to the top. */
  back: { top: 2, bottom: 5, east: 3, west: 4, south: 6, north: 1 },
};

function box(w, h, holes = []) {
  const blocked = new Set(holes.map(([x, z]) => `${x},${z}`));
  const ground = [];
  for (let z = 0; z < h; z += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!blocked.has(`${x},${z}`)) ground.push({ x, z });
    }
  }
  return ground;
}

function die(x, z, faces) {
  return { x, z, faces: { ...faces } };
}

export const STAGES = [
  {
    id: 'stage-1',
    name: 'ひところ',
    blurb: '手前に見えている赤い1が上に来る向きへ、金の輪まで転がそう。',
    hintDir: 'up',
    moves: 5,
    ground: box(3, 3),
    goals: [{ x: 1, z: 0 }],
    dice: [die(1, 1, F.front)],
    expect: ['N:0'],
  },
  {
    id: 'stage-2',
    name: 'うらがえし',
    blurb: '同じ方向に2回転がすと、上面は最初の裏面になります。右へ2回。',
    failHint: '右へもう一度転がすと、裏面の1が上に出ます。',
    hintDir: 'right',
    moves: 4,
    ground: box(3, 1),
    goals: [{ x: 2, z: 0 }],
    dice: [die(0, 0, F.flipped)],
    expect: ['E:0', 'E:0'],
  },
  {
    id: 'stage-3',
    name: '穴をよける',
    blurb: '上面はすでに1です。穴をよけて、1のままゴールまで運ぼう。',
    failHint: '穴のマスには地面がありません。横へ回ってください。',
    moves: 6,
    ground: box(3, 3, [[0, 1]]),
    goals: [{ x: 0, z: 2 }],
    dice: [die(0, 0, F.oneUp)],
    expect: ['E:0', 'S:0', 'S:0', 'W:0'],
  },
  {
    id: 'stage-4',
    name: 'いっしょ',
    blurb: '選んだダイスはまとめて同じ方向へ転がせます。何個でも手数は1です。',
    hintDir: 'up',
    moves: 2,
    ground: box(2, 2),
    goals: [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ],
    dice: [die(0, 1, F.front), die(1, 1, F.front)],
    expect: ['N:0+1'],
  },
  {
    id: 'stage-5',
    name: 'ばらばら',
    blurb: '同時に転がせるのは同じ方向だけです。落とさないよう、動かすダイスを選んで。',
    failHint: '全部いっぺんに動かすと、どちらかが落ちます。タップで片方だけ選んでください。',
    moves: 4,
    ground: [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
      { x: 2, z: 1 },
    ],
    goals: [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
    ],
    dice: [die(0, 1, F.front), die(2, 1, F.right)],
    expect: ['N:0', 'W:1'],
  },
  {
    id: 'stage-6',
    name: 'まわりこみ',
    blurb: '右へまっすぐ2回だと、上面は裏面の6になります。回り込もう。',
    failHint: '同じ方向の2回は裏返ります。別の道で1に戻してください。',
    moves: 6,
    ground: box(3, 3),
    goals: [{ x: 2, z: 1 }],
    dice: [die(0, 1, F.oneUp)],
    expect: ['S:0', 'E:0', 'E:0', 'N:0'],
  },
  {
    id: 'stage-7',
    name: 'ならべて',
    blurb: '手前の赤い1は、横に転がしても前を向いたままです。ゴールで上に向けよう。',
    moves: 7,
    ground: box(4, 3),
    goals: [
      { x: 3, z: 0 },
      { x: 3, z: 2 },
    ],
    dice: [die(0, 1, F.front), die(1, 1, F.front)],
    expect: ['S:1', 'E:0', 'E:0+1', 'E:0+1', 'N:0'],
  },
  {
    id: 'stage-8',
    name: 'ぎりぎり',
    blurb: '手数にほとんど余裕がありません。戻すでやり直せます。',
    moves: 5,
    ground: box(4, 2),
    goals: [
      { x: 3, z: 0 },
      { x: 3, z: 1 },
    ],
    dice: [die(0, 1, F.right), die(1, 1, F.front)],
    expect: ['E:0+1', 'E:0+1', 'N:1', 'E:0'],
  },
  {
    id: 'stage-9',
    name: 'れっしゃ',
    blurb: '3つとも裏面が1です。前だけどかすと、うしろが2手では間に合いません。',
    failHint: '3つ同時に右へ転がしてください。',
    moves: 2,
    ground: box(5, 1),
    goals: [{ x: 2, z: 0 }, { x: 3, z: 0 }, { x: 4, z: 0 }],
    dice: [die(0, 0, F.flipped), die(1, 0, F.flipped), die(2, 0, F.flipped)],
    expect: ['E:0+1+2', 'E:0+1+2'],
  },
  {
    id: 'stage-10',
    name: 'よんにん',
    blurb: '4つの裏面が1です。1つでも残すと、この手数では揃いません。',
    failHint: '4つとも選んで、右へ2回です。',
    moves: 2,
    ground: box(3, 4),
    goals: [0, 1, 2, 3].map((z) => ({ x: 2, z })),
    dice: [0, 1, 2, 3].map((z) => die(0, z, F.flipped)),
    expect: ['E:0+1+2+3', 'E:0+1+2+3'],
  },
  {
    id: 'stage-11',
    name: 'そろって',
    blurb: 'まっすぐ2マスだと上面は6になります。2つ同時に回り込まないと4手では足りません。',
    failHint: '2つとも、すべての手で一緒に回ってください。',
    moves: 4,
    ground: box(5, 4),
    goals: [{ x: 3, z: 1 }, { x: 3, z: 2 }],
    dice: [die(1, 1, F.oneUp), die(1, 2, F.oneUp)],
    expect: ['S:0+1', 'E:0+1', 'E:0+1', 'N:0+1'],
  },
  {
    id: 'stage-12',
    name: 'どいて',
    blurb: '端の2つは奥へ向ければ1になります。真ん中は、どいてから戻らないと1がずれます。3手ぴったりです。',
    failHint: '端を先に揃えると、真ん中が戻れません。',
    moves: 3,
    ground: box(5, 3),
    goals: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 4, z: 0 }],
    dice: [die(0, 1, F.front), die(2, 1, F.oneUp), die(4, 1, F.front)],
    expect: ['E:1', 'N:0+1+2', 'W:1'],
  },
  {
    id: 'stage-13',
    name: 'みぎひだり',
    blurb: '右へ2回で裏返る組と、左へ2回で裏返る組です。違う方向は同時に転がせません。4手しかありません。',
    failHint: '同じ組の2つは、同時に2回転がしてください。',
    moves: 4,
    ground: box(4, 4),
    goals: [{ x: 3, z: 0 }, { x: 3, z: 1 }, { x: 0, z: 2 }, { x: 0, z: 3 }],
    dice: [die(1, 0, F.flipped), die(1, 1, F.flipped), die(2, 2, F.flipped), die(2, 3, F.flipped)],
    expect: ['E:0+1', 'E:0+1', 'W:2+3', 'W:2+3'],
  },
  {
    id: 'stage-14',
    name: 'よこよん',
    blurb: '手前の1は、横に4回転がしても前を向いたままです。3つ一緒に進まないと5手では足りません。',
    failHint: '横に4回、それから奥へ。3つ同時です。',
    moves: 5,
    ground: box(5, 4),
    goals: [{ x: 4, z: 0 }, { x: 4, z: 1 }, { x: 4, z: 2 }],
    dice: [die(0, 1, F.front), die(0, 2, F.front), die(0, 3, F.front)],
    expect: ['E:0+1+2', 'E:0+1+2', 'E:0+1+2', 'E:0+1+2', 'N:0+1+2'],
  },
  {
    id: 'stage-15',
    name: '通りすぎ',
    blurb: 'ゴールは隣です。1回では1にならないので、いったん通りすぎて戻ってください。5手ぴったりです。',
    failHint: '右へ2回で1になります。そこから回って、ゴールに1のまま戻ります。',
    moves: 5,
    ground: box(4, 3),
    goals: [{ x: 1, z: 1 }],
    dice: [die(0, 1, F.flipped)],
    expect: ['E:0', 'E:0', 'S:0', 'W:0', 'N:0'],
  },
  {
    id: 'stage-16',
    name: 'うしろむき',
    blurb: '赤い1は、ゴールと反対側を向いています。奥へ転がしても1は上に来ません。6手ぴったりです。',
    failHint: 'いったん手前へ転がして1を出し、右の列を回ってゴールへ。',
    moves: 6,
    ground: [
      { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 },
      { x: 1, z: 1 }, { x: 3, z: 1 },
      { x: 1, z: 2 }, { x: 2, z: 2 }, { x: 3, z: 2 },
      { x: 1, z: 3 }, { x: 2, z: 3 }, { x: 3, z: 3 },
    ],
    goals: [{ x: 2, z: 0 }],
    dice: [die(2, 2, F.back)],
    expect: ['S:0', 'E:0', 'N:0', 'N:0', 'N:0', 'W:0'],
  },
  {
    id: 'stage-17',
    name: 'もどって',
    blurb: 'ゴールの上にいますが、上面は6です。出て、1のまま同じマスに戻ってください。8手しかありません。',
    failHint: 'その場で裏返すには、盤のまわりを回る必要があります。',
    moves: 8,
    ground: box(3, 3),
    goals: [{ x: 1, z: 1 }],
    dice: [die(1, 1, F.flipped)],
    expect: ['E:0', 'S:0', 'W:0', 'N:0', 'N:0', 'E:0', 'S:0', 'W:0'],
  },
  {
    id: 'stage-18',
    name: 'ふたりとも',
    blurb: '2つともゴールの上で裏向きです。ぶつかると手が潰れるので、すれ違いながら1で戻ってください。7手ぴったりです。',
    failHint: '同時に動かせるところと、どちらか一方だけのところがあります。',
    moves: 7,
    ground: box(4, 3),
    goals: [{ x: 1, z: 1 }, { x: 2, z: 1 }],
    dice: [die(1, 1, F.flipped), die(2, 1, F.flipped)],
    expect: ['S:0', 'W:1', 'W:0+1', 'N:0+1', 'E:0', 'E:0+1', 'S:1'],
  },
];

export const FRONT_FACES = { ...F.front };
