// Google Apps Script — paste this into script.google.com
// Deploy as: Web App → Execute as: Me → Who has access: Anyone

const SECRET = 'OixSxy7gpV0N5PrMWHYzXEotWTZWTJ7Cwlgd79pHdao=';

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

    // Save to Drive
    var folderName = 'Joey-Context-Backup';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var payload = {
      exportedAt: new Date().toISOString(),
      profile: data.profile || null,
      memories: data.memories || [],
      history: data.history || []
    };

    var content = JSON.stringify(payload, null, 2);

    // Save timestamped copy
    folder.createFile('joey-context-' + timestamp + '.json', content, MimeType.PLAIN_TEXT);

    // Update or create latest file
    var latestFiles = folder.getFilesByName('joey-context-latest.json');
    if (latestFiles.hasNext()) {
      latestFiles.next().setContent(content);
    } else {
      folder.createFile('joey-context-latest.json', content, MimeType.PLAIN_TEXT);
    }

    // Clean up old backups (keep last 20)
    var allFiles = folder.getFiles();
    var files = [];
    while (allFiles.hasNext()) {
      var f = allFiles.next();
      var name = f.getName();
      if (name !== 'joey-context-latest.json' && name.startsWith('joey-context-')) {
        files.push({ file: f, date: f.getDateCreated() });
      }
    }
    if (files.length > 20) {
      files.sort(function(a, b) { return a.date - b.date; });
      for (var i = 0; i < files.length - 20; i++) {
        files[i].file.setTrashed(true);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      memoriesCount: (data.memories || []).length,
      historyCount: (data.history || []).length,
      hasProfile: !!data.profile
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

    var folders = DriveApp.getFoldersByName('Joey-Context-Backup');
    if (!folders.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No backup folder found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var latestFiles = folders.next().getFilesByName('joey-context-latest.json');
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
