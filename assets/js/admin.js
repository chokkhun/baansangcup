/* =========================================================
   admin.js — ตรรกะหน้าแอดมิน
   ========================================================= */

let TEAMS_CACHE = [];
let MATCHES_CACHE = [];
let NEWS_CACHE = [];
let SETTINGS_CACHE = {};

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
  [SETTINGS_CACHE, TEAMS_CACHE, MATCHES_CACHE, NEWS_CACHE] = await Promise.all([
    FutsalData.getSettings(),
    FutsalData.getTeams(),
    FutsalData.getMatches(),
    FutsalData.getNews(),
  ]);
  renderSettings();
  renderMatches();
  renderTeams();
  renderNews();
  renderAddMatchForm();
  renderAddTeamForm();
  renderAddNewsForm();
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
  ["date", "วันที่ (2569-11-06)", "text"],
  ["time", "เวลา", "text"],
  ["venue", "สนาม", "text"],
  ["team_home", "ทีมเหย้า", "text"],
  ["team_away", "ทีมเยือน", "text"],
  ["score_home", "สกอร์เหย้า", "text"],
  ["score_away", "สกอร์เยือน", "text"],
  ["status", "สถานะ", "select", ["upcoming", "live", "finished"]],
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
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" /></div>`;
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
  ["date", "วันที่ (2569-11-06)", "text"],
  ["title", "หัวข้อข่าว", "text"],
  ["excerpt", "สรุปย่อ", "text"],
  ["content", "เนื้อหาเต็ม", "textarea"],
  ["image_url", "ลิงก์รูปภาพ (ถ้ามี)", "text"],
];

function newsFieldHtml(field, value, idPrefix) {
  const [key, label, type] = field;
  const id = `${idPrefix}-${key}`;
  if (type === "textarea") {
    return `<div class="field field-wide"><label for="${id}">${label}</label>
      <textarea id="${id}" data-key="${key}" rows="3">${value ?? ""}</textarea></div>`;
  }
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" data-key="${key}" value="${escapeAttr(value ?? "")}" /></div>`;
}

function renderAddNewsForm() {
  const form = document.getElementById("news-add-form");
  form.innerHTML =
    NEWS_FIELDS.map((f) => newsFieldHtml(f, "", "new-news")).join("") +
    `<div class="field field-actions"><button type="submit" class="btn btn-primary">เพิ่มข่าว</button></div>`;
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

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initTabs();
});
