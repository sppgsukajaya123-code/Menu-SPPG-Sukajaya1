/* ===== API GOOGLE APPS SCRIPT ===== */
const API_URL = "https://script.google.com/macros/s/AKfycbzUkHNPAZuXaqBVkZQI5ZkkiqgS-RJ0nJORNOAqd6zGtbjoLdPrrGKGxUkVf_IUMfEi7A/exec";

let progress = 0;
let loadingInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  const loadingBar = document.getElementById("loadingBar");
  const loadingPercent = document.getElementById("loadingPercent");

  loadingInterval = setInterval(() => {
    if (progress < 88) {
      progress++;
      loadingBar.style.width = progress + "%";
      loadingPercent.textContent = progress + "%";
    }
  }, 20);

  loadMenu();
});

/* ===== LOAD MENU ===== */
async function loadMenu() {
  try {
    const data = await ambilDataMenu();
    console.log("DATA DARI SPREADSHEET:", data);

    const menuHariIni = cariMenuHariIni(data);

    if (!menuHariIni) {
      tampilkanMenuKosong();
      selesaiLoading();
      return;
    }

    tampilkanMenu(menuHariIni);
    selesaiLoading();
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    tampilkanError(error.message);
  }
}

/* ===== AMBIL DATA API ===== */
async function ambilDataMenu() {
  const response = await fetch(API_URL, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error("Gagal menghubungi Google Apps Script.");
  }

  const result = await response.json();
  console.log("Response API:", result);

  let data = result;
  if (result && Array.isArray(result.data)) data = result.data;
  else if (result && Array.isArray(result.menu)) data = result.menu;

  if (!Array.isArray(data)) {
    throw new Error("Format data API bukan array.");
  }

  return data;
}

/* ===== AMBIL FIELD (fleksibel terhadap nama kolom) ===== */
function ambilField(obj, namaField) {
  if (!obj) return "";
  const target = normalisasi(namaField);
  const key = Object.keys(obj).find(k => normalisasi(k) === target);
  return key ? obj[key] : "";
}

function normalisasi(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* ===== TANGGAL HARI INI (Asia/Jakarta) ===== */
function tanggalHariIni() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

/* ===== NORMALISASI TANGGAL -> "YYYY-MM-DD" ===== */
function tanggalKey(value) {
  if (!value) return "";
  const text = String(value).trim();

  // format ISO: 2026-09-21 atau 2026-09-21T00:00:00.000Z
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  // format Indonesia: 21/09/2026 atau 21-09-2026
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }

  // fallback: biarkan Date yang parse
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(parsed);
  }

  return "";
}

/* ===== CARI MENU HARI INI (dengan fallback ke menu terakhir) ===== */
function cariMenuHariIni(data) {
  const today = tanggalHariIni();

  const denganTanggal = data
    .map(item => ({ item, key: tanggalKey(ambilField(item, "TANGGAL")) }))
    .filter(entry => entry.key !== "");

  console.log("Tanggal yang dicari (hari ini):", today);
  console.log("Tanggal yang terbaca di spreadsheet:", denganTanggal.map(e => e.key));

  if (denganTanggal.length === 0) return null;

  // 1) coba cari yang PERSIS hari ini
  const cocok = denganTanggal.find(e => e.key === today);
  if (cocok) {
    return { ...cocok.item, __fallback: false, __tanggalDipakai: cocok.key };
  }

  // 2) tidak ada untuk hari ini -> pakai tanggal terakhir yang sudah lewat
  const terurutTerbaru = [...denganTanggal].sort((a, b) => (a.key < b.key ? 1 : -1));
  const sudahLewat = terurutTerbaru.filter(e => e.key <= today);
  const dipilih = sudahLewat[0] || terurutTerbaru[terurutTerbaru.length - 1];

  console.warn("Menu hari ini belum ada di spreadsheet, menampilkan menu terakhir:", dipilih.key);
  return { ...dipilih.item, __fallback: true, __tanggalDipakai: dipilih.key };
}

/* ===== FORMAT TANGGAL ===== */
function formatTanggal(value) {
  const key = tanggalKey(value);
  if (!key) return "Tanggal tidak tersedia";

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(date);
}

