export class AudioDirector {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicTimer = null;
    this.step = 0;
    this.droneNodes = [];
    this.volume = 0.72;
  }

  async unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.sfxBus = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.22;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(this.context.destination);
    this.master.gain.value = this.volume;
    this.startDrone();
    if (this.musicEnabled) this.startMusic();
  }

  startDrone() {
    const ctx = this.context;
    const pad = ctx.createGain();
    pad.gain.value = 0.11;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.8;
    pad.connect(filter);
    filter.connect(this.musicBus);
    [41.2, 61.74, 82.41, 123.47].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 2 ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = index % 2 ? -4 : 3;
      gain.gain.value = index === 0 ? 0.34 : 0.12;
      osc.connect(gain);
      gain.connect(pad);
      osc.start();
      this.droneNodes.push(osc, gain);
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.075;
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.droneNodes.push(lfo, lfoGain, pad, filter);
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.22;
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.45;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.035;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.musicBus);
    noise.start();
    this.droneNodes.push(noise, noiseFilter, noiseGain);
  }

  startMusic() {
    if (!this.context || this.musicTimer) return;
    const sequence = [0, 3, 7, 10, 7, 5, 3, 12, 10, 7, 5, 2, 3, 7, 10, 14];
    const scale = [0, 2, 3, 7, 10, 12, 14, 15];
    this.musicTimer = window.setInterval(() => {
      if (!this.context || !this.enabled || !this.musicEnabled || this.context.state !== 'running') return;
      const ctx = this.context;
      const note = sequence[this.step % sequence.length];
      const semitone = scale[note % scale.length];
      const base = 110 * Math.pow(2, semitone / 12);
      const t = ctx.currentTime + 0.02;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, t);
      osc.detune.setValueAtTime(this.step % 4 === 0 ? -7 : 4, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900 + (this.step % 4) * 180, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.045, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 1.1);
      if (this.step % 4 === 0) this.lowPulse(48 + (this.step % 3) * 5, 0.55);
      this.step += 1;
    }, 520);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  lowPulse(frequency = 48, duration = 0.45) {
    if (!this.context || !this.musicEnabled || !this.enabled) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * 1.6, t);
    osc.frequency.exponentialRampToValueAtTime(frequency, t + duration);
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  tone({ frequency = 220, endFrequency = 90, duration = 0.14, type = 'sine', gain = 0.12, filter = 2400, bus = 'sfx' } = {}) {
    if (!this.context || !this.enabled || (bus === 'sfx' && !this.sfxEnabled)) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, frequency), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + duration);
    filt.type = 'lowpass';
    filt.frequency.value = filter;
    filt.Q.value = 0.6;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.018, duration * 0.2));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(filt);
    filt.connect(amp);
    amp.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.025);
  }

  noise({ duration = 0.18, gain = 0.1, lowpass = 1800, highpass = 120 } = {}) {
    if (!this.context || !this.enabled || !this.sfxEnabled) return;
    const ctx = this.context;
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
    source.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = highpass;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = lowpass;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(hp); hp.connect(lp); lp.connect(amp); amp.connect(this.sfxBus);
    source.start();
  }

  play(event, intensity = 1) {
    if (!this.context || !this.enabled || !this.sfxEnabled) return;
    const i = Math.max(0.35, Math.min(2.2, intensity));
    const sounds = {
      shot: () => { this.tone({ frequency: 510, endFrequency: 170, duration: 0.095, type: 'sawtooth', gain: 0.065 * i, filter: 1800 }); this.noise({ duration: 0.055, gain: 0.028 * i, lowpass: 2200, highpass: 500 }); },
      hit: () => { this.tone({ frequency: 190, endFrequency: 68, duration: 0.13, type: 'triangle', gain: 0.08 * i, filter: 950 }); this.noise({ duration: 0.07, gain: 0.035 * i, lowpass: 1100 }); },
      crit: () => { this.tone({ frequency: 880, endFrequency: 220, duration: 0.22, type: 'sine', gain: 0.12 * i, filter: 3200 }); this.tone({ frequency: 1320, endFrequency: 660, duration: 0.12, type: 'triangle', gain: 0.045 * i }); },
      dash: () => { this.noise({ duration: 0.24, gain: 0.12 * i, lowpass: 1500, highpass: 170 }); this.tone({ frequency: 310, endFrequency: 70, duration: 0.28, type: 'sawtooth', gain: 0.06 * i, filter: 700 }); },
      pulse: () => { this.tone({ frequency: 72, endFrequency: 36, duration: 0.75, type: 'sine', gain: 0.19 * i, filter: 240 }); this.tone({ frequency: 440, endFrequency: 70, duration: 0.5, type: 'triangle', gain: 0.11 * i, filter: 1200 }); this.noise({ duration: 0.4, gain: 0.11 * i, lowpass: 1800 }); },
      hurt: () => { this.tone({ frequency: 145, endFrequency: 48, duration: 0.32, type: 'sawtooth', gain: 0.14 * i, filter: 430 }); },
      pickup: () => { this.tone({ frequency: 640, endFrequency: 980, duration: 0.16, type: 'sine', gain: 0.07 * i, filter: 2600 }); },
      upgrade: () => { [392, 523, 659].forEach((frequency, index) => window.setTimeout(() => this.tone({ frequency, endFrequency: frequency * 1.25, duration: 0.28, type: 'sine', gain: 0.08 * i, filter: 3000 }), index * 85)); },
      boss: () => { this.lowPulse(34, 1.2); this.tone({ frequency: 82, endFrequency: 42, duration: 1.1, type: 'sawtooth', gain: 0.17 * i, filter: 320 }); this.noise({ duration: 0.8, gain: 0.1 * i, lowpass: 650, highpass: 60 }); },
      win: () => { [220, 277, 330, 440, 554].forEach((frequency, index) => window.setTimeout(() => this.tone({ frequency, endFrequency: frequency, duration: 0.75, type: 'sine', gain: 0.09 * i, filter: 2200 }), index * 120)); },
      defeat: () => { this.tone({ frequency: 180, endFrequency: 28, duration: 1.4, type: 'sawtooth', gain: 0.16 * i, filter: 320 }); }
    };
    sounds[event]?.();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.context.currentTime, 0.04);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.06);
    if (enabled) this.startMusic(); else this.stopMusic();
  }

  setSfxEnabled(enabled) { this.sfxEnabled = enabled; }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.05);
  }

  dispose() {
    this.stopMusic();
    for (const node of this.droneNodes) {
      try { node.stop?.(); node.disconnect?.(); } catch {}
    }
    this.droneNodes.length = 0;
    this.context?.close();
    this.context = null;
  }
}
