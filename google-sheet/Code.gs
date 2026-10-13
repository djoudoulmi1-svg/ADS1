function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("SYNC_SECRET");
    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");

    if (!expectedSecret || payload.sync_secret !== expectedSecret) {
      return output({ ok: false, error: "Unauthorized" });
    }
    if (!payload.user_id || !payload.email || !payload.display_name) {
      return output({ ok: false, error: "Incomplete roster record" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName("Users") || spreadsheet.insertSheet("Users");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["User ID", "Email", "Display Name", "First Seen", "Last Updated"]);
      }

      const lastRow = sheet.getLastRow();
      const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];
      const normalizedEmail = String(payload.email).trim().toLowerCase();
      const existingIndex = rows.findIndex(row =>
        String(row[0]) === String(payload.user_id) || String(row[1]).trim().toLowerCase() === normalizedEmail
      );
      const now = new Date();
      if (existingIndex >= 0) {
        const rowNumber = existingIndex + 2;
        const firstSeen = rows[existingIndex][3] || now;
        sheet.getRange(rowNumber, 1, 1, 5).setValues([[
          payload.user_id, normalizedEmail, payload.display_name, firstSeen, now
        ]]);
      } else {
        sheet.appendRow([payload.user_id, normalizedEmail, payload.display_name, now, now]);
      }
    } finally {
      lock.releaseLock();
    }

    return output({ ok: true });
  } catch (error) {
    return output({ ok: false, error: String(error) });
  }
}

function output(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}