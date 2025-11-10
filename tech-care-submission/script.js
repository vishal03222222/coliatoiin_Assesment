// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {

    // --- Select all the DOM elements you need to update ---
    // Profile Sidebar
    const patientAvatar = document.getElementById('patient-avatar');
    const patientName = document.getElementById('patient-name');
    const patientDob = document.getElementById('patient-dob');
    const patientGender = document.getElementById('patient-gender');
    const patientContact = document.getElementById('patient-contact');
    const patientEmergency = document.getElementById('patient-emergency');
    const patientInsurance = document.getElementById('patient-insurance');
    
    // Vitals
    const respiratoryRate = document.getElementById('respiratory-rate');
    const respiratoryLevel = document.getElementById('respiratory-level');
    const temperature = document.getElementById('temperature');
    const temperatureLevel = document.getElementById('temperature-level');
    const heartRate = document.getElementById('heart-rate');
    const heartRateLevel = document.getElementById('heart-rate-level');

    // Diagnostic List
    const diagnosticListBody = document.getElementById('diagnostic-list-body');
    
    // Lab Results
    const labResultsList = document.getElementById('lab-results-list');
    
    // Chart Canvas
    const bpChartCanvas = document.getElementById('bpChart').getContext('2d');


    // --- API Endpoint and Auth ---
    const API_URL = 'https://fedskillstest.coalitiontechnologies.workers.dev';
    // IMPORTANT: Replace with your actual encrypted auth key
    const AUTH_KEY = '[ENCRYPTED AUTH KEY GOES HERE]'; 

    async function fetchPatientData() {
        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH_KEY}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // The API returns an array, but we only care about Jessica Taylor.
            // Let's find her data.
            const jessicaData = data.find(patient => patient.name === "Jessica Taylor");

            if (jessicaData) {
                populateUI(jessicaData);
            } else {
                console.error("Jessica Taylor's data not found.");
            }

        } catch (error) {
            console.error("Could not fetch patient data:", error);
        }
    }

    function populateUI(patient) {
        // --- 1. Populate Profile Sidebar ---
        patientAvatar.src = patient.profile_picture;
        patientName.textContent = patient.name;
        patientDob.textContent = patient.date_of_birth;
        patientGender.textContent = patient.gender;
        patientContact.textContent = patient.phone_number;
        patientEmergency.textContent = patient.emergency_contact;
        patientInsurance.textContent = patient.insurance_type;

        // --- 2. Populate Vitals ---
        // We'll use the *latest* diagnosis history entry (index 0)
        const latestHistory = patient.diagnosis_history[0];
        
        respiratoryRate.textContent = `${latestHistory.respiratory_rate.value} bpm`;
        respiratoryLevel.textContent = latestHistory.respiratory_rate.levels;
        
        temperature.textContent = `${latestHistory.temperature.value}°F`;
        temperatureLevel.textContent = latestHistory.temperature.levels;
        
        heartRate.textContent = `${latestHistory.heart_rate.value} bpm`;
        heartRateLevel.textContent = latestHistory.heart_rate.levels;
        // Tip: You can add CSS classes here to change text color based on "levels"
        
        // --- 3. Populate Diagnostic List ---
        diagnosticListBody.innerHTML = ''; // Clear existing
        patient.diagnostic_list.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.description}</td>
                <td>${item.status}</td>
            `;
            diagnosticListBody.appendChild(row);
        });

        // --- 4. Populate Lab Results ---
        labResultsList.innerHTML = ''; // Clear existing
        patient.lab_results.forEach(result => {
            const li = document.createElement('li');
            li.textContent = result;
            // Add download icon if needed
            // li.innerHTML = `${result} <img src="assets/download.png" alt="download">`;
            labResultsList.appendChild(li);
        });

        // --- 5. Create the Chart ---
        setupChart(patient.diagnosis_history);
    }
    
    function setupChart(history) {
        // The data is "latest first", so reverse it for a chronological chart
        const chronologicalHistory = [...history].reverse();
        
        // Extract data for the chart
        const labels = chronologicalHistory.map(item => `${item.month.substring(0, 3)}, ${item.year}`);
        const systolicData = chronologicalHistory.map(item => item.blood_pressure.systolic.value);
        const diastolicData = chronologicalHistory.map(item => item.blood_pressure.diastolic.value);

        new Chart(bpChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Systolic',
                        data: systolicData,
                        borderColor: '#E66FD2', // Pink
                        backgroundColor: '#E66FD2',
                        fill: false,
                        tension: 0.4 // This makes the line curvy
                    },
                    {
                        label: 'Diastolic',
                        data: diastolicData,
                        borderColor: '#8C6FE6', // Purple
                        backgroundColor: '#8C6FE6',
                        fill: false,
                        tension: 0.4 // This makes the line curvy
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide the built-in legend to match the design
                    }
                }
            }
        });
    }

    // --- Run the fetch function ---
    fetchPatientData();

});