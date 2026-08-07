// Service worker: sends constrained song metadata to the Song2Radio backend.
// Provider API keys live only in Vercel environment variables and are never
// stored in, or returned to, the browser extension.

const SERVICE_ENDPOINT = 'https://song2radio.vercel.app/api/intro';
const CLIENT_VERSION = '3.1.3';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    'enabled', 'aiEnabled', 'albumEnabled', 'voice', 'installId',
  ]);
  const updates = {};
  if (stored.enabled === undefined) updates.enabled = true;
  if (stored.aiEnabled === undefined) updates.aiEnabled = true;
  if (stored.albumEnabled === undefined) updates.albumEnabled = true;
  // v3.1.2 removes system voices from the picker. Existing system selections
  // move to the default cloud host voice; browser speech remains failure-only.
  if (
    stored.voice === undefined
    || stored.voice === 'browser'
    || (typeof stored.voice === 'string' && stored.voice.startsWith('browser:'))
  ) updates.voice = 'Maia';
  if (!stored.installId) updates.installId = createInstallId();
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);

  // Remove keys left by v2.x upgrades. They are no longer read by the extension.
  await chrome.storage.local.remove(['apiKey', 'deepseekApiKey', 'provider']);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SONG_INTRO') {
    handleSongIntro(request.song)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'intro_failed' }));
    return true;
  }
});

function createInstallId() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getSettings() {
  const stored = await chrome.storage.local.get(['aiEnabled', 'voice', 'installId']);
  if (!stored.installId) {
    stored.installId = createInstallId();
    await chrome.storage.local.set({ installId: stored.installId });
  }
  return {
    aiEnabled: stored.aiEnabled !== false,
    voice: stored.voice || 'Maia',
    installId: stored.installId,
  };
}

async function handleSongIntro(song) {
  const settings = await getSettings();
  const fallbackText = song.artist
    ? `接下来为您播放：${song.name}，演唱：${song.artist}`
    : `接下来为您播放：${song.name}`;

  try {
    const controller = new AbortController();
    const timeoutMs = song.includeAlbumIntro ? 36000 : 26000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(SERVICE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Song2Radio-Version': CLIENT_VERSION,
        },
        body: JSON.stringify({
          installId: settings.installId,
          aiEnabled: settings.aiEnabled,
          voice: settings.voice,
          song,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return { text: fallbackText, error: `service_${response.status}` };
    const data = await response.json();
    if (!data || typeof data.text !== 'string' || !data.text.trim()) {
      return { text: fallbackText, error: 'service_empty' };
    }
    return {
      text: data.text.trim(),
      ...(typeof data.audioUrl === 'string' ? { audioUrl: data.audioUrl } : {}),
      degraded: data.degraded === true,
    };
  } catch (error) {
    return {
      text: fallbackText,
      error: error && error.name === 'AbortError' ? 'service_timeout' : 'service_unavailable',
    };
  }
}
