/* =========================================================
   sw.js — แคชไฟล์หน้าเว็บ/สไตล์/สคริปต์ไว้ให้เปิดได้ไวขึ้นและ
   ใช้งานได้แม้เน็ตหลุดชั่วคราว (ข้อมูลจาก Google Sheet ไม่ถูกแคช
   จะพยายามดึงข้อมูลใหม่จากเน็ตเสมอ เพื่อให้ผล/ตารางแข่งอัปเดตล่าสุด)
   ========================================================= */

const CACHE_VERSION = "bansang-cup-v2"; // เปลี่ยนเลขนี้เมื่อแก้ไฟล์เว็บ เพื่อล้างแคชเก่า

const APP_SHELL = [
  "./",
  "./index.html",
  "./schedule.html",
  "./draw.html",
  "./rules.html",
  "./news.html",
  "./register.html",
  "./assets/css/style.css",
  "./assets/js/config.js",
  "./assets/js/sheets.js",
  "./assets/js/app.js",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ห้ามแคชข้อมูลจาก Google Sheet — ต้องได้ข้อมูลล่าสุดเสมอ
  if (url.hostname.includes("docs.google.com")) return;

  // เฉพาะไฟล์ในเว็บของเราเอง (same-origin) เท่านั้นที่ใช้กลยุทธ์ cache-first
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
