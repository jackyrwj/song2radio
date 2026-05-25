const toggleEnabled = document.getElementById('toggle-enabled');
const toggleAi = document.getElementById('toggle-ai');
const enabledStatus = document.getElementById('enabled-status');
const aiStatus = document.getElementById('ai-status');
const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save-btn');
const status = document.getElementById('status');
const voiceSelect = document.getElementById('voice-select');
const voiceStatus = document.getElementById('voice-status');
const toggleDeepseek = document.getElementById('toggle-deepseek');
const providerStatus = document.getElementById('provider-status');
const deepseekKeyInput = document.getElementById('deepseek-key');
const deepseekKeySection = document.getElementById('deepseek-key-section');
// Populate system browser voices into the dropdown
function populateBrowserVoices() {
  const group = document.getElementById('browser-voices-group');
  const voices = speechSynthesis.getVoices();
  // Prefer Chinese voices, but also expose any voice marked zh
  const zhVoices = voices.filter(v => /^zh/i.test(v.lang));
  const list = zhVoices.length ? zhVoices : voices;

  group.innerHTML = '';
  for (const v of list) {
    const opt = document.createElement('option');
    opt.value = `browser:${v.name}`;
    opt.textContent = `${v.name} (${v.lang})`;
    group.appendChild(opt);
  }
  // Restore stored selection after voices arrive
  chrome.storage.local.get('voice', ({ voice }) => {
    if (voice) voiceSelect.value = voice;
  });
}
populateBrowserVoices();
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = populateBrowserVoices;
}

// Load current state
chrome.storage.local.get(
  ['enabled', 'aiEnabled', 'apiKey', 'deepseekApiKey', 'provider', 'voice'],
  (result) => {
    const isEnabled = result.enabled !== false;
    const aiOn = result.aiEnabled !== false;
    toggleEnabled.checked = isEnabled;
    toggleAi.checked = aiOn;
    apiKeyInput.value = result.apiKey || '';
    deepseekKeyInput.value = result.deepseekApiKey || '';
    const useDeepseek = (result.provider || 'qwen') === 'deepseek';
    toggleDeepseek.checked = useDeepseek;
    voiceSelect.value = result.voice || 'Maia';
    updateEnabledLabel(isEnabled);
    updateAiLabel(aiOn);
    updateVoiceLabel(voiceSelect.value);
    updateProviderLabel(useDeepseek);
  }
);

toggleDeepseek.addEventListener('change', () => {
  const useDeepseek = toggleDeepseek.checked;
  chrome.storage.local.set({ provider: useDeepseek ? 'deepseek' : 'qwen' });
  updateProviderLabel(useDeepseek);
});

voiceSelect.addEventListener('change', () => {
  chrome.storage.local.set({ voice: voiceSelect.value });
  updateVoiceLabel(voiceSelect.value);
});

toggleEnabled.addEventListener('change', () => {
  const v = toggleEnabled.checked;
  chrome.storage.local.set({ enabled: v });
  updateEnabledLabel(v);
});

toggleAi.addEventListener('change', () => {
  const v = toggleAi.checked;
  chrome.storage.local.set({ aiEnabled: v });
  updateAiLabel(v);
});

saveBtn.addEventListener('click', () => {
  const qwenKey = apiKeyInput.value.trim();
  const dsKey = deepseekKeyInput.value.trim();
  chrome.storage.local.set({ apiKey: qwenKey, deepseekApiKey: dsKey }, () => {
    saveBtn.textContent = '已保存 ✓';
    saveBtn.classList.add('saved');
    const activeKey = toggleDeepseek.checked ? dsKey : qwenKey;
    status.textContent = activeKey ? '' : '当前文案来源未填 key，会回退到简单播报';
    setTimeout(() => {
      saveBtn.textContent = '保存';
      saveBtn.classList.remove('saved');
    }, 1500);
  });
});

function updateEnabledLabel(on) {
  enabledStatus.textContent = on ? '已开启' : '已关闭';
  enabledStatus.style.color = on ? '#e60026' : '#555';
}

function updateAiLabel(on) {
  aiStatus.textContent = on ? 'AI 介绍' : '使用简单文案';
  aiStatus.style.color = on ? '#e60026' : '#666';
}

function updateProviderLabel(useDeepseek) {
  if (useDeepseek) {
    providerStatus.textContent = '文案走 DeepSeek，音色仍走百炼';
    providerStatus.style.color = '#e60026';
    deepseekKeySection.style.display = '';
  } else {
    providerStatus.textContent = '默认关，文案由百炼生成';
    providerStatus.style.color = '#666';
    deepseekKeySection.style.display = 'none';
  }
}

function updateVoiceLabel(v) {
  if (v === 'browser') {
    voiceStatus.textContent = '自动选最佳系统语音（免费）';
    voiceStatus.style.color = '#888';
  } else if (v.startsWith('browser:')) {
    voiceStatus.textContent = '系统语音 · 免费、无延迟';
    voiceStatus.style.color = '#888';
  } else {
    voiceStatus.textContent = v === 'Maia' ? '推荐音色 · 知性温柔女声（需百炼 key）' : '云端音色（需百炼 key）';
    voiceStatus.style.color = '#e60026';
  }
}
