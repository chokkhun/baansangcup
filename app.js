/* =========================================================
   app.js — ฟังก์ชันกลางที่ใช้ร่วมกันทุกหน้า
   ========================================================= */

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function formatThaiDate(isoLike) {
  if (!isoLike) return "";
  const parts = String(isoLike).split(/[-\/]/);
  if (parts.length < 3) return isoLike;
  const [y, m, d] = parts;
  const month = THAI_MONTHS[parseInt(m, 10) - 1] || m;
  return `${parseInt(d, 10)} ${month} ${y}`;
}

function divisionLabel(div) {
  return div === "U12" ? "รุ่นไม่เกิน 12 ปี" : div === "U14" ? "รุ่นไม่เกิน 14 ปี" : div;
}

function divisionClass(div) {
  return div === "U12" ? "chip-blue" : div === "U14" ? "chip-red" : "";
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- ป้ายสถานะแมตช์ ---------- */
function statusBadge(status) {
  if (status === "live") return `<span class="badge badge-live">กำลังแข่ง</span>`;
  if (status === "finished") return `<span class="badge badge-finished">จบแล้ว</span>`;
  return `<span class="badge badge-upcoming">เตรียมแข่ง</span>`;
}

/* ---------- การ์ดแมตช์ ---------- */
function matchCard(m) {
  const hasScore = m.status !== "upcoming" && (m.score_home !== "" || m.score_away !== "");
  return `
    <article class="match-card ${divisionClass(m.division)}">
      <div class="match-card__top">
        <span class="chip ${divisionClass(m.division)}">${divisionLabel(m.division)}</span>
        <span class="match-card__round">${m.round || ""}${m.group ? " · สาย " + m.group : ""}</span>
        ${statusBadge(m.status)}
      </div>
      <div class="match-card__teams">
        <span class="team team--home">${m.team_home}</span>
        <span class="score">${hasScore ? `${m.score_home} – ${m.score_away}` : "VS"}</span>
        <span class="team team--away">${m.team_away}</span>
      </div>
      <div class="match-card__meta">
        <span>📅 ${formatThaiDate(m.date)}</span>
        <span>⏱ ${m.time || "-"}</span>
        <span>📍 ${m.venue || "-"}</span>
      </div>
    </article>`;
}

/* ---------- ตั๋วผลรวม (ticker) ---------- */
function tickerChip(m) {
  return `
    <span class="ticker-chip ${divisionClass(m.division)}">
      <strong>${m.team_home}</strong> vs <strong>${m.team_away}</strong>
      <em>${formatThaiDate(m.date)} · ${m.time}</em>
    </span>`;
}

function renderTicker(containerId, matches) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const upcoming = matches.filter((m) => m.status !== "finished").slice(0, 10);
  const source = upcoming.length ? upcoming : matches;
  const html = source.map(tickerChip).join("");
  // duplicate content so the CSS marquee loops seamlessly
  container.innerHTML = `<div class="ticker-track">${html}${html}</div>`;
}

/* ---------- ตารางคะแนน (คำนวณจากผลแมตช์ที่จบแล้ว) ---------- */
function buildStandings(teams, matches, division, group) {
  const rows = {};
  teams
    .filter((t) => t.division === division && (!group || t.group === group))
    .forEach((t) => {
      rows[t.name] = { name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });

  matches
    .filter(
      (m) =>
        m.division === division &&
        (!group || m.group === group) &&
        m.status === "finished" &&
        m.score_home !== "" &&
        m.score_away !== ""
    )
    .forEach((m) => {
      const hs = parseInt(m.score_home, 10);
      const as = parseInt(m.score_away, 10);
      if (!rows[m.team_home]) rows[m.team_home] = { name: m.team_home, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      if (!rows[m.team_away]) rows[m.team_away] = { name: m.team_away, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      const home = rows[m.team_home];
      const away = rows[m.team_away];
      home.p++; away.p++;
      home.gf += hs; home.ga += as;
      away.gf += as; away.ga += hs;
      if (hs > as) { home.w++; home.pts += 3; away.l++; }
      else if (hs < as) { away.w++; away.pts += 3; home.l++; }
      else { home.d++; away.d++; home.pts++; away.pts++; }
    });

  return Object.values(rows).sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || a.name.localeCompare(b.name)
  );
}

function standingsTable(rows) {
  return `
    <table class="standings-table">
      <thead>
        <tr>
          <th class="col-team">ทีม</th>
          <th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th>
          <th>ได้</th><th>เสีย</th><th>คะแนน</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr class="${i < 2 ? "row-qualify" : ""}">
            <td class="col-team"><span class="rank">${i + 1}</span> ${r.name}</td>
            <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
            <td>${r.gf}</td><td>${r.ga}</td><td class="pts">${r.pts}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

/* ---------- ใส่ข้อมูล Settings ลงหน้าเว็บ (data-setting="key") ---------- */
function applySettings(settings) {
  document.querySelectorAll("[data-setting]").forEach((node) => {
    const key = node.getAttribute("data-setting");
    if (settings[key] !== undefined && settings[key] !== "") {
      node.textContent = settings[key];
    }
  });
  document.querySelectorAll("[data-setting-href]").forEach((node) => {
    const key = node.getAttribute("data-setting-href");
    if (settings[key]) node.setAttribute("href", settings[key]);
  });
  if (settings.banner_image_url) {
    document.querySelectorAll("[data-banner-bg]").forEach((node) => {
      node.style.backgroundImage = `linear-gradient(180deg, rgba(5,7,15,.55), rgba(5,7,15,.92)), url('${settings.banner_image_url}')`;
    });
  }
  document.title = settings.site_title
    ? `${settings.site_title} — ${document.title.split("—").pop().trim()}`
    : document.title;
}

/* ---------- นำทางมือถือ ---------- */
function initNav() {
  const btn = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".site-nav");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => menu.classList.toggle("is-open"));
}

document.addEventListener("DOMContentLoaded", initNav);
