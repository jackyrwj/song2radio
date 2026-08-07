export default function handler(_request, response) {
  const keyConfigured = Boolean(process.env.DASHSCOPE_API_KEY);
  const rateLimitConfigured = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
  const ready = keyConfigured && rateLimitConfigured;
  response.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'configuration_required',
    keyConfigured,
    rateLimitConfigured,
  });
}
