/* =========================================================
   admin.js — ตรรกะหน้าแอดมิน
   ========================================================= */

let TEAMS_CACHE = [];
let MATCHES_CACHE = [];
let NEWS_CACHE = [];
let SETTINGS_CACHE = {};
let REGISTRATIONS_CACHE = [];
let RULES_CACHE = [];

function showStatus(msg, type) {
  const el = document.getElementById("admin-status");
  el.textContent = msg;
  el.className = "admin-status " + type;
  el.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => (el.style.display = "none"), 4000);
}

/* ---------- Login ---------- */
function initLogin() {
  const loginScreen = document.getElementById("login-screen");
  const adminPanel = document.getElementById("admin-panel");
  const pwInput = document.getElementById("pw-input");
  const pwError = document.getElementById("pw-error");
  const pwWarning = document.getElementById("pw-config-warning");

  if (!ADMIN_API_URL) pwWarning.style.display = "block";

  async function tryLogin(pw) {
    AdminAPI.setPassword(pw);
    try {
      // เรียก action เบาๆ เพื่อทดสอบรหัสผ่าน
      await AdminAPI.updateSettings({});
      FutsalData.clearCache(); // กันข้อมูลเก่าค้างจากตอนเปิดหน้าเว็บสาธารณะก่อนหน้านี้
      loginScreen.style.display = "none";
      adminPanel.style.display = "block";
      loadAllData();
    } catch (err) {
      AdminAPI.clearPassword();
      pwError.textContent = "เข้าสู่ระบบไม่สำเร็จ: " + err.message;
      pwError.style.display = "block";
    }
  }

  document.getElementById("pw-submit").addEventListener("click", () => {
    if (pwInput.value) tryLogin(pwInput.value);
  });
  pwInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && pwInput.value) tryLogin(pwInput.value);
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    AdminAPI.clearPassword();
    adminPanel.style.display = "none";
    loginScreen.style.display = "block";
  });

  // ถ้ามีรหัสผ่านค้างอยู่ใน session ให้ลองเข้าอัตโนมัติ
  if (AdminAPI.getPassword()) tryLogin(AdminAPI.getPassword());
}

/* ---------- Tabs ---------- */
function initTabs() {
  document.querySelectorAll("#admin-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#admin-tabs button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.querySelectorAll(".admin-tab-panel").forEach((p) => {
        p.style.display = p.dataset.panel === btn.dataset.tab ? "block" : "none";
      });
    });
  });
}

/* ---------- โหลดข้อมูลทั้งหมด ---------- */
async function loadAllData() {
  const [all, registrations] = await Promise.all([
    FutsalData.getAll(),
    FutsalData.getRegistrations(),
  ]);
  SETTINGS_CACHE = all.settings;
  TEAMS_CACHE = all.teams;
  MATCHES_CACHE = all.matches;
  NEWS_CACHE = all.news;
  RULES_CACHE = all.rules || [];
  REGISTRATIONS_CACHE = registrations;
  renderSettings();
  renderMatches();
  renderTeams();
  renderNews();
  renderRegistrations();
  renderRules();
  renderAddMatchForm();
  renderAddTeamForm();
  renderAddNewsForm();
  renderAddRuleForm();
}

