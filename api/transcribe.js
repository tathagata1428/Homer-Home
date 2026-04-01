function cleanTranscript(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '');
  }
  text = text.replace(/^Transcript:\s*/i, '').trim();
  return text;
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload && payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate && candidate.content && candidate.content.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return cleanTranscript(text);
  }
  return '';
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const audioBase64 = String(body.audioBase64 || '').trim();
  const mimeType = String(body.mimeType || 'audio/webm').trim();
  const language = String(body.language || '').trim();
  if (!audioBase64) {
    return res.status(400).json({ ok: false, error: 'Missing audio data' });
  }
  if (audioBase64.length > 18 * 1024 * 1024) {
    return res.status(413).json({ ok: false, error: 'Audio payload too large' });
  }

  const model = String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash').trim();
  const prompt =
    'Transcribe the spoken words from this audio recording. ' +
    'Return only the transcript text, with normal punctuation. ' +
    'Do not add labels, speaker names, commentary, or markdown.' +
    (language ? (' The speaker language hint is: ' + language + '.') : '');

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent?key=' +
        encodeURIComponent(geminiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        })
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        (payload && payload.error && (payload.error.message || payload.error.status)) ||
        ('HTTP ' + response.status);
      return res.status(response.status || 502).json({ ok: false, error: String(detail || 'Transcription failed') });
    }

    const transcript = extractGeminiText(payload);
    if (!transcript) {
      return res.status(200).json({ ok: true, transcript: '', model, warning: 'No transcript text returned' });
    }

    return res.status(200).json({ ok: true, transcript, model });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error && error.message ? error.message : 'Transcription request failed'
    });
  }
}
