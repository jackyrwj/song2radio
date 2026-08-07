import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIntro,
  RequestValidationError,
  validateIntroRequest,
} from '../lib/server/song2radio.js';
import { enforceRateLimits, RateLimitError } from '../lib/server/rate-limit.js';

function validRequest(overrides = {}) {
  return {
    installId: '0123456789abcdef0123456789abcdef',
    aiEnabled: true,
    voice: 'browser',
    song: {
      site: 'netease',
      name: '测试歌曲',
      artist: '测试歌手',
      album: '测试专辑',
      albumId: '42',
      albumKey: 'netease:id:42',
      includeAlbumIntro: true,
      trackIndex: 0,
      totalTracks: 3,
    },
    ...overrides,
  };
}

test('validates and truncates the constrained extension payload', () => {
  const input = validateIntroRequest(validRequest());
  assert.equal(input.song.site, 'netease');
  assert.equal(input.song.includeAlbumIntro, true);

  assert.throws(
    () => validateIntroRequest(validRequest({ voice: 'attacker-controlled-voice' })),
    RequestValidationError,
  );
  assert.throws(
    () => validateIntroRequest(validRequest({ installId: 'short' })),
    RequestValidationError,
  );
});

test('album intros force Qwen web search and cloud TTS without exposing a key to the client', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body, authorization: options.headers.Authorization });
    if (body.model === 'qwen3-tts-flash') {
      return {
        ok: true,
        json: async () => ({
          output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/intro.wav?token=test' } },
        }),
      };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: '联网核实后的专辑介绍。【1】' } }] }) };
  };

  const input = validateIntroRequest(validRequest({ voice: 'Maia' }));
  const result = await createIntro(input, { apiKey: 'server-secret', fetchImpl });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.model, 'qwen-plus');
  assert.equal(calls[0].body.enable_search, true);
  assert.equal(calls[0].body.search_options.forced_search, true);
  assert.equal(calls[1].body.model, 'qwen3-tts-flash');
  assert.match(result.text, /测试歌曲/);
  assert.doesNotMatch(result.text, /【1】/);
  assert.equal(
    result.audioUrl,
    'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/intro.wav?token=test',
  );
});

test('provider failures degrade to a safe local sentence', async () => {
  const input = validateIntroRequest(validRequest({ song: { site: 'qq', name: '只有歌名' } }));
  const result = await createIntro(input, {
    apiKey: 'server-secret',
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.text, '接下来为您播放：只有歌名');
  assert.equal(result.degraded, true);
});

test('album research is reused across different songs from the same album', async () => {
  const values = new Map();
  const redis = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
  };
  let searchCalls = 0;
  const fetchImpl = async () => {
    searchCalls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: '同一张专辑的背景介绍。' } }] }) };
  };

  const first = validateIntroRequest(validRequest());
  const second = validateIntroRequest(validRequest({
    song: {
      ...validRequest().song,
      name: '专辑中的另一首歌',
      songId: 'second-song',
      trackIndex: 4,
    },
  }));
  await createIntro(first, { apiKey: 'server-secret', fetchImpl, redis });
  await createIntro(second, { apiKey: 'server-secret', fetchImpl, redis });
  assert.equal(searchCalls, 1);
});

test('persistent counters enforce the configured install limit', async () => {
  const values = new Map();
  const redis = {
    async incr(key) {
      const next = (values.get(key) || 0) + 1;
      values.set(key, next);
      return next;
    },
    async expire() {},
  };

  const oldLimit = process.env.DAILY_INSTALL_LIMIT;
  process.env.DAILY_INSTALL_LIMIT = '1';
  try {
    await enforceRateLimits({ redis, installId: 'install-a', ip: '127.0.0.1', includeAlbumIntro: false });
    await assert.rejects(
      enforceRateLimits({ redis, installId: 'install-a', ip: '127.0.0.1', includeAlbumIntro: false }),
      RateLimitError,
    );
  } finally {
    if (oldLimit === undefined) delete process.env.DAILY_INSTALL_LIMIT;
    else process.env.DAILY_INSTALL_LIMIT = oldLimit;
  }
});
