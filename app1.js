// ================== CONFIG & STATE ==================
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzCFP8SKAJgKQ0h6PttLD1gzj1ZfLhgGt8X5Ke9l35nBNBPp6FeKNKD8HlVBsFWQVOY/exec";

let currentUser = null;
let currentRole = null;
let currentClassOfLeader = "";
const sessionKey = "absensiAppSessionV2";

// For charts filtering
let allAbsensiCache = [];
let allGuruCache = [];
let allKelasCache = [];
let allMapelCache = [];

// ================== HELPERS ==================
function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg text-sm text-white shadow-lg transition-slow ${
    type === "success" ? "bg-primary-600" : "bg-red-500"
  }`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
  }, 1800);
  setTimeout(() => {
    el.remove();
  }, 2400);
}
function fmtToday() {
  const d = new Date();
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    d.getDay()
  ];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return {
    hari,
    tanggal: `${yyyy}-${mm}-${dd}`,
    label: `${hari}, ${dd}/${mm}/${yyyy}`,
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const inputTanggal = document.getElementById("inputTanggal");
  if (inputTanggal) {
    inputTanggal.value = `${yyyy}-${mm}-${dd}`;
  }
});

function setPageTitle(t) {
  document.getElementById("pageTitle").textContent = t;
}
function setAvatarInitial(name) {
  document.getElementById("avatarInitial").textContent = (name || "U")
    .charAt(0)
    .toUpperCase();
}
function showOnly(sectionId) {
  document
    .querySelectorAll("main section")
    .forEach((s) => s.classList.add("hidden"));
  const el =
    document.getElementById(sectionId) ||
    document.getElementById("page-dashboard-charts");
  el.classList.remove("hidden");
}
function renderTableRows(tbody, rows) {
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "bg-white border border-slate-200 rounded-xl shadow-sm";
    tr.innerHTML = `
          <td class="px-3 py-2 text-slate-800">${r.Hari}</td>
          <td class="px-3 py-2 text-slate-800">${r.Tanggal}</td>
		  <td class="px-3 py-2 text-slate-800">${r.Kelas}</td>
          <td class="px-3 py-2 text-slate-800">${r["Jam Ke-"]}</td>
          <td class="px-3 py-2 text-slate-800">${r["Nama Guru"]}</td>
          <td class="px-3 py-2">
            <span class="px-2 py-1 rounded text-xs ${
              r["Status Kehadiran"] === "Hadir"
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700"
            }">${r["Status Kehadiran"]}</span>
          </td>
          <td class="px-3 py-2 text-slate-800">${r.Keterangan || "-"}</td>
        `;
    tbody.appendChild(tr);
  });
}
function populateSelect(el, items, valueKey, labelKey, includeAll = false) {
  el.innerHTML = "";
  if (includeAll) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Semua";
    el.appendChild(o);
  }
  items.forEach((it) => {
    const val = valueKey ? it[valueKey] : it;
    const lab = labelKey ? it[labelKey] : it;
    const opt = document.createElement("option");
    opt.value = val ?? "";
    opt.textContent = lab ?? "";
    el.appendChild(opt);
  });
}
function exportCSV(filename, rows) {
  const headers = Object.keys(
    rows[0] || {
      Hari: "",
      Tanggal: "",
      "Jam Ke-": "",
      Kelas: "",
      "Nama Guru": "",
      Mapel: "",
      "Status Kehadiran": "",
      Keterangan: "",
    }
  );
  const csv = [
    headers,
    ...rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
  ]
    .map((arr) => arr.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}
function encodeParams(obj) {
  return Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
    .join("&");
}

// ================== API (GET) ==================
const api = {
  async checkLogin(username, role, password) {
    const q = encodeParams({ action: "checkLogin", username, role, password });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json();
  },
  async listUsers() {
    const r = await fetch(WEB_APP_URL + "?action=listUsers");
    return await r.json();
  },
  async listGuru() {
    const r = await fetch(WEB_APP_URL + "?action=listGuru");
    return await r.json();
  },
  async listKelas() {
    const r = await fetch(WEB_APP_URL + "?action=listKelas");
    return await r.json();
  },
  /*async listAbsensi() {
    const r = await fetch(WEB_APP_URL + "?action=listAbsensi");
    return await r.json();
  },*/
  // Versi baru listAbsensi() dengan pagination otomatis
  async listAbsensi() {
    const allData = [];
    let startRow = 0;
    const limit = 500; // sama dengan limit backend

    while (true) {
      const url = `${WEB_APP_URL}?action=listAbsensi&startRow=${startRow}&limit=${limit}`;
      const r = await fetch(url);
      const json = await r.json();

      if (!json.ok) {
        console.error("Error ambil data:", json);
        break;
      }

      allData.push(...json.data);

      if (json.data.length < limit) break; // sudah habis
      startRow += limit;
    }

    return { ok: true, data: allData }; // format sama seperti sebelumnya
  },

  async createAbsensi(payload) {
    const q = encodeParams({
      action: "createAbsensi",
      ...payload,
      jam: Array.isArray(payload.jam)
        ? payload.jam.join("|")
        : String(payload.jam || ""),
    });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async changePassword(username, oldPass, newPass) {
    const q = encodeParams({
      action: "changePassword",
      username,
      oldPass,
      newPass,
    });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async resetAllPasswordDefault() {
    const q = encodeParams({ action: "resetPasswordDefault" });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async upsertGuru(namaGuru, mapel, jp) {
    const q = encodeParams({ action: "upsertGuru", namaGuru, mapel, jp });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async deleteGuru(namaGuru) {
    const q = encodeParams({ action: "deleteGuru", namaGuru });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async upsertKelas(namaKelas, username, password) {
    const q = encodeParams({
      action: "upsertKelas",
      namaKelas,
      username,
      password,
    });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
  async deleteKelas(namaKelas) {
    const q = encodeParams({ action: "deleteKelas", namaKelas });
    const r = await fetch(WEB_APP_URL + "?" + q);
    return await r.json().catch(async () => ({
      ok: false,
      error: await r.text().then((t) => t.slice(0, 200)),
    }));
  },
};

// ================== CHARTS ==================
let chartBar, chartPie;
function buildCharts(absensi) {
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const d2i = {
    Senin: 0,
    Selasa: 1,
    Rabu: 2,
    Kamis: 3,
    Jumat: 4,
    Sabtu: 5,
    Minggu: 6,
  };
  const counts = [0, 0, 0, 0, 0, 0, 0];
  absensi.forEach((r) => {
    const i = d2i[r.Hari];
    if (i != null) counts[i] += 1;
  });

  if (chartBar) chartBar.destroy();
  if (chartPie) chartPie.destroy();

  chartBar = new Chart(document.getElementById("chartBar"), {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        {
          label: "Jumlah Entri",
          data: counts,
          backgroundColor: [
            "#bfdbfe",
            "#93c5fd",
            "#60a5fa",
            "#3b82f6",
            "#2563eb",
            "#1d4ed8",
            "#1e40af",
          ],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  const hadir = absensi.filter((r) => r["Status Kehadiran"] === "Hadir").length;
  const th = absensi.length - hadir;
  chartPie = new Chart(document.getElementById("chartPie"), {
    type: "pie",
    data: {
      labels: ["Hadir", "Tidak Hadir"],
      datasets: [
        { data: [hadir, th], backgroundColor: ["#1d4ed8", "#93c5fd"] },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// ================== UI INIT ==================
function showRoleMenus(role) {
  document
    .getElementById("menuClassLeader")
    .classList.toggle("hidden", !(role === "Ketua Kelas"));
  document
    .getElementById("menuLeaders")
    .classList.toggle(
      "hidden",
      !["Kepala Sekolah", "Wakasek Kurikulum"].includes(role)
    );
  document
    .getElementById("menuAdmin")
    .classList.toggle("hidden", !(role === "Administrator"));
}
function activateMenuLinks() {
  document.querySelectorAll(".menu-link").forEach((a) => {
    a.addEventListener("click", () => {
      const target = a.getAttribute("data-target");
      showOnly(target);
      const titleMap = {
        "page-dashboard-charts": "Grafik Kehadiran Guru",
        "page-ketua-input": "Input Kehadiran",
        "page-ketua-riwayat": "Riwayat Laporan",
        "page-laporan": "Laporan Absensi",
        "page-rekap": "Rekapitulasi",
        "page-admin-akun": "Kelola Akun",
        "page-admin-master": "Data Guru & Kelas",
        "page-change-pass": "Ganti Password",
      };
      setPageTitle(titleMap[target] || "Dashboard");
      closeSidebarMobile();
      if (target === "page-ketua-riwayat") loadRiwayat();
      if (target === "page-laporan") refreshLaporanTable();
      if (target === "page-rekap") refreshRekapTable();
      if (target === "page-admin-akun" || target === "page-admin-master")
        refreshAdminTables();
    });
  });
}
function openSidebarMobile() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.remove("hidden");
}
function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.add("hidden");
}

function buildJamCheckboxes() {
  const container = document.getElementById("containerJam");
  container.innerHTML = "";
  for (let i = 1; i <= 11; i++) {
    const wrap = document.createElement("label");
    wrap.className =
      "inline-flex items-center gap-2 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-fast text-blue-900";
    wrap.innerHTML = `<input type="checkbox" name="jam" value="${i}" class="text-primary-600"><span>JP ${i}</span>`;
    container.appendChild(wrap);
  }
}

async function initOptions() {
  try {
    // Ambil data guru & kelas
    const g = await api.listGuru();
    const k = await api.listKelas();

    allGuruCache = g.data || [];
    allKelasCache = k.data || [];

    // 🔑 Generate cache mapel sekali saja
    allMapelCache = [
      ...new Set(allGuruCache.map((x) => x["Mata Pelajaran"]).filter(Boolean)),
    ];

    // Form Ketua Kelas → Input Kehadiran
    populateSelect(
      document.getElementById("inputGuru"),
      allGuruCache,
      "Nama Guru",
      "Nama Guru",
      false
    );

    // Filter Laporan
    populateSelect(
      document.getElementById("filterGuru"),
      [{ "Nama Guru": "" }, ...allGuruCache],
      "Nama Guru",
      "Nama Guru",
      false
    );
    populateSelect(
      document.getElementById("filterKelas"),
      [{ "Nama Kelas": "" }, ...allKelasCache],
      "Nama Kelas",
      "Nama Kelas",
      false
    );

    // Chart Filters
    populateSelect(
      document.getElementById("chartFilterGuru"),
      [{ "Nama Guru": "" }, ...allGuruCache],
      "Nama Guru",
      "Nama Guru",
      true
    );
    populateSelect(
      document.getElementById("chartFilterKelas"),
      [{ "Nama Kelas": "" }, ...allKelasCache],
      "Nama Kelas",
      "Nama Kelas",
      true
    );

    // Rekap Guru
    populateSelect(
      document.getElementById("rekapGuru"),
      [{ "Nama Guru": "" }, ...allGuruCache],
      "Nama Guru",
      "Nama Guru",
      false
    );

    // Rekap Mapel
    const mpSel = document.getElementById("rekapMapel");
    mpSel.innerHTML = "";

    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "Semua";
    mpSel.appendChild(allOpt);

    allMapelCache.forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      mpSel.appendChild(o);
    });
  } catch (err) {
    console.error("initOptions error:", err);
    toast("Gagal memuat data guru/kelas", "error");
  }
}

async function resolveKelasByUsername(username) {
  try {
    // 🔎 Cari dulu di cache
    if (allKelasCache && allKelasCache.length > 0) {
      const found = allKelasCache.find(
        (row) =>
          String(row.Username || "")
            .trim()
            .toLowerCase() ===
          String(username || "")
            .trim()
            .toLowerCase()
      );
      if (found) return String(found["Nama Kelas"] || "").trim();
    }

    // 🔄 Kalau cache kosong → fallback ke API
    const k = await api.listKelas();
    allKelasCache = k.data || [];
    const found = allKelasCache.find(
      (row) =>
        String(row.Username || "")
          .trim()
          .toLowerCase() ===
        String(username || "")
          .trim()
          .toLowerCase()
    );
    return found ? String(found["Nama Kelas"] || "").trim() : "";
  } catch (e) {
    console.error("resolveKelasByUsername error:", e);
    return "";
  }
}

function rowToDisplayAbsensi(r) {
  return {
    Hari: r.Hari,
    Tanggal: r.Tanggal,
    "Jam Ke-": r["Jam Ke-"],
    Kelas: r.Kelas,
    "Nama Guru": r["Nama Guru"],
    Mapel: r.Mapel,
    "Status Kehadiran": r["Status Kehadiran"],
    Keterangan: r.Keterangan || "",
    "Input Oleh": r["Input Oleh"],
    "Waktu Input": r["Waktu Input"],
  };
}

// ==============================
// LOGIN HANDLER
// ==============================
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const role = document.getElementById("loginRole").value;

  const btn = document.getElementById("loginBtn");
  const btnText = document.getElementById("loginBtnText");
  const spinner = document.getElementById("loginSpinner");
  const original = btnText.textContent;
  btn.disabled = true;
  btn.classList.add("opacity-80", "cursor-not-allowed");
  btnText.textContent = "Memeriksa…";
  spinner.classList.remove("hidden");

  try {
    console.log("🔐 Cek login untuk:", username, role);

    // 1. Validasi login
    const res = await api.checkLogin(username, role, password);
    console.log("✅ Hasil checkLogin:", res);
    if (!res.ok) {
      toast(res.error || "Login gagal", "error");
      return;
    }

    // 2. Preload data penting
    await preloadCache();

    // 3. Resolve kelas dari cache
    let kelasName = "";
    if (role === "ketua_kelas") {
      kelasName = await resolveKelasByUsername(username);
      console.log("🎓 Kelas ketua_kelas ditemukan:", kelasName);
    }

    // 4. Set user session
    currentUser = { username, role, name: res.name || username };
    currentRole = role;
    currentClassOfLeader = kelasName || "";
    console.log(
      "👤 currentUser:",
      currentUser,
      "currentClassOfLeader:",
      currentClassOfLeader
    );

    try {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          username,
          role,
          name: currentUser.name,
          kelas: currentClassOfLeader,
        })
      );
      console.log("💾 Session tersimpan:", localStorage.getItem(sessionKey));
    } catch (e) {
      console.warn("Gagal simpan session", e);
    }

    // 5. Update UI
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    document.getElementById("roleBadge").textContent = currentUser.name;
    setAvatarInitial(currentUser.name || currentUser.username);
    showRoleMenus(currentRole);

    // 6. Arahkan sesuai role
    redirectByRole(currentRole);

    // 7. Init dropdown + build charts (pakai cache)
    await initOptions();
    buildCharts(filteredAbsensiForCharts());

    toast("Berhasil masuk!");
  } catch (err) {
    console.error("❌ Login error:", err);
    toast("Tidak bisa terhubung ke server.", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
    btnText.textContent = original;
    spinner.classList.add("hidden");
  }
}

// ==============================
// RESTORE SESSION
// ==============================
async function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey));
    if (!session) {
      console.log("ℹ️ Tidak ada session tersimpan.");
      return;
    }

    console.log("🔄 Restore session dari localStorage:", session);

    currentUser = {
      username: session.username,
      role: session.role,
      name: session.name,
    };
    currentRole = session.role;
    currentClassOfLeader = session.kelas || "";
    console.log(
      "👤 Restored user:",
      currentUser,
      "kelas:",
      currentClassOfLeader
    );

    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    document.getElementById("roleBadge").textContent = currentUser.name;
    setAvatarInitial(currentUser.name || currentUser.username);
    showRoleMenus(currentRole);

    // ✅ load semua cache dulu
    await preloadCache();

    // 🔄 kalau kelas kosong → resolve ulang
    if (!currentClassOfLeader && currentRole === "ketua_kelas") {
      console.log("⚠️ Kelas kosong, coba resolve ulang dari cache…");
      currentClassOfLeader = await resolveKelasByUsername(currentUser.username);
      console.log("🎓 Kelas berhasil di-resolve ulang:", currentClassOfLeader);

      try {
        localStorage.setItem(
          sessionKey,
          JSON.stringify({
            ...session,
            kelas: currentClassOfLeader,
          })
        );
        console.log("💾 Session diperbarui:", localStorage.getItem(sessionKey));
      } catch (e) {}
    }

    // arahkan ke halaman sesuai role
    redirectByRole(currentRole);
  } catch (e) {
    console.error("❌ Gagal restore session", e);
  }
}

// ==============================
// PRELOAD CACHE
// ==============================
async function preloadCache() {
  try {
    if (!allAbsensiCache.length) {
      const abs = await api.listAbsensi();
      allAbsensiCache = (abs.data || []).map(rowToDisplayAbsensi);
      console.log("📊 Cache Absensi dimuat:", allAbsensiCache.length, "record");
    }
    if (!allGuruCache.length) {
      const g = await api.listGuru();
      allGuruCache = g.data || [];
      console.log("👨‍🏫 Cache Guru dimuat:", allGuruCache.length, "record");
    }
    if (!allKelasCache.length) {
      const k = await api.listKelas();
      allKelasCache = k.data || [];
      console.log("🏫 Cache Kelas dimuat:", allKelasCache.length, "record");
    }
    if (!allMapelCache.length) {
      const m = await api.listMapel();
      allMapelCache = m.data || [];
      console.log("📚 Cache Mapel dimuat:", allMapelCache.length, "record");
    }
  } catch (err) {
    console.error("❌ Gagal preload cache", err);
  }
}

function redirectByRole(role) {
  if (role === "Ketua Kelas") {
    setPageTitle("Input Kehadiran");
    showOnly("page-ketua-input");
  } else if (role === "Kepala Sekolah" || role === "Wakasek Kurikulum") {
    setPageTitle("Laporan Kehadiran");
    showOnly("page-laporan");
    refreshLaporanTable(); // ✅ auto load laporan
    refreshRekapTable(); // ✅ auto load rekap
  } else if (role === "Administrator") {
    setPageTitle("Manajemen Akun");
    showOnly("page-admin-akun");
  } else {
    setPageTitle("Beranda");
    showOnly("page-blank");
  }
}

function filteredAbsensiForCharts() {
  let rows = allAbsensiCache.slice();

  // Ketua Kelas hanya data yang diinput oleh akun ini
  if (currentUser && currentUser.role === "Ketua Kelas") {
    rows = rows.filter(
      (r) =>
        (r["Input Oleh"] || "").toLowerCase() ===
        (currentUser.username || "").toLowerCase()
    );
  }

  const kelas = document.getElementById("chartFilterKelas")?.value || "";
  const guru = document.getElementById("chartFilterGuru")?.value || "";
  const tanggal = document.getElementById("chartFilterTanggal")?.value || "";

  if (kelas) rows = rows.filter((r) => r.Kelas === kelas);
  if (guru) rows = rows.filter((r) => r["Nama Guru"] === guru);
  if (tanggal) rows = rows.filter((r) => r.Tanggal === tanggal);

  return rows;
}

async function submitKehadiran(e) {
  e.preventDefault();
  const btn = document.getElementById("btnKirim");
  const btnText = document.getElementById("btnKirimText");
  const btnSpin = document.getElementById("btnKirimSpin");
  btn.disabled = true;
  btn.classList.add("opacity-80", "cursor-not-allowed");
  btnSpin.classList.remove("hidden");
  btnText.textContent = "Mengirim…";

  //const { hari, tanggal } = fmtToday();
  const inputTanggal = document.getElementById("inputTanggal").value;
  let tanggal = inputTanggal;
  if (!tanggal) {
    // fallback kalau input kosong, tetap pakai hari ini
    const { tanggal: tgl } = fmtToday();
    tanggal = tgl;
  }
  const hari = new Date(tanggal).toLocaleDateString("id-ID", {
    weekday: "long",
  });

  const jam = [...document.querySelectorAll('input[name="jam"]:checked')].map(
    (i) => parseInt(i.value, 10)
  );
  const status = document.querySelector('input[name="status"]:checked')?.value;
  const guru = document.getElementById("inputGuru").value;
  const ket = document.getElementById("inputKet").value.trim();

  let kelasName = currentClassOfLeader;
  if (!kelasName && currentUser?.username) {
    kelasName = await resolveKelasByUsername(currentUser.username);
    currentClassOfLeader = kelasName;
    try {
      const s = JSON.parse(localStorage.getItem(sessionKey) || "{}");
      s.kelas = kelasName;
      localStorage.setItem(sessionKey, JSON.stringify(s));
    } catch (e) {}
  }

  if (jam.length === 0) {
    toast("Pilih minimal 1 jam pelajaran.", "error");
    return resetSend();
  }
  if (!status) {
    toast("Pilih status kehadiran.", "error");
    return resetSend();
  }
  if (!guru) {
    toast("Pilih nama guru.", "error");
    return resetSend();
  }
  if (!kelasName) {
    toast("Nama Kelas untuk akun ini belum dihubungkan.", "error");
    return resetSend();
  }

  // Ambil mapel otomatis (cache dulu biar cepat)
  let mapel = "";
  try {
    const g = await api.listGuru();
    const arr = g.data || [];
    const found = arr.find((x) => x["Nama Guru"] === guru);
    mapel = found ? found["Mata Pelajaran"] : "";
  } catch (e) {}

  // 🚫 Cek duplikasi pakai cache lokal
  const taken = new Set();
  allAbsensiCache
    .filter((r) => r.Tanggal === tanggal && r.Kelas === kelasName)
    .forEach((r) =>
      String(r["Jam Ke-"] || "")
        .split("|")
        .filter(Boolean)
        .forEach((j) => taken.add(Number(j)))
    );
  const dup = jam.filter((j) => taken.has(j));
  if (dup.length) {
    toast("Data sudah ada untuk JP: " + dup.join(", "), "error");
    return resetSend();
  }

  // Simpan ke server (lebih ringan)
  const payload = {
    action: "createAbsensi",
    hari,
    tanggal,
    jam,
    kelas: kelasName,
    namaGuru: guru,
    mapel,
    status,
    keterangan: ket,
    inputOleh: currentUser?.username || "unknown",
  };
  const res = await api.createAbsensi(payload);

  if (!res.ok) {
    toast(res.error || "Gagal mengirim", "error");
    return resetSend();
  }

  // ✅ Update cache lokal langsung
  const newRow = rowToDisplayAbsensi({
    Hari: hari,
    Tanggal: tanggal,
    Kelas: kelasName,
    "Jam Ke-": jam.join("|"),
    "Nama Guru": guru,
    Mapel: mapel,
    "Status Kehadiran": status,
    Keterangan: ket,
    "Input Oleh": currentUser?.username || "unknown",
    "Waktu Input": new Date().toISOString().slice(0, 19).replace("T", " "),
  });
  allAbsensiCache.push(newRow);

  // Refresh chart & riwayat dari cache
  buildCharts(filteredAbsensiForCharts());
  loadRiwayat();

  // Reset form
  document
    .querySelectorAll('input[name="jam"]')
    .forEach((i) => (i.checked = false));
  document
    .querySelectorAll('input[name="status"]')
    .forEach((i) => (i.checked = false));
  document.getElementById("inputKet").value = "";
  toast("Laporan terkirim!");

  showOnly("page-ketua-riwayat");
  resetSend();

  function resetSend() {
    btn.disabled = false;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
    btnSpin.classList.add("hidden");
    btnText.textContent = "Kirim";
  }
}

async function loadRiwayat() {
  try {
    // ✅ Ambil dari cache, bukan API
    let rows = allAbsensiCache.map(rowToDisplayAbsensi);

    // Filter jika user = Ketua Kelas
    if (currentUser && currentUser.role === "Ketua Kelas") {
      rows = rows.filter(
        (r) =>
          (r["Input Oleh"] || "").toLowerCase() ===
          (currentUser.username || "").toLowerCase()
      );
    }

    renderTableRows(document.getElementById("tbodyRiwayat"), rows);
  } catch (e) {
    console.error("Gagal load riwayat", e);
    toast("Gagal memuat riwayat", "error");
  }
}

function setDefaultFilters() {
  // reset kelas & guru
  document.getElementById("filterKelas").value = "";
  document.getElementById("filterGuru").value = "";

  // set tanggal default = hari ini
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  document.getElementById("filterStart").value = todayStr;
  document.getElementById("filterEnd").value = todayStr;
}

function refreshLaporanTable() {
  const kelas = document.getElementById("filterKelas").value;
  let start = document.getElementById("filterStart").value;
  let end = document.getElementById("filterEnd").value;
  const guru = document.getElementById("filterGuru").value;

  // ✅ Validasi tanggal end >= start
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) {
      end = start;
      document.getElementById("filterEnd").value = start; // update UI
    }
  }

  let rows = allAbsensiCache.map(rowToDisplayAbsensi);

  // filter berdasarkan role
  if (currentUser && currentUser.role === "Ketua Kelas") {
    rows = rows.filter(
      (r) =>
        (r["Input Oleh"] || "").toLowerCase() ===
        (currentUser.username || "").toLowerCase()
    );
  }

  // filter tambahan
  if (kelas) rows = rows.filter((r) => r.Kelas === kelas);
  if (guru) rows = rows.filter((r) => r["Nama Guru"] === guru);

  // filter tanggal range
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    rows = rows.filter((r) => {
      const rowDate = new Date(r.Tanggal);
      return rowDate >= startDate && rowDate <= endDate;
    });
  }

  // render tabel
  renderTableRows(
    document.getElementById("tbodyLaporan"),
    rows.map((r) => ({
      Hari: r.Hari,
      Tanggal: r.Tanggal,
      Kelas: r.Kelas,
      "Jam Ke-": r["Jam Ke-"],
      "Nama Guru": r["Nama Guru"],
      "Status Kehadiran": r["Status Kehadiran"],
      Keterangan: r.Keterangan,
    }))
  );
}

document.addEventListener("DOMContentLoaded", () => {
  // set default saat load
  setDefaultFilters();
  refreshLaporanTable();

  // auto refresh kalau filter berubah
  document
    .getElementById("filterKelas")
    .addEventListener("change", refreshLaporanTable);
  document
    .getElementById("filterStart")
    .addEventListener("change", refreshLaporanTable);
  document
    .getElementById("filterEnd")
    .addEventListener("change", refreshLaporanTable);
  document
    .getElementById("filterGuru")
    .addEventListener("change", refreshLaporanTable);

  // tombol reset
  document.getElementById("btnReset").addEventListener("click", () => {
    setDefaultFilters();
    refreshLaporanTable();
  });
});

function refreshRekapTable() {
  const gSel = document.getElementById("rekapGuru").value;
  const mSel = document.getElementById("rekapMapel").value;

  let absData = [...allAbsensiCache];
  let guruData = [...allGuruCache];

  // Filter berdasarkan role
  if (currentUser && currentUser.role === "Ketua Kelas") {
    absData = absData.filter(
      (r) =>
        (r["Input Oleh"] || "").toLowerCase() ===
        (currentUser.username || "").toLowerCase()
    );
  }

  // Filter guru & mapel sesuai pilihan
  const filteredGuru = guruData.filter(
    (x) =>
      (!gSel || x["Nama Guru"] === gSel) &&
      (!mSel || x["Mata Pelajaran"] === mSel)
  );

  const tbody = document.getElementById("tbodyRekap");
  tbody.innerHTML = "";
  let totalJp = 0;

  filteredGuru.forEach((G) => {
    const jp = Number(G["Jumlah JP"]) || 0;
    totalJp += jp;
    const absG = absData.filter((r) => r["Nama Guru"] === G["Nama Guru"]);
    const hadir = absG
      .filter((r) => r["Status Kehadiran"] === "Hadir")
      .reduce(
        (a, r) =>
          a +
          String(r["Jam Ke-"] || "")
            .split("|")
            .filter(Boolean).length,
        0
      );
    const tidak = absG
      .filter((r) => r["Status Kehadiran"] !== "Hadir")
      .reduce(
        (a, r) =>
          a +
          String(r["Jam Ke-"] || "")
            .split("|")
            .filter(Boolean).length,
        0
      );
    const pct = jp ? Math.round((Math.min(hadir, jp) / jp) * 100) : 0;

    const tr = document.createElement("tr");
    tr.className = "bg-white border border-slate-200 rounded-xl shadow-sm";
    tr.innerHTML = `
      <td class="px-3 py-2 text-slate-800">${G["Nama Guru"]}</td>
      <td class="px-3 py-2 text-slate-800">${G["Mata Pelajaran"]}</td>
      <td class="px-3 py-2 text-slate-800">${jp}</td>
      <td class="px-3 py-2 text-slate-800">${Math.min(hadir, jp)}</td>
      <td class="px-3 py-2 text-slate-800">${Math.min(
        tidak,
        Math.max(jp - Math.min(hadir, jp), 0)
      )}</td>
      <td class="px-3 py-2"><span class="px-2 py-1 rounded text-xs ${
        pct >= 90
          ? "bg-blue-100 text-blue-700"
          : pct >= 75
          ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700"
      }">${pct}%</span></td>
      <td class="px-3 py-2"><button class="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white transition-fast">Detail</button></td>
    `;
    const btn = tr.querySelector("button");
    btn.addEventListener("click", () => openDetailModal(G["Nama Guru"], absG));
    tbody.appendChild(tr);
  });

  document.getElementById("totalJp").textContent = totalJp;
}

// ✅ Auto load saat halaman siap
document.addEventListener("DOMContentLoaded", () => {
  refreshRekapTable();

  // Auto refresh filter
  document
    .getElementById("rekapGuru")
    .addEventListener("change", refreshRekapTable);
  document
    .getElementById("rekapMapel")
    .addEventListener("change", refreshRekapTable);
});

async function refreshAdminTables() {
  // Users
  const u = await api.listUsers();
  const users = u.data || [];
  const tbodyA = document.getElementById("tbodyAkun");
  tbodyA.innerHTML = "";
  users.forEach((U) => {
    const tr = document.createElement("tr");
    tr.className = "bg-white border border-slate-200 rounded-xl shadow-sm";
    tr.innerHTML = `
          <td class="px-3 py-2 text-slate-800">${U["Nama Lengkap"] || "-"}</td>
          <td class="px-3 py-2 text-slate-800">${U.Username}</td>
          <td class="px-3 py-2 text-slate-800">${U.Role}</td>
          <td class="px-3 py-2"><button class="px-3 py-1.5 rounded bg-primary-600 hover:bg-primary-700 text-white transition-fast">Reset Password</button></td>
        `;
    tr.querySelector("button").addEventListener("click", async () => {
      const res = await api.resetAllPasswordDefault();
      if (!res.ok) {
        toast(res.error || "Gagal reset", "error");
        return;
      }
      toast("Password semua user disetel ke 123456");
    });
    tbodyA.appendChild(tr);
  });

  // Guru
  const g = await api.listGuru();
  const gurus = g.data || [];
  const tbodyG = document.getElementById("tbodyGuru");
  tbodyG.innerHTML = "";
  gurus.forEach((G) => {
    const tr = document.createElement("tr");
    tr.className = "bg-white border border-slate-200 rounded-xl shadow-sm";
    tr.innerHTML = `
          <td class="px-3 py-2 text-slate-800">${G["Nama Guru"]}</td>
          <td class="px-3 py-2 text-slate-800">${G["Mata Pelajaran"]}</td>
          <td class="px-3 py-2 text-slate-800">${G["Jumlah JP"]}</td>
          <td class="px-3 py-2">
            <button class="px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-800 transition-fast mr-2">Edit</button>
            <button class="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-fast">Hapus</button>
          </td>
        `;
    const [btnEdit, btnDel] = tr.querySelectorAll("button");
    btnEdit.addEventListener("click", async () => {
      const nama = prompt("Nama Guru:", G["Nama Guru"]);
      if (!nama) return;
      const mapel = prompt("Mata Pelajaran:", G["Mata Pelajaran"]);
      if (!mapel) return;
      const jp = parseInt(
        prompt("Jumlah JP:", G["Jumlah JP"]) || G["Jumlah JP"],
        10
      );
      const res = await api.upsertGuru(
        nama,
        mapel,
        isNaN(jp) ? G["Jumlah JP"] : jp
      );
      if (!res.ok) {
        toast(res.error || "Gagal simpan", "error");
        return;
      }
      toast("Data guru diperbarui");
      refreshAdminTables();
      initOptions();
    });
    btnDel.addEventListener("click", async () => {
      if (!confirm("Hapus guru ini?")) return;
      const res = await api.deleteGuru(G["Nama Guru"]);
      if (!res.ok) {
        toast(res.error || "Gagal hapus", "error");
        return;
      }
      toast("Guru dihapus");
      refreshAdminTables();
      initOptions();
    });
    tbodyG.appendChild(tr);
  });

  // Kelas
  const k = await api.listKelas();
  const kelas = k.data || [];
  const tbodyK = document.getElementById("tbodyKelas");
  tbodyK.innerHTML = "";
  kelas.forEach((K) => {
    const tr = document.createElement("tr");
    tr.className = "bg-white border border-slate-200 rounded-xl shadow-sm";
    tr.innerHTML = `
          <td class="px-3 py-2 text-slate-800">${K["Nama Kelas"]}</td>
          <td class="px-3 py-2 text-slate-800">${K.Username || "-"}</td>
          <td class="px-3 py-2 text-slate-800">${K.Password || "-"}</td>
          <td class="px-3 py-2">
            <button class="px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-800 transition-fast mr-2">Edit</button>
            <button class="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-fast">Hapus</button>
          </td>
        `;
    const [btnEdit, btnDel] = tr.querySelectorAll("button");
    btnEdit.addEventListener("click", async () => {
      const nama = prompt("Nama Kelas:", K["Nama Kelas"]);
      if (!nama) return;
      const username = prompt("Username:", K.Username || "");
      if (username === null) return;
      const password = prompt("Password:", K.Password || "");
      if (password === null) return;
      const res = await api.upsertKelas(nama, username, password);
      if (!res.ok) {
        toast(res.error || "Gagal simpan", "error");
        return;
      }
      toast("Data kelas diperbarui");
      refreshAdminTables();
      initOptions();
    });
    btnDel.addEventListener("click", async () => {
      if (!confirm("Hapus kelas ini?")) return;
      const res = await api.deleteKelas(K["Nama Kelas"]);
      if (!res.ok) {
        toast(res.error || "Gagal hapus", "error");
        return;
      }
      toast("Kelas dihapus");
      refreshAdminTables();
      initOptions();
    });
    tbodyK.appendChild(tr);
  });
}

// ================== DETAIL MODAL ==================
function openDetailModal(namaGuru, rows) {
  const modal = document.getElementById("detailModal");
  const title = document.getElementById("detailTitle");
  const body = document.getElementById("detailBody");
  title.textContent = "Detail Kehadiran • " + namaGuru;
  body.innerHTML = "";
  if (!rows || !rows.length) {
    body.innerHTML = '<div class="text-slate-600">Tidak ada data.</div>';
  } else {
    rows.forEach((r) => {
      const item = document.createElement("div");
      item.className =
        "flex items-start justify-between gap-3 border-b border-slate-200 py-2";
      item.innerHTML = `
            <div>
              <div class="font-medium text-slate-900">${r.Tanggal} • ${
        r.Hari
      }</div>
              <div class="text-slate-600 text-sm">JP: ${
                r["Jam Ke-"]
              } • Status: ${r["Status Kehadiran"]} • Kelas: ${r.Kelas}</div>
            </div>
            <div class="text-slate-500 text-sm">${r.Keterangan || "-"}</div>
          `;
      body.appendChild(item);
    });
  }
  modal.classList.remove("hidden");
}
function closeDetailModal() {
  document.getElementById("detailModal").classList.add("hidden");
}

// ================== STARTUP ==================
document.addEventListener("DOMContentLoaded", async () => {
  // Restore session
  try {
    const raw = localStorage.getItem(sessionKey);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.username && s.role) {
        currentUser = {
          username: s.username,
          role: s.role,
          name: s.name || s.username,
        };
        currentRole = s.role;
        currentClassOfLeader = s.kelas || "";
        document.getElementById("loginView").classList.add("hidden");
        document.getElementById("appShell").classList.remove("hidden");
        document.getElementById("roleBadge").textContent = currentUser.name;
        setAvatarInitial(currentUser.name || currentUser.username);
        showRoleMenus(currentRole);
        // arahkan sesuai role (bukan charts)
        redirectByRole(currentRole);
        //setPageTitle('Dashboard');
        //showOnly('page-dashboard-charts');
      }
    }
  } catch (e) {}

  const { label, tanggal, hari } = fmtToday();
  const labelEl = document.getElementById("todayLabel");
  if (labelEl) labelEl.textContent = label;
  const todayInline = document.getElementById("todayInline");
  if (todayInline) todayInline.textContent = label;
  const infoTanggal = document.getElementById("infoTanggal");
  if (infoTanggal) infoTanggal.textContent = `${hari} • ${tanggal}`;

  // Hidden test: still run silently to set note
  (async () => {
    const mode = document.getElementById("modeBadge");
    const note = document.getElementById("connectedNote");
    function setNote(
      ok,
      textOk = "URL tersambung. Silakan login.",
      textErr = "Tidak bisa terhubung ke server."
    ) {
      if (ok) {
        if (mode) {
          mode.textContent = "Mode: Terhubung";
          mode.className =
            "text-xs px-2 py-1 rounded bg-blue-100 text-blue-700";
        }
        if (note) {
          note.textContent = textOk;
          note.className =
            "rounded-xl px-4 py-3 mb-6 text-sm text-slate-700 bg-slate-50 border border-slate-200";
        }
      } else {
        if (mode) {
          mode.textContent = "Mode: Gagal Terhubung";
          mode.className = "text-xs px-2 py-1 rounded bg-red-100 text-red-700";
        }
        if (note) {
          note.textContent = textErr;
          note.className =
            "rounded-xl px-4 py-3 mb-6 text-sm text-red-700 bg-red-50 border border-red-200";
        }
      }
    }
    try {
      const r = await fetch(WEB_APP_URL + "?action=listUsers");
      await r.text();
      setNote(true);
    } catch (e) {
      setNote(false);
    }
  })();

  // Menus
  activateMenuLinks();

  // Forms
  buildJamCheckboxes();
  document
    .getElementById("formKehadiran")
    ?.addEventListener("submit", submitKehadiran);
  document
    .getElementById("refreshRiwayat")
    ?.addEventListener("click", async () => {
      await loadRiwayat();
      toast("Data riwayat diperbarui.");
    });

  // Leaders
  document
    .getElementById("btnCari")
    ?.addEventListener("click", refreshLaporanTable);

  // Rekap
  document
    .getElementById("btnRekap")
    ?.addEventListener("click", refreshRekapTable);
  document
    .getElementById("btnRefreshRekap")
    ?.addEventListener("click", refreshRekapTable);

  // Charts filters
  document
    .getElementById("btnTampilkanChart")
    ?.addEventListener("click", () => {
      buildCharts(filteredAbsensiForCharts());
    });

  // Load initial data for charts if already logged in
  if (!document.getElementById("loginView").classList.contains("hidden")) {
    // not logged in yet
  } else {
    const abs = await api.listAbsensi();
    allAbsensiCache = (abs.data || []).map(rowToDisplayAbsensi);
    await initOptions();
    buildCharts(filteredAbsensiForCharts());
  }

  // Login handlers
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("togglePass")?.addEventListener("click", () => {
    const inp = document.getElementById("loginPassword");
    const eye = document.getElementById("eyeIcon");
    if (inp.type === "password") {
      inp.type = "text";
      eye.style.opacity = 0.7;
    } else {
      inp.type = "password";
      eye.style.opacity = 1;
    }
  });

  // ✅ Toggle show/hide password
  document.querySelectorAll(".togglePass").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (target.type === "password") {
        target.type = "text";
        btn.textContent = "🙈";
      } else {
        target.type = "password";
        btn.textContent = "👁";
      }
    });
  });

  // ✅ Validasi password
  function validatePassword(pw) {
    const regex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    return regex.test(pw);
  }

  // ✅ Handle submit
  document
    .getElementById("formChangePass")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const oldPass = document.getElementById("oldPass").value.trim();
      const newPass = document.getElementById("newPass").value.trim();
      const newPass2 = document.getElementById("newPass2").value.trim();
      const btn = document.getElementById("btnSavePass");

      if (!validatePassword(newPass)) {
        toast(
          "Password baru minimal 8 karakter, harus ada huruf, angka, dan simbol.",
          "error"
        );
        return;
      }
      if (newPass !== newPass2) {
        toast("Konfirmasi password tidak sama.", "error");
        return;
      }

      btn.disabled = true;
      try {
        const res = await api.changePassword(
          currentUser.username,
          oldPass,
          newPass
        );
        if (!res.ok) {
          toast(res.error || "Gagal mengganti password.", "error");
        } else {
          toast("Password berhasil diubah.");
          e.target.reset();
        }
      } catch (err) {
        console.error(err);
        toast("Terjadi kesalahan jaringan.", "error");
      } finally {
        btn.disabled = false;
      }
    });

  // Sidebar overlay
  document.getElementById("openSidebar")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("overlay").classList.remove("hidden");
  });
  document.getElementById("closeSidebar")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").classList.add("hidden");
  });
  document.getElementById("overlay")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").classList.add("hidden");
  });

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem(sessionKey);
    } catch (e) {}
    currentUser = null;
    currentRole = null;
    currentClassOfLeader = "";
    // Sembunyikan aplikasi, tampilkan login
    document.getElementById("appShell").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
    // Bersihkan input login
    const user = document.getElementById("loginUsername");
    if (user) user.value = "";
    const pass = document.getElementById("loginPassword");
    if (pass) pass.value = "";
    toast("Anda telah keluar.");
  });
});
