/**
 * ============================================================
 *  บ้านสร้างคัพ — Admin Backend (Google Apps Script)
 * ============================================================
 *  วิธีติดตั้ง:
 *  1) เปิด Google Sheet ของคุณ → เมนู Extensions (ส่วนขยาย) → Apps Script
 *  2) ลบโค้ดเดิมในไฟล์ Code.gs ทิ้งทั้งหมด แล้ววางโค้ดทั้งไฟล์นี้แทน
 *  3) แก้ค่า ADMIN_PASSWORD ด้านล่างให้เป็นรหัสผ่านที่คุณต้องการ (ตั้งเอง)
 *  4) กด Deploy (ปุ่มสีน้ำเงินมุมขวาบน) → New deployment
 *     - Select type: เลือก "Web app"
 *     - Execute as: Me (บัญชีของคุณ)
 *     - Who has access: Anyone
 *  5) กด Deploy → คัดลอก "Web app URL" ที่ได้ (ลงท้ายด้วย /exec)
 *  6) เอา URL นั้นไปวางใน assets/js/config.js บรรทัด ADMIN_API_URL
 * ============================================================
 */

const ADMIN_PASSWORD = "chok0923"; // <-- ตั้งรหัสผ่านแอดมินของคุณตรงนี้

const SHEET_NAMES = {
  settings: "Settings",
  teams: "Teams",
  matches: "Matches",
  news: "News",
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.password !== ADMIN_PASSWORD) {
      return jsonOutput({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" });
    }

    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (action) {
      case "updateSettings":
        result = updateSettings(ss, body.data);
        break;
      case "upsertMatch":
        result = upsertRow(ss, SHEET_NAMES.matches, "id", body.data);
        break;
      case "deleteMatch":
        result = deleteRow(ss, SHEET_NAMES.matches, "id", body.id);
        break;
      case "upsertTeam":
        result = upsertRow(ss, SHEET_NAMES.teams, "id", body.data);
        break;
      case "deleteTeam":
        result = deleteRow(ss, SHEET_NAMES.teams, "id", body.id);
        break;
      case "upsertNews":
        result = upsertRow(ss, SHEET_NAMES.news, "id", body.data);
        break;
      case "deleteNews":
        result = deleteRow(ss, SHEET_NAMES.news, "id", body.id);
        break;
      default:
        return jsonOutput({ ok: false, error: "ไม่รู้จักคำสั่ง: " + action });
    }

    return jsonOutput({ ok: true, result: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // ใช้ตรวจสอบว่า deploy สำเร็จหรือยัง (เปิด URL ในเบราว์เซอร์จะเห็นข้อความนี้)
  return jsonOutput({ ok: true, message: "บ้านสร้างคัพ Admin API พร้อมใช้งาน" });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("ไม่พบแท็บชื่อ: " + name);
  return sheet;
}

function getHeaderRow(sheet) {
  const lastCol = sheet.getLastColumn();
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim());
}

/* ---------- Settings: key/value อัปเดตทับตาม key ---------- */
function updateSettings(ss, data) {
  const sheet = getSheet(ss, SHEET_NAMES.settings);
  const values = sheet.getDataRange().getValues(); // รวมแถวหัวตาราง (key, value)
  const keyToRow = {};
  for (let r = 1; r < values.length; r++) {
    keyToRow[String(values[r][0]).trim()] = r + 1; // 1-indexed row number in sheet
  }

  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (keyToRow[key]) {
      sheet.getRange(keyToRow[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });
  return { updated: Object.keys(data).length };
}

/* ---------- เพิ่มหรือแก้ไขแถวข้อมูล โดยอ้างอิงจากคอลัมน์ id ---------- */
function upsertRow(ss, sheetName, idColumn, rowData) {
  const sheet = getSheet(ss, sheetName);
  const headers = getHeaderRow(sheet);
  const idIndex = headers.indexOf(idColumn);
  if (idIndex === -1) throw new Error("ไม่พบคอลัมน์ " + idColumn + " ในแท็บ " + sheetName);

  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(rowData[idColumn])) {
      targetRow = r + 1;
      break;
    }
  }

  const rowArray = headers.map((h) => (rowData[h] !== undefined ? rowData[h] : ""));

  if (targetRow === -1) {
    // แถวใหม่: ถ้าไม่ได้ส่ง id มา ให้สร้าง id ใหม่อัตโนมัติ (เลขถัดจากค่ามากสุดที่มี)
    if (!rowData[idColumn]) {
      let maxId = 0;
      for (let r = 1; r < values.length; r++) {
        const n = parseInt(values[r][idIndex], 10);
        if (!isNaN(n) && n > maxId) maxId = n;
      }
      rowArray[idIndex] = maxId + 1;
    }
    sheet.appendRow(rowArray);
    return { created: true, id: rowArray[idIndex] };
  } else {
    sheet.getRange(targetRow, 1, 1, rowArray.length).setValues([rowArray]);
    return { updated: true, id: rowData[idColumn] };
  }
}

/* ---------- ลบแถวข้อมูลตาม id ---------- */
function deleteRow(ss, sheetName, idColumn, idValue) {
  const sheet = getSheet(ss, sheetName);
  const headers = getHeaderRow(sheet);
  const idIndex = headers.indexOf(idColumn);
  const values = sheet.getDataRange().getValues();

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idIndex]) === String(idValue)) {
      sheet.deleteRow(r + 1);
      return { deleted: true, id: idValue };
    }
  }
  return { deleted: false, error: "ไม่พบแถวที่มี id นี้" };
}
