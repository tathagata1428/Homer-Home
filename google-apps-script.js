// Google Apps Script — paste this into script.google.com
// This saves/retrieves Joey's context (profile, memories, history) to/from Google Drive

const SECRET = 'OixSxy7gpV0N5PrMWHYzXEotWTZWTJ7Cwlgd79pHdao=';
const FOLDER_NAME = 'Joey-Context-Backup';

function doGet(e) {
  try {
    var secret = e.parameter.secret;
    
    if (secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var action = e.parameter.action || 'restore';
    
    if (action === 'restore') {
      var folders = DriveApp.getFoldersByName(FOLDER_NAME);
      if (!folders.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'Backup folder not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var folder = folders.next();
      var latestFiles = folder.getFilesByName('joey-context-latest.json');
      
      if (!latestFiles.hasNext()) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'No backup found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var file = latestFiles.next();
      var content = file.getBlob().getDataAsString();
      return ContentService.createTextOutput(content)
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    Logger.log('POST received. Contents: ' + e.postData.contents);
    var data = JSON.parse(e.postData.contents);
    
    if (data.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ 
        error: 'Unauthorized', 
        received: data.secret ? data.secret.substring(0, 20) + '...' : 'empty',
        receivedLength: data.secret ? data.secret.length : 0,
        expectedLength: SECRET.length
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
    
    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var payload = {
      exportedAt: new Date().toISOString(),
      profile: data.profile || null,
      memories: data.memories || [],
      history: data.history || []
    };
    
    var fileName = 'joey-context-' + timestamp + '.json';
    folder.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    
    var latestFiles = folder.getFilesByName('joey-context-latest.json');
    if (latestFiles.hasNext()) {
      latestFiles.next().setContent(JSON.stringify(payload, null, 2));
    } else {
      folder.createFile('joey-context-latest.json', JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    }
    
    // Clean up old backups
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
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
