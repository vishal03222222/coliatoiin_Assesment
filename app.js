// app.js — Coalition FED Test Integration (Jessica Taylor only)

const API_URL = "https://fedskillstest.coalitiontechnologies.workers.dev";
const bpCanvas = document.getElementById("bpChart");

// DOM refs
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

let bpChart;

// prompt-based Basic Auth
let cachedAuth = null;
function getAuthHeader() {
  if (cachedAuth) return cachedAuth;
  const user = prompt("Enter API username (demo: coalition):");
  if (!user) return null;
  const pass = prompt("Enter API password (demo: skills-test):");
  if (!pass) return null;
  cachedAuth = "Basic " + btoa(`${user}:${pass}`);
  return cachedAuth;
}

// Fetch from API or fallback
async function fetchData() {
  try {
    const auth = getAuthHeader();
    if (!auth) throw new Error("No credentials");
    const res = await fetch(API_URL, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error("Status " + res.status);
    return await res.json();
  } catch (e) {
    console.warn("Using local mock data:", e.message);
    const r = await fetch("mock-jessica.json");
    return await r.json();
  }
}

// Render Chart
function renderChart(diagnosis_history) {
  const labels = diagnosis_history.map((d) => `${d.month}, ${d.year}`);
  const systolic = diagnosis_history.map((d) => d.blood_pressure.systolic.value);
  const diastolic = diagnosis_history.map((d) => d.blood_pressure.diastolic.value);
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
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
        {
          label: "Diastolic",
          data: diastolic,
          borderColor: "#7c74ff",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

// Render UI
function renderJessica(p) {
  avatarEl.src = p.profile_picture || "";
  pName.textContent = p.name;
  pMeta.textContent = `${p.gender} • ${p.age}`;
  pDob.textContent = p.date_of_birth;
  pPhone.textContent = p.phone_number;
  pEmergency.textContent = p.emergency_contact;
  pInsurance.textContent = p.insurance_type;

  // vitals (from last record)
  const last = p.diagnosis_history[p.diagnosis_history.length - 1];
  respVal.textContent = `${last.respiratory_rate.value} bpm`;
  respLevel.textContent = last.respiratory_rate.levels;
  tempVal.textContent = `${last.temperature.value}°F`;
  tempLevel.textContent = last.temperature.levels;
  heartVal.textContent = `${last.heart_rate.value} bpm`;
  heartLevel.textContent = last.heart_rate.levels;

  // diagnostics
  diagnosticListEl.innerHTML = "";
  p.diagnostic_list.forEach((d) => {
    const row = document.createElement("div");
    row.className = "diag-row";
    row.innerHTML = `<div>${d.name}</div><div class="muted">${d.description}</div><div>${d.status}</div>`;
    diagnosticListEl.appendChild(row);
  });

  // labs
  labListEl.innerHTML = "";
  p.lab_results.forEach((lab) => {
    const li = document.createElement("li");
    li.textContent = `${lab} ⬇`;
    labListEl.appendChild(li);
  });

  // chart
  renderChart(p.diagnosis_history);
}

// init
(async function init() {
  const data = await fetchData();
  const list = Array.isArray(data) ? data : [data];
  const jessica = list.find((p) => p.name === "Jessica Taylor") || list[0];
  renderJessica(jessica);
})();
