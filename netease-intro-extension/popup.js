const toggleEnabled = document.getElementById('toggle-enabled');
const toggleAi = document.getElementById('toggle-ai');
const toggleAlbum = document.getElementById('toggle-album');
const enabledStatus = document.getElementById('enabled-status');
const aiStatus = document.getElementById('ai-status');
const albumStatus = document.getElementById('album-status');
const voiceSelect = document.getElementById('voice-select');

chrome.storage.local.get(
  ['enabled', 'aiEnabled', 'albumEnabled', 'voice'],
  (result) => {
    const enabled = result.enabled !== false;
    const aiEnabled = result.aiEnabled !== false;
    const albumEnabled = result.albumEnabled !== false;
    const hasVoice = Array.from(voiceSelect.options).some(option => option.value === result.voice);
    const voice = hasVoice ? result.voice : 'Maia';
    if (voice !== result.voice) chrome.storage.local.set({ voice });

    toggleEnabled.checked = enabled;
    toggleAi.checked = aiEnabled;
    toggleAlbum.checked = albumEnabled;
    voiceSelect.value = voice;
    updateEnabledLabel(enabled);
    updateAiLabel(aiEnabled);
    updateAlbumLabel(albumEnabled);
  }
);

toggleEnabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggleEnabled.checked });
  updateEnabledLabel(toggleEnabled.checked);
});

toggleAi.addEventListener('change', () => {
  chrome.storage.local.set({ aiEnabled: toggleAi.checked });
  updateAiLabel(toggleAi.checked);
});

toggleAlbum.addEventListener('change', () => {
  chrome.storage.local.set({ albumEnabled: toggleAlbum.checked });
  updateAlbumLabel(toggleAlbum.checked);
});

voiceSelect.addEventListener('change', () => {
  chrome.storage.local.set({ voice: voiceSelect.value });
});

function updateEnabledLabel(on) {
  enabledStatus.textContent = on ? '已开启' : '已关闭';
  enabledStatus.style.color = on ? '#e60026' : '#555';
}

function updateAiLabel(on) {
  aiStatus.textContent = on ? 'AI 介绍' : '使用简单文案';
  aiStatus.style.color = on ? '#e60026' : '#666';
}

function updateAlbumLabel(on) {
  albumStatus.textContent = on ? '新专辑首次出现时联网介绍' : '不播报专辑资料';
  albumStatus.style.color = on ? '#e60026' : '#666';
}
