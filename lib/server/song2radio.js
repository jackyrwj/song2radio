import { createHash } from 'node:crypto';

const TEXT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const TTS_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const SONG_MODEL = 'qwen-turbo';
const ALBUM_MODEL = 'qwen-plus';
const TTS_MODEL = 'qwen3-tts-flash';

export const CLOUD_VOICES = new Set([
  'Cherry', 'Serena', 'Ethan', 'Chelsie', 'Vivian', 'Jennifer', 'Neil', 'Vincent',
  'Eldric Sage', 'Maia', 'Dylan', 'Jada', 'Sunny', 'Eric', 'Rocky', 'Kiki', 'Roy', 'Peter',
]);

const ALLOWED_SITES = new Set(['netease', 'qq']);

export class RequestValidationError extends Error {}

function cleanString(value, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new RequestValidationError('字段类型不正确');
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function validateIntroRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestValidationError('请求体必须是对象');
  }

  const installId = cleanString(body.installId, 128);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(installId)) {
    throw new RequestValidationError('安装标识无效');
  }

  const rawSong = body.song;
  if (!rawSong || typeof rawSong !== 'object' || Array.isArray(rawSong)) {
    throw new RequestValidationError('缺少歌曲信息');
  }

  const site = cleanString(rawSong.site, 20);
  if (!ALLOWED_SITES.has(site)) throw new RequestValidationError('音乐平台无效');

  const name = cleanString(rawSong.name, 160);
  if (!name) throw new RequestValidationError('歌曲名不能为空');

  const voice = cleanString(body.voice || 'browser', 80);
  if (voice !== 'browser' && !voice.startsWith('browser:') && !CLOUD_VOICES.has(voice)) {
    throw new RequestValidationError('音色无效');
  }

  const intOrUndefined = (value, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : undefined;
  const song = {
    site,
    name,
    songId: cleanString(rawSong.songId, 100),
    artist: cleanString(rawSong.artist, 240),
    album: cleanString(rawSong.album, 200),
    albumId: cleanString(rawSong.albumId, 100),
    albumKey: cleanString(rawSong.albumKey, 400),
    releaseDate: cleanString(rawSong.releaseDate, 80),
    trackIndex: intOrUndefined(rawSong.trackIndex, 10000),
    totalTracks: intOrUndefined(rawSong.totalTracks, 10000),
    includeAlbumIntro: rawSong.includeAlbumIntro === true,
  };

  if (!song.album) song.includeAlbumIntro = false;

  return {
    installId,
    voice,
    aiEnabled: body.aiEnabled !== false,
    song,
  };
}

export function fallbackText(song) {
  return song.artist
    ? `接下来为您播放：${song.name}，演唱：${song.artist}`
    : `接下来为您播放：${song.name}`;
}

function positionRule(song) {
  if (song.trackIndex === 0) {
    return '这是歌单第一首歌，请先用一两句自然的开场白欢迎听众，结尾引导听众进入歌曲。';
  }
  const isLast = typeof song.trackIndex === 'number' && typeof song.totalTracks === 'number'
    && song.totalTracks > 1 && song.trackIndex === song.totalTracks - 1;
  if (isLast) return '这是歌单最后一首歌，请在结尾感谢听众陪伴并自然收尾。';
  return '结尾加一句自然、简短的过渡语，引导听众进入歌曲。';
}

function joinAlbumBriefAndSong(albumBrief, song) {
  const opening = song.trackIndex === 0
    ? '欢迎收听今天的电台情歌，我们先从这张专辑说起。'
    : '';
  let handoff = song.artist
    ? `接下来播放${song.artist}的${song.name}，一起来听。`
    : `接下来播放${song.name}，一起来听。`;
  const isLast = typeof song.trackIndex === 'number' && typeof song.totalTracks === 'number'
    && song.totalTracks > 1 && song.trackIndex === song.totalTracks - 1;
  if (isLast) handoff = `这是今天的最后一首歌，${handoff}感谢你的陪伴，我们下次再见。`;
  return `${opening}${albumBrief.replace(/[。！？!?]?$/, '。')}${handoff}`;
}

function sanitizeModelText(text) {
  return String(text || '')
    .replace(/\[(?:ref_)?\d+\]|【\d+】/gi, '')
    .replace(/^```[a-z]*|```$/gim, '')
    .trim();
}

