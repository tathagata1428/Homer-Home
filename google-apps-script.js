// Google Apps Script — paste this into script.google.com
// Deploy as: Web App → Execute as: Me → Who has access: Anyone

const SECRET = 'OixSxy7gpV0N5PrMWHYzXEotWTZWTJ7Cwlgd79pHdao=';
const UPLOADS_FOLDER_NAME = 'Joey-Context-Uploads';
const WORK_UPLOADS_FOLDER_NAME = 'Joey-Work-Context-Uploads';
const BACKUP_FOLDER_NAME = 'Joey-Context-Backup';
const WORK_BACKUP_FOLDER_NAME = 'Joey-Work-Context-Backup';
const UPLOADS_FOLDER_ID = '1GX4SkZsAGa7KwSdnneyMmGra6djxRaAO';
const WORK_UPLOADS_FOLDER_ID = '';
const BACKUP_FOLDER_ID = '';
const WORK_BACKUP_FOLDER_ID = '';
const VAULT_EMERGENCY_FOLDER_NAME = 'Homer-Vault-Emergency-Backup';
const VAULT_EMERGENCY_FOLDER_ID = '';

function normalizeMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'work' ? 'work' : 'personal';
}

function getUploadsFolderConfig(mode) {
  return normalizeMode(mode) === 'work'
    ? { name: WORK_UPLOADS_FOLDER_NAME, id: WORK_UPLOADS_FOLDER_ID }
    : { name: UPLOADS_FOLDER_NAME, id: UPLOADS_FOLDER_ID };
}

function getBackupFolderConfig(mode) {
  return normalizeMode(mode) === 'work'
    ? { name: WORK_BACKUP_FOLDER_NAME, id: WORK_BACKUP_FOLDER_ID }
    : { name: BACKUP_FOLDER_NAME, id: BACKUP_FOLDER_ID };
}

function getVaultEmergencyFolderConfig() {
  return { name: VAULT_EMERGENCY_FOLDER_NAME, id: VAULT_EMERGENCY_FOLDER_ID };
}

function formatDriveStamp(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
}

