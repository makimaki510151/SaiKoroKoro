import { FRONT_FACES, STAGES } from './levels.js';
import {
  canonical,
  cellKey,
  cloneDice,
  cloneGround,
  groundSet,
  isClear,
  issues,
  parseLevel,
  rollFaces,
  serializeLevel,
  turn,
} from './logic.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './storage.js';
import { createView } from './view.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const canvas = $('c');
const modal = $('modal');
const toastEl = $('toast');
const fileInput = $('file-input');

const audio = createAudio();
const view = createView(canvas);
const save = loadSave();
const settings = save.settings;

let scene = 'title';
let session = null;
let previewId = null;
let busy = false;
let toastTimer = 0;
let importTarget = 'play';
let boardToken = '';

const editor = {
  level: null,
  tool: 'roll',
  selected: new Set(),
  history: [],
  verifiedHash: null,
};

const TOOL_HELP = {
  ground: 'マスをタップして地面を置いたり消したりします。',
  slide: '地面をタップするたびに、動く床の矢印が右、手前、左、奥、普通の地面の順で切り替わります。',
  flip: '地面をタップして、操作が反転する紫の床を切り替えます。',
  crumb: '地面をタップして、一度離れると壊れる床を切り替えます。',
  goal: '地面をタップしてゴールを切り替えます。',
  die: '地面にダイスを置き、ダイスをタップすると消します。',
  roll: 'ダイスを選んで転がします。床のギミックも本番と同じように動きます。',
  face: '選んだダイスを、その場で倒すように向きを変えます。',
};

function write() {
  writeSave(save);
}

function applySettings() {
  audio.setVolume(Number(settings.volume) || 0);
  document.body.classList.toggle('reduce', !!settings.reduced);
  view.setReduced(!!settings.reduced);
  view.setFlip(!!settings.flip);
  view.setNumbers(!!settings.numbers);
  app.classList.toggle('controls-side', !!settings.sideControls);
  const layout = $('play-layout');
  const side = !!settings.sideControls;
  layout.textContent = side ? '操作を下' : '操作を右';
  layout.setAttribute('aria-pressed', side ? 'true' : 'false');
  layout.title = side ? '操作盤を下に戻します' : '操作盤を右に寄せて盤面を広げます';
  $('set-volume').value = String(Math.round((settings.volume ?? 0.7) * 100));
  $('set-numbers').checked = !!settings.numbers;
  $('set-reduced').checked = !!settings.reduced;
  $('set-flip').checked = !!settings.flip;
  $('set-vibrate').checked = settings.vibrate !== false;
  if (!navigator.vibrate) $('vibrate-row').hidden = true;
}

