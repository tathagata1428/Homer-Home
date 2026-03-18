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
      evt = { attendees: [] };
    } else if (line === 'END:VEVENT' && evt) {
      if (evt.start) events.push(evt);
      evt = null;
    } else if (evt) {
      var col = line.indexOf(':');
      if (col < 0) continue;
      var key = line.substring(0, col);
      var val = line.substring(col + 1);
      // Strip parameters but keep them for CN extraction
      var params = key.split(';');
      var baseKey = params[0];

      if (baseKey === 'SUMMARY') {
        evt.summary = unesc(val);
      } else if (baseKey === 'DTSTART') {
        evt.start = parseICSDate(val);
        // Check if all-day event
        if (key.indexOf('VALUE=DATE') >= 0 && val.length <= 8) {
          evt.allDay = true;
        }
      } else if (baseKey === 'DTEND') {
        evt.end = parseICSDate(val);
      } else if (baseKey === 'LOCATION') {
        evt.location = unesc(val);
      } else if (baseKey === 'DESCRIPTION') {
        evt.description = unesc(val);
      } else if (baseKey === 'CATEGORIES') {
        evt.categories = unesc(val).split(',').map(function(c) { return c.trim(); }).filter(Boolean);
      } else if (baseKey === 'ORGANIZER') {
        var orgName = extractParam(key, 'CN');
        var orgEmail = val.replace(/^mailto:/i, '');
        evt.organizer = { name: orgName || '', email: orgEmail || '' };
      } else if (baseKey === 'ATTENDEE') {
        var attName = extractParam(key, 'CN');
        var attRole = extractParam(key, 'ROLE') || '';
        var attStatus = extractParam(key, 'PARTSTAT') || '';
        var attEmail = val.replace(/^mailto:/i, '');
        evt.attendees.push({
          name: attName || '',
          email: attEmail || '',
          role: attRole,
          status: attStatus
        });
      } else if (baseKey === 'STATUS') {
        evt.status = val.trim();
      } else if (baseKey === 'PRIORITY') {
        evt.icsPriority = parseInt(val) || 0;
      } else if (baseKey === 'URL') {
        evt.url = val.trim();
      } else if (baseKey === 'TRANSP') {
        evt.transparency = val.trim();
      } else if (baseKey === 'CLASS') {
        evt.classification = val.trim();
      } else if (baseKey === 'CREATED') {
        evt.created = parseICSDate(val);
      } else if (baseKey === 'LAST-MODIFIED') {
        evt.lastModified = parseICSDate(val);
      } else if (baseKey === 'UID') {
        evt.uid = val.trim();
      } else if (baseKey === 'SEQUENCE') {
        evt.sequence = parseInt(val) || 0;
      } else if (baseKey === 'RRULE') {
        evt.recurrence = parseRRule(val);
      } else if (baseKey === 'RECURRENCE-ID') {
        evt.recurrenceId = parseICSDate(val);
      }
    }
  }

  return events;
}

function extractParam(key, param) {
  var parts = key.split(';');
  for (var i = 1; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq >= 0) {
      var pName = parts[i].substring(0, eq).trim();
      if (pName === param) {
        var pVal = parts[i].substring(eq + 1).trim();
        // Remove surrounding quotes
        if (pVal.charAt(0) === '"' && pVal.charAt(pVal.length - 1) === '"') {
          pVal = pVal.substring(1, pVal.length - 1);
        }
        return pVal;
      }
    }
  }
  return '';
}

function parseRRule(val) {
  var rule = {};
  val.split(';').forEach(function(part) {
    var eq = part.indexOf('=');
    if (eq >= 0) {
      var k = part.substring(0, eq).trim();
      var v = part.substring(eq + 1).trim();
      if (k === 'FREQ') rule.freq = v;
      else if (k === 'INTERVAL') rule.interval = parseInt(v) || 1;
      else if (k === 'COUNT') rule.count = parseInt(v) || 0;
      else if (k === 'UNTIL') rule.until = parseICSDate(v);
      else if (k === 'BYDAY') rule.byDay = v;
      else if (k === 'BYMONTHDAY') rule.byMonthDay = v;
    }
  });
  return rule;
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
