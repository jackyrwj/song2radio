// Netease Cloud Music adapter — exposes site-specific song info to intercept.js

(function () {
  if (!/(^|\.)music\.163\.com$/.test(location.hostname)) return;

  window.__NETEASE_INTRO_ADAPTER__ = {
    name: 'netease',

    getProgressAnchor() {
      return document.querySelector(
        '.m-playbar .m-pbar, .m-playbar .barbg, .m-playbar [class*="progress"]'
      );
    },

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
          const album = t.album || t.al || null;
          const artists = t.artists || t.ar || [];
          info = {
            name: t.name,
            songId: t.id != null ? String(t.id) : '',
            artist: artists.map(a => a.name).join('/'),
            album: album ? album.name : '',
            albumId: album && album.id != null ? String(album.id) : '',
            releaseDate: album && album.publishTime ? formatDate(album.publishTime) : '',
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
            const queuedTrack = queue[idx];
            const queuedAlbum = queuedTrack && (queuedTrack.album || queuedTrack.al);
            const queuedArtists = queuedTrack && (queuedTrack.artists || queuedTrack.ar);
            if (!info.album && queuedAlbum) {
              info.album = queuedAlbum.name || '';
              info.albumId = queuedAlbum.id != null ? String(queuedAlbum.id) : '';
              info.releaseDate = queuedAlbum.publishTime ? formatDate(queuedAlbum.publishTime) : '';
            }
            if (!info.artist && Array.isArray(queuedArtists)) {
              info.artist = queuedArtists.map(a => a.name).join('/');
            }
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

  function formatDate(timestamp) {
    const d = new Date(timestamp);
    if (!Number.isFinite(d.getTime())) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
})();
