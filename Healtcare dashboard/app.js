// app.js — corrected + robust chart + prompt-based Basic Auth
// API config
const API_URL = "https://fedskillstest.coalitiontechnologies.workers.dev";

// DOM refs
const bpCanvas = document.getElementById("bpChart");
const avatarEl = document.getElementById("avatar");
const pName = document.getElementById("pName");
const pMeta = document.getElementById("pMeta");
const pDob = document.getElementById("pDob");
const pPhone = document.getElementById("pPhone");
const pEmergency = document.getElementById("pEmergency");
const pInsurance = document.getElementById("pInsurance");
const diagnosticListEl = document.getElementById("diagnosticList");
const labListEl = document.getElementById("labList");
const respVal = document.getElementById("respiratory");
const respLevel = document.getElementById("respiratory-level");
const tempVal = document.getElementById("temperature");
const tempLevel = document.getElementById("temperature-level");
const heartVal = document.getElementById("heart");
const heartLevel = document.getElementById("heart-level");

let bpChart = null;
let cachedAuth = null;

// embedded placeholder avatar data URI
const DATA_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
     <rect rx='12' width='100%' height='100%' fill='#f3f6ff'/>
     <circle cx='48' cy='34' r='18' fill='#dfefff'/>
     <rect x='22' y='56' width='52' height='22' rx='8' fill='#eaf5ff'/>
   </svg>`
);

// ---------- Auth prompt ----------
function getAuthHeader() {
  if (cachedAuth) return cachedAuth;
  // allow injection via window.__API_AUTH for automation if needed
  if (window.__API_AUTH && typeof window.__API_AUTH === 'string') {
    cachedAuth = window.__API_AUTH;
    return cachedAuth;
  }
  const user = window.prompt("Enter API username (demo: coalition) — cancel to use local mock:");
  if (user === null) return null;
  const pass = window.prompt("Enter API password (demo: skills-test):");
  if (pass === null) return null;
  cachedAuth = "Basic " + btoa(`${user}:${pass}`);
  return cachedAuth;
}

// ---------- Fetch data (API -> fallback mock) ----------
async function fetchData() {
  try {
    const auth = getAuthHeader();
    if (!auth) throw new Error("No credentials provided (using mock)");
    const r = await fetch(API_URL, { method: "GET", headers: { Authorization: auth } });
    if (!r.ok) throw new Error("API error: " + r.status);
    const data = await r.json();
    console.log("API response:", data);
    return data;
  } catch (err) {
    console.warn("Using local mock data:", err.message);
    // load local mock
    const r = await fetch("mock-jessica.json");
    const mock = await r.json();
    console.log("Loaded mock:", mock);
    return mock;
  }
}

// ---------- Robust chart renderer ----------
function renderChart(diagnosis_history = []) {
  // defensive checks
  if (!Array.isArray(diagnosis_history) || diagnosis_history.length === 0) {
    // empty placeholder chart
    bpCanvas.style.height = '260px';
    if (bpChart) bpChart.destroy();
    bpChart = new Chart(bpCanvas.getContext("2d"), {
      type: 'line',
      data: { labels: ["No data"], datasets: [] },
      options: { maintainAspectRatio: false }
    });
    return;
  }

  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  // normalize and sort
  const normalized = diagnosis_history.map(item => {
    const year = item.year || (item.date ? new Date(item.date).getFullYear() : null);
    let monthIdx = null;
    if (item.month) {
      const m = item.month.toString().slice(0,3).toLowerCase();
      monthIdx = MONTHS[m] || null;
    } else if (item.date) {
      const d = new Date(item.date);
      if (!isNaN(d)) monthIdx = d.getMonth() + 1;
    }
    const sortKey = (year ? year * 100 + (monthIdx || 0) : 0);
    return {
      sortKey,
      label: `${item.month ? item.month : ''}${item.year ? (item.month ? ', ' + item.year : item.year) : ''}`.trim(),
      systolic: item.blood_pressure && item.blood_pressure.systolic ? Number(item.blood_pressure.systolic.value) : null,
      diastolic: item.blood_pressure && item.blood_pressure.diastolic ? Number(item.blood_pressure.diastolic.value) : null
    };
  });

  normalized.sort((a,b) => a.sortKey - b.sortKey);

  const labels = normalized.map(n => n.label || '');
  const systolic = normalized.map(n => n.systolic === null ? null : n.systolic);
  const diastolic = normalized.map(n => n.diastolic === null ? null : n.diastolic);

  const validS = systolic.filter(v => v !== null && !isNaN(v));
  const validD = diastolic.filter(v => v !== null && !isNaN(v));
  const allValues = validS.concat(validD);

  let yMin, yMax;
  if (allValues.length) {
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    if (min === max) {
      yMin = Math.max(0, min - 20);
      yMax = max + 20;
    } else {
      const pad = Math.ceil((max - min) * 0.12);
      yMin = Math.max(0, min - pad);
      yMax = max + pad;
    }
  } else {
    yMin = 50; yMax = 170;
  }

  bpCanvas.style.height = '260px';
  if (bpChart) bpChart.destroy();

  bpChart = new Chart(bpCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Systolic",
          data: systolic,
          borderColor: "#ff6bcb",
          backgroundColor: "rgba(255,107,203,0.06)",
          tension: 0.35,
          pointRadius: (allValues.length === 1 ? 6 : 3),
          spanGaps: true
        },
        {
          label: "Diastolic",
          data: diastolic,
          borderColor: "#7c74ff",
          backgroundColor: "rgba(124,116,255,0.06)",
          tension: 0.35,
          pointRadius: (allValues.length === 1 ? 6 : 3),
          spanGaps: true
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: { min: yMin, max: yMax, ticks: { stepSize: 10 }, grid: { color: 'rgba(15,23,42,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ---------- Render patient into UI (use 'patient' parameter consistently) ----------
function renderJessica(patient) {
  if (!patient) return;
  console.log("Rendering patient:", patient);

  avatarEl.src = patient.profile_picture || DATA_AVATAR;
  pName.textContent = patient.name || "Jessica Taylor";
  pMeta.textContent = `${patient.gender || "Female"} • ${patient.age || ""}`;
  pDob.textContent = patient.date_of_birth || patient.dob || "";
  pPhone.textContent = patient.phone_number || patient.phone || "";
  pEmergency.textContent = patient.emergency_contact || patient.emergency || "";
  pInsurance.textContent = patient.insurance_type || patient.insurance || "";

  // diagnosis_history may be an array; pick the last record for vitals display
  const dh = Array.isArray(patient.diagnosis_history) ? patient.diagnosis_history : [];
  const last = dh.length ? dh[dh.length - 1] : null;
  if (last) {
    respVal.textContent = last.respiratory_rate ? `${last.respiratory_rate.value} bpm` : "--";
    respLevel.textContent = last.respiratory_rate ? last.respiratory_rate.levels : "--";
    tempVal.textContent = last.temperature ? `${last.temperature.value}°F` : "--";
    tempLevel.textContent = last.temperature ? last.temperature.levels : "--";
    heartVal.textContent = last.heart_rate ? `${last.heart_rate.value} bpm` : "--";
    heartLevel.textContent = last.heart_rate ? last.heart_rate.levels : "--";
  } else {
    respVal.textContent = "--";
    respLevel.textContent = "--";
    tempVal.textContent = "--";
    tempLevel.textContent = "--";
    heartVal.textContent = "--";
    heartLevel.textContent = "--";
  }

  // diagnostic list
  diagnosticListEl.innerHTML = "";
  if (Array.isArray(patient.diagnostic_list) && patient.diagnostic_list.length) {
    patient.diagnostic_list.forEach(d => {
      const row = document.createElement("div");
      row.className = "diag-row";
      row.innerHTML = `<div>${d.name}</div><div class="muted">${d.description || ''}</div><div>${d.status || ''}</div>`;
      diagnosticListEl.appendChild(row);
    });
  } else {
    diagnosticListEl.innerHTML = "<div class='muted'>No diagnostics available</div>";
  }

  // labs
  labListEl.innerHTML = "";
  if (Array.isArray(patient.lab_results) && patient.lab_results.length) {
    patient.lab_results.forEach(l => {
      const li = document.createElement("li");
      li.textContent = `${l} ⬇`;
      labListEl.appendChild(li);
    });
  } else {
    labListEl.innerHTML = "<div class='muted'>No lab results</div>";
  }

  // chart
  renderChart(dh);
}

// ---------- Init: fetch then pick Jessica ----------
(async function init() {
  try {
    const data = await fetchData();
    // data could be array or single object
    const list = Array.isArray(data) ? data : (Array.isArray(data.patients) ? data.patients : [data]);

    // Find Jessica (case-insensitive)
    const jessica = list.find(p => (p.name || "").toLowerCase().includes("jessica") && (p.name || "").toLowerCase().includes("taylor")) || list[0];
    if (!jessica) {
      console.warn("Jessica not found; using first item");
    }
    renderJessica(jessica);
  } catch (err) {
    console.error("Initialization error:", err);
  }
})();
