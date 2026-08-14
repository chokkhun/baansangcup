/* =========================================================
   admin-api.js — ส่งคำสั่งแก้ไขข้อมูลไปที่ Google Apps Script
   ========================================================= */

const AdminAPI = (() => {
  function getPassword() {
    return sessionStorage.getItem("bansang_admin_pw") || "";
  }

  function setPassword(pw) {
    sessionStorage.setItem("bansang_admin_pw", pw);
  }

  function clearPassword() {
    sessionStorage.removeItem("bansang_admin_pw");
  }

  async function call(action, payload) {
    if (!ADMIN_API_URL) {
      throw new Error("ยังไม่ได้ตั้งค่า ADMIN_API_URL ใน config.js");
    }
    const body = JSON.stringify({ action, password: getPassword(), ...payload });

    // ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
    const res = await fetch(ADMIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "เกิดข้อผิดพลาด");
    return json.result;
  }

  return {
    getPassword,
    setPassword,
    clearPassword,
    updateSettings: (data) => call("updateSettings", { data }),
    upsertMatch: (data) => call("upsertMatch", { data }),
    deleteMatch: (id) => call("deleteMatch", { id }),
    upsertTeam: (data) => call("upsertTeam", { data }),
    deleteTeam: (id) => call("deleteTeam", { id }),
    upsertNews: (data) => call("upsertNews", { data }),
    deleteNews: (id) => call("deleteNews", { id }),
    upsertRegistration: (data) => call("upsertRegistration", { data }),
    deleteRegistration: (id) => call("deleteRegistration", { id }),
    upsertRule: (data) => call("upsertRule", { data }),
    deleteRule: (id) => call("deleteRule", { id }),
    // การสมัครทีมจากหน้าเว็บสาธารณะ ไม่ต้องล็อกอิน จึงไม่ผ่าน getPassword()
    submitRegistration: (data) => call("publicRegister", { data }),
    uploadImage: (base64, filename, mimeType) =>
      call("uploadImage", { data: { base64, filename, mimeType } }),
  };
})();
