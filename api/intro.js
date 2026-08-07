import { createIntro, RequestValidationError, validateIntroRequest } from '../lib/server/song2radio.js';
import { enforceRateLimits, getRedis, RateLimitError } from '../lib/server/rate-limit.js';

function sendJson(response, status, body, extraHeaders = {}) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.json(body);
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Song2Radio-Version');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'POST, OPTIONS' });

  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > 12_000) return sendJson(response, 413, { error: 'request_too_large' });
  if (!process.env.DASHSCOPE_API_KEY) return sendJson(response, 503, { error: 'service_not_configured' });

  try {
    const input = validateIntroRequest(request.body);
    const redis = getRedis();
    const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '')
      .split(',')[0]
      .trim();

    await enforceRateLimits({
      redis,
      installId: input.installId,
      ip,
      includeAlbumIntro: input.song.includeAlbumIntro,
    });

    const result = await createIntro(input, { redis });
    return sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof RequestValidationError) return sendJson(response, 400, { error: 'invalid_request' });
    if (error instanceof RateLimitError) {
      return sendJson(response, 429, { error: 'rate_limited' }, { 'Retry-After': String(error.retryAfter) });
    }
    if (error?.message === 'rate_limit_not_configured') {
      return sendJson(response, 503, { error: 'rate_limit_not_configured' });
    }
    console.error('intro_request_failed', error?.message || error);
    return sendJson(response, 502, { error: 'upstream_failed' });
  }
}
