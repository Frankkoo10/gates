const SoundEngine = (() => {
    let ctx = null;
    let masterGain, musicGain, sfxGain;
    let musicPlaying = false;
    let musicTimers = [];
    let volume = 0.6;
    let muted = false;
    let bonusIntensity = false;
    let droneOscs = [];

    function init() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { return; }

        masterGain = ctx.createGain();
        masterGain.gain.value = muted ? 0 : volume;
        masterGain.connect(ctx.destination);

        musicGain = ctx.createGain();
        musicGain.gain.value = 0.30;
        musicGain.connect(masterGain);

        sfxGain = ctx.createGain();
        sfxGain.gain.value = 1;
        sfxGain.connect(masterGain);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function now() { return ctx ? ctx.currentTime : 0; }

    function tone(freq, dur, type, dest, opts) {
        if (!ctx) return;
        opts = opts || {};
        type = type || 'sine';
        dest = dest || sfxGain;
        const t0 = now() + (opts.delay || 0);
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (opts.glideTo) osc.frequency.linearRampToValueAtTime(opts.glideTo, t0 + dur);

        const g = ctx.createGain();
        const peak = opts.gain !== undefined ? opts.gain : 0.3;
        const attack = opts.attack !== undefined ? opts.attack : 0.01;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }

    function bell(freq, dur, dest, opts) {
        if (!ctx) return;
        opts = opts || {};
        dest = dest || sfxGain;
        const t0 = now() + (opts.delay || 0);
        const partials = [1, 2.01, 3.03, 4.2];
        const g = ctx.createGain();
        const peak = opts.gain !== undefined ? opts.gain : 0.25;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        g.connect(dest);

        partials.forEach((p, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * p, t0);
            const pg = ctx.createGain();
            pg.gain.value = 1 / (i + 1.5);
            osc.connect(pg);
            pg.connect(g);
            osc.start(t0);
            osc.stop(t0 + dur + 0.1);
        });
    }

    function noiseBurst(dur, dest, opts) {
        if (!ctx) return;
        opts = opts || {};
        dest = dest || sfxGain;
        const t0 = now() + (opts.delay || 0);
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = opts.filterType || 'bandpass';
        filter.frequency.setValueAtTime(opts.filterFreq || 1000, t0);
        if (opts.filterGlideTo) filter.frequency.linearRampToValueAtTime(opts.filterGlideTo, t0 + dur);
        filter.Q.value = opts.q || 1;

        const g = ctx.createGain();
        const peak = opts.gain !== undefined ? opts.gain : 0.3;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + (opts.attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        noise.connect(filter);
        filter.connect(g);
        g.connect(dest);
        noise.start(t0);
        noise.stop(t0 + dur + 0.05);
    }

    function thunder(opts) {
        if (!ctx) return;
        opts = opts || {};
        const d = opts.delay || 0;
        const g = opts.gain !== undefined ? opts.gain : 0.35;
        noiseBurst(0.08, sfxGain, { filterType: 'highpass', filterFreq: 3000, gain: g, attack: 0.001, delay: d });
        noiseBurst(2.0, sfxGain, { filterType: 'lowpass', filterFreq: 150, filterGlideTo: 40, gain: g * 0.8, attack: 0.05, delay: d + 0.05 });
    }

    function click() {
        tone(1100, 0.05, 'square', sfxGain, { gain: 0.12, attack: 0.002 });
    }

    function betChange() {
        tone(700, 0.06, 'square', sfxGain, { gain: 0.14, attack: 0.002 });
    }

    function toggleSwitch() {
        tone(500, 0.05, 'triangle', sfxGain, { gain: 0.15 });
        tone(900, 0.05, 'triangle', sfxGain, { gain: 0.15, delay: 0.05 });
    }

    function insufficientCredit() {
        tone(220, 0.25, 'sawtooth', sfxGain, { gain: 0.18, glideTo: 140 });
    }

    function spinStart() {
        noiseBurst(0.6, sfxGain, { filterType: 'bandpass', filterFreq: 250, filterGlideTo: 500, gain: 0.22, q: 0.6 });
        tone(180, 0.6, 'sawtooth', sfxGain, { gain: 0.08, glideTo: 260 });
    }

    function reelLand() {
        tone(160, 0.08, 'square', sfxGain, { gain: 0.16 });
        noiseBurst(0.06, sfxGain, { filterType: 'lowpass', filterFreq: 400, gain: 0.15 });
    }

    function tumbleWin(step) {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const idx = Math.min(step - 1, notes.length - 1);
        const octaveBoost = 1 + Math.floor((step - 1) / notes.length) * 0.05;
        bell(notes[idx] * octaveBoost, 0.5, sfxGain, { gain: 0.22 });
        noiseBurst(0.25, sfxGain, { filterType: 'bandpass', filterFreq: 2800, gain: 0.12, q: 3 });
    }

    function orbCollect(mult) {
        const base = 500 + Math.min(mult, 100) * 4;
        tone(base, 0.35, 'sine', sfxGain, { gain: 0.18, glideTo: base * 1.6, attack: 0.02 });
        bell(base * 1.5, 0.4, sfxGain, { gain: 0.15 });
    }

    function globalMultiplierRise() {
        [440, 554.37, 659.25, 880].forEach((f, i) => {
            bell(f, 0.4, sfxGain, { gain: 0.18, delay: i * 0.08 });
        });
        thunder({ gain: 0.2, delay: 0.1 });
    }

    function scatterTrigger() {
        thunder({ gain: 0.5 });
        [261.63, 329.63, 392.00, 523.25, 659.25].forEach((f, i) => {
            bell(f, 0.9, sfxGain, { gain: 0.22, delay: i * 0.12 });
        });
    }

    function freeSpinsEnd() {
        [783.99, 659.25, 523.25, 392.00].forEach((f, i) => {
            bell(f, 0.6, sfxGain, { gain: 0.2, delay: i * 0.15 });
        });
    }

    function maxWin() {
        thunder({ gain: 0.5 });
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
            bell(f, 1.0, sfxGain, { gain: 0.25, delay: i * 0.1 });
        });
    }

    const padChord = [110.00, 130.81, 164.81];
    const arpeggioScale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

    function startDrone() {
        stopDrone();
        padChord.forEach((f, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = 0;
            g.gain.linearRampToValueAtTime(0.10 - i * 0.02, now() + 3);
            osc.connect(g);
            g.connect(musicGain);
            osc.start();
            droneOscs.push(osc);

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.08 + i * 0.03;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 1.5;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.detune);
            lfo.start();
            droneOscs.push(lfo);
        });
    }

    function stopDrone() {
        droneOscs.forEach(osc => { try { osc.stop(); } catch (e) {} });
        droneOscs = [];
    }

    function scheduleArpeggio() {
        if (!musicPlaying) return;
        const stepTime = bonusIntensity ? 0.9 : 1.6;
        if (Math.random() < (bonusIntensity ? 0.85 : 0.55)) {
            const note = arpeggioScale[Math.floor(Math.random() * arpeggioScale.length)];
            bell(note, 1.4, musicGain, { gain: 0.09 });
        }
        musicTimers.push(setTimeout(scheduleArpeggio, stepTime * 1000));
    }

    function scheduleThunderAmbience() {
        if (!musicPlaying) return;
        const wait = (bonusIntensity ? 6000 : 14000) + Math.random() * (bonusIntensity ? 6000 : 12000);
        musicTimers.push(setTimeout(() => {
            if (musicPlaying) thunder({ gain: bonusIntensity ? 0.12 : 0.06 });
            scheduleThunderAmbience();
        }, wait));
    }

    function startMusic() {
        if (!ctx || musicPlaying) return;
        musicPlaying = true;
        startDrone();
        scheduleArpeggio();
        scheduleThunderAmbience();
    }

    function stopMusic() {
        musicPlaying = false;
        musicTimers.forEach(id => clearTimeout(id));
        musicTimers = [];
        stopDrone();
    }

    function setBonusMode(on) {
        bonusIntensity = !!on;
        if (musicGain && ctx) {
            musicGain.gain.setTargetAtTime(on ? 0.42 : 0.30, now(), 1.2);
        }
    }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05);
    }

    function toggleMute() {
        muted = !muted;
        if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05);
        return muted;
    }

    function isMuted() { return muted; }
    function getVolume() { return volume; }

    return {
        init, resume, click, betChange, toggleSwitch, insufficientCredit,
        spinStart, reelLand, tumbleWin, orbCollect, globalMultiplierRise,
        scatterTrigger, freeSpinsEnd, maxWin, startMusic, stopMusic,
        setBonusMode, setVolume, toggleMute, isMuted, getVolume
    };
})();
