import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

test('extension removes legacy keys and sends only constrained metadata to Vercel', async () => {
  const source = await readFile('netease-intro-extension/background.js', 'utf8');
  const state = {
    apiKey: 'legacy-qwen-key',
    deepseekApiKey: 'legacy-deepseek-key',
    provider: 'deepseek',
    enabled: true,
    aiEnabled: true,
    albumEnabled: true,
    voice: 'browser',
  };
  let installListener;
  let messageListener;
  let requestBody;
  let requestUrl;

  const context = {
    AbortController,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      requestUrl = url;
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ text: '服务端生成的介绍' }) };
    },
    chrome: {
      runtime: {
        onInstalled: { addListener(fn) { installListener = fn; } },
        onMessage: { addListener(fn) { messageListener = fn; } },
      },
      storage: { local: {
        async get(keys) {
          if (typeof keys === 'string') return { [keys]: state[keys] };
          return Object.fromEntries(keys.map(key => [key, state[key]]));
        },
        async set(values) { Object.assign(state, values); },
        async remove(keys) { for (const key of keys) delete state[key]; },
      } },
    },
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  await installListener();
  assert.equal(state.apiKey, undefined);
  assert.equal(state.deepseekApiKey, undefined);
  assert.match(state.installId, /^[a-f0-9]{32}$/);
  assert.equal(state.voice, 'Maia');

  const response = await new Promise(resolve => {
    const keepAlive = messageListener({
      type: 'GET_SONG_INTRO',
      song: { site: 'netease', name: '测试歌曲', artist: '测试歌手' },
    }, {}, resolve);
    assert.equal(keepAlive, true);
  });

  assert.equal(requestUrl, 'https://song2radio.vercel.app/api/intro');
  assert.equal(requestBody.installId, state.installId);
  assert.equal(requestBody.voice, 'Maia');
  assert.equal(requestBody.apiKey, undefined);
  assert.equal(requestBody.deepseekApiKey, undefined);
  assert.equal(response.text, '服务端生成的介绍');
});
