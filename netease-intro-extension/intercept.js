// Core interceptor (MAIN world)
// Supports two adapter modes:
//   - 'play_intercept': hook HTMLMediaElement.prototype.play (Netease)
//   - 'observer':       watch DOM via adapter.watch(cb), pause/resume via adapter.pause()/resume() (QQ)

(function () {
  const adapter = window.__NETEASE_INTRO_ADAPTER__;
  if (!adapter) return;

  let enabled = true;
  let voicePref = 'browser';
  let activeIntro = null; // { token, introAudio, resolve, onDone }

  // --- Mode dispatch ---
  if (adapter.mode === 'observer') {
    initObserverMode();
  } else {
    initPlayInterceptMode();
  }

  // ========== Play-intercept mode (Netease) ==========
  function initPlayInterceptMode() {
    let lastSrc = '';
    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function () {
      const audio = this;

      if (audio.__neteaseIntro) return originalPlay.apply(audio, arguments);

      if (
        !adapter.isPlayerAudio(audio) ||
        !enabled ||
        audio.src === lastSrc
      ) {
        return originalPlay.apply(audio, arguments);
      }

      stopActiveIntro();
      lastSrc = audio.src;
      try { audio.pause(); } catch (e) {}

      const myToken = {};
      const myIntro = { token: myToken };
      activeIntro = myIntro;

      return new Promise((resolve, reject) => {
        myIntro.resolve = resolve;

        const resumePlayback = () => {
          // If crossfade is already running, the song is playing and ramping;
          // just resolve the page's play() promise — fade interval cleans up activeIntro itself.
          if (myIntro.crossfadeStarted) {
            resolve();
            return;
          }
          if (activeIntro && activeIntro.token === myToken) activeIntro = null;
          originalPlay.apply(audio).then(resolve).catch(reject);
        };

        runIntroFlow(
          myToken,
          resumePlayback,
          () => activeIntro && activeIntro.token === myToken,
          myIntro,
          undefined,
          500,
          { songAudio: audio, originalPlay } // enable crossfade
        );
      });
    };
  }

  // ========== Observer mode (QQ Music) ==========
  function initObserverMode() {
    adapter.watch(async (songInfo) => {
      if (!enabled) return;
      stopActiveIntro();

      // Pause the song while intro plays
      try {
        if (adapter.pause) await adapter.pause();
      } catch (e) {}

      const myToken = {};
      const myIntro = { token: myToken };
      activeIntro = myIntro;

      const resumePlayback = () => {
        if (activeIntro && activeIntro.token === myToken) activeIntro = null;
        try { adapter.resume && adapter.resume(); } catch (e) {}
      };

      // Run with pre-fetched songInfo (skip the 500ms wait — observer already knows the new song)
      runIntroFlow(myToken, resumePlayback, () => activeIntro && activeIntro.token === myToken, myIntro, songInfo, 0);
    });
  }

  // ========== Shared intro flow ==========
  function runIntroFlow(myToken, onComplete, stillValid, myIntro, preSongInfo, delay, fadeCtx) {
    const wait = typeof delay === 'number' ? delay : 500;

    setTimeout(async () => {
      if (!stillValid()) return;

      const info = preSongInfo || adapter.getSongInfo();
      if (!info || !info.name) { onComplete(); return; }

      const aiResponse = await requestAiIntro(info);
      if (!stillValid()) return;

      const text = (aiResponse && aiResponse.text)
        ? aiResponse.text
        : (info.artist
            ? `接下来为您播放：${info.name}，演唱：${info.artist}`
            : `接下来为您播放：${info.name}`);

      const done = () => { if (stillValid()) onComplete(); };

      if (aiResponse && aiResponse.audioUrl) {
        const a = new Audio(aiResponse.audioUrl);
        a.__neteaseIntro = true;
        myIntro.introAudio = a;

        // Crossfade: start the real song quietly in the last X seconds of the intro
        if (fadeCtx && fadeCtx.songAudio) {
          setupCrossfade(a, myIntro, stillValid, fadeCtx);
        }

        a.onended = done;
        a.onerror = () => speakBrowser(text, done);
        a.play().catch(() => speakBrowser(text, done));
      } else {
        speakBrowser(text, done);
      }
    }, wait);
  }

  // === Fixed fade defaults (no UI knobs to keep things simple) ===
  const FADE_LEAD_MS = 6000;       // voice fade window (last 6s of intro audio)
  const POST_INTRO_RAMP_MS = 7000; // music keeps ramping this long after voice ends
  const VOICE_FLOOR = 0.5;         // voice never fades below this (until file ends)
  const SONG_DUCK_PEAK = 0.22;     // music max volume WHILE voice is still playing
  const SONG_CURVE_POWER = 2.0;    // higher = slower music entrance

  function setupCrossfade(introAudio, myIntro, stillValid, fadeCtx) {
    const { songAudio, originalPlay } = fadeCtx;

    let started = false;
    const monitor = setInterval(() => {
      if (!stillValid()) { clearInterval(monitor); return; }
      if (started) return;
      if (!introAudio.duration || !isFinite(introAudio.duration)) return;

      const remainingMs = (introAudio.duration - introAudio.currentTime) * 1000;
      if (remainingMs <= FADE_LEAD_MS && remainingMs > 0) {
        started = true;
        myIntro.crossfadeStarted = true;
        clearInterval(monitor);
        beginCrossfade(introAudio, songAudio, originalPlay, myIntro, Math.max(400, remainingMs), stillValid);
      }
    }, 80);

    myIntro.cancelFadeMonitor = () => clearInterval(monitor);
  }

  function beginCrossfade(introAudio, songAudio, origPlay, myIntro, durationMs, _stillValidArg) {
    // Use a fade-local "still valid" check: the fade must keep running even
    // after the intro audio ends naturally (otherwise the song stays stuck at
    // the duck-peak volume). It only stops if our myIntro is no longer active.
    const stillValid = () => activeIntro === myIntro;

    const originalVolume = songAudio.volume;
    myIntro.fadeRestore = () => { try { songAudio.volume = originalVolume; } catch (e) {} };

    songAudio.volume = 0;
    origPlay.apply(songAudio).catch(() => {});

    const songFadeMs = durationMs + POST_INTRO_RAMP_MS;
    const voicePhaseEnd = durationMs / songFadeMs; // songP value at which voice ends

    const startTime = Date.now();
    const fadeId = setInterval(() => {
      if (!stillValid()) { clearInterval(fadeId); return; }
      const elapsed = Date.now() - startTime;
      const introP = Math.min(elapsed / durationMs, 1);
      const songP = Math.min(elapsed / songFadeMs, 1);

      // Voice: cos curve mapped from [1, 0] → [1, VOICE_FLOOR]
      const voiceCurve = Math.cos(introP * Math.PI / 2);
      try {
        introAudio.volume = VOICE_FLOOR + (1 - VOICE_FLOOR) * voiceCurve;
      } catch (e) {}

      // Music in two phases:
      //   Phase 1 (while voice plays): 0 → SONG_DUCK_PEAK, very gentle curve
      //   Phase 2 (after voice ends):  SONG_DUCK_PEAK → 1.0, linear ramp
      let songFrac;
      if (songP <= voicePhaseEnd) {
        const phaseP = songP / voicePhaseEnd;
        songFrac = SONG_DUCK_PEAK * Math.pow(phaseP, SONG_CURVE_POWER);
      } else {
        const phaseP = (songP - voicePhaseEnd) / (1 - voicePhaseEnd);
        songFrac = SONG_DUCK_PEAK + (1 - SONG_DUCK_PEAK) * phaseP;
      }
      try { songAudio.volume = originalVolume * songFrac; } catch (e) {}

      if (songP >= 1) {
        clearInterval(fadeId);
        try { introAudio.volume = VOICE_FLOOR; } catch (e) {}
        try { songAudio.volume = originalVolume; } catch (e) {}
        // Fade done — release ownership so a fresh song can start a new intro
        if (activeIntro === myIntro) activeIntro = null;
      }
    }, 20);

    myIntro.fadeIntervalId = fadeId;
  }

  function stopActiveIntro() {
    if (!activeIntro) return;
    const old = activeIntro;
    activeIntro = null;

    if (old.cancelFadeMonitor) try { old.cancelFadeMonitor(); } catch (e) {}
    if (old.fadeIntervalId) try { clearInterval(old.fadeIntervalId); } catch (e) {}
    if (old.fadeRestore) try { old.fadeRestore(); } catch (e) {}

    try { speechSynthesis.cancel(); } catch (e) {}
    if (old.introAudio) {
      try {
        old.introAudio.onended = null;
        old.introAudio.onerror = null;
        old.introAudio.pause();
        old.introAudio.src = '';
      } catch (e) {}
    }
    if (old.resolve) {
      try { old.resolve(); } catch (e) {}
    }
  }

  // Score table for system TTS voices — higher = better quality.
  // Goal: when user picks "browser default", avoid the harsh Huihui voice
  // and prefer modern neural voices (Xiaoxiao, Yunxi, Google etc.) if installed.
  function scoreVoice(v) {
    const n = (v.name || '').toLowerCase();
    if (/xiaoxiao|晓晓/.test(n)) return 100;
    if (/yunxi|云希/.test(n)) return 95;
    if (/xiaoyi|晓伊/.test(n)) return 92;
    if (/yunyang|云扬/.test(n)) return 90;
    if (/yunjian|云健/.test(n)) return 88;
    if (/xiaochen|晓辰/.test(n)) return 85;
    if (/google/.test(n)) return 80;       // Google's zh-CN neural voice
    if (/tracy|hanhan/.test(n)) return 60;
    if (/yaoyao|kangkang/.test(n)) return 50;
    if (/huihui/.test(n)) return 10;       // notorious, harsh
    return 40;
  }

  function pickBestZhVoice() {
    const all = speechSynthesis.getVoices();
    const zh = all.filter(v => /^zh/i.test(v.lang));
    const pool = zh.length ? zh : all;
    if (!pool.length) return null;
    return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  function speakBrowser(text, onDone) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1.1;
    u.volume = 1.0;

    if (voicePref && voicePref.startsWith('browser:')) {
      // User explicitly picked a system voice
      const wanted = voicePref.slice(8);
      const v = speechSynthesis.getVoices().find(v => v.name === wanted);
      if (v) u.voice = v;
    } else if (voicePref === 'browser') {
      // Auto-pick the best installed Chinese voice (avoids Huihui by default)
      const best = pickBestZhVoice();
      if (best) u.voice = best;
    }

    u.onend = onDone;
    u.onerror = onDone;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function requestAiIntro(song) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2) + Date.now();
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 9000);

      function handler(event) {
        if (event.source !== window) return;
        const d = event.data;
        if (d && d.type === 'NETEASE_INTRO_RESPONSE' && d.requestId === requestId) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(d.response);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ type: 'NETEASE_INTRO_REQUEST', requestId, song, site: adapter.name }, '*');
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'NETEASE_INTRO_STATE') {
      if ('enabled' in event.data) enabled = event.data.enabled;
      if ('voice' in event.data) voicePref = event.data.voice;
      if (!enabled) {
        stopActiveIntro();
        try { adapter.resume && adapter.resume(); } catch (e) {}
      }
    }
  });
})();
