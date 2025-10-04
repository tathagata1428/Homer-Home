export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url param" });
  }

  // Parse & allow-list the hostname (not substring)
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const ALLOW = new Set([
    "cloud.b4it.ro",       // ✅ added
    "reminder.b4it.ro",
    "journal.b4it.ro",
    "tasks.b4it.ro",
    "password.b4it.ro",
    "b4it.go.ro",          // Proxmox (any port)
    "ntfy.sh",
    "www.tnas.online",     // NAS
    "b4it.ro"              // root if you ever ping it directly
  ]);

  if (!ALLOW.has(host)) {
    return res.status(403).json({ error: "Forbidden host", host });
  }

  // Fetch with timeout + HEAD→GET fallback
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const baseOpts = { cache: "no-store", redirect: "follow", signal: controller.signal };

  try {
    let method = "HEAD";
    let r = await fetch(url, { ...baseOpts, method });

    // Some servers return 405 for HEAD; try GET
    if (!r.ok && (r.status === 405 || r.status === 501)) {
      method = "GET";
      r = await fetch(url, { ...baseOpts, method });
    }

    clearTimeout(timeout);

    const code = r.status || 0;
    // Consider reachable if we got any non-5xx HTTP response
    const up = code > 0 && code < 500;

    return res.status(200).json({ status: up ? "ok" : "down", code, host, method });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ status: "down", error: err.message, host });
  }
}
