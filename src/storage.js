const KEY = 'saikorokoro-v1';

function defaults() {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    settings: { volume: 0.7, numbers: false, reduced, flip: false, vibrate: true, sideControls: false },
    cleared: {},
    custom: [],
    draft: null,
  };
}

export function loadSave() {
  const base = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      settings: { ...base.settings, ...(raw.settings || {}) },
      cleared: raw.cleared && typeof raw.cleared === 'object' ? raw.cleared : {},
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      draft: raw.draft || null,
    };
  } catch {
    return base;
  }
}

export function writeSave(save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}