/* ===== FORMAT ANGKA ===== */
function formatAngka(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "-";

  const text = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(text);
  if (Number.isNaN(number)) return String(value);

  return number.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function setText(id, value, unit = "") {
  const element = document.getElementById(id);
  if (element) element.textContent = formatAngka(value) + unit;
}

/* ===== TAMPILKAN MENU ===== */
function tampilkanMenu(menu) {
  console.log("MENU YANG DITAMPILKAN:", menu);

  const labelTanggal = document.querySelector(".date-box span");
  const info = document.getElementById("infoText");

  document.getElementById("tanggalMenu").textContent = formatTanggal(ambilField(menu, "TANGGAL"));

  if (menu.__fallback) {
    if (labelTanggal) labelTanggal.textContent = "MENU TERAKHIR";
    if (info) info.textContent = `Menu untuk hari ini belum diperbarui oleh tim SPPG. Menampilkan menu terakhir (${formatTanggal(menu.__tanggalDipakai)}).`;
  } else {
    if (labelTanggal) labelTanggal.textContent = "MENU HARI INI";
    if (info) info.textContent = "Data menu dan kandungan gizi diperbarui oleh tim SPPG SUKAJAYA 1.";
  }

  const nama = ambilField(menu, "NAMA MENU");
  const namaElement = document.getElementById("namaMenu");
  namaElement.textContent = nama || "Menu Hari Ini";
  namaElement.classList.remove("data-in");
  void namaElement.offsetWidth;
  namaElement.classList.add("data-in");

  const porsiBesar = ambilField(menu, "PORSI BESAR") || {};
  const porsiKecil = ambilField(menu, "PORSI KECIL") || {};

  setText("energiBesar", ambilField(porsiBesar, "ENERGI"), " kkal");
  setText("karboBesar", ambilField(porsiBesar, "KARBOHIDRAT"), " g");
  setText("proteinBesar", ambilField(porsiBesar, "PROTEIN"), " g");
  setText("lemakBesar", ambilField(porsiBesar, "LEMAK"), " g");
  setText("seratBesar", ambilField(porsiBesar, "SERAT"), " g");

  setText("energiKecil", ambilField(porsiKecil, "ENERGI"), " kkal");
  setText("karboKecil", ambilField(porsiKecil, "KARBOHIDRAT"), " g");
  setText("proteinKecil", ambilField(porsiKecil, "PROTEIN"), " g");
  setText("lemakKecil", ambilField(porsiKecil, "LEMAK"), " g");
  setText("seratKecil", ambilField(porsiKecil, "SERAT"), " g");

  tampilkanFoto(ambilField(menu, "FOTO"), nama);

  setTimeout(() => {
    aktifkanScrollAnimation();
    animasikanAngka(menu);
  }, 150);
}

/* ===== TAMPILKAN FOTO ===== */
function tampilkanFoto(foto, namaMenu) {
  const wrapper = document.getElementById("photoWrapper");
  const image = document.getElementById("fotoMenu");
  const loading = document.getElementById("photoLoading");

  wrapper.classList.remove("loaded", "photo-error");
  loading.textContent = "Memuat foto...";
  image.style.display = "block";
  image.alt = namaMenu ? `Foto ${namaMenu}` : "Foto menu";

  if (!foto) {
    tampilkanFotoError("Foto menu belum tersedia.");
    return;
  }

  const url = ubahURLFoto(foto);
  console.log("URL FOTO:", url);

  image.onload = () => wrapper.classList.add("loaded");
  image.onerror = () => tampilkanFotoError("Foto menu tidak dapat dimuat. Pastikan file Google Drive dibagikan ke \"Semua orang yang memiliki link\".");
  image.src = url;
}

function tampilkanFotoError(pesan) {
  const wrapper = document.getElementById("photoWrapper");
  const image = document.getElementById("fotoMenu");
  const loading = document.getElementById("photoLoading");

  image.style.display = "none";
  wrapper.classList.remove("loaded");
  wrapper.classList.add("photo-error");
  loading.textContent = pesan;
}

/* ===== KONVERSI URL GOOGLE DRIVE -> THUMBNAIL ===== */
function ubahURLFoto(url) {
  const text = String(url || "").trim();
  if (!text) return "";

  const fileMatch = text.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w800`;

  const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;

  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return `https://drive.google.com/thumbnail?id=${text}&sz=w800`;

  return text;
}

/* ===== MENU KOSONG (hanya jika sheet benar-benar tidak punya baris valid) ===== */
function tampilkanMenuKosong() {
  document.getElementById("tanggalMenu").textContent = "Belum tersedia";
  document.getElementById("namaMenu").textContent = "Menu belum tersedia di spreadsheet";

  tampilkanFotoError("Belum ada data menu yang bisa dibaca dari spreadsheet. Pastikan kolom TANGGAL terisi dengan format tanggal yang benar.");

  const ids = [
    "energiBesar", "karboBesar", "proteinBesar", "lemakBesar", "seratBesar",
    "energiKecil", "karboKecil", "proteinKecil", "lemakKecil", "seratKecil"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "-";
  });

  const info = document.getElementById("infoText");
  if (info) info.textContent = "Belum ada baris menu yang valid di spreadsheet. Cek kembali kolom TANGGAL.";
}