function getTargetFolder(folderName, folderId) {
  var safeId = String(folderId || '').trim();
  if (safeId) return DriveApp.getFolderById(safeId);

  var safeName = String(folderName || '').trim();
  if (!safeName) {
    throw new Error('Folder name is empty');
  }

  var folders = DriveApp.getFoldersByName(safeName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(safeName);
}

function listFilesByName(folder, fileName) {
  var out = [];
  var iter = folder.getFilesByName(String(fileName || '').trim());
  while (iter.hasNext()) out.push(iter.next());
  return out;
}

function upsertTextFile(folder, fileName, content, mimeType) {
  var name = String(fileName || '').trim();
  if (!name) throw new Error('File name is empty');
  var nextContent = String(content || '');
  var matches = listFilesByName(folder, name);
  var primary = matches.length ? matches.shift() : null;
  if (primary) {
    var currentContent = '';
    try { currentContent = primary.getBlob().getDataAsString(); } catch (_err) {}
    if (currentContent !== nextContent) primary.setContent(nextContent);
  } else {
    primary = folder.createFile(name, nextContent, mimeType || MimeType.PLAIN_TEXT);
  }
  matches.forEach(function(file) {
    try { file.setTrashed(true); } catch (_err) {}
  });
  return primary;
}

function syncManagedContextFiles(folder, filesMap) {
  var source = filesMap && typeof filesMap === 'object' ? filesMap : {};
  var keep = { 'joey-context.json': true };
  Object.keys(source).forEach(function(name) {
    var safeName = String(name || '').trim();
    if (safeName) keep[safeName] = true;
  });

  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var file = iter.next();
    var name = String(file.getName() || '');
    if (keep[name]) continue;
    if (/\.(md|txt)$/i.test(name)) {
      try { file.setTrashed(true); } catch (_err) {}
    }
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'No POST body received — the request may have been converted to GET during redirect'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);

    // Trim both sides for robust comparison
    var receivedSecret = (data.secret || '').trim();
    var expectedSecret = SECRET.trim();

    if (receivedSecret !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Unauthorized',
        hint: 'Secret mismatch. Received length: ' + receivedSecret.length + ', expected length: ' + expectedSecret.length +
          '. First 4 chars match: ' + (receivedSecret.slice(0, 4) === expectedSecret.slice(0, 4))
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var mode = normalizeMode(data.mode);

    if ((data.action || '') === 'upload_file') {
      var upload = data.file || {};
      var uploadFolderCfg = getUploadsFolderConfig(mode);
      var uploadFolder = getTargetFolder(uploadFolderCfg.name, uploadFolderCfg.id);
      var safeName = String(upload.name || 'upload.bin').replace(/[\\/:*?"<>|]+/g, '-');
      var binary = Utilities.base64Decode(String(upload.base64Data || ''));
      var blob = Utilities.newBlob(binary, upload.mimeType || MimeType.PLAIN_TEXT, safeName);
      var driveFile = uploadFolder.createFile(blob);

      if (upload.extractedText) {
        var sidecarName = String(upload.id || driveFile.getId()) + '--' + safeName + '.txt';
        uploadFolder.createFile(sidecarName, String(upload.extractedText || ''), MimeType.PLAIN_TEXT);
      }

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        fileId: driveFile.getId(),
        fileName: safeName,
        folderId: uploadFolder.getId(),
        folderName: uploadFolder.getName(),
        folderUrl: uploadFolder.getUrl(),
        driveUrl: driveFile.getUrl(),
        webViewLink: driveFile.getUrl(),
        webContentLink: 'https://drive.google.com/uc?export=download&id=' + driveFile.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if ((data.kind || '') === 'vault-snapshot') {
      var vaultFolderCfg = getVaultEmergencyFolderConfig();
      var vaultFolder = getTargetFolder(vaultFolderCfg.name, vaultFolderCfg.id);
      var exportedAt = new Date();
      var vaultPayload = {
        exportedAt: exportedAt.toISOString(),
        kind: 'vault-snapshot',
        snapshot: data.snapshot || {},
        manifest: data.manifest || null,
        meta: data.meta || {}
      };
      var vaultContent = JSON.stringify(vaultPayload, null, 2);
      var latestName = 'homer-vault-latest.json';
      var archiveName = 'homer-vault-' + formatDriveStamp(exportedAt) + '.json';
      var latestFiles = vaultFolder.getFilesByName(latestName);
      if (latestFiles.hasNext()) latestFiles.next().setContent(vaultContent);
      else vaultFolder.createFile(latestName, vaultContent, MimeType.PLAIN_TEXT);
      var archiveFile = vaultFolder.createFile(archiveName, vaultContent, MimeType.PLAIN_TEXT);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        kind: 'vault-snapshot',
        exportedAt: vaultPayload.exportedAt,
        fileName: archiveName,
        folderId: vaultFolder.getId(),
        folderName: vaultFolder.getName(),
        folderUrl: vaultFolder.getUrl(),
        driveUrl: archiveFile.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Save to Drive
    var backupFolderCfg = getBackupFolderConfig(mode);
    var folder = getTargetFolder(backupFolderCfg.name, backupFolderCfg.id);

    var payload = {
      exportedAt: new Date().toISOString(),
      mode: mode,
      profile: data.profile || null,
      memories: data.memories || [],
      history: data.history || [],
      files: data.files || {},
      fileLibrary: data.fileLibrary || [],
      customFiles: data.customFiles || {},
      journal: data.journal || [],
      syncMeta: data.syncMeta || {}
    };

    var content = JSON.stringify(payload, null, 2);

    // Update or create stable JSON snapshot
    upsertTextFile(folder, 'joey-context.json', content, MimeType.PLAIN_TEXT);

    var files = data.files || {};
    Object.keys(files).sort().forEach(function (name) {
      var body = String(files[name] || '');
      upsertTextFile(folder, name, body, MimeType.PLAIN_TEXT);
    });
    syncManagedContextFiles(folder, files);

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      exportedAt: payload.exportedAt,
      memoriesCount: (data.memories || []).length,
      historyCount: (data.history || []).length,
      hasProfile: !!data.profile,
      customFilesCount: Object.keys(data.customFiles || {}).length,
      journalCount: (data.journal || []).length
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.message,
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var receivedSecret = ((e.parameter || {}).secret || '').trim();
    if (receivedSecret !== SECRET.trim()) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var folder;
    var mode = normalizeMode((e.parameter || {}).mode);
    try {
      var backupFolderCfg = getBackupFolderConfig(mode);
      folder = getTargetFolder(backupFolderCfg.name, backupFolderCfg.id);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No backup folder found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var latestFiles = folder.getFilesByName('joey-context.json');
    if (!latestFiles.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No backup file found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var content = latestFiles.next().getBlob().getDataAsString();
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
