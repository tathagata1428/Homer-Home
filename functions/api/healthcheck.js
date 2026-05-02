export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '*';
  return Response.json({
    ok: true,
    ts: Date.now(),
    ver: 'gdrive-restore-v2',
    hasGdriveUrl: !!(env && env.GDRIVE_WEBHOOK_URL),
    hasGdriveSecret: !!(env && env.GDRIVE_SECRET)
  }, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'no-store'
    }
  });
}