/* ===== SELESAI LOADING ===== */
function selesaiLoading() {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }

  const loadingBar = document.getElementById("loadingBar");
  const loadingPercent = document.getElementById("loadingPercent");
  const loadingScreen = document.getElementById("loadingScreen");
  const mainContent = document.getElementById("mainContent");

  let current = progress;
  const finish = setInterval(() => {
    current += 3;
    if (current >= 100) {
      current = 100;
      clearInterval(finish);
      loadingBar.style.width = "100%";
      loadingPercent.textContent = "100%";
      setTimeout(() => {
        loadingScreen.classList.add("hide");
        mainContent.classList.add("show");
      }, 350);
      return;
    }
    loadingBar.style.width = current + "%";
    loadingPercent.textContent = current + "%";
  }, 15);
}

/* ===== ERROR API ===== */
function tampilkanError(message) {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }

  document.getElementById("loadingPercent").textContent = "Gagal memuat";
  document.getElementById("loadingPercent").style.color = "#c0392b";
  document.getElementById("tanggalMenu").textContent = "";
  document.getElementById("namaMenu").textContent = "Data menu tidak dapat dimuat";

  tampilkanFotoError(message || "Terjadi kesalahan saat mengambil data.");

  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hide");
    document.getElementById("mainContent").classList.add("show");
  }, 900);
}

/* ===== ANIMASI SCROLL ===== */
function aktifkanScrollAnimation() {
  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach(el => el.classList.add("active"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("active");
    });
  }, { threshold: 0.12 });

  elements.forEach(element => observer.observe(element));
}

/* ===== ANIMASI ANGKA (count up) ===== */
function animasikanAngka(menu) {
  const porsiBesar = ambilField(menu, "PORSI BESAR") || {};
  const porsiKecil = ambilField(menu, "PORSI KECIL") || {};

  const mapping = [
    ["energiBesar", ambilField(porsiBesar, "ENERGI"), " kkal"],
    ["karboBesar", ambilField(porsiBesar, "KARBOHIDRAT"), " g"],
    ["proteinBesar", ambilField(porsiBesar, "PROTEIN"), " g"],
    ["lemakBesar", ambilField(porsiBesar, "LEMAK"), " g"],
    ["seratBesar", ambilField(porsiBesar, "SERAT"), " g"],
    ["energiKecil", ambilField(porsiKecil, "ENERGI"), " kkal"],
    ["karboKecil", ambilField(porsiKecil, "KARBOHIDRAT"), " g"],
    ["proteinKecil", ambilField(porsiKecil, "PROTEIN"), " g"],
    ["lemakKecil", ambilField(porsiKecil, "LEMAK"), " g"],
    ["seratKecil", ambilField(porsiKecil, "SERAT"), " g"]
  ];

  mapping.forEach(([id, value, unit], index) => {
    setTimeout(() => countNumber(id, value, unit), 600 + index * 70);
  });
}

function countNumber(id, value, unit) {
  const element = document.getElementById(id);
  if (!element) return;

  if (value === null || value === undefined || String(value).trim() === "") {
    element.textContent = "-";
    return;
  }

  const number = Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(number)) {
    element.textContent = formatAngka(value) + unit;
    return;
  }

  const finalText = number.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + unit;
  const start = performance.now();
  const duration = 750;
  let selesai = false;

  function frame(now) {
    if (selesai) return;
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const current = number * eased;
    element.textContent = current.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + unit;
    if (p < 1) requestAnimationFrame(frame);
    else selesai = true;
  }

  requestAnimationFrame(frame);

  // Pengaman: kalau requestAnimationFrame berhenti (mis. tab sempat tidak fokus),
  // paksa angka final tampil benar setelah durasi animasi selesai.
  setTimeout(() => {
    selesai = true;
    element.textContent = finalText;
  }, duration + 400);
}