function buzz(pattern) {
  if (!settings.vibrate || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function go(next) {
  scene = next;
  app.dataset.scene = next;
  boardToken = '';
  if (next === 'title') view.showTitle();
  if (next === 'stages') renderStages();
  if (next === 'editor') presentEditor(true);
}

function measureDock(el, fallback) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const box = el?.getBoundingClientRect();
  if (!box || box.width < 8 || box.height < 8) return fallback;
  const gap = 12;
  if (box.width > w * 0.72 && box.top > h * 0.25) {
    return { top: 16, bottom: Math.ceil(h - box.top) + gap, left: gap, right: gap };
  }
  if (box.left < w * 0.25) {
    return { top: 16, bottom: gap, left: Math.ceil(box.right) + gap, right: gap };
  }
  return { top: 16, bottom: gap, left: gap, right: Math.ceil(w - box.left) + gap };
}

function insets() {
  const narrow = window.innerWidth < 880;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (scene === 'play') {
    const topBox = document.querySelector('#scene-play .hud-top')?.getBoundingClientRect();
    const panel = document.querySelector('#scene-play .hud-bottom')?.getBoundingClientRect();
    const top = topBox && topBox.bottom > 0 ? Math.ceil(topBox.bottom) + 8 : 78;
    if (panel && panel.width > 8) {
      const onSide = panel.left > w * 0.28 && panel.width < w * 0.72;
      if (onSide) return { top, bottom: 12, left: 12, right: Math.ceil(w - panel.left) + 12 };
      return { top, bottom: Math.ceil(h - panel.top) + 10, left: 8, right: 8 };
    }
    return { top: 78, bottom: narrow ? 300 : 214, left: 0, right: 0 };
  }
  if (scene === 'editor') {
    return measureDock(
      document.querySelector('#scene-editor .dock'),
      narrow
        ? { top: 64, bottom: Math.round(h * 0.5), left: 0, right: 0 }
        : { top: 12, bottom: 12, left: 0, right: 400 },
    );
  }
  if (scene === 'stages') {
    return measureDock(
      document.querySelector('#scene-stages .dock'),
      narrow
        ? { top: 8, bottom: Math.round(h * 0.6), left: 0, right: 0 }
        : { top: 12, bottom: 12, left: 468, right: 12 },
    );
  }
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

function showModal({ title, text, actions }) {
  $('modal-title').textContent = title;
  $('modal-text').textContent = text;
  const box = $('modal-actions');
  box.replaceChildren();
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${action.primary ? 'primary' : 'tiny'}`;
    button.textContent = action.label;
    if (action.escape) button.dataset.escape = '1';
    button.addEventListener('click', () => {
      hideModal();
      action.run();
    });
    box.append(button);
  }
  modal.hidden = false;
  box.querySelector('.primary')?.focus();
}

function hideModal() {
  modal.hidden = true;
}

function starterLevel() {
  const ground = [];
  for (let z = 0; z < 4; z += 1) {
    for (let x = 0; x < 4; x += 1) ground.push({ x, z });
  }
  return {
    name: 'マイステージ',
    moves: 4,
    ground,
    goals: [{ x: 1, z: 1 }],
    dice: [{ x: 1, z: 2, faces: { ...FRONT_FACES } }],
  };
}

function loadDraft() {
  const level = save.draft?.level;
  if (level && Array.isArray(level.ground) && Array.isArray(level.dice) && Array.isArray(level.goals)) {
    editor.level = level;
    editor.verifiedHash = save.draft.verifiedHash || null;
    editor.history = [];
    editor.selected = new Set(level.dice.map((_, i) => i));
    return;
  }
  editor.level = starterLevel();
  editor.verifiedHash = null;
  editor.history = [];
  editor.selected = new Set([0]);
}

function persistDraft() {
  save.draft = {
    verifiedHash: editor.verifiedHash,
    level: structuredClone(editor.level),
  };
  write();
}

function ghostCells(level) {
  let minX = 0;
  let maxX = 5;
  let minZ = 0;
  let maxZ = 5;
  for (const cell of [...level.ground, ...level.goals, ...level.dice]) {
    minX = Math.min(minX, cell.x - 1);
    maxX = Math.max(maxX, cell.x + 1);
    minZ = Math.min(minZ, cell.z - 1);
    maxZ = Math.max(maxZ, cell.z + 1);
  }
  minX = Math.max(-2, minX);
  minZ = Math.max(-2, minZ);
  maxX = Math.min(8, maxX);
  maxZ = Math.min(8, maxZ);
  const cells = [];
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) cells.push({ x, z });
  }
  return cells;
}

function playBoard() {
  return {
    ground: session.ground,
    goals: session.level.goals,
    dice: session.dice,
  };
}

function controlsReversed() {
  if (!session) return false;
  const flips = new Set(
    session.ground.filter((cell) => cell.kind === 'flip').map((cell) => `${cell.x},${cell.z}`),
  );
  for (const index of session.selected) {
    const die = session.dice[index];
    if (die && flips.has(`${die.x},${die.z}`)) return true;
  }
  return false;
}

function present(level, selected, ghosts) {
  const token = JSON.stringify({
    scene,
    g: level.ground,
    o: level.goals,
    n: level.dice.length,
    ghosts: !!ghosts,
  });
  view.setNumbers(!!settings.numbers);
  if (token !== boardToken) {
    view.setWorld({
      ground: level.ground,
      goals: level.goals,
      dice: level.dice,
      ghosts,
      selected,
      numbers: !!settings.numbers,
    });
    view.frame(ghosts || level.ground, insets());
    boardToken = token;
  } else {
    view.syncDice(level.dice, level.goals, selected);
  }
}

function isUnlocked(index) {
  if (index <= 0) return true;
  return !!save.cleared[STAGES[index - 1].id];
}

function customId(level) {
  const text = `${level.name}:${canonical(level)}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return `custom-${hash.toString(16)}`;
}

function renderStages() {
  const list = $('stage-list');
  list.replaceChildren();
  STAGES.forEach((stage, index) => {
    list.append(stageCard(stage, index + 1, isUnlocked(index)));
  });
  const label = document.createElement('div');
  label.className = 'group-label';
  label.textContent = 'マイステージ';
  list.append(label);
  if (!save.custom.length) {
    const empty = document.createElement('p');
    empty.textContent = 'レベルデザインから出力すると、ここに並びます。';
    list.append(empty);
  }
  for (const item of save.custom) {
    const parsed = parseLevel(item.data);
    if (!parsed.ok) continue;
    const level = { ...parsed.level, id: item.id, blurb: 'つくったステージ' };
    const row = document.createElement('div');
    row.className = 'card-row';
    const card = stageCard(level, '自', true);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn tiny';
    del.textContent = '消す';
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      save.custom = save.custom.filter((entry) => entry.id !== item.id);
      write();
      if (previewId === item.id) previewId = STAGES[0].id;
      renderStages();
    });
    row.append(card, del);
    list.append(row);
  }
  if (!previewId) previewId = STAGES.find((stage, index) => isUnlocked(index) && !save.cleared[stage.id])?.id || STAGES[0].id;
  showPreview(previewId);
}

