import crypto from 'crypto';
import { mergeDerivedFileContext } from './context-files.js';
import { getJoeyContextKeys, getJoeyMode } from './joey-context.js';
import { computeJoeySyncMeta } from './joey-sync-meta.js';
import {
  createRedisFetch,
  fetchWithRedirects,
  getGoogleDriveConfig,
  getRedisConfig,
  loadRedisJson,
  saveRedisJson,
  verifyJoeyPassphrase
} from './joey-server.js';

export default async function handleGdriveFile(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { passphrase, fileName, mimeType, size, base64Data, extractedText, source } = req.body || {};
  if (!passphrase) return res.status(401).json({ error: 'Missing passphrase' });
  if (!fileName || !base64Data) return res.status(400).json({ error: 'Missing file data' });
  const mode = getJoeyMode(req);
  const { MEMORY_KEY, PROFILE_KEY, HISTORY_KEY, FILES_KEY, FILE_LIBRARY_KEY, CUSTOM_FILES_KEY, JOURNAL_KEY, SYNC_META_KEY } = getJoeyContextKeys(mode);

  const { webhook: gdriveWebhook, secret: gdriveSecret } = getGoogleDriveConfig();
  if (!gdriveWebhook) return res.status(500).json({ error: 'GDRIVE_WEBHOOK_URL not configured' });
  if (!gdriveSecret) return res.status(500).json({ error: 'GDRIVE_SECRET not configured' });

  const redisFetch = createRedisFetch();
  const { url: redisUrl, token: redisToken } = getRedisConfig();
  if (!redisUrl || !redisToken || !redisFetch) return res.status(500).json({ error: 'Redis not configured' });

  function sanitizeFileName(name) {
    return String(name || 'upload.bin').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'upload.bin';
  }

  try {
    const isValid = await verifyJoeyPassphrase(passphrase, redisFetch);
    if (!isValid) return res.status(403).json({ error: 'Forbidden' });

    const binary = Buffer.from(String(base64Data || ''), 'base64');
    const sha256 = crypto.createHash('sha256').update(binary).digest('hex');
    const id = 'file_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const uploadedAt = new Date().toISOString();
    const safeName = sanitizeFileName(fileName);
    const normalizedText = String(extractedText || '').trim().slice(0, 40000);

    const payload = {
      action: 'upload_file',
      secret: gdriveSecret,
      mode,
      file: {
        id,
        name: safeName,
        mimeType: String(mimeType || 'application/octet-stream'),
        size: Number(size) || binary.length,
        uploadedAt,
        base64Data: binary.toString('base64'),
        extractedText: normalizedText
      }
    };

    const response = await fetchWithRedirects(gdriveWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const redirectChain = response.redirectChain || [];

    if (!response.text) {
      return res.status(response.status || 502).json({ error: response.error || 'No response after redirects', redirectChain });
    }

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return res.status(502).json({
        error: 'Non-JSON response from Google',
        status: response.status,
        responsePreview: response.text.slice(0, 300),
        redirectChain
      });
    }
    if (parsed.error) {
      return res.status(502).json({
        error: 'Google Script rejected the request',
        detail: parsed.error,
        hint: parsed.hint || (parsed.error === 'Unauthorized'
          ? 'Redeploy Apps Script and confirm its SECRET matches the GDRIVE_SECRET env var exactly.'
          : undefined),
        redirectChain
      });
    }

    const library = await loadRedisJson(redisFetch, FILE_LIBRARY_KEY, []);
    const record = {
      id,
      name: safeName,
      mimeType: String(mimeType || 'application/octet-stream'),
      size: Number(size) || binary.length,
      sha256,
      uploadedAt,
      processedAt: uploadedAt,
      source: source || 'chat-upload',
      driveFileId: parsed.fileId || '',
      folderId: parsed.folderId || '',
      folderName: parsed.folderName || '',
      folderUrl: parsed.folderUrl || '',
      driveUrl: parsed.webViewLink || parsed.driveUrl || '',
      downloadUrl: parsed.webContentLink || parsed.downloadUrl || '',
      excerpt: normalizedText.slice(0, 500),
      extractedText: normalizedText
    };

    const existingIndex = library.findIndex((item) => item && item.sha256 === sha256 && item.name === safeName);
    if (existingIndex >= 0) {
      library[existingIndex] = { ...library[existingIndex], ...record, id: library[existingIndex].id || id };
    } else {
      library.push(record);
    }
    while (library.length > 60) library.shift();
    const [profile, memories, history, currentFiles, customFiles, journal, syncMetaStored] = await Promise.all([
      loadRedisJson(redisFetch, PROFILE_KEY, {}),
      loadRedisJson(redisFetch, MEMORY_KEY, []),
      loadRedisJson(redisFetch, HISTORY_KEY, []),
      loadRedisJson(redisFetch, FILES_KEY, {}),
      loadRedisJson(redisFetch, CUSTOM_FILES_KEY, {}),
      loadRedisJson(redisFetch, JOURNAL_KEY, []),
      loadRedisJson(redisFetch, SYNC_META_KEY, {})
    ]);
    const nextFiles = mergeDerivedFileContext(currentFiles, library, customFiles, uploadedAt);
    const nextSyncMeta = computeJoeySyncMeta({
      mode,
      profile,
      memories,
      history,
      files: nextFiles,
      fileLibrary: library,
      customFiles,
      journal
    }, {
      ...(syncMetaStored && typeof syncMetaStored === 'object' ? syncMetaStored : {}),
      mode,
      updatedAt: uploadedAt,
      lastSource: 'gdrive-file-upload'
    });
    await Promise.all([
      saveRedisJson(redisFetch, FILE_LIBRARY_KEY, library),
      saveRedisJson(redisFetch, FILES_KEY, nextFiles),
      saveRedisJson(redisFetch, SYNC_META_KEY, nextSyncMeta)
    ]);

    return res.status(200).json({ ok: true, file: record, drive: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}
