// Google Apps Script — paste this into script.google.com
// This saves Joey's context (profile, memories, history) to a Google Drive folder

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = data.secret;

    // Simple auth — set this to a secret of your choice
    if (secret !== 'CHANGE_THIS_SECRET') {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Create or find the folder
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

    // Save timestamped backup
    var fileName = 'joey-context-' + timestamp + '.json';
    folder.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

    // Also update a "latest" file (overwrite)
    var latestFiles = folder.getFilesByName('joey-context-latest.json');
    if (latestFiles.hasNext()) {
      latestFiles.next().setContent(JSON.stringify(payload, null, 2));
    } else {
      folder.createFile('joey-context-latest.json', JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    }

    // Clean up old backups — keep last 30
    var allFiles = folder.getFiles();
    var files = [];
    while (allFiles.hasNext()) {
      var f = allFiles.next();
      if (f.getName().startsWith('joey-context-') && f.getName() !== 'joey-context-latest.json') {
        files.push({ file: f, date: f.getDateCreated() });
      }
    }
    files.sort(function(a, b) { return b.date - a.date; });
    for (var i = 30; i < files.length; i++) {
      files[i].file.setTrashed(true);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, file: fileName }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