function stageCard(level, mark, open) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  button.disabled = !open;
  if (level.id === previewId) button.classList.add('current');
  const best = save.cleared[level.id];
  button.innerHTML = `<span class="num"></span><span><b></b><small></small></span>`;
  button.querySelector('.num').textContent = String(mark);
  button.querySelector('b').textContent = open ? level.name : '？？？';
  button.querySelector('small').textContent = open
    ? best ? `クリア · 記録 ${best.best}手 / 制限 ${level.moves}` : `制限 ${level.moves}手`
    : 'まえのステージをクリアすると開きます';
  button.addEventListener('click', () => {
    if (!open) {
      toast('まえのステージをクリアすると開きます');
      return;
    }
    previewId = level.id;
    renderStages();
  });
  return button;
}

function findLevel(id) {
  const builtin = STAGES.find((stage) => stage.id === id);
  if (builtin) return builtin;
  const custom = save.custom.find((entry) => entry.id === id);
  if (!custom) return null;
  const parsed = parseLevel(custom.data);
  if (!parsed.ok) return null;
  return { ...parsed.level, id: custom.id, blurb: 'つくったステージ' };
}

function showPreview(id) {
  const level = findLevel(id);
  const start = $('stage-start');
  if (!level) {
    start.disabled = true;
    return;
  }
  previewId = id;
  start.disabled = false;
  start.textContent = `「${level.name}」をあそぶ`;
  present(level, new Set(level.dice.map((_, i) => i)), null);
}

function startSession(level, testing) {
  const frozen = {
    ...level,
    ground: level.ground.map((cell) => ({ ...cell })),
    goals: level.goals.map((cell) => ({ ...cell })),
    dice: cloneDice(level.dice),
  };
  session = {
    level: frozen,
    testing,
    dice: cloneDice(frozen.dice),
    ground: cloneGround(frozen.ground),
    initialGround: cloneGround(frozen.ground),
    selected: new Set(frozen.dice.map((_, i) => i)),
    movesLeft: frozen.moves,
    history: [],
    over: null,
    hint: !!frozen.hintDir,
  };
  hideModal();
  go('play');
  $('play-back').textContent = testing ? '配置へ' : 'ステージ';
  updateHud();
  present(playBoard(), session.selected, null);
}

function updateHud() {
  if (!session) return;
  const level = session.level;
  $('play-name').textContent = session.testing ? `テスト · ${level.name}` : level.name;
  $('play-blurb').textContent = session.testing
    ? '最初の配置からクリアすると、出力できます。'
    : (level.blurb || '');
  const moves = $('play-moves');
  moves.textContent = `残り ${session.movesLeft}`;
  moves.classList.toggle('warn', session.movesLeft <= 1);
  $('play-selected').textContent = `選択 ${session.selected.size}/${session.dice.length}${controlsReversed() ? ' · 操作が逆' : ''}`;
  $('play-undo').disabled = !session.history.length || session.over === 'clear';
  for (const button of $('play-dpad').querySelectorAll('button')) {
    button.classList.toggle('pulse', session.hint && button.dataset.dir === level.hintDir && !settings.reduced);
  }
}

function presentFixed() {
  if (scene === 'play' && session) present(playBoard(), session.selected, null);
  else if (scene === 'editor' && editor.level) presentEditor(false);
  else if (scene === 'stages' && previewId) showPreview(previewId);
}