async function fetchWithTimeout(url, options, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callChat({ apiKey, model, messages, search = false, fetchImpl }) {
  const payload = {
    model,
    messages,
    temperature: search ? 0.5 : 0.8,
    max_tokens: 400,
  };
  if (search) {
    payload.enable_search = true;
    payload.search_options = { forced_search: true, search_strategy: 'turbo' };
  }

  const response = await fetchWithTimeout(TEXT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, search ? 18000 : 8000, fetchImpl);

  if (!response.ok) throw new Error(`text_api_${response.status}`);
  const data = await response.json();
  const text = sanitizeModelText(data?.choices?.[0]?.message?.content);
  if (!text) throw new Error('text_empty');
  return text;
}

async function generateAlbumBrief(song, apiKey, fetchImpl) {
  const prompt = `请联网查询下面这张音乐专辑的可靠资料，并写成一段中文电台口播。
专辑：${song.album}
歌手：${song.artist || '未知'}
${song.releaseDate ? `页面显示发行信息：${song.releaseDate}\n` : ''}
要求：
- 重点说明发行时间、创作或时代背景、风格与主题、评价或影响，只选最值得听众知道的内容。
- 必须先联网核实；同名专辑要结合歌手判断，不得混用其他专辑的信息。
- 不确定或搜索不到的内容直接省略，禁止猜测；不要提到搜索过程或资料来源。
- 80 至 130 个汉字，口语化、适合朗读，只输出正文，不要标题、列表、引用标记或 markdown。`;

  return callChat({
    apiKey,
    model: ALBUM_MODEL,
    search: true,
    fetchImpl,
    messages: [
      { role: 'system', content: '你是一位严谨的音乐电台编辑。先检索并核实事实，再将资料压缩成自然、准确的中文口播。' },
      { role: 'user', content: prompt },
    ],
  });
}

async function generateSongText(song, apiKey, fetchImpl) {
  const prompt = `请用中文，以电台主持人的口吻，为下面这首歌写一段口播介绍。
歌曲：${song.name}
${song.artist ? `演唱：${song.artist}\n` : ''}${song.album ? `专辑：${song.album}\n` : ''}
要求：
- 总字数控制在 120 字以内，简要介绍歌手、专辑和歌曲本身；资料不确定时省略，不要编造。
- 语言口语化、流畅自然，适合朗读。
- ${positionRule(song)}
- 直接输出正文，不要书名号、markdown 或解释。`;

  return callChat({
    apiKey,
    model: SONG_MODEL,
    fetchImpl,
    messages: [
      { role: 'system', content: '你是一位资深的音乐电台主持人，擅长用简短、生动、流畅的口播语言介绍歌曲。' },
      { role: 'user', content: prompt },
    ],
  });
}

async function generateAudio(text, voice, apiKey, fetchImpl) {
  const response = await fetchWithTimeout(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: { text: text.slice(0, 500), voice, language_type: 'Chinese' },
    }),
  }, 15000, fetchImpl);

  if (!response.ok) throw new Error(`tts_api_${response.status}`);
  const data = await response.json();
  const audioUrl = normalizeAudioUrl(data?.output?.audio?.url);
  if (!audioUrl) throw new Error('tts_no_url');
  return audioUrl;
}

function normalizeAudioUrl(value) {
  let url;
  try { url = new URL(value); } catch (e) { return ''; }
  if (url.username || url.password) return '';

  // DashScope currently returns Beijing OSS result URLs as HTTP even though
  // the same signed object supports HTTPS. Music sites run over HTTPS, so the
  // original URL would be blocked as mixed content in the extension page.
  const isAliyunHost = url.hostname === 'aliyuncs.com' || url.hostname.endsWith('.aliyuncs.com');
  if (url.protocol === 'http:' && isAliyunHost) url.protocol = 'https:';
  return url.protocol === 'https:' ? url.toString() : '';
}

function textCacheKey(input) {
  const value = JSON.stringify({
    v: 1,
    ai: input.aiEnabled,
    song: input.song,
  });
  return `intro:text:${createHash('sha256').update(value).digest('hex')}`;
}

function albumBriefCacheKey(song) {
  const identity = song.albumId
    ? `${song.site}:id:${song.albumId}`
    : `${song.site}:name:${song.album.toLocaleLowerCase()}|${song.artist.toLocaleLowerCase()}`;
  return `intro:album:${createHash('sha256').update(`v1|${identity}`).digest('hex')}`;
}

export async function createIntro(input, options = {}) {
  const apiKey = options.apiKey || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('server_not_configured');
  const fetchImpl = options.fetchImpl || fetch;
  const redis = options.redis || null;
  const cacheKey = textCacheKey(input);

  let text = null;
  if (redis) {
    try { text = await redis.get(cacheKey); } catch (e) {}
  }

  let degraded = false;
  if (!text) {
    try {
      if (input.song.includeAlbumIntro) {
        let albumBrief = null;
        const albumKey = albumBriefCacheKey(input.song);
        if (redis) {
          try { albumBrief = await redis.get(albumKey); } catch (e) {}
        }
        if (!albumBrief) {
          albumBrief = await generateAlbumBrief(input.song, apiKey, fetchImpl);
          if (redis) {
            try { await redis.set(albumKey, albumBrief, { ex: 60 * 60 * 24 * 30 }); } catch (e) {}
          }
        }
        text = joinAlbumBriefAndSong(albumBrief, input.song);
      } else if (input.aiEnabled) {
        text = await generateSongText(input.song, apiKey, fetchImpl);
      } else {
        text = fallbackText(input.song);
      }
    } catch (e) {
      text = fallbackText(input.song);
      degraded = true;
    }

    if (redis && !degraded) {
      const ttl = input.song.includeAlbumIntro ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
      try { await redis.set(cacheKey, text, { ex: ttl }); } catch (e) {}
    }
  }

  let audioUrl;
  if (CLOUD_VOICES.has(input.voice) && process.env.ENABLE_CLOUD_TTS !== 'false') {
    try {
      audioUrl = await generateAudio(text, input.voice, apiKey, fetchImpl);
    } catch (e) {
      console.error('tts_generation_failed', e?.message || 'unknown_error');
      degraded = true;
    }
  }

  return { text, ...(audioUrl ? { audioUrl } : {}), degraded };
}
