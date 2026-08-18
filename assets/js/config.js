/* =========================================================
   ตั้งค่าเว็บไซต์ "บ้านสร้างคัพ"
   ============================================================
   1) ไปสร้าง Google Sheet ของคุณ (ดูโครงสร้างคอลัมน์ใน README.md)
   2) กด แชร์ > เผยแพร่สู่เว็บ (File > Share > Publish to web)
   3) คัดลอก "รหัส Sheet" จาก URL มาใส่ที่ SHEET_ID ด้านล่าง
      ตัวอย่าง URL: https://docs.google.com/spreadsheets/d/1AbCxxxxx/edit
                                                      ^^^^^^^^^^ ส่วนนี้
   4) ตั้งชื่อแท็บ (sheet tab) ให้ตรงกับ SHEET_TABS ด้านล่าง
   5) เมื่อกรอก SHEET_ID แล้ว เว็บไซต์จะดึงข้อมูลจาก Google Sheet
      โดยอัตโนมัติ ไม่ต้องแก้โค้ดอีก แก้ข้อมูลในชีตได้เลย
   ========================================================= */

const SHEET_ID = "1wmvaN9oJV9ZtJlH9S88haRcrFq66BOIz47FdxDlF3K0";

const SHEET_TABS = {
  settings: "Settings",
  teams: "Teams",
  matches: "Matches",
  news: "News",
  registrations: "Registrations",
  rules: "Rules",
};

/* =========================================================
   หน้าแอดมิน (admin.html) — ต้องมี URL นี้ถึงจะแก้ไขข้อมูลผ่านหน้าเว็บได้
   วิธีได้มา: ดูขั้นตอนใน apps-script/Code.gs และ README.md หัวข้อ
   "เปิดใช้งานหน้าแอดมิน"
   ตัวอย่างรูปแบบ: https://script.google.com/macros/s/AKfycbxxxxxxxxxx/exec
   ========================================================= */
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbyCZAAftycS-ISsr26jNAE58ZPd9XoDSLxwyvPQuvVdSjevP2SI50eLJToNSTEwu2Lu/exec";

/* =========================================================
   ข้อมูลตัวอย่าง (SAMPLE DATA)
   ใช้แสดงผลทันทีก่อนเชื่อม Google Sheet จริง และใช้เป็น "แผนสำรอง"
   หากดึงข้อมูลจากชีตไม่สำเร็จ (เช่น ยังไม่ได้ตั้งค่า SHEET_ID)
   แก้ไขค่าพวกนี้ได้อิสระ หรือปล่อยไว้เป็นตัวอย่างก็ได้
   ========================================================= */