function onCleared() {
  const used = session.level.moves - session.movesLeft;
  if (session.testing) {
    editor.verifiedHash = canonical(editor.level);
    persistDraft();
    showModal({
      title: 'テストクリア',
      text: `${used}手で揃いました。この配置は出力できます。`,
      actions: [
        { label: '出力する', primary: true, run: () => { go('editor'); exportLevel(); } },
        { label: 'もう一度', run: () => startSession(editor.level, true) },
        { label: '配置に戻る', escape: true, run: () => go('editor') },
      ],
    });
    return;
  }
  const prev = save.cleared[session.level.id];
  const improved = !prev || used < prev.best;
  save.cleared[session.level.id] = { best: prev ? Math.min(prev.best, used) : used };
  write();
  const index = STAGES.findIndex((stage) => stage.id === session.level.id);
  const next = index >= 0 ? STAGES[index + 1] : null;
  const all = STAGES.every((stage) => save.cleared[stage.id]);
  const text = `${used}手で揃えました。${improved ? '記録を更新しました。' : `記録は ${save.cleared[session.level.id].best}手です。`}${all && index === STAGES.length - 1 ? ' すべてのステージが揃いました。' : ''}`;
  const actions = [];
  if (next) actions.push({ label: 'つぎへ', primary: true, run: () => startSession(next, false) });
  actions.push({ label: 'もう一度', primary: !next, run: () => startSession(session.level, false) });
  actions.push({ label: 'ステージへ', escape: true, run: () => go('stages') });
  showModal({ title: 'クリア', text, actions });
}

function showFail() {
  const fell = session.over === 'fall';
  const hint = session.level.failHint ? `\n${session.level.failHint}` : '';
  const actions = [
    { label: 'もう一度', primary: true, run: () => restart() },
  ];
  if (session.history.length) actions.push({ label: '1手もどす', run: () => undoPlay() });
  actions.push({
    label: session.testing ? '配置に戻る' : 'ステージへ',
    escape: true,
    run: () => (session.testing ? go('editor') : go('stages')),
  });
  showModal({
    title: fell ? '落下' : '手数切れ',
    text: `${fell ? '地面のないところへ転がしました。' : '制限手数で揃えられませんでした。'}${hint}`,
    actions,
  });
}

function restart() {
  if (busy || !session) return;
  session.dice = cloneDice(session.level.dice);
  session.ground = cloneGround(session.initialGround);
  session.movesLeft = session.level.moves;
  session.history = [];
  session.selected = new Set(session.dice.map((_, i) => i));
  session.over = null;
  session.hint = !!session.level.hintDir;
  hideModal();
  boardToken = '';
  updateHud();
  present(playBoard(), session.selected, null);
}

function undoPlay() {
  if (busy || !session?.history.length || session.over === 'clear') return;
  const prev = session.history.pop();
  session.dice = prev.dice;
  session.ground = cloneGround(prev.ground);
  session.movesLeft = prev.movesLeft;
  session.selected = new Set(prev.selected);
  session.over = null;
  hideModal();
  boardToken = '';
  updateHud();
  present(playBoard(), session.selected, null);
}

async function playRoll(screenDir) {
  if (busy || !session || session.over || view.cameraBusy() || !modal.hidden) return;
  const dir = view.screenToWorld(screenDir);
  if (!dir) return;
  session.hint = false;
  updateHud();
  if (!session.selected.size) {
    toast('ダイスを選んでください');
    return;
  }
  const result = turn(session.dice, session.ground, [...session.selected], dir);
  if (result.reason === 'blocked') {
    busy = true;
    audio.blocked();
    toast('ダイスが重なります');
    try { await view.shake([...session.selected], settings.reduced); } finally { busy = false; }
    return;
  }
  busy = true;
  try {
    const before = cloneDice(session.dice);
    session.history.push({
      dice: before,
      ground: cloneGround(session.ground),
      movesLeft: session.movesLeft,
      selected: [...session.selected],
    });
    session.movesLeft -= 1;
    audio.roll();
    buzz(12);
    if (result.reason === 'fall') {
      await view.animateRoll({
        before,
        after: result.dice,
        dir: result.actualDir,
        falling: result.falling || [],
        reduced: settings.reduced,
      });
      audio.fail();
      buzz([30, 40, 70]);
      session.over = 'fall';
      showFail();
    } else {
      await view.animateRoll({
        before,
        after: result.rolled,
        dir: result.actualDir,
        falling: [],
        reduced: settings.reduced,
      });
      if (result.slides.length) {
        await view.animateCarry(result.slides, result.rolled, result.dice, settings.reduced);
      }
      if (result.crumbled.length) {
        await view.animateCrumble(result.crumbled, settings.reduced);
      }
      session.dice = result.dice;
      session.ground = cloneGround(result.ground);
      boardToken = '';
      present(playBoard(), session.selected, null);
      const cleared = isClear(session.dice, session.level.goals);
      if (result.crumbled.length && !cleared) toast('床が崩れました');
      if (cleared) {
        audio.clear();
        buzz([16, 24, 16]);
        session.over = 'clear';
        onCleared();
      } else if (session.movesLeft <= 0) {
        audio.fail();
        buzz([40, 30, 70]);
        session.over = 'limit';
        showFail();
      }
    }
    updateHud();
  } finally {
    busy = false;
  }
}

