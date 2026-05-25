// QQ Music adapter (y.qq.com)
// Observer mode: no <audio> element to hook. Polls DOM for song changes
// and clicks the bottom-bar play/pause button to control playback.

(function () {
  if (!/(^|\.)y\.qq\.com$/.test(location.hostname)) return;

  const SONG_INFO_SEL = '.player_music__info';
  const PLAY_BTN_SEL = '.btn_big_play';

  let lastHandledKey = '';
  let introActive = false;

  function readSongInfo() {
    const container = document.querySelector(SONG_INFO_SEL)
      || document.querySelector('.player_music')
      || document.querySelector('.mod_song_info')
      || document.querySelector('.song_info__info');
    if (!container) return { name: '', artist: '', album: '' };

    const links = container.querySelectorAll('a, span, div');
    let name = '';
    const artists = [];

    for (const a of links) {
      const cls = (a.className || '').toString();
      const txt = a.textContent.trim();
      if (!txt) continue;
      if (cls.includes('playlist__author') || cls.includes('singer') || cls.includes('author') || cls.includes('artist')) {
        artists.push(txt);
      } else if (!name && !/^(歌曲|歌手|时长|上一首|播放|暂停|下一首|列表循环|喜欢|下载)/.test(txt)) {
        name = txt;
      }
    }

    return { name, artist: artists.join('/'), album: '' };
  }

  function songKey(info) {
    return info && info.name ? `${info.name}|${info.artist || ''}` : '';
  }

  function findPlayBtn() {
    return document.querySelector(PLAY_BTN_SEL);
  }

  function findMedia() {
    const media = Array.from(document.querySelectorAll('audio, video'));
    return media.find(el => !el.paused && !el.ended) || media.find(el => el.src || el.currentSrc) || null;
  }

  function isMediaPlaying() {
    const media = findMedia();
    return !!media && !media.paused && !media.ended;
  }

  // "btn_big_play--pause" modifier means "click to pause" → currently playing.
  function isPlaying(btn) {
    return isMediaPlaying() || (!!btn && btn.className.toString().includes('btn_big_play--pause'));
  }

  let pauseWaitTimer = null;
  let pausedByUs = false;
  let pausedMedia = null;

  window.__NETEASE_INTRO_ADAPTER__ = {
    name: 'qq',
    mode: 'observer',
    hookMediaPlay: true,

    getSongInfo: readSongInfo,

    isPlayerAudio(media) {
      return media && (media.tagName === 'AUDIO' || media.tagName === 'VIDEO');
    },

    isIntroActive() {
      return introActive;
    },

    setIntroActive(v) {
      introActive = !!v;
    },

    markSongHandled(info) {
      const key = songKey(info);
      if (key) lastHandledKey = key;
    },

    // Simple polling — robust against SPA re-renders.
    // Only announce once QQ Music is actually playing. Otherwise the page can
    // expose the first song before the user clicks play, consuming the intro too early.
    watch(onSongChange) {
      let pendingKey = '';
      let playOrdinal = 0;
      let handling = false;

      const tick = async () => {
        if (handling) return;
        const btn = findPlayBtn();
        if (!isPlaying(btn)) return;

        const info = readSongInfo();
        if (!info.name) return;
        const key = songKey(info);
        if (key === lastHandledKey || key === pendingKey) return;
        pendingKey = key;
        info.trackIndex = playOrdinal++;

        handling = true;
        let accepted = false;
        try {
          accepted = await Promise.resolve(onSongChange(info));
        } catch (e) {
          accepted = false;
        }

        if (accepted) {
          lastHandledKey = key;
        } else {
          playOrdinal = Math.max(0, playOrdinal - 1);
        }
        pendingKey = '';
        handling = false;
      };
      setInterval(tick, 150);
      // Also fire as soon as possible after playback has really started
      tick();
    },

    // Pause: if already playing, click now. Otherwise poll for up to 10s
    // (handles cases where DOM updates before audio actually starts —
    // e.g., QQ's autoplay-block dialog still pending user click).
    pause() {
      if (pauseWaitTimer) { clearInterval(pauseWaitTimer); pauseWaitTimer = null; }
      pausedByUs = false;
      pausedMedia = null;

      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };

        const confirmPaused = () => {
          if (pausedMedia && pausedMedia.paused) return true;
          const b = findPlayBtn();
          return b && !isPlaying(b);
        };

        const pauseMedia = () => {
          const media = findMedia();
          if (!media || media.paused || media.ended) return false;
          try {
            media.pause();
            pausedMedia = media;
            pausedByUs = true;
            setTimeout(() => {
              if (confirmPaused()) finish(true);
            }, 80);
            return true;
          } catch (e) {
            return false;
          }
        };

        let lastPauseClickAt = 0;
        const clickPause = (btn) => {
          const now = Date.now();
          if (now - lastPauseClickAt < 400) return;
          lastPauseClickAt = now;
          btn.click();
          pausedByUs = true;
          setTimeout(() => {
            if (confirmPaused()) finish(true);
          }, 120);
        };

        if (pauseMedia()) {
          // Keep the confirmation interval running; some players briefly resume
          // after a programmatic pause during track switches.
        }

        const btn = findPlayBtn();
        if (!pausedMedia && btn && isPlaying(btn)) {
          clickPause(btn);
        }

        const start = Date.now();
        pauseWaitTimer = setInterval(() => {
          if (Date.now() - start > 10000) {
            clearInterval(pauseWaitTimer);
            pauseWaitTimer = null;
            finish(false);
            return;
          }
          if (confirmPaused() && pausedByUs) {
            clearInterval(pauseWaitTimer);
            pauseWaitTimer = null;
            finish(true);
            return;
          }
          if (pauseMedia()) return;
          const b = findPlayBtn();
          if (!pausedMedia && b && isPlaying(b)) {
            clickPause(b);
          }
        }, 80);
      });
    },

    async resume() {
      if (pauseWaitTimer) {
        clearInterval(pauseWaitTimer);
        pauseWaitTimer = null;
      }
      if (!pausedByUs) return;
      const media = pausedMedia;
      pausedMedia = null;
      if (media && media.paused) {
        try {
          await media.play();
          pausedByUs = false;
          return;
        } catch (e) {}
      }

      const start = Date.now();
      const clickWhenReady = () => {
        const btn = findPlayBtn();
        if (btn && !isPlaying(btn)) {
          btn.click();
          pausedByUs = false;
          return true;
        }
        return false;
      };

      if (clickWhenReady()) return;
      const timer = setInterval(() => {
        if (clickWhenReady() || Date.now() - start > 3000) {
          clearInterval(timer);
          if (Date.now() - start > 3000) pausedByUs = false;
        }
      }, 100);
    },
  };
})();