/* ---------- ตั้งค่าเว็บ (Settings) ---------- */
function renderSettings() {
  const container = document.getElementById("settings-form");
  container.innerHTML = Object.keys(SETTINGS_CACHE)
    .map(
      (key) => `
    <div class="field admin-settings-item">
      <label for="set-${key}">${key}</label>
      <input id="set-${key}" data-key="${key}" value="${escapeAttr(SETTINGS_CACHE[key])}" />
    </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("settings-save")?.addEventListener("click", async () => {
    const inputs = document.querySelectorAll("#settings-form input");
    const data = {};
    inputs.forEach((i) => (data[i.dataset.key] = i.value));
    try {
      await AdminAPI.updateSettings(data);
      showStatus("บันทึกการตั้งค่าเรียบร้อยแล้ว", "ok");
    } catch (err) {
      showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
    }
  });
});

/* ---------- แมตช์ ---------- */
const MATCH_FIELDS = [
  ["division", "รุ่นอายุ", "select", ["U12", "U14"]],
  ["group", "สาย", "text"],
  ["round", "รอบ", "text"],
  ["date", "วันที่แข่งขัน", "date"],
  ["time", "เวลา", "time"],
  ["venue", "สนาม", "text"],
  ["team_home", "ทีมเหย้า", "text"],
  ["team_away", "ทีมเยือน", "text"],
  ["score_home", "สกอร์เหย้า", "text"],
  ["score_away", "สกอร์เยือน", "text"],
  ["status", "สถานะ", "select", ["upcoming", "live", "finished"]],
  ["yellow_home", "🟨 ใบเหลือง (เหย้า)", "text"],
  ["red_home", "🟥 ใบแดง (เหย้า)", "text"],
  ["yellow_away", "🟨 ใบเหลือง (เยือน)", "text"],
  ["red_away", "🟥 ใบแดง (เยือน)", "text"],
];

function fieldHtml(field, value, idPrefix) {
  const [key, label, type, options] = field;
  const id = `${idPrefix}-${key}`;
  if (type === "select") {
    return `<div class="field"><label for="${id}">${label}</label>
      <select id="${id}" data-key="${key}">
        ${options.map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`).join("")}
      </select></div>`;
  }
  // date/time ใช้ตัวเลือกวันที่-เวลาแบบเนทีฟของเบราว์เซอร์ กันปัญหาเรื่องเรียงลำดับ
  // วัน/เดือน/ปี สับสนเวลาพิมพ์เอง ค่าที่ได้จะยังคงเป็นรูปแบบ YYYY-MM-DD/HH:mm เหมือนเดิม
  // (ไม่กระทบการเรียงลำดับตามวันที่ที่อื่นในระบบ)
  const inputType = type === "date" || type === "time" ? type : "text";
  return `<div class="field"><label for="${id}">${label}</label>
    <input type="${inputType}" id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" /></div>`;
}

function renderAddMatchForm() {
  const form = document.getElementById("match-add-form");
  form.innerHTML =
    MATCH_FIELDS.map((f) => fieldHtml(f, "", "new-match")).join("") +
    `<div class="field field-actions"><button type="submit" class="btn btn-primary">เพิ่มแมตช์</button></div>`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    MATCH_FIELDS.forEach(([key]) => (data[key] = form.querySelector(`[data-key="${key}"]`).value));
    try {
      await AdminAPI.upsertMatch(data);
      showStatus("เพิ่มแมตช์ใหม่เรียบร้อยแล้ว", "ok");
      MATCHES_CACHE = await FutsalData.getMatches();
      renderMatches();
      form.reset();
    } catch (err) {
      showStatus("เพิ่มแมตช์ไม่สำเร็จ: " + err.message, "error");
    }
  };
}

