function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    const supabaseUrl = properties.getProperty("SUPABASE_URL");
    const anonKey = properties.getProperty("SUPABASE_ANON_KEY");

    if (!spreadsheetId || !supabaseUrl || !anonKey || !payload.access_token) {
      return output({ ok: false, error: "Unauthorized" });
    }

    const authResponse = UrlFetchApp.fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "get",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${payload.access_token}`
      },
      muteHttpExceptions: true
    });
    if (authResponse.getResponseCode() !== 200) {
      return output({ ok: false, error: "A valid signed-in account is required" });
    }
    const user = JSON.parse(authResponse.getContentText());
    if (!user.id || !user.email || !user.email_confirmed_at) {
      return output({ ok: false, error: "Confirm the account email before syncing" });
    }

    const profileResponse = UrlFetchApp.fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=display_name`,
      {
        method: "get",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${payload.access_token}`
        },
        muteHttpExceptions: true
      }
    );
    if (profileResponse.getResponseCode() !== 200) {
      return output({ ok: false, error: "Could not read the account profile" });
    }
    const profiles = JSON.parse(profileResponse.getContentText());
    if (!profiles.length) return output({ ok: false, error: "Account profile is not ready" });
    const displayName = profiles[0].display_name;

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
      const normalizedEmail = String(user.email).trim().toLowerCase();
      const existingIndex = rows.findIndex(row =>
        String(row[0]) === String(user.id) || String(row[1]).trim().toLowerCase() === normalizedEmail
      );
      const now = new Date();
      if (existingIndex >= 0) {
        const rowNumber = existingIndex + 2;
        const firstSeen = rows[existingIndex][3] || now;
        sheet.getRange(rowNumber, 1, 1, 5).setValues([[
          user.id, normalizedEmail, displayName, firstSeen, now
        ]]);
      } else {
        sheet.appendRow([user.id, normalizedEmail, displayName, now, now]);
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