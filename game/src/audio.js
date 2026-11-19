// Synthesized sound only: every effect is built with WebAudio oscillators and
// filtered noise, so the game ships no audio files and makes no network request.
// The context starts on the first user gesture; every call is safe before that.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: two detuned saws through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 58;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Police siren: a sine that alternates between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ensure()) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound never breaks the game.
    }
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t = ctx.currentTime + when;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch {
      // Sound never breaks the game.
    }
  }

  return {
    /** Call from any user gesture; resumes a suspended context. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    /** Engine hum follows how fast the player is driving, 0 to 1. */
    engine(amount, inCar) {
      if (!ensure()) return;
      try {
        const target = inCar ? 0.05 + amount * 0.11 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        const freq = 52 + amount * 110;
        engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(freq * 1.02 + 3, ctx.currentTime, 0.08);
      } catch {
        // Sound never breaks the game.
      }
    },
    /** The two-tone police siren, on while any wanted stars are up. */
    siren(on, dt) {
      if (!ensure()) return;
      try {
        if (on) {
          sirenTimer += dt;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 920 : 660, ctx.currentTime, 0.03);
          }
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        }
      } catch {
        // Sound never breaks the game.
      }
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 2400);
    },
    thugShot() {
      noiseBurst(0.12, 0.22, 1800);
    },
    punch() {
      noiseBurst(0.08, 0.35, 500);
    },
    crash() {
      noiseBurst(0.25, 0.45, 900);
    },
    click() {
      tone(880, 0.06, 'square', 0.08);
    },
    chime() {
      tone(523, 0.16, 'sine', 0.16);
      tone(659, 0.16, 'sine', 0.16, 0.09);
      tone(784, 0.28, 'sine', 0.18, 0.18);
    },
    fail() {
      tone(220, 0.3, 'sawtooth', 0.1);
      tone(165, 0.45, 'sawtooth', 0.1, 0.16);
    },
  };
}