function renderMatches() {
  const container = document.getElementById("matches-list");
  const sorted = [...MATCHES_CACHE].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  container.innerHTML = sorted
    .map((m) => {
      const rowId = `match-${m.id}`;
      return `
      <div class="admin-row" data-id="${m.id}">
        <div class="admin-row__top">
          <span class="admin-row__title">#${m.id} · ${m.team_home || "-"} vs ${m.team_away || "-"}</span>
          <div class="field-actions">
            <button class="btn btn-primary btn-sm" data-action="save">บันทึก</button>
            <button class="btn btn-danger btn-sm" data-action="delete">ลบ</button>
          </div>
        </div>
        <div class="admin-form-grid" id="${rowId}">
          ${MATCH_FIELDS.map((f) => fieldHtml(f, m[f[0]], rowId)).join("")}
        </div>
      </div>`;
    })
    .join("") || `<p style="color:var(--ink-500)">ยังไม่มีข้อมูลแมตช์</p>`;

  container.querySelectorAll(".admin-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const data = { id };
      MATCH_FIELDS.forEach(([key]) => (data[key] = row.querySelector(`[data-key="${key}"]`).value));
      try {
        await AdminAPI.upsertMatch(data);
        showStatus(`บันทึกแมตช์ #${id} เรียบร้อยแล้ว`, "ok");
        MATCHES_CACHE = await FutsalData.getMatches();
      } catch (err) {
        showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`ลบแมตช์ #${id} ใช่หรือไม่?`)) return;
      try {
        await AdminAPI.deleteMatch(id);
        showStatus(`ลบแมตช์ #${id} เรียบร้อยแล้ว`, "ok");
        MATCHES_CACHE = await FutsalData.getMatches();
        renderMatches();
      } catch (err) {
        showStatus("ลบไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

/* ---------- ทีม ---------- */
const TEAM_FIELDS = [
  ["division", "รุ่นอายุ", "select", ["U12", "U14"]],
  ["group", "สาย", "text"],
  ["name", "ชื่อทีม", "text"],
];

function renderAddTeamForm() {
  const form = document.getElementById("team-add-form");
  form.innerHTML =
    TEAM_FIELDS.map((f) => fieldHtml(f, "", "new-team")).join("") +
    `<div class="field field-actions"><button type="submit" class="btn btn-primary">เพิ่มทีม</button></div>`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    TEAM_FIELDS.forEach(([key]) => (data[key] = form.querySelector(`[data-key="${key}"]`).value));
    try {
      await AdminAPI.upsertTeam(data);
      showStatus("เพิ่มทีมใหม่เรียบร้อยแล้ว", "ok");
      TEAMS_CACHE = await FutsalData.getTeams();
      renderTeams();
      form.reset();
    } catch (err) {
      showStatus("เพิ่มทีมไม่สำเร็จ: " + err.message, "error");
    }
  };
}

function renderTeams() {
  const container = document.getElementById("teams-list");
  container.innerHTML = TEAMS_CACHE
    .map((t) => {
      const rowId = `team-${t.id}`;
      return `
      <div class="admin-row" data-id="${t.id}">
        <div class="admin-row__top">
          <span class="admin-row__title">#${t.id} · ${t.name}</span>
          <div class="field-actions">
            <button class="btn btn-primary btn-sm" data-action="save">บันทึก</button>
            <button class="btn btn-danger btn-sm" data-action="delete">ลบ</button>
          </div>
        </div>
        <div class="admin-form-grid" id="${rowId}">
          ${TEAM_FIELDS.map((f) => fieldHtml(f, t[f[0]], rowId)).join("")}
        </div>
      </div>`;
    })
    .join("") || `<p style="color:var(--ink-500)">ยังไม่มีข้อมูลทีม</p>`;

  container.querySelectorAll(".admin-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const data = { id };
      TEAM_FIELDS.forEach(([key]) => (data[key] = row.querySelector(`[data-key="${key}"]`).value));
      try {
        await AdminAPI.upsertTeam(data);
        showStatus(`บันทึกทีม #${id} เรียบร้อยแล้ว`, "ok");
        TEAMS_CACHE = await FutsalData.getTeams();
      } catch (err) {
        showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`ลบทีม #${id} ใช่หรือไม่?`)) return;
      try {
        await AdminAPI.deleteTeam(id);
        showStatus(`ลบทีม #${id} เรียบร้อยแล้ว`, "ok");
        TEAMS_CACHE = await FutsalData.getTeams();
        renderTeams();
      } catch (err) {
        showStatus("ลบไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

/* ---------- ข่าวสาร ---------- */
const NEWS_FIELDS = [
  ["date", "วันที่เผยแพร่", "date"],
  ["title", "หัวข้อข่าว", "text"],
  ["excerpt", "สรุปย่อ", "text"],
  ["content", "เนื้อหาเต็ม", "textarea"],
  ["image_url", "รูปข่าว", "image"],
];

/* ย่อขนาดรูปในเครื่อง (ฝั่งเบราว์เซอร์) ก่อนอัปโหลด กันไฟล์ใหญ่เกินไป/อัปช้า */
function resizeImageFile(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]); // ตัดส่วน "data:image/jpeg;base64," ออก เหลือแค่ base64
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function newsFieldHtml(field, value, idPrefix) {
  const [key, label, type] = field;
  const id = `${idPrefix}-${key}`;
  if (type === "textarea") {
    return `<div class="field field-wide"><label for="${id}">${label}</label>
      <textarea id="${id}" data-key="${key}" rows="3">${value ?? ""}</textarea></div>`;
  }
  if (type === "image") {
    return `<div class="field field-wide">
      <label for="${id}">${label}</label>
      <input id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" placeholder="วางลิงก์รูป หรืออัปโหลดไฟล์ด้านล่าง" />
      <div class="admin-image-upload">
        <input type="file" accept="image/*" id="${id}-file" class="admin-file-input" />
        <span class="admin-upload-status" id="${id}-status"></span>
      </div>
      ${value ? `<img src="${escapeAttr(value)}" class="admin-image-preview" id="${id}-preview" />` : `<img class="admin-image-preview" id="${id}-preview" style="display:none" />`}
    </div>`;
  }
  const inputType = type === "date" ? "date" : "text";
  return `<div class="field"><label for="${id}">${label}</label>
    <input type="${inputType}" id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" /></div>`;
}

/* ผูก event ให้ input[type=file] ของรูปข่าว: เลือกไฟล์ -> ย่อขนาด -> อัปโหลดขึ้น Drive -> เติมลิงก์ */
function wireImageUpload(idPrefix) {
  const fileInput = document.getElementById(`${idPrefix}-image_url-file`);
  const textInput = document.getElementById(`${idPrefix}-image_url`);
  const status = document.getElementById(`${idPrefix}-image_url-status`);
  const preview = document.getElementById(`${idPrefix}-image_url-preview`);
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    status.textContent = "กำลังอัปโหลด…";
    status.style.color = "var(--ink-500)";
    try {
      const base64 = await resizeImageFile(file);
      const result = await AdminAPI.uploadImage(base64, file.name, "image/jpeg");
      textInput.value = result.url;
      preview.src = result.url;
      preview.style.display = "block";
      status.textContent = "อัปโหลดสำเร็จ ✓";
      status.style.color = "var(--blue-400)";
    } catch (err) {
      status.textContent = "อัปโหลดไม่สำเร็จ: " + err.message;
      status.style.color = "var(--red-400)";
    }
  });
}

function renderAddNewsForm() {
  const form = document.getElementById("news-add-form");
  form.innerHTML =
    NEWS_FIELDS.map((f) => newsFieldHtml(f, "", "new-news")).join("") +
    `<div class="field field-actions"><button type="submit" class="btn btn-primary">เพิ่มข่าว</button></div>`;
  wireImageUpload("new-news");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    NEWS_FIELDS.forEach(([key]) => (data[key] = form.querySelector(`[data-key="${key}"]`).value));
    try {
      await AdminAPI.upsertNews(data);
      showStatus("เพิ่มข่าวใหม่เรียบร้อยแล้ว", "ok");
      NEWS_CACHE = await FutsalData.getNews();
      renderNews();
      form.reset();
      document.getElementById("new-news-image_url-preview").style.display = "none";
    } catch (err) {
      showStatus("เพิ่มข่าวไม่สำเร็จ: " + err.message, "error");
    }
  };
}

function renderNews() {
  const container = document.getElementById("news-list");
  container.innerHTML = NEWS_CACHE
    .map((n) => {
      const rowId = `news-${n.id}`;
      return `
      <div class="admin-row" data-id="${n.id}">
        <div class="admin-row__top">
          <span class="admin-row__title">#${n.id} · ${n.title}</span>
          <div class="field-actions">
            <button class="btn btn-primary btn-sm" data-action="save">บันทึก</button>
            <button class="btn btn-danger btn-sm" data-action="delete">ลบ</button>
          </div>
        </div>
        <div class="admin-form-grid" id="${rowId}">
          ${NEWS_FIELDS.map((f) => newsFieldHtml(f, n[f[0]], rowId)).join("")}
        </div>
      </div>`;
    })
    .join("") || `<p style="color:var(--ink-500)">ยังไม่มีข่าวสาร</p>`;

  container.querySelectorAll(".admin-row").forEach((row) => {
    const id = row.dataset.id;
    wireImageUpload(`news-${id}`);
    row.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const data = { id };
      NEWS_FIELDS.forEach(([key]) => (data[key] = row.querySelector(`[data-key="${key}"]`).value));
      try {
        await AdminAPI.upsertNews(data);
        showStatus(`บันทึกข่าว #${id} เรียบร้อยแล้ว`, "ok");
        NEWS_CACHE = await FutsalData.getNews();
      } catch (err) {
        showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`ลบข่าว #${id} ใช่หรือไม่?`)) return;
      try {
        await AdminAPI.deleteNews(id);
        showStatus(`ลบข่าว #${id} เรียบร้อยแล้ว`, "ok");
        NEWS_CACHE = await FutsalData.getNews();
        renderNews();
      } catch (err) {
        showStatus("ลบไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

/* ---------- กฎกติกา ---------- */
const RULE_FIELDS = [
  ["order", "ลำดับ (เลขน้อยขึ้นก่อน)", "text"],
  ["title", "หัวข้อ", "text"],
  ["content", "เนื้อหา (ขึ้นบรรทัดใหม่ได้ / นำหน้าด้วย • เพื่อแสดงเป็นลิสต์)", "textarea"],
];

function ruleFieldHtml(field, value, idPrefix) {
  const [key, label, type] = field;
  const id = `${idPrefix}-${key}`;
  if (type === "textarea") {
    return `<div class="field field-wide"><label for="${id}">${label}</label>
      <textarea id="${id}" data-key="${key}" rows="5">${value ?? ""}</textarea></div>`;
  }
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" /></div>`;
}

function renderAddRuleForm() {
  const form = document.getElementById("rule-add-form");
  form.innerHTML =
    RULE_FIELDS.map((f) => ruleFieldHtml(f, "", "new-rule")).join("") +
    `<div class="field field-actions"><button type="submit" class="btn btn-primary">เพิ่มหัวข้อ</button></div>`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    RULE_FIELDS.forEach(([key]) => (data[key] = form.querySelector(`[data-key="${key}"]`).value));
    try {
      await AdminAPI.upsertRule(data);
      showStatus("เพิ่มหัวข้อกฎกติกาเรียบร้อยแล้ว", "ok");
      RULES_CACHE = await FutsalData.getRules();
      renderRules();
      form.reset();
    } catch (err) {
      showStatus("เพิ่มไม่สำเร็จ: " + err.message, "error");
    }
  };
}

function renderRules() {
  const container = document.getElementById("rules-list");
  if (!container) return;
  const sorted = [...RULES_CACHE].sort(
    (a, b) => (parseInt(a.order, 10) || 0) - (parseInt(b.order, 10) || 0)
  );
  container.innerHTML =
    sorted
      .map((r) => {
        const rowId = `rule-${r.id}`;
        return `
      <div class="admin-row" data-id="${r.id}">
        <div class="admin-row__top">
          <span class="admin-row__title">#${r.id} · ${r.title || "-"}</span>
          <div class="field-actions">
            <button class="btn btn-primary btn-sm" data-action="save">บันทึก</button>
            <button class="btn btn-danger btn-sm" data-action="delete">ลบ</button>
          </div>
        </div>
        <div class="admin-form-grid" id="${rowId}">
          ${RULE_FIELDS.map((f) => ruleFieldHtml(f, r[f[0]], rowId)).join("")}
        </div>
      </div>`;
      })
      .join("") || `<p style="color:var(--ink-500)">ยังไม่มีหัวข้อกฎกติกา</p>`;

  container.querySelectorAll(".admin-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const data = { id };
      RULE_FIELDS.forEach(([key]) => (data[key] = row.querySelector(`[data-key="${key}"]`).value));
      try {
        await AdminAPI.upsertRule(data);
        showStatus(`บันทึกหัวข้อ #${id} เรียบร้อยแล้ว`, "ok");
        RULES_CACHE = await FutsalData.getRules();
      } catch (err) {
        showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`ลบหัวข้อ #${id} ใช่หรือไม่?`)) return;
      try {
        await AdminAPI.deleteRule(id);
        showStatus(`ลบหัวข้อ #${id} เรียบร้อยแล้ว`, "ok");
        RULES_CACHE = await FutsalData.getRules();
        renderRules();
      } catch (err) {
        showStatus("ลบไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

/* ---------- ทีมสมัครเข้าร่วม ---------- */
const REG_STATUS_OPTIONS = ["รอตรวจสอบ", "อนุมัติแล้ว", "ปฏิเสธ"];

function renderRegistrations() {
  const container = document.getElementById("registrations-list");
  if (!container) return;
  const sorted = [...REGISTRATIONS_CACHE].sort((a, b) =>
    String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
  );
  container.innerHTML =
    sorted
      .map((r) => {
        const rowId = `reg-${r.id}`;
        return `
      <div class="admin-row" data-id="${r.id}">
        <div class="admin-row__top">
          <span class="admin-row__title">#${r.id} · ${r.team_name || "-"} (${r.division || "-"})</span>
          <div class="field-actions">
            <button class="btn btn-primary btn-sm" data-action="save">บันทึก</button>
            <button class="btn btn-danger btn-sm" data-action="delete">ลบ</button>
          </div>
        </div>
        <div class="admin-form-grid" id="${rowId}">
          <div class="field"><label>สมัครเมื่อ</label><input value="${escapeAttr(r.timestamp || "")}" disabled /></div>
          <div class="field"><label for="${rowId}-division">รุ่นอายุ</label>
            <select id="${rowId}-division" data-key="division">
              ${["U12", "U14"].map((o) => `<option value="${o}" ${o === r.division ? "selected" : ""}>${o}</option>`).join("")}
            </select></div>
          <div class="field"><label for="${rowId}-team_name">ชื่อทีม</label>
            <input id="${rowId}-team_name" data-key="team_name" value="${escapeAttr(r.team_name || "")}" /></div>
          <div class="field"><label for="${rowId}-contact_name">ชื่อผู้ติดต่อ</label>
            <input id="${rowId}-contact_name" data-key="contact_name" value="${escapeAttr(r.contact_name || "")}" /></div>
          <div class="field"><label for="${rowId}-phone">เบอร์โทร</label>
            <input id="${rowId}-phone" data-key="phone" value="${escapeAttr(r.phone || "")}" /></div>
          <div class="field"><label for="${rowId}-players_count">จำนวนผู้เล่น</label>
            <input id="${rowId}-players_count" data-key="players_count" value="${escapeAttr(r.players_count || "")}" /></div>
          <div class="field field-wide"><label for="${rowId}-note">หมายเหตุ</label>
            <input id="${rowId}-note" data-key="note" value="${escapeAttr(r.note || "")}" /></div>
          <div class="field"><label for="${rowId}-status">สถานะ</label>
            <select id="${rowId}-status" data-key="status">
              ${REG_STATUS_OPTIONS.map((o) => `<option value="${o}" ${o === r.status ? "selected" : ""}>${o}</option>`).join("")}
            </select></div>
        </div>
      </div>`;
      })
      .join("") || `<p style="color:var(--ink-500)">ยังไม่มีทีมสมัครเข้ามา</p>`;

  container.querySelectorAll(".admin-row").forEach((row) => {
    const id = row.dataset.id;
    const keys = ["division", "team_name", "contact_name", "phone", "players_count", "note", "status"];
    row.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const data = { id };
      keys.forEach((key) => (data[key] = row.querySelector(`[data-key="${key}"]`).value));
      try {
        await AdminAPI.upsertRegistration(data);
        showStatus(`บันทึกทีมสมัคร #${id} เรียบร้อยแล้ว`, "ok");
        REGISTRATIONS_CACHE = await FutsalData.getRegistrations();
      } catch (err) {
        showStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`ลบทีมสมัคร #${id} ใช่หรือไม่?`)) return;
      try {
        await AdminAPI.deleteRegistration(id);
        showStatus(`ลบทีมสมัคร #${id} เรียบร้อยแล้ว`, "ok");
        REGISTRATIONS_CACHE = await FutsalData.getRegistrations();
        renderRegistrations();
      } catch (err) {
        showStatus("ลบไม่สำเร็จ: " + err.message, "error");
      }
    });
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initTabs();
});
