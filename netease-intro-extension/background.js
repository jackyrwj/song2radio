// Service worker: handles 百炼 API calls (text intro + TTS) and caches results

const TTS_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const TTS_MODEL = 'qwen3-tts-flash';

// Text-generation providers (OpenAI-compatible chat completion endpoints)
const PROVIDERS = {
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    keyName: 'apiKey',
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    keyName: 'deepseekApiKey',
  },
};

// First-time install: seed defaults
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['apiKey', 'deepseekApiKey', 'provider', 'enabled', 'aiEnabled', 'voice']);
  const updates = {};
  if (stored.deepseekApiKey === undefined) updates.deepseekApiKey = '';
  if (stored.provider === undefined) updates.provider = 'qwen';
  if (stored.enabled === undefined) updates.enabled = true;
  if (stored.aiEnabled === undefined) updates.aiEnabled = true;
  if (stored.voice === undefined) updates.voice = 'browser';
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

const introCache = new Map();
const audioCache = new Map();
const MAX_TEXT_CACHE = 500;
const MAX_AUDIO_CACHE = 300;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SONG_INTRO') {
    handleSongIntro(request.song).then(sendResponse);
    return true;
  }
});

async function handleSongIntro(song) {
  const isFirst = song.trackIndex === 0;
  const isLast = typeof song.trackIndex === 'number' && typeof song.totalTracks === 'number'
    && song.totalTracks > 1 && song.trackIndex === song.totalTracks - 1;
  const posKey = isFirst ? 'first' : isLast ? 'last' : '';
  const { apiKey, deepseekApiKey, provider, aiEnabled, voice } = await chrome.storage.local.get(
    ['apiKey', 'deepseekApiKey', 'provider', 'aiEnabled', 'voice']
  );

  const activeProvider = PROVIDERS[provider] ? provider : 'qwen';
  const textApiKey = activeProvider === 'deepseek' ? deepseekApiKey : apiKey;

  // Cache key includes provider so switching providers doesn't reuse old text
  const cacheKey = `${activeProvider}|${song.name}|${song.artist || ''}|${song.album || ''}|${posKey}`;

  // ---------- 1. Get text ----------
  let text;
  let textError = null;

  if (aiEnabled !== false && textApiKey) {
    if (introCache.has(cacheKey)) {
      text = introCache.get(cacheKey);
    } else {
      const r = await generateText(song, textApiKey, activeProvider);
      if (r.text) {
        text = r.text;
        cachePut(introCache, cacheKey, text, MAX_TEXT_CACHE);
      } else {
        textError = r.error;
      }
    }
  }

  // Fallback text
  if (!text) {
    const baseText = song.artist
      ? `接下来为您播放：${song.name}，演唱：${song.artist}`
      : `接下来为您播放：${song.name}`;

    text = baseText;
  }

  // ---------- 2. Get audio (only for cloud voices; browser/system voices handled in content.js) ----------
  const isCloudVoice = voice && voice !== 'browser' && !voice.startsWith('browser:');
  if (isCloudVoice && apiKey) {
    const audioKey = `${voice}|${text}`;
    let audioUrl = audioCache.get(audioKey);
    let audioError = null;

    if (!audioUrl) {
      const r = await generateAudio(text, voice, apiKey);
      if (r.audioUrl) {
        audioUrl = r.audioUrl;
        cachePut(audioCache, audioKey, audioUrl, MAX_AUDIO_CACHE);
      } else {
        audioError = r.error;
      }
    }

    if (audioUrl) {
      return { text, audioUrl, textError, quotaExceeded: false };
    }
    return { text, textError, audioError, quotaExceeded: false };
  }

  return { text, textError, quotaExceeded: false };
}

async function generateText(song, apiKey, providerName) {
  const provider = PROVIDERS[providerName] || PROVIDERS.qwen;
  const isFirst = song.trackIndex === 0;
  const isLast = typeof song.trackIndex === 'number' && typeof song.totalTracks === 'number'
    && song.totalTracks > 1 && song.trackIndex === song.totalTracks - 1;

  let positionRule = '';
  if (isFirst) {
    positionRule = `- 这是今天歌单的第一首歌，请在介绍正文之前加上 1-2 句温暖的开场白，欢迎听众开始这段音乐旅程，语气自然亲切，不要过于正式。
- 结尾加一句自然的过渡引导词，例如"一起来听一下吧"。`;
  } else if (isLast) {
    positionRule = `- 这是今天歌单的最后一首歌，结尾不要用普通的过渡语，而是用一句温情的收尾语，感谢听众的陪伴，引导他们期待下次，例如"让我们下张专辑再见吧"、"感谢今天的陪伴，我们下次再见"，风格温暖自然。`;
  } else {
    positionRule = `- 结尾加一句自然的过渡引导词，引导听众进入歌曲，例如"一起来听一下吧"、"让我们一起感受一下"、"现在就来听听这首歌"等，风格要自然、不生硬，与正文语气保持一致。`;
  }

  const prompt = `请用中文，以电台主持人的口吻，为下面这首歌写一段口播介绍。
歌曲：${song.name}
${song.artist ? `演唱：${song.artist}` : ''}
${song.album ? `专辑：${song.album}` : ''}

要求：
- 总字数控制在 120 字以内，分三个层次简要介绍：歌手背景（出道、风格、代表作或地位）、专辑背景（发行年份、定位或主题）、歌曲本身（风格、亮点或情绪）。
- 语言口语化、流畅自然，适合朗读。
- 如果某项信息不确定，可以简略带过，不要编造离奇细节。
- 直接输出介绍正文，不要书名号，不要 markdown 或解释。
${positionRule}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: '你是一位资深的音乐电台主持人，擅长用简短、生动、流畅的口播语言介绍歌曲。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: 'text_api_error_' + response.status };
    }
    const data = await response.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    return text ? { text } : { error: 'text_empty' };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'text_timeout' : 'text_fetch_failed' };
  }
}

async function generateAudio(text, voice, apiKey) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: { text, voice, language_type: 'Chinese' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: 'tts_api_error_' + response.status };
    }
    const data = await response.json();
    const url = data.output && data.output.audio && data.output.audio.url;
    return url ? { audioUrl: url } : { error: 'tts_no_url' };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'tts_timeout' : 'tts_fetch_failed' };
  }
}

function cachePut(map, key, value, max) {
  if (map.size >= max) {
    map.delete(map.keys().next().value);
  }
  map.set(key, value);
}
