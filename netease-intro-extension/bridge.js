// ISOLATED world bridge:
//   1. Syncs chrome.storage state → MAIN world via postMessage
//   2. Relays AI intro requests from MAIN world → background → MAIN world

(function () {
  // ---- State sync ----
  function sendState(state) {
    window.postMessage({ type: 'NETEASE_INTRO_STATE', ...state }, '*');
  }

  chrome.storage.local.get(['enabled', 'voice'], (result) => {
    sendState({
      enabled: result.enabled !== false,
      voice: result.voice || 'Maia',
    });
  });

  chrome.storage.onChanged.addListener((changes) => {
    const update = {};
    if ('enabled' in changes) update.enabled = changes.enabled.newValue;
    if ('voice' in changes) update.voice = changes.voice.newValue;
    if (Object.keys(update).length) sendState(update);
  });

  // ---- AI intro request relay ----
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== 'NETEASE_INTRO_REQUEST') return;

    const requestId = data.requestId;
    chrome.runtime.sendMessage(
      { type: 'GET_SONG_INTRO', song: data.song },
      (response) => {
        window.postMessage(
          {
            type: 'NETEASE_INTRO_RESPONSE',
            requestId,
            response: response || { error: 'no_response' },
          },
          '*'
        );
      }
    );
  });
})();