function pushEditor() {
  editor.history.push(structuredClone(editor.level));
  if (editor.history.length > 40) editor.history.shift();
}

function undoEditor() {
  if (busy || !editor.history.length) return;
  editor.level = editor.history.pop();
  editor.selected = new Set(editor.level.dice.map((_, i) => i));
  presentEditor(true);
  persistDraft();
}

function mutate(change) {
  pushEditor();
  change();
  presentEditor(true);
  persistDraft();
}

function refreshEditorChrome() {
  const level = editor.level;
  const nameInput = $('ed-name');
  if (document.activeElement !== nameInput) nameInput.value = level.name;
  $('ed-mov').textContent = String(level.moves);
  for (const button of $('ed-tools').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', button.dataset.tool === editor.tool ? 'true' : 'false');
  }
  $('ed-tool-help').textContent = TOOL_HELP[editor.tool];
  const directing = editor.tool === 'roll' || editor.tool === 'face';
  $('ed-dpad').hidden = !directing;
  $('ed-select-row').hidden = !directing;
  const problems = issues(level);
  const verified = canonical(level) === editor.verifiedHash;
  const already = isClear(level.dice, level.goals);
  let status = '出力するには、テストで最初からクリアしてください。';
  if (problems.length) status = problems[0];
  else if (already) status = '最初から揃っています。向きか位置を崩してください。';
  else if (verified) status = 'クリア確認済みです。出力できます。';
  $('ed-status').textContent = status;
  $('ed-export').disabled = !(verified && !problems.length && !already);
  $('ed-export').classList.toggle('ready', !$('ed-export').disabled);
  $('ed-test').disabled = problems.length > 0 || already;
}

function presentEditor(rebuild) {
  if (rebuild) boardToken = '';
  present(editor.level, editor.selected, ghostCells(editor.level));
  refreshEditorChrome();
}

function toggleSelect(set, index) {
  if (set.has(index)) set.delete(index);
  else set.add(index);
  audio.select();
}

