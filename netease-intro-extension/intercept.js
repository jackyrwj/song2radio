// Core interceptor (MAIN world)
// Supports two adapter modes:
//   - 'play_intercept': hook HTMLMediaElement.prototype.play (Netease)
//   - 'observer':       watch DOM via adapter.watch(cb), pause/resume via adapter.pause()/resume() (QQ)

(function () {
  const adapter = window.__NETEASE_INTRO_ADAPTER__;
  if (!adapter) return;

  let enabled = true;
  let albumEnabled = true;
  let voicePref = 'Maia';
  let activeIntro = null; // { token, introAudio, resolve, onDone }
  const announcedAlbumKeys = new Set();
  let pageUi = null;
  let waitingUiTimer = null;
  let waitingUiRun = 0;

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
    if (adapter.hookMediaPlay) {
      initMediaPlayObserverMode();
    }

    adapter.watch(async (songInfo) => {
      if (!enabled) return false;
      if (adapter.isIntroActive && adapter.isIntroActive()) return false;
      stopActiveIntro();

      // Pause the song while intro plays
      let paused = true;
      try {
        if (adapter.pause) paused = await adapter.pause();
      } catch (e) {
        paused = false;
      }
      if (!paused) return false;

      const myToken = {};
      const myIntro = { token: myToken };
      activeIntro = myIntro;

      const resumePlayback = () => {
        if (activeIntro && activeIntro.token === myToken) activeIntro = null;
        try { adapter.resume && adapter.resume(); } catch (e) {}
      };

      // Run with pre-fetched songInfo (skip the 500ms wait — observer already knows the new song)
      runIntroFlow(myToken, resumePlayback, () => activeIntro && activeIntro.token === myToken, myIntro, songInfo, 0);
      return true;
    });
  }

  function initMediaPlayObserverMode() {
    let lastMediaKey = '';
    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function () {
      const media = this;

      if (media.__neteaseIntro) return originalPlay.apply(media, arguments);
      if (!enabled || (adapter.isPlayerAudio && !adapter.isPlayerAudio(media))) {
        return originalPlay.apply(media, arguments);
      }

      const mediaKey = media.currentSrc || media.src || `${media.tagName}:${Date.now()}`;
      if (mediaKey && mediaKey === lastMediaKey) {
        return originalPlay.apply(media, arguments);
      }

      stopActiveIntro();
      lastMediaKey = mediaKey;
      try { media.pause(); } catch (e) {}

      const myToken = {};
      const myIntro = { token: myToken };
      activeIntro = myIntro;
      if (adapter.setIntroActive) adapter.setIntroActive(true);

      return new Promise((resolve, reject) => {
        myIntro.resolve = resolve;

        const resumePlayback = () => {
          if (activeIntro && activeIntro.token === myToken) activeIntro = null;
          if (adapter.setIntroActive) adapter.setIntroActive(false);
          originalPlay.apply(media).then(resolve).catch(reject);
        };

        runIntroFlow(
          myToken,
          resumePlayback,
          () => activeIntro && activeIntro.token === myToken,
          myIntro,
          undefined,
          350
        );
      });
    };
  }

  // ========== Shared intro flow ==========
  function runIntroFlow(myToken, onComplete, stillValid, myIntro, preSongInfo, delay, fadeCtx) {
    const wait = typeof delay === 'number' ? delay : 500;

    setTimeout(async () => {
      if (!stillValid()) return;

      const info = preSongInfo || adapter.getSongInfo();
      if (!info || !info.name) { onComplete(); return; }
      prepareAlbumContext(info);
      if (adapter.markSongHandled) {
        try { adapter.markSongHandled(info); } catch (e) {}
      }

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

  function prepareAlbumContext(info) {
    info.site = adapter.name;
    if (!albumEnabled || !info.album) return;

    const normalizedAlbum = info.album.trim().toLocaleLowerCase();
    const normalizedArtist = (info.artist || '').trim().toLocaleLowerCase();
    const albumKey = info.albumId
      ? `${adapter.name}:id:${info.albumId}`
      : `${adapter.name}:name:${normalizedAlbum}|${normalizedArtist}`;

    info.albumKey = albumKey;
    if (announcedAlbumKeys.has(albumKey)) return;
    announcedAlbumKeys.add(albumKey);
    info.includeAlbumIntro = true;
  }

  // ========== In-page waiting progress ==========
  initWaitingIndicator();

  function initWaitingIndicator() {
    const mount = () => {
      const anchor = adapter.getProgressAnchor ? adapter.getProgressAnchor() : null;
      if (!anchor) return;
      if (!pageUi || !pageUi.host.isConnected) createWaitingIndicator(anchor);
      else if (pageUi.host.parentElement !== anchor) anchor.appendChild(pageUi.host);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    }
    mount();
    setInterval(mount, 750);
  }

  function createWaitingIndicator(anchor) {
    const host = document.createElement('div');
    host.id = 'diantai-qingge-progress';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: absolute;
        inset: 0;
        z-index: 2147483646;
        display: block;
        pointer-events: none;
      }
      * { box-sizing: border-box; }
      .waiting-track {
        position: absolute;
        inset: 50% 0 auto;
        height: 4px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 184, 164, 0.22);
        opacity: 0;
        transform: translateY(-50%);
        transition-property: opacity;
        transition-duration: 150ms;
      }
      .waiting-track[data-visible="true"] { opacity: 1; }
      .waiting-bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ff705f, #ffb18f 62%, #fff0d2);
        box-shadow: 0 0 8px rgba(255, 112, 95, 0.72);
        transition-property: width;
        transition-duration: 320ms;
        transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .waiting-track, .waiting-bar { transition-duration: 0ms; }
      }
      @media (forced-colors: active) {
        .waiting-bar { background: Highlight; box-shadow: none; }
      }
    `;

    const track = document.createElement('div');
    track.className = 'waiting-track';
    track.dataset.visible = 'false';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'AI 口播准备进度');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', '0');
    const bar = document.createElement('div');
    bar.className = 'waiting-bar';
    track.appendChild(bar);

    shadow.append(style, track);
    anchor.appendChild(host);
    pageUi = { host, track, bar };
  }

  function startWaitingUi(song) {
    if (!pageUi || !pageUi.host.isConnected) {
      const anchor = adapter.getProgressAnchor ? adapter.getProgressAnchor() : null;
      if (anchor) createWaitingIndicator(anchor);
    }
    if (!pageUi) return;
    waitingUiRun += 1;
    const run = waitingUiRun;
    if (waitingUiTimer) clearInterval(waitingUiTimer);
    let progress = 7;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pageUi.track.dataset.visible = 'true';
    pageUi.track.setAttribute('aria-valuetext', song.includeAlbumIntro ? '正在查询专辑资料' : '正在生成口播');
    pageUi.bar.style.width = `${reducedMotion ? 45 : progress}%`;
    pageUi.track.setAttribute('aria-valuenow', String(reducedMotion ? 45 : progress));
    if (!reducedMotion) {
      waitingUiTimer = setInterval(() => {
        if (run !== waitingUiRun) return;
        progress = Math.min(92, progress + Math.max(0.8, (92 - progress) * 0.045));
        pageUi.bar.style.width = `${progress}%`;
        pageUi.track.setAttribute('aria-valuenow', String(Math.round(progress)));
      }, 420);
    }
  }

  function finishWaitingUi(ok) {
    if (!pageUi) return;
    waitingUiRun += 1;
    const run = waitingUiRun;
    if (waitingUiTimer) clearInterval(waitingUiTimer);
    waitingUiTimer = null;
    pageUi.bar.style.width = '100%';
    pageUi.track.setAttribute('aria-valuenow', '100');
    pageUi.track.setAttribute('aria-valuetext', ok ? '口播已就绪' : '已使用简洁播报');
    setTimeout(() => {
      if (!pageUi || run !== waitingUiRun) return;
      pageUi.track.dataset.visible = 'false';
      pageUi.bar.style.width = '0%';
      pageUi.track.setAttribute('aria-valuenow', '0');
      pageUi.track.removeAttribute('aria-valuetext');
    }, 900);
  }

  function cancelWaitingUi() {
    if (!pageUi) return;
    waitingUiRun += 1;
    if (waitingUiTimer) clearInterval(waitingUiTimer);
    waitingUiTimer = null;
    pageUi.track.dataset.visible = 'false';
    pageUi.bar.style.width = '0%';
    pageUi.track.setAttribute('aria-valuenow', '0');
    pageUi.track.removeAttribute('aria-valuetext');
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
    if (adapter.setIntroActive) adapter.setIntroActive(false);
    cancelWaitingUi();
  }

  // Score table for the failure-only system TTS fallback — higher is better.
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

    // System speech is no longer selectable. It is used only when cloud TTS
    // fails, choosing the best installed Chinese voice automatically.
    const best = pickBestZhVoice();
    if (best) u.voice = best;

    u.onend = onDone;
    u.onerror = onDone;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function requestAiIntro(song) {
    return new Promise((resolve) => {
      startWaitingUi(song);
      const requestId = Math.random().toString(36).slice(2) + Date.now();
      // Album web search (18s) followed by cloud TTS (15s) needs a wider first-use window.
      // Ordinary per-song intros retain the short timeout.
      const responseTimeout = song.includeAlbumIntro ? 38000 : 28000;
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        finishWaitingUi(false);
        resolve(null);
      }, responseTimeout);

      function handler(event) {
        if (event.source !== window) return;
        const d = event.data;
        if (d && d.type === 'NETEASE_INTRO_RESPONSE' && d.requestId === requestId) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          finishWaitingUi(Boolean(
            d.response && d.response.text && !d.response.error && !d.response.degraded
          ));
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
      if ('albumEnabled' in event.data) albumEnabled = event.data.albumEnabled;
      if ('voice' in event.data) voicePref = event.data.voice;
      if (!enabled) {
        stopActiveIntro();
        try { adapter.resume && adapter.resume(); } catch (e) {}
      }
    }
  });
})();