const SAMPLE_DATA = {
  settings: {
    site_title: "บ้านสร้างคัพ ครั้งที่ 1",
    site_subtitle: "การแข่งขันฟุตซอลการกุศลโอเพ่น",
    banner_tagline:
      "รายได้ทั้งหมดหักค่าใช้จ่ายแล้ว นำไปซ่อมแซมสนามฟุตซอลให้กับเด็กในชุมชนวัดบ้านสร้าง",
    event_dates: "6–8 พฤศจิกายน 2569",
    venue_name: "สนามฟุตซอลชายน้ำบ้านสร้าง (ไม่มีโดม)",
    venue_address: "อ.บ้านสร้าง จ.ปราจีนบุรี",
    live_note: "มีไลฟ์สดถ่ายทอดตลอดการแข่งขัน",
    half_minutes: "15",
    contact1_name: "คุณโชค",
    contact1_phone: "098-665-3916",
    contact2_name: "คุณเบญ",
    contact2_phone: "065-636-2988",

    teams_u12: "12",
    fee_u12: "1,500",
    deposit_u12: "500",
    prize_u12_1: "3,000",
    prize_u12_2: "2,000",
    prize_u12_3: "1,000 (ร่วม)",
    age_u12: "รุ่นอายุไม่เกิน 12 ปี (เกิด พ.ศ. 2557 ขึ้นไป)",

    teams_u14: "16",
    fee_u14: "1,800",
    deposit_u14: "500",
    prize_u14_1: "5,000",
    prize_u14_2: "3,000",
    prize_u14_3: "1,000 (ร่วม)",
    age_u14: "รุ่นอายุไม่เกิน 14 ปี (เกิด พ.ศ. 2555 ขึ้นไป)",
  },

  teams: [
    { id: 1, division: "U12", group: "A", name: "ทีม A1" },
    { id: 2, division: "U12", group: "A", name: "ทีม A2" },
    { id: 3, division: "U12", group: "A", name: "ทีม A3" },
    { id: 4, division: "U12", group: "B", name: "ทีม B1" },
    { id: 5, division: "U12", group: "B", name: "ทีม B2" },
    { id: 6, division: "U12", group: "B", name: "ทีม B3" },
    { id: 7, division: "U12", group: "C", name: "ทีม C1" },
    { id: 8, division: "U12", group: "C", name: "ทีม C2" },
    { id: 9, division: "U12", group: "C", name: "ทีม C3" },
    { id: 10, division: "U12", group: "D", name: "ทีม D1" },
    { id: 11, division: "U12", group: "D", name: "ทีม D2" },
    { id: 12, division: "U12", group: "D", name: "ทีม D3" },

    { id: 13, division: "U14", group: "A", name: "ทีม A1" },
    { id: 14, division: "U14", group: "A", name: "ทีม A2" },
    { id: 15, division: "U14", group: "A", name: "ทีม A3" },
    { id: 16, division: "U14", group: "A", name: "ทีม A4" },
    { id: 17, division: "U14", group: "B", name: "ทีม B1" },
    { id: 18, division: "U14", group: "B", name: "ทีม B2" },
    { id: 19, division: "U14", group: "B", name: "ทีม B3" },
    { id: 20, division: "U14", group: "B", name: "ทีม B4" },
    { id: 21, division: "U14", group: "C", name: "ทีม C1" },
    { id: 22, division: "U14", group: "C", name: "ทีม C2" },
    { id: 23, division: "U14", group: "C", name: "ทีม C3" },
    { id: 24, division: "U14", group: "C", name: "ทีม C4" },
    { id: 25, division: "U14", group: "D", name: "ทีม D1" },
    { id: 26, division: "U14", group: "D", name: "ทีม D2" },
    { id: 27, division: "U14", group: "D", name: "ทีม D3" },
    { id: 28, division: "U14", group: "D", name: "ทีม D4" },
  ],

  matches: [
    { id: 1, division: "U12", group: "A", round: "รอบแบ่งกลุ่ม", date: "2026-11-06", time: "09:00", venue: "สนาม 1", team_home: "ทีม A1", team_away: "ทีม A2", score_home: "", score_away: "", status: "upcoming" },
    { id: 2, division: "U12", group: "A", round: "รอบแบ่งกลุ่ม", date: "2026-11-06", time: "09:30", venue: "สนาม 2", team_home: "ทีม A3", team_away: "ทีม B1", score_home: "", score_away: "", status: "upcoming" },
    { id: 3, division: "U14", group: "B", round: "รอบแบ่งกลุ่ม", date: "2026-11-06", time: "10:00", venue: "สนาม 1", team_home: "ทีม B2", team_away: "ทีม B3", score_home: "", score_away: "", status: "upcoming" },
    { id: 4, division: "U12", group: "C", round: "รอบแบ่งกลุ่ม", date: "2026-11-06", time: "08:30", venue: "สนาม 2", team_home: "ทีม C1", team_away: "ทีม C2", score_home: "3", score_away: "1", status: "finished" },
    { id: 5, division: "U14", group: "A", round: "รอบแบ่งกลุ่ม", date: "2026-11-06", time: "08:00", venue: "สนาม 1", team_home: "ทีม A1", team_away: "ทีม A4", score_home: "2", score_away: "2", status: "finished" },
    { id: 6, division: "U14", group: "D", round: "รอบแบ่งกลุ่ม", date: "2026-11-07", time: "09:00", venue: "สนาม 2", team_home: "ทีม D1", team_away: "ทีม D2", score_home: "", score_away: "", status: "upcoming" },
  ],

  news: [
    {
      id: 1,
      date: "2026-10-15",
      title: "เปิดรับสมัครทีมเข้าร่วม บ้านสร้างคัพ ครั้งที่ 1",
      image_url: "",
      excerpt:
        "เปิดรับสมัครทีมฟุตซอลรุ่นอายุไม่เกิน 12 ปี และ 14 ปี เข้าร่วมการแข่งขันการกุศล รายได้นำไปซ่อมแซมสนามฟุตซอลในชุมชน",
      content:
        "การแข่งขันฟุตซอลการกุศลโอเพ่น บ้านสร้างคัพ ครั้งที่ 1 เปิดรับสมัครทีมเข้าร่วมการแข่งขันแล้ว โดยแบ่งเป็น 2 รุ่นอายุ รุ่นไม่เกิน 12 ปี รับ 12 ทีม และรุ่นไม่เกิน 14 ปี รับ 16 ทีม รายได้ทั้งหมดหลังหักค่าใช้จ่ายจะนำไปซ่อมแซมสนามฟุตซอลให้กับเด็กในชุมชนวัดบ้านสร้าง สนใจติดต่อคุณโชค 098-665-3916 หรือคุณเบญ 065-636-2988",
    },
  ],

  rules: [
    {
      id: 1,
      order: 1,
      title: "รูปแบบการแข่งขัน",
      content:
        "• แข่งขันครึ่งละ {{half_minutes}} นาที ไม่มีต่อเวลา\n• รอบแบ่งสาย แข่งขันแบบพบกันหมดภายในสาย เก็บคะแนนสะสม (ชนะ 3 คะแนน เสมอ 1 คะแนน แพ้ 0 คะแนน)\n• ทีมอันดับต้นของแต่ละสายผ่านเข้าสู่รอบแพ้คัดออก (Knockout)\n• หากคะแนนเท่ากันในรอบแพ้คัดออก ตัดสินด้วยการยิงลูกโทษ ณ จุดโทษ\n• กติกาการแข่งขันอื่น ๆ ให้ยึดตามกติกาฟุตซอลสากล (FIFA Futsal Laws of the Game) เป็นหลัก",
    },
    {
      id: 2,
      order: 2,
      title: "คุณสมบัติผู้เล่น",
      content:
        "• ผู้เล่นต้องมีอายุตรงตามรุ่นที่สมัคร โดยยึดปีเกิดตามที่ระบุในแต่ละรุ่น\n• ทีมต้องเตรียมเอกสารยืนยันอายุ/สำเนาบัตรประชาชนหรือสูติบัตรของผู้เล่นมาแสดงในวันแข่งขัน\n• 1 ทีมสามารถมีผู้เล่นได้ไม่เกินตามที่ผู้จัดกำหนดในวันประชุมผู้จัดการทีม",
    },
    {
      id: 3,
      order: 3,
      title: "การรับสมัครและการชำระเงิน",
      content:
        "• ชำระค่าสมัครและค่าประกันทีมพร้อมกันในวันที่สมัคร เพื่อยืนยันสิทธิ์การเข้าร่วม\n• ค่าประกันทีมจะได้รับคืนเมื่อทีมไม่มีปัญหาเรื่องวินัย/มารยาทตลอดการแข่งขัน\n• ที่นั่งมีจำนวนจำกัดตามจำนวนทีมที่รับในแต่ละรุ่น สมัครก่อนมีสิทธิ์ก่อน",
    },
  ],
};
