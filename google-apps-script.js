// Google Apps Script — paste this into script.google.com

const SECRET = 'OixSxy7gpV0N5PrMWHYzXEotWTZWTJ7Cwlgd79pHdao=';

function doPost(e) {
  try {
    // Log raw request for debugging
    Logger.log('Raw POST body: ' + e.postData.contents);
    
    var data = JSON.parse(e.postData.contents);
    
    // Debug response showing what was received
    if (data.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ 
        error: 'Unauthorized',
        debug: {
          received: data.secret,
          receivedLength: data.secret ? data.secret.length : 0,
          expectedLength: SECRET.length,
          secretMatch: data.secret === SECRET
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Success - save to Drive
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
    
    folder.createFile('joey-context-' + timestamp + '.json', JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    
    var latestFiles = folder.getFilesByName('joey-context-latest.json');
    if (latestFiles.hasNext()) {
      latestFiles.next().setContent(JSON.stringify(payload, null, 2));
    } else {
      folder.createFile('joey-context-latest.json', JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    if (e.parameter.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var folders = DriveApp.getFoldersByName('Joey-Context-Backup');
    if (!folders.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No folder' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var latestFiles = folders.next().getFilesByName('joey-context-latest.json');
    if (!latestFiles.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'No backup' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var content = latestFiles.next().getBlob().getDataAsString();
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
