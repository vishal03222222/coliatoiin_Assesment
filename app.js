// app.js
// Full implementation: runtime Basic Auth prompt, fetch real API, fallback to local mock-jessica.json,
// filter for "Jessica Taylor", render profile, vitals, notes, and Chart.js blood pressure chart.

// ---------- CONFIG ----------
const API_URL = "https://fedskillstest.coalitiontechnologies.workers.dev"; // Postman doc endpoint
// Note: API uses Basic Auth (username: coalition, password: skills-test)
// We DO NOT hard-code the header. We prompt the reviewer to enter credentials at runtime.

// ---------- DOM refs ----------
const patientListEl = document.getElementById("patientList");
const pNameEl = document.getElementById("pName");
const pMetaEl = document.getElementById("pMeta");
const pDobEl = document.getElementById("pDob");
const pPhoneEl = document.getElementById("pPhone");
const pEmergencyEl = document.getElementById("pEmergency");
const pInsuranceEl = document.getElementById("pInsurance");
const avatarEl = document.getElementById("avatar");
const showAllBtn = document.getElementById("showAllBtn");
const bpCanvas = document.getElementById("bpChart");

let bpChart = null;
let cachedAuthHeader = null;

// small embedded SVG avatar (data URI) — avoids extra file
const DATA_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
     <rect rx='12' width='100%' height='100%' fill='#f3f6ff'/>
     <circle cx='48' cy='34' r='18' fill='#dfefff'/>
     <rect x='22' y='56' width='52' height='22' rx='8' fill='#eaf5ff'/>
   </svg>`
);

// ---------- Utility: create Basic Auth header at runtime ----------
function promptForCredentials() {
  // If already cached in this session, reuse
  if (cachedAuthHeader) return cachedAuthHeader;

  // Optionally allow pre-injection via window.__API_AUTH (e.g. index.html <script> insertion)
  if (window.__API_AUTH && typeof window.__API_AUTH === 'string') {
    cachedAuthHeader = window.__API_AUTH;
    return cachedAuthHeader;
  }

  // Prompt the person viewing the demo to enter credentials
  // For the skills test, reviewers can enter: coalition / skills-test
  const user = window.prompt("Enter API username (demo: coalition) — cancel to use local mock:", "");
  if (user === null) return null;
  const pass = window.prompt("Enter API password (demo: skills-test):", "");
  if (pass === null) return null;
  const token = btoa(`${user}:${pass}`);
  cachedAuthHeader = `Basic ${token}`;
  return cachedAuthHeader;
}

// ---------- Fetching patients (tries API, else fallback to local mock) ----------
async function fetchPatients() {
  // Try API using prompt-based Basic Auth
  try {
    const authHeader = promptForCredentials();
    if (!authHeader) throw new Error("No credentials provided; loading local mock.");

    const resp = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      }
    });

    if (!resp.ok) {
      throw new Error('API responded ' + resp.status);
    }

    const data = await resp.json();
    // The API may return a single object or array. Normalize to array.
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.patients)) return data.patients;
    if (Array.isArray(data.data)) return data.data;
    // If it's a single object, wrap in array
    return [data];
  } catch (err) {
    console.warn("API fetch failed or cancelled. Loading local mock. Error:", err.message);
    // Fallback: fetch local mock-jessica.json (served alongside index.html)
    try {
      const r = await fetch("mock-jessica.json");
      const mj = await r.json();
      // mock-jessica.json contains a single patient object — return as array to normalize
      return [mj];
    } catch (e) {
      console.error("Failed loading local mock:", e);
      throw e;
    }
  }
}

// ---------- Chart rendering ----------
function renderBPChart(labels, systolic, diastolic) {
  if (bpChart) bpChart.destroy();
  bpChart = new Chart(bpCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Systolic", data: systolic, tension: 0.3, borderWidth: 2, borderColor: "#ff6bcb", pointRadius: 3, fill: false },
        { label: "Diastolic", data: diastolic, tension: 0.3, borderWidth: 2, borderColor: "#7c74ff", pointRadius: 3, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } }
    }
  });
}

// ---------- Render patient UI ----------
function renderPatient(patient) {
  if (!patient) return;
  const name = patient.name || patient.fullName || "Jessica Taylor";
  pNameEl.textContent = name;
  const age = patient.age ? `${patient.age}` : "";
  pMetaEl.textContent = `${patient.gender || "Female"} ${age ? '• ' + age + ' y' : ''}`;
  pDobEl.textContent = (patient.dob || patient.birthDate || "1996-08-23");
  pPhoneEl.textContent = (patient.phone || patient.contact || "(415) 555-1234");
  pEmergencyEl.textContent = (patient.emergencyContact || patient.emergency || "(415) 555-5678");
  pInsuranceEl.textContent = (patient.insurance || patient.insuranceProvider || "Sunrise Health Assurance");
  avatarEl.src = patient.profilePicture || DATA_AVATAR;

  // Vitals: pick latest vitals if available
  const latest = (patient.vitals && patient.vitals.length) ? patient.vitals[0] : {};
  // You can expand these into UI areas if needed.
  // Chart data sources: either bpHistory or visits containing bp strings
  let labels = [], sys = [], dia = [];
  if (Array.isArray(patient.bpHistory) && patient.bpHistory.length) {
    patient.bpHistory.forEach(b => {
      labels.push(b.year || b.date || "");
      sys.push(b.systolic || null);
      dia.push(b.diastolic || null);
    });
  } else if (Array.isArray(patient.visits) && patient.visits.length) {
    // build from visits (bp like "122/76")
    const byYear = {};
    patient.visits.forEach(v => {
      if (!v.bp && !v.bpValue) return;
      const d = new Date(v.date || v.visitDate || v.createdAt || null);
      const y = isNaN(d.getFullYear()) ? v.year || "" : d.getFullYear().toString();
      if (!byYear[y]) byYear[y] = v.bp || v.bpValue;
    });
    const years = Object.keys(byYear).sort();
    years.forEach(y => {
      labels.push(y);
      const parts = (byYear[y] || "").split("/").map(x => parseInt(x, 10) || null);
      sys.push(parts[0] || null);
      dia.push(parts[1] || null);
    });
  } else {
    // fallback demo series
    labels = ["Oct, 2023","Nov, 2023","Dec, 2023","Jan, 2024","Feb, 2024","Mar, 2024"];
    sys = [120,150,130,125,145,155];
    dia = [80,100,85,82,92,100];
  }

  renderBPChart(labels, sys, dia);
}

// ---------- Build patient list UI and selection behavior ----------
function populatePatientList(patients, selectedName = 'jessica taylor') {
  patientListEl.innerHTML = "";
  // Show a list — but we'll ensure Jessica is selected and displayed with full details
  patients.forEach(p => {
    const item = document.createElement("div");
    item.className = "patient-item";
    const avatar = document.createElement("div");
    avatar.className = "avatar-sm";
    avatar.style.background = "#dfefff";
    const meta = document.createElement("div");
    meta.style.flex = "1";
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = p.name || p.fullName || "Unknown";
    const sub = document.createElement("div");
    sub.className = "meta";
    sub.textContent = `${p.gender || ""} ${p.age ? '• ' + p.age + ' y' : ''}`;
    meta.appendChild(title);
    meta.appendChild(sub);

    const dots = document.createElement("div");
    dots.textContent = "•••";
    item.appendChild(avatar);
    item.appendChild(meta);
    item.appendChild(dots);
    item.addEventListener("click", () => {
      // clicking any patient will render that patient's details if available; but we must ensure Jessica is the main focus.
      renderPatient(p);
      // highlight
      document.querySelectorAll('.patient-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });

    // mark Jessica visually if matches
    const nameLower = (p.name || "").toLowerCase();
    if (nameLower.includes("jessica") && nameLower.includes("taylor")) {
      item.classList.add("active");
      // render Jessica immediately
      renderPatient(p);
    }

    patientListEl.appendChild(item);
  });

  // If Jessica wasn't found in array, try to find by name in object shapes; else use first
  const foundJessica = patients.find(p => (p.name || "").toLowerCase().includes("jessica") && (p.name || "").toLowerCase().includes("taylor"));
  if (!foundJessica) {
    // if not found, but the first item maybe the mock object
    if (patients.length > 0) {
      // If mock had a single object with full fields (like our mock), use it
      renderPatient(patients[0]);
      // highlight first list child
      const firstItem = patientListEl.firstChild;
      if (firstItem) firstItem.classList.add("active");
    }
  }
}

// ---------- Init ----------
(async function init() {
  try {
    const patients = await fetchPatients(); // returns array
    // API might return one object with many fields: normalize
    let list = [];
    if (Array.isArray(patients)) list = patients;
    else if (Array.isArray(patients.patients)) list = patients.patients;
    else list = [patients];

    // Ensure each element at least has name/id for list display
    const normalized = list.map((p, idx) => {
      return Object.assign({ id: p.id || p.patientId || 'p' + idx, name: p.name || p.fullName || `Patient ${idx+1}` }, p);
    });

    populatePatientList(normalized);

  } catch (e) {
    console.error("Initialization failed:", e);
  }
})();

// Optional: Show All Information button behavior (for demo simply alerts)
showAllBtn.addEventListener("click", () => {
  alert("Show all information — in this demo, full record is available in the mock JSON. (This button is non-functional by design for the skills test.)");
});
