/* =========================================================
   sheets.js
   ดึงข้อมูลจาก Google Sheet ที่ "เผยแพร่สู่เว็บ" แล้ว โดยใช้
   Google Visualization API (gviz) ซึ่งคืนค่าเป็น JSON โดยไม่ต้อง
   ใช้ API key และไม่ต้องเขียนเซิร์ฟเวอร์ฝั่งหลังบ้านเพิ่ม
   ========================================================= */

const FutsalData = (() => {
  function gvizUrl(sheetName) {
    // headers=0 ปิดการ "เดาหัวตาราง" อัตโนมัติของ Google ซึ่งบางครั้งเดาผิด
    // และทำให้แถวข้อมูลแรก ๆ หายไปอย่างเงียบ ๆ
    // พารามิเตอร์ _= เป็นตัวกันแคชฝั่ง Google เอง (ไม่ใช่แคชเบราว์เซอร์) เพื่อให้ได้
    // ข้อมูลล่าสุดเสมอ โดยเฉพาะหลังลบ/แก้ไขข้อมูลผ่านหน้าแอดมิน
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      sheetName
    )}&headers=0&_=${Date.now()}`;
  }

  // Google เดา "จำนวนหัวตาราง" และ "ชนิดข้อมูล" ของแต่ละคอลัมน์เองโดยอัตโนมัติ
  // ซึ่งบางครั้งเดาผิด (เช่น เจอค่าตัวเลขเยอะกว่าตัวหนังสือในคอลัมน์เดียวกัน
  // ก็จะตัดสินว่าทั้งคอลัมน์เป็น "ตัวเลข" แล้วทิ้งค่าที่เป็นตัวหนังสือเป็น null)
  // เราจึงใช้ headers=0 (ปิดการเดา) แล้วกำหนดชื่อคอลัมน์ตามลำดับเองแทน
  // ให้ผลลัพธ์แม่นยำแน่นอน ไม่ขึ้นกับการเดาของ Google
  const COLUMN_ORDER = {
    Settings: ["key", "value"],
    Teams: ["id", "division", "group", "name"],
    Matches: [
      "id", "division", "group", "round", "date", "time", "venue",
      "team_home", "team_away", "score_home", "score_away", "status",
      "yellow_home", "red_home", "yellow_away", "red_away",
    ],
    News: ["id", "date", "title", "excerpt", "content", "image_url"],
  };

  // แปลง response แปลก ๆ ของ gviz (ที่ห่อด้วยฟังก์ชัน) ให้เป็น JSON ปกติ
  function parseGviz(text, sheetName) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const json = JSON.parse(text.substring(start, end + 1));
    const cols = COLUMN_ORDER[sheetName] || json.table.cols.map((c, i) => c.id || `col${i}`);

    let rows = json.table.rows.map((r) => {
      const obj = {};
      cols.forEach((colName, i) => {
        const cell = r.c && r.c[i];
        obj[colName] = cell ? (cell.v ?? cell.f ?? "") : "";
      });
      return obj;
    });

    // เนื่องจากตั้ง headers=0 แถวแรกที่ได้คือแถวหัวตารางจริง ("key","value" ฯลฯ)
    // ให้ตัดทิ้ง 1 แถวถ้าตรงกับชื่อคอลัมน์แรกพอดี
    if (rows.length && String(rows[0][cols[0]]).trim().toLowerCase() === cols[0]) {
      rows = rows.slice(1);
    }

    // ตัดแถวว่างล้วน (เผื่อมีแถวเปล่าติดมาท้ายชีต)
    return rows.filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
  }

  async function fetchSheet(sheetName) {
    // ถ้าตั้งค่าระบบแอดมินไว้แล้ว ใช้ Apps Script อ่านข้อมูลแทน gviz เพราะ gviz มีแคช
    // ฝั่ง Google เองที่บางครั้งค้างข้อมูลเก่าอยู่หลายนาที ส่วน Apps Script อ่านสดทุกครั้ง
    if (ADMIN_API_URL) {
      const url = `${ADMIN_API_URL}?sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch-failed");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "fetch-failed");
      return json.data;
    }

    // โหมดสำรอง (ยังไม่ได้ตั้งค่าระบบแอดมิน) — อ่านผ่าน gviz แบบเดิม
    if (!SHEET_ID) throw new Error("no-sheet-id");
    const res = await fetch(gvizUrl(sheetName), { cache: "no-store" });
    if (!res.ok) throw new Error("fetch-failed");
    const text = await res.text();
    return parseGviz(text, sheetName);
  }

  function settingsArrayToObject(rows) {
    const obj = {};
    rows.forEach((row) => {
      const key = (row.key || row.Key || "").toString().trim();
      const value = row.value ?? row.Value ?? "";
      if (key) obj[key] = value;
    });
    return obj;
  }

  async function fetchBulk() {
    if (!ADMIN_API_URL) return null;
    const url = `${ADMIN_API_URL}?bulk=1&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch-failed");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "fetch-failed");
    return json; // { settings, teams, matches, news }
  }

  async function getSettings() {
    try {
      const rows = await fetchSheet(SHEET_TABS.settings);
      const parsed = settingsArrayToObject(rows);
      return { ...SAMPLE_DATA.settings, ...parsed };
    } catch (e) {
      return SAMPLE_DATA.settings;
    }
  }

  async function getTeams() {
    try {
      const rows = await fetchSheet(SHEET_TABS.teams);
      return rows; // แม้ผลลัพธ์จะว่างเปล่า (ลบข้อมูลหมดแล้ว) ก็ถือเป็นค่าจริง ไม่ใช่ error
    } catch (e) {
      return SAMPLE_DATA.teams;
    }
  }

  async function getMatches() {
    try {
      const rows = await fetchSheet(SHEET_TABS.matches);
      return rows;
    } catch (e) {
      return SAMPLE_DATA.matches;
    }
  }

  async function getNews() {
    try {
      const rows = await fetchSheet(SHEET_TABS.news);
      return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    } catch (e) {
      return SAMPLE_DATA.news;
    }
  }

  /* รายชื่อทีมที่สมัครเข้าร่วม — ใช้เฉพาะหน้าแอดมิน ไม่รวมอยู่ใน bulk เพราะไม่ใช่
     ข้อมูลสาธารณะที่หน้าอื่นต้องใช้ (ไม่มีข้อมูลตัวอย่างสำรอง ถ้าดึงไม่ได้คืน [] ว่าง) */
  async function getRegistrations() {
    try {
      return await fetchSheet(SHEET_TABS.registrations);
    } catch (e) {
      return [];
    }
  }

  /* ดึงข้อมูลหลักทั้ง 4 อย่างในคำขอเดียว (เร็วกว่ายิงทีละอย่างมาก) ใช้ในทุกหน้า
     แทน Promise.all(getSettings(), getTeams(), ...) เดิม — ถ้าโหมด bulk ใช้ไม่ได้
     (เช่น ยังไม่ได้ตั้งค่าแอดมิน หรือ Apps Script ล่ม) จะร่วงกลับไปดึงทีละอย่างเหมือนเดิม
     ซึ่งแต่ละอย่างก็มีระบบสำรอง (gviz แล้วก็ข้อมูลตัวอย่าง) อยู่แล้วในตัว */
  async function getAll() {
    try {
      const bulk = await fetchBulk();
      if (bulk) {
        return {
          settings: { ...SAMPLE_DATA.settings, ...bulk.settings },
          teams: bulk.teams || [],
          matches: bulk.matches || [],
          news: (bulk.news || []).sort((a, b) => (a.date < b.date ? 1 : -1)),
        };
      }
    } catch (e) {
      // ตกไปดึงทีละอย่างด้านล่าง
    }
    const [settings, teams, matches, news] = await Promise.all([
      getSettings(),
      getTeams(),
      getMatches(),
      getNews(),
    ]);
    return { settings, teams, matches, news };
  }

  return { getSettings, getTeams, getMatches, getNews, getRegistrations, getAll };
})();
