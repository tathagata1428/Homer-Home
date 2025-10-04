export default async function handler(req, res) {
  // ✅ Allow requests from any origin (frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url param" });
  }

  // Only allow known safe hosts
  const allowed = [
    "b4it.ro",
    "b4it.go.ro",
    "ntfy.sh",
    "reminder.b4it.ro",
    "journal.b4it.ro",
    "tasks.b4it.ro",
    "password.b4it.ro",
    "www.tnas.online"
  ];
  if (!allowed.some(host => url.includes(host))) {
    return res.status(403).json({ error: "Forbidden host" });
  }

  try {
    // ✅ Always fetch with follow redirects + timeout protection
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "follow", signal: controller.signal });
    clearTimeout(timeout);

    if (r.ok) {
      res.status(200).json({ status: "ok", code: r.status });
    } else {
      res.status(200).json({ status: "down", code: r.status });
    }
  } catch (err) {
    res.status(200).json({ status: "down", error: err.message });
  }
}
