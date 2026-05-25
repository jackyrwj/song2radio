// Netease Cloud Music adapter — exposes site-specific song info to intercept.js

(function () {
  if (!/(^|\.)music\.163\.com$/.test(location.hostname)) return;

  window.__NETEASE_INTRO_ADAPTER__ = {
    name: 'netease',

    // Filter: should this <audio> element trigger our intro?
    isPlayerAudio(audio) {
      return audio.tagName === 'AUDIO' && !!audio.src;
    },

    getSongInfo() {
      let info = { name: '', artist: '', album: '' };

      // 方案1：window.player API（最可靠）
      try {
        const result = window.player.getPlaying();
        if (result && result.track && result.track.name) {
          const t = result.track;
          info = {
            name: t.name,
            artist: (t.artists || []).map(a => a.name).join('/'),
            album: t.album ? t.album.name : '',
          };
        }
      } catch (e) {}

      // 方案2：播放栏 DOM
      if (!info.name) {
        const nameEl = document.querySelector('.m-playbar .words a.name');
        const artistEl = document.querySelector('.m-playbar .words .by a');
        if (nameEl && nameEl.textContent.trim()) {
          info = {
            name: nameEl.textContent.trim(),
            artist: artistEl ? artistEl.textContent.trim() : '',
            album: '',
          };
        }
      }

      // 方案3：页面标题（格式："▶ 歌名"）
      if (!info.name) {
        const m = document.title.match(/^▶\s*(.+)/);
        if (m) info = { name: m[1].trim(), artist: '', album: '' };
      }

      // Queue position — from localStorage. track-queue is the playback queue
      // (current + recently played), player-setting.index is current position.
      try {
        const queue = JSON.parse(localStorage.getItem('track-queue') || '[]');
        const setting = JSON.parse(localStorage.getItem('player-setting') || '{}');
        if (Array.isArray(queue) && queue.length > 0) {
          let idx = typeof setting.index === 'number' ? setting.index : -1;
          // Sanity check: confirm the index actually points to this track id;
          // if mismatch, search by id (handles cases where index is stale).
          try {
            const curId = window.player.getPlaying().track.id;
            if (queue[idx] && queue[idx].id !== curId) {
              idx = queue.findIndex(t => t && t.id === curId);
            }
          } catch (e) {}
          if (idx >= 0) {
            info.trackIndex = idx;
            info.totalTracks = queue.length;
            info.isFirst = idx === 0;
            info.isLast = idx === queue.length - 1;
          }
        }
      } catch (e) {}

      return info;
    },
  };
})();
