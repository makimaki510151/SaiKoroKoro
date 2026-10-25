export function createAudio() {
  let ctx = null;
  let master = null;
  let volume = 0.7;

  function ensure() {
    if (volume <= 0) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    master.gain.value = volume;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay = 0) {
    const ac = ensure();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain) {
    const ac = ensure();
    if (!ac) return;
    const count = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, count, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    setVolume(v) {
      volume = v;
      if (master) master.gain.value = v;
    },
    unlock() {
      ensure();
    },
    click() {
      tone(620, 0.05, 'sine', 0.04);
    },
    select() {
      tone(480, 0.04, 'sine', 0.035);
    },
    roll() {
      noise(0.09, 0.08);
      tone(150, 0.1, 'triangle', 0.05);
    },
    blocked() {
      tone(96, 0.09, 'square', 0.03);
    },
    fail() {
      tone(220, 0.16, 'sine', 0.05);
      tone(140, 0.22, 'sine', 0.04, 0.08);
    },
    clear() {
      tone(523, 0.12, 'sine', 0.05);
      tone(659, 0.12, 'sine', 0.05, 0.09);
      tone(784, 0.2, 'sine', 0.05, 0.18);
    },
  };
}