function onPick(x, y) {
  if (!modal.hidden || busy) return;
  const hit = view.pick(x, y);
  if (scene === 'play') {
    if (!session || session.over || !hit || hit.kind !== 'die') return;
    toggleSelect(session.selected, hit.index);
    view.syncDice(session.dice, session.level.goals, session.selected);
    updateHud();
    return;
  }
  if (scene !== 'editor' || !hit) return;
  const level = editor.level;
  const ground = groundSet(level.ground);
  if (editor.tool === 'roll' || editor.tool === 'face') {
    if (hit.kind === 'die') {
      toggleSelect(editor.selected, hit.index);
      view.syncDice(level.dice, level.goals, editor.selected);
    }
    return;
  }
  if (editor.tool === 'ground') {
    if (hit.kind === 'die') {
      toast('先にダイスを外してください');
      return;
    }
    const key = cellKey(hit.x, hit.z);
    const has = ground.has(key);
    if (has && level.goals.some((goal) => goal.x === hit.x && goal.z === hit.z)) {
      toast('先にゴールを外してください');
      return;
    }
    mutate(() => {
      if (has) level.ground = level.ground.filter((cell) => cellKey(cell.x, cell.z) !== key);
      else level.ground.push({ x: hit.x, z: hit.z });
    });
    return;
  }
  if (editor.tool === 'goal') {
    const cell = hit.kind === 'die' ? level.dice[hit.index] : hit;
    if (!ground.has(cellKey(cell.x, cell.z))) {
      toast('先に地面を置いてください');
      return;
    }
    mutate(() => {
      const exists = level.goals.some((goal) => goal.x === cell.x && goal.z === cell.z);
      level.goals = exists
        ? level.goals.filter((goal) => !(goal.x === cell.x && goal.z === cell.z))
        : level.goals.concat([{ x: cell.x, z: cell.z }]);
    });
    return;
  }
  if (editor.tool === 'slide' || editor.tool === 'flip' || editor.tool === 'crumb') {
    if (hit.kind === 'die') {
      toast('先にダイスを外してください');
      return;
    }
    const key = cellKey(hit.x, hit.z);
    if (!ground.has(key)) {
      toast('先に地面を置いてください');
      return;
    }
    mutate(() => {
      const cell = level.ground.find((item) => cellKey(item.x, item.z) === key);
      if (!cell) return;
      if (editor.tool === 'slide') {
        const order = ['E', 'S', 'W', 'N'];
        if (cell.kind !== 'slide') {
          cell.kind = 'slide';
          cell.dir = 'E';
        } else {
          const next = order.indexOf(cell.dir) + 1;
          if (next >= order.length) {
            delete cell.kind;
            delete cell.dir;
          } else cell.dir = order[next];
        }
        return;
      }
      if (cell.kind === editor.tool) {
        delete cell.kind;
        delete cell.dir;
      } else {
        cell.kind = editor.tool;
        delete cell.dir;
      }
    });
    return;
  }
  if (editor.tool === 'die') {
    if (hit.kind === 'die') {
      mutate(() => {
        level.dice.splice(hit.index, 1);
        editor.selected = new Set(level.dice.map((_, i) => i));
      });
      return;
    }
    if (!ground.has(cellKey(hit.x, hit.z))) {
      toast('先に地面を置いてください');
      return;
    }
    if (level.dice.some((die) => die.x === hit.x && die.z === hit.z)) return;
    mutate(() => {
      level.dice.push({ x: hit.x, z: hit.z, faces: { ...FRONT_FACES } });
      editor.selected = new Set([level.dice.length - 1]);
    });
  }
}

async function editorDirection(screenDir) {
  if (busy || view.cameraBusy() || !modal.hidden) return;
  const dir = view.screenToWorld(screenDir);
  if (!dir) return;
  if (!editor.selected.size) {
    toast('ダイスを選んでください');
    return;
  }
  if (editor.tool === 'face') {
    mutate(() => {
      for (const index of editor.selected) {
        editor.level.dice[index].faces = rollFaces(editor.level.dice[index].faces, dir);
      }
    });
    audio.roll();
    return;
  }
  if (editor.tool !== 'roll') return;
  const result = turn(editor.level.dice, editor.level.ground, [...editor.selected], dir);
  if (!result.ok) {
    audio.blocked();
    toast(result.reason === 'fall' ? 'そこには地面がありません' : 'ダイスが重なります');
    busy = true;
    try { await view.shake([...editor.selected], settings.reduced); } finally { busy = false; }
    return;
  }
  const before = cloneDice(editor.level.dice);
  pushEditor();
  busy = true;
  try {
    audio.roll();
    await view.animateRoll({
      before,
      after: result.rolled,
      dir: result.actualDir,
      falling: [],
      reduced: settings.reduced,
    });
    if (result.slides.length) {
      await view.animateCarry(result.slides, result.rolled, result.dice, settings.reduced);
    }
    if (result.crumbled.length) {
      await view.animateCrumble(result.crumbled, settings.reduced);
    }
    editor.level.dice = result.dice;
    editor.level.ground = cloneGround(result.ground);
    boardToken = '';
    presentEditor(false);
    persistDraft();
  } finally {
    busy = false;
  }
}

function onScreenDir(screenDir) {
  if (scene === 'play') playRoll(screenDir);
  else if (scene === 'editor') editorDirection(screenDir);
}

