/** Built-in stages. `expect` is a shortest line. Tests search unless `search` is false. */

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

function span(xs, zs) {
  const ground = [];
  for (const z of zs) {
    for (const x of xs) ground.push({ x, z });
  }
  return ground;
}

function tile(x, z, kind, dir) {
  const cell = { x, z };
  if (kind) cell.kind = kind;
  if (dir) cell.dir = dir;
  return cell;
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
    id: 'stage-10',
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
    id: 'stage-11',
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
    id: 'stage-12',
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
    id: 'stage-13',
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
    id: 'stage-19',
    name: '入れ替わり',
    blurb: '4つともゴールの上にいますが、上面は1ではありません。場所を入れ替え、4手で全員の1を上に。',
    failHint: '同じマスに戻らなくて大丈夫です。隣のゴールへ渡してください。',
    moves: 4,
    ground: box(3, 3),
    goals: [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 1, z: 2 },
      { x: 2, z: 1 },
    ],
    dice: [
      die(2, 1, { top: 5, bottom: 2, east: 1, west: 6, south: 4, north: 3 }),
      die(1, 0, F.right),
      die(0, 1, { top: 3, bottom: 4, east: 5, west: 2, south: 6, north: 1 }),
      die(1, 2, { top: 3, bottom: 4, east: 2, west: 5, south: 1, north: 6 }),
    ],
    expect: ['E:2+3', 'S:1+2', 'N:0+3', 'W:0+1'],
  },
  {
    id: 'stage-20',
    name: 'みんな集合',
    blurb: '盤は4つの島に分かれています。各ダイスは内側のゴールへ。2つ同時に動かさないと8手では足りません。',
    failHint: '離れた島のダイスも、同じ方向なら1手でまとめて転がせます。',
    moves: 8,
    search: false,
    ground: span([-2, -1, 0, 2, 3, 4], [-1, 0, 1, 3, 4, 5]),
    goals: [
      { x: 0, z: 1 },
      { x: 0, z: 3 },
      { x: 2, z: 1 },
      { x: 2, z: 3 },
    ],
    dice: [
      die(4, 5, { top: 1, bottom: 6, east: 4, west: 3, south: 5, north: 2 }),
      die(-2, 5, F.right),
      die(-2, -1, { top: 5, bottom: 2, east: 1, west: 6, south: 4, north: 3 }),
      die(4, -1, F.flipped),
    ],
    expect: ['E:1+2', 'S:2+3', 'W:0+3', 'W:0+3', 'N:0+1', 'E:1+2', 'S:2+3', 'N:0+1'],
  },
  {
    id: 'stage-21',
    name: 'わたる',
    blurb: '青緑の床は、先がふさがると反対へ戻ります。左へ乗ると、右の壁で折り返して、さらに左まで運ばれます。',
    failHint: '左へ乗ってください。床は右へ進めないので、一緒に左の空きまで戻ります。そこから手前です。',
    moves: 2,
    ground: [
      tile(2, 0),
      tile(1, 0, 'slide', 'E'),
      tile(0, 1),
      tile(-1, 0),
    ],
    goals: [{ x: 0, z: 1 }],
    dice: [die(2, 0, F.back)],
    expect: ['W:0', 'S:0'],
  },
  {
    id: 'stage-22',
    name: 'のせる',
    blurb: '床はまず右の壁まで進みます。そこに乗ると、折り返してゴールまで戻ってきます。',
    failHint: '左へ出てから、奥の床に乗ってください。',
    moves: 2,
    ground: [
      tile(3, 1),
      tile(2, 1),
      tile(3, 0),
      tile(1, 0, 'slide', 'E'),
    ],
    goals: [{ x: 1, z: 0 }],
    dice: [die(3, 1, F.front)],
    expect: ['W:0', 'N:0'],
  },
  {
    id: 'stage-23',
    name: 'おりる',
    blurb: '壁で折り返した床に乗って運ばれます。降りたあとも床は行き来するので、手前へ2回進んでください。',
    failHint: '左へ乗ると、床が折り返して一緒に左へ進みます。降りてから、手前へもう一度。',
    moves: 3,
    ground: [
      tile(2, 0),
      tile(1, 0, 'slide', 'E'),
      tile(0, 1),
      tile(0, 2),
      tile(-1, 0),
    ],
    goals: [{ x: 0, z: 2 }],
    dice: [die(2, 0, { top: 5, bottom: 2, west: 1, east: 6, south: 3, north: 4 })],
    expect: ['W:0', 'S:0', 'S:0'],
  },
  {
    id: 'stage-24',
    name: 'ぎゃく',
    blurb: '紫の床の上では、押した方向と逆に転がります。奥を押すと手前へ進み、1が上に出ます。',
    failHint: '奥のボタンで、手前のゴールへ転がります。',
    moves: 1,
    ground: [
      tile(0, 0),
      tile(0, 1, 'flip'),
      tile(0, 2),
    ],
    goals: [{ x: 0, z: 2 }],
    dice: [die(0, 1, F.back)],
    expect: ['N:0'],
  },
  {
    id: 'stage-25',
    name: 'ひきかえす',
    blurb: 'いったん紫の床に乗り、そこでは手前のボタンが奥へ進みます。',
    failHint: '奥へ乗ってから、手前を押すとゴール方向へ転がります。',
    moves: 2,
    ground: [
      tile(0, 0),
      tile(0, 1, 'flip'),
      tile(0, 2),
    ],
    goals: [{ x: 0, z: 0 }],
    dice: [die(0, 2, { top: 6, bottom: 1, north: 2, south: 5, east: 3, west: 4 })],
    expect: ['N:0', 'S:0'],
  },
  {
    id: 'stage-26',
    name: 'とおる',
    blurb: '中央の紫の床では、奥のボタンが手前へ転がします。そこを通って右手前のゴールへ。',
    failHint: '紫の床の上で奥を押すと、手前の列に出ます。',
    moves: 4,
    ground: [
      tile(0, 0),
      tile(1, 0),
      tile(2, 0),
      tile(1, 1, 'flip'),
      tile(0, 2),
      tile(1, 2),
      tile(2, 2),
    ],
    goals: [{ x: 2, z: 2 }],
    dice: [die(0, 0, { top: 6, bottom: 1, north: 2, south: 5, east: 3, west: 4 })],
    expect: ['E:0', 'S:0', 'N:0', 'E:0'],
  },
  {
    id: 'stage-27',
    name: 'くずれる',
    blurb: 'ひびの入った床は、一度離れると崩れます。右へ2回。戻る床はもうありません。',
    failHint: '右へ2回で1が上になり、ゴールに着きます。',
    moves: 2,
    ground: [
      tile(0, 0),
      tile(1, 0, 'crumb'),
      tile(2, 0),
    ],
    goals: [{ x: 2, z: 0 }],
    dice: [die(0, 0, F.flipped)],
    expect: ['E:0', 'E:0'],
  },
  {
    id: 'stage-28',
    name: 'もどせない',
    blurb: '上面を1に戻すには一周します。ひびの床は離れた瞬間に消えるので、同じマスは二度通れません。',
    failHint: '手前、右、奥、左の順です。',
    moves: 4,
    ground: [
      tile(0, 0),
      tile(1, 0, 'crumb'),
      tile(0, 1),
      tile(1, 1),
    ],
    goals: [{ x: 0, z: 0 }],
    dice: [die(0, 0, F.back)],
    expect: ['S:0', 'E:0', 'N:0', 'W:0'],
  },
  {
    id: 'stage-29',
    name: 'まわりみち',
    blurb: '右のひび床は、渡ったあと崩れます。下の列を回って、1のまま最初のマスへ。',
    failHint: '右へ2回で1になります。手前の列を左へ戻ってください。',
    moves: 6,
    ground: [
      tile(0, 0),
      tile(1, 0, 'crumb'),
      tile(2, 0),
      tile(2, 1),
      tile(1, 1),
      tile(0, 1),
    ],
    goals: [{ x: 0, z: 0 }],
    dice: [die(0, 0, F.flipped)],
    expect: ['E:0', 'E:0', 'S:0', 'W:0', 'W:0', 'N:0'],
  },
  {
    id: 'stage-30',
    name: '双子島',
    blurb: '2つの島に分かれています。それぞれゴールの上ですが向きが違います。6手で両方の1を上に。',
    failHint: '同じ方向にまとめて転がせます。島から落ちないよう、動かすダイスを選んでください。',
    moves: 6,
    ground: [
      tile(0, 2), tile(0, 3), tile(1, 2), tile(1, 3),
      tile(2, 0), tile(2, 1), tile(3, 0), tile(3, 1),
    ],
    goals: [
      { x: 1, z: 2 },
      { x: 2, z: 1 },
    ],
    dice: [
      die(2, 1, { top: 2, bottom: 5, east: 6, west: 1, south: 4, north: 3 }),
      die(1, 2, { top: 5, bottom: 2, east: 1, west: 6, south: 4, north: 3 }),
    ],
    expect: ['E:0', 'N:0', 'W:0+1', 'S:0+1', 'E:1', 'N:1'],
  },
  {
    id: 'stage-31',
    name: '整列',
    blurb: '3つのダイスを3手でゴールへ。同時に動かせるときは、手数は1です。',
    failHint: 'バラバラに動かす手と、3つ同時の手があります。',
    moves: 3,
    ground: span([1, 2, 3], [0, 1, 2, 3]),
    goals: [
      { x: 2, z: 1 },
      { x: 2, z: 3 },
      { x: 3, z: 2 },
    ],
    dice: [
      die(2, 0, F.back),
      die(1, 1, { top: 6, bottom: 1, east: 5, west: 2, south: 4, north: 3 }),
      die(2, 2, F.back),
    ],
    expect: ['E:1', 'S:0+1+2', 'E:1'],
  },
];

export const FRONT_FACES = { ...F.front };
