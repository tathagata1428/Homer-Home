export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  // Only allow https ICS URLs
  if (!url.startsWith('https://')) {
    return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
  }

  try {
    var r = await fetch(url, {
      headers: { 'User-Agent': 'Homer-Home/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream returned ' + r.status });

    var text = await r.text();
    var events = parseICS(text);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ events: events });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch calendar' });
  }
}

function parseICS(text) {
  var events = [];
  var lines = unfold(text).split('\n');
  var evt = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      evt = {};
    } else if (line === 'END:VEVENT' && evt) {
      if (evt.start) events.push(evt);
      evt = null;
    } else if (evt) {
      var col = line.indexOf(':');
      if (col < 0) continue;
      var key = line.substring(0, col);
      var val = line.substring(col + 1);
      // Strip parameters (e.g. DTSTART;VALUE=DATE:20260316)
      var baseKey = key.split(';')[0];

      if (baseKey === 'SUMMARY') {
        evt.summary = unesc(val);
      } else if (baseKey === 'DTSTART') {
        evt.start = parseICSDate(val);
      } else if (baseKey === 'DTEND') {
        evt.end = parseICSDate(val);
      } else if (baseKey === 'LOCATION') {
        evt.location = unesc(val);
      } else if (baseKey === 'DESCRIPTION') {
        evt.description = unesc(val).substring(0, 200);
      }
    }
  }

  return events;
}

// Unfold long lines per RFC 5545
function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '');
}

// Parse ICS date formats: 20260316T140000Z or 20260316
function parseICSDate(val) {
  val = val.replace(/[^\dT]/g, '');
  if (val.length >= 8) {
    var y = val.substring(0, 4);
    var m = val.substring(4, 6);
    var d = val.substring(6, 8);
    var date = y + '-' + m + '-' + d;
    if (val.length >= 15) {
      var hh = val.substring(9, 11);
      var mm = val.substring(11, 13);
      return date + 'T' + hh + ':' + mm;
    }
    return date;
  }
  return val;
}

function unesc(s) {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\').replace(/\\;/g, ';');
}