function exportLevel() {
  const level = editor.level;
  const problems = issues(level);
  if (problems.length) {
    toast(problems[0]);
    return;
  }
  if (isClear(level.dice, level.goals)) {
    toast('最初から揃っている配置は出力できません');
    return;
  }
  if (canonical(level) !== editor.verifiedHash) {
    toast('最初からクリアした配置だけ出力できます');
    return;
  }
  const text = serializeLevel(level);
  const blob = new Blob([text], { type: 'application/json' });
  const link = document.createElement('a');
  const slug = level.name.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]+/g, '').slice(0, 24) || 'stage';
  link.href = URL.createObjectURL(blob);
  link.download = `saikorokoro-${slug}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  const id = customId(level);
  const data = JSON.parse(text);
  save.custom = save.custom.filter((entry) => entry.id !== id);
  save.custom.push({ id, data });
  write();
  toast('出力しました。ステージ選択にも入っています');
}

function openImport(target) {
  importTarget = target;
  fileInput.value = '';
  fileInput.click();
}

async function onFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = parseLevel(JSON.parse(await file.text()));
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    if (importTarget === 'editor') {
      editor.level = parsed.level;
      editor.verifiedHash = null;
      editor.history = [];
      editor.selected = new Set(parsed.level.dice.map((_, i) => i));
      editor.tool = 'roll';
      presentEditor(true);
      persistDraft();
      toast('読み込みました。出力するには、もう一度クリアしてください');
      return;
    }
    const id = customId(parsed.level);
    save.custom = save.custom.filter((entry) => entry.id !== id);
    save.custom.push({ id, data: JSON.parse(serializeLevel(parsed.level)) });
    write();
    previewId = id;
    if (scene !== 'stages') go('stages');
    else renderStages();
    toast('ステージに追加しました');
  } catch {
    toast('このファイルは読めません');
  }
}

function confirmLeave(run) {
  if (scene === 'play' && session && session.history.length && !session.over) {
    showModal({
      title: '中断しますか',
      text: 'いまの手順は破棄されます。',
      actions: [
        { label: 'もどる', primary: true, run },
        { label: 'つづける', escape: true, run: () => {} },
      ],
    });
    return;
  }
  run();
}

function bind() {
  $('title-play').addEventListener('click', () => { audio.click(); go('stages'); });
  $('title-edit').addEventListener('click', () => { audio.click(); go('editor'); });
  $('title-help').addEventListener('click', () => { audio.click(); go('help'); });
  $('title-settings').addEventListener('click', () => { audio.click(); go('settings'); });
  $('help-back').addEventListener('click', () => go('title'));
  $('settings-back').addEventListener('click', () => go('title'));
  $('stages-back').addEventListener('click', () => go('title'));
  $('stage-start').addEventListener('click', () => {
    const level = findLevel(previewId);
    if (level) startSession(level, false);
  });
  $('stages-import').addEventListener('click', () => openImport('play'));
  $('play-back').addEventListener('click', () => confirmLeave(() => (session?.testing ? go('editor') : go('stages'))));
  $('play-all').addEventListener('click', () => {
    if (!session) return;
    session.selected = new Set(session.dice.map((_, i) => i));
    view.syncDice(session.dice, session.level.goals, session.selected);
    updateHud();
  });
  $('play-none').addEventListener('click', () => {
    if (!session) return;
    session.selected = new Set();
    view.syncDice(session.dice, session.level.goals, session.selected);
    updateHud();
  });
  $('play-undo').addEventListener('click', undoPlay);
  $('play-restart').addEventListener('click', restart);
  $('play-cam').addEventListener('click', () => view.cycleCamera());
  $('play-layout').addEventListener('click', () => {
    settings.sideControls = !settings.sideControls;
    write();
    applySettings();
    audio.click();
    boardToken = '';
    presentFixed();
  });
  $('ed-back').addEventListener('click', () => go('title'));
  $('ed-cam').addEventListener('click', () => view.cycleCamera());
  $('ed-undo').addEventListener('click', undoEditor);
  $('ed-reset').addEventListener('click', () => {
    showModal({
      title: '初期化しますか',
      text: 'いまの配置を、練習用の初期ステージに戻します。',
      actions: [
        {
          label: '初期化する',
          primary: true,
          run: () => {
            editor.level = starterLevel();
            editor.verifiedHash = null;
            editor.history = [];
            editor.selected = new Set([0]);
            presentEditor(true);
            persistDraft();
          },
        },
        { label: 'やめる', escape: true, run: () => {} },
      ],
    });
  });
  $('ed-name').addEventListener('input', (event) => {
    editor.level.name = event.target.value.slice(0, 24);
    refreshEditorChrome();
    persistDraft();
  });
  $('ed-mov-dec').addEventListener('click', () => {
    if (editor.level.moves <= 1) return;
    mutate(() => { editor.level.moves -= 1; });
  });
  $('ed-mov-inc').addEventListener('click', () => {
    if (editor.level.moves >= 30) return;
    mutate(() => { editor.level.moves += 1; });
  });
  $('ed-tools').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    editor.tool = button.dataset.tool;
    refreshEditorChrome();
  });
  $('ed-all').addEventListener('click', () => {
    editor.selected = new Set(editor.level.dice.map((_, i) => i));
    view.syncDice(editor.level.dice, editor.level.goals, editor.selected);
  });
  $('ed-none').addEventListener('click', () => {
    editor.selected = new Set();
    view.syncDice(editor.level.dice, editor.level.goals, editor.selected);
  });
  $('ed-test').addEventListener('click', () => {
    const problems = issues(editor.level);
    if (problems.length) {
      toast(problems[0]);
      return;
    }
    if (isClear(editor.level.dice, editor.level.goals)) {
      toast('最初から揃っています。条件を崩してください');
      return;
    }
    startSession(editor.level, true);
  });
  $('ed-export').addEventListener('click', exportLevel);
  $('ed-import').addEventListener('click', () => openImport('editor'));
  for (const pad of [ $('play-dpad'), $('ed-dpad') ]) {
    pad.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (button) onScreenDir(button.dataset.dir);
    });
  }
  $('set-volume').addEventListener('input', (event) => {
    settings.volume = Number(event.target.value) / 100;
    audio.setVolume(settings.volume);
    audio.click();
    write();
  });
  $('set-numbers').addEventListener('change', (event) => {
    settings.numbers = event.target.checked;
    write();
    applySettings();
    boardToken = '';
    presentFixed();
  });
  $('set-reduced').addEventListener('change', (event) => {
    settings.reduced = event.target.checked;
    write();
    applySettings();
    if (session) updateHud();
  });
  $('set-flip').addEventListener('change', (event) => {
    settings.flip = event.target.checked;
    write();
    applySettings();
  });
  $('set-vibrate').addEventListener('change', (event) => {
    settings.vibrate = event.target.checked;
    write();
  });
  $('set-wipe').addEventListener('click', () => {
    showModal({
      title: '記録を消しますか',
      text: 'クリア記録、マイステージ、デザイン中の下書きを消します。',
      actions: [
        {
          label: '消す',
          primary: true,
          run: () => {
            save.cleared = {};
            save.custom = [];
            save.draft = null;
            write();
            loadDraft();
            previewId = null;
            toast('消しました');
          },
        },
        { label: 'やめる', escape: true, run: () => {} },
      ],
    });
  });
  fileInput.addEventListener('change', onFile);
  window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
  window.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea')) return;
    const screen = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyW: 'up',
      KeyA: 'left',
      KeyS: 'down',
      KeyD: 'right',
    }[event.code];
    if (screen && (scene === 'play' || scene === 'editor')) {
      event.preventDefault();
      onScreenDir(screen);
      return;
    }
    if ((event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) || event.code === 'KeyU') {
      event.preventDefault();
      if (scene === 'play') undoPlay();
      if (scene === 'editor') undoEditor();
    } else if (event.code === 'KeyR' && scene === 'play' && modal.hidden) {
      restart();
    } else if (event.code === 'KeyC' && (scene === 'play' || scene === 'editor')) {
      view.cycleCamera();
    } else if (event.code === 'Escape') {
      const escape = modal.querySelector('[data-escape]');
      if (!modal.hidden && escape) escape.click();
      else if (scene === 'play') $('play-back').click();
      else if (scene === 'editor') go('title');
      else if (scene !== 'title') go('title');
    } else if (event.code === 'Enter' && scene === 'stages' && modal.hidden && event.target === document.body) {
      $('stage-start').click();
    }
  });
  let swipe = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.hypot(dx, dy) >= 24) {
      onScreenDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    } else onPick(event.clientX, event.clientY);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('resize', () => {
    view.resize();
    boardToken = '';
    presentFixed();
  });
}

function boot() {
  save.custom = save.custom.filter((entry) => entry?.data && parseLevel(entry.data).ok);
  loadDraft();
  applySettings();
  bind();
  view.resize();
  go('title');
}

boot();
