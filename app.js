// ===== Configuration =====
const CONFIG = {
    locations: Array.from({ length: 31 }, (_, i) => i + 1),
    
    departments: ['Operations', 'Safety', 'Accounting'],
    
    noteTypes: {
        Accounting: [
            'Cash Count/GSR Violation',
            'KPI Sheet Violation',
            'Payroll/Onboarding Violation',
            'Company Card Violation',
            'Expense Report Violation',
            'Other'
        ],
        Operations: [
            'Order Placing Violation',
            'Over Budget Violation',
            'Site Appearance Violation',
            'Procedural Violation',
            'Other'
        ],
        Safety: [
            'PPE Violation',
            'Preventable Accident Violation',
            'Training Violation',
            'Safety Protocol Violation',
            'Other'
        ]
    }
};

// ===== API Configuration =====
const API_BASE = '/.netlify/functions';

// ===== Database API Functions =====
async function initDatabase() {
    try {
        const response = await fetch(`${API_BASE}/init-db`);
        const result = await response.json();
        
        if (result.success) {
            console.log('Database initialized successfully');
        } else {
            console.error('Database initialization failed:', result.error);
            showToast('Error connecting to database', true);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        showToast('Error connecting to database. Check your connection.', true);
    }
}

async function insertNote(location, department, noteType, otherDesc, additionalNotes) {
    try {
        const response = await fetch(`${API_BASE}/notes-create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: parseInt(location),
                department,
                note_type: noteType,
                other_description: otherDesc || null,
                additional_notes: additionalNotes || null
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.note;
    } catch (error) {
        console.error('Error inserting note:', error);
        throw error;
    }
}

async function getNotes(location = null, department = null) {
    try {
        let url = `${API_BASE}/notes-get`;
        const params = new URLSearchParams();
        
        if (location) params.append('location', location);
        if (department) params.append('department', department);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.notes;
    } catch (error) {
        console.error('Error fetching notes:', error);
        return [];
    }
}

async function getNotesForExport(location) {
    try {
        const response = await fetch(`${API_BASE}/notes-get?location=${location}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        // Sort by department and date
        return result.notes.sort((a, b) => {
            if (a.department !== b.department) {
                return a.department.localeCompare(b.department);
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });
    } catch (error) {
        console.error('Error fetching notes for export:', error);
        return [];
    }
}

// ===== UI Functions =====
function populateLocationDropdown() {
    const locationSelect = document.getElementById('location');
    const filterLocationSelect = document.getElementById('filterLocation');
    
    CONFIG.locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = `Site ${loc}`;
        locationSelect.appendChild(option);
        
        const filterOption = option.cloneNode(true);
        filterLocationSelect.appendChild(filterOption);
    });
}

function updateNoteTypes(department) {
    const noteTypeGroup = document.getElementById('noteTypeGroup');
    const noteTypeSelect = document.getElementById('noteType');
    const otherDescGroup = document.getElementById('otherDescGroup');
    
    // Clear existing options
    noteTypeSelect.innerHTML = '<option value="">Select a note type...</option>';
    otherDescGroup.style.display = 'none';
    
    if (!department) {
        noteTypeGroup.style.display = 'none';
        return;
    }
    
    const types = CONFIG.noteTypes[department];
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        noteTypeSelect.appendChild(option);
    });
    
    noteTypeGroup.style.display = 'block';
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    toastIcon.textContent = isError ? '✗' : '✓';
    toast.style.background = isError ? 'var(--danger)' : 'var(--success)';
    
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function renderRecords(notes) {
    const container = document.getElementById('recordsContainer');
    
    if (notes.length === 0) {
        container.innerHTML = '<p class="no-records">No records found</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => {
        const deptClass = `dept-${note.department.toLowerCase()}`;
        const displayType = note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}` 
            : note.note_type;
        
        return `
            <div class="record-card">
                <div class="record-header">
                    <span class="record-type">${displayType}</span>
                    <span class="record-timestamp">${formatDate(note.created_at)}</span>
                </div>
                <div class="record-meta">
                    <span class="record-badge">Site ${note.location}</span>
                    <span class="record-badge ${deptClass}">${note.department}</span>
                </div>
                ${note.additional_notes ? `<p class="record-notes">${note.additional_notes}</p>` : ''}
            </div>
        `;
    }).join('');
}

async function exportToSpreadsheet(location) {
    const notes = await getNotesForExport(location);
    
    if (notes.length === 0) {
        showToast('No records to export for this site', true);
        return;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Group notes by department
    const departments = ['Operations', 'Safety', 'Accounting'];
    
    departments.forEach(dept => {
        const deptNotes = notes.filter(n => n.department === dept);
        
        if (deptNotes.length > 0) {
            const data = deptNotes.map(note => ({
                'Date/Time': formatDate(note.created_at),
                'Note Type': note.note_type,
                'Other Description': note.other_description || '',
                'Additional Notes': note.additional_notes || ''
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 22 },
                { wch: 30 },
                { wch: 30 },
                { wch: 50 }
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, dept);
        }
    });
    
    // Also create an "All Records" sheet
    const allData = notes.map(note => ({
        'Date/Time': formatDate(note.created_at),
        'Department': note.department,
        'Note Type': note.note_type,
        'Other Description': note.other_description || '',
        'Additional Notes': note.additional_notes || ''
    }));
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    allWs['!cols'] = [
        { wch: 22 },
        { wch: 15 },
        { wch: 30 },
        { wch: 30 },
        { wch: 50 }
    ];
    XLSX.utils.book_append_sheet(wb, allWs, 'All Records');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Site_${location}_Notes_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${notes.length} records to ${filename}`);
}

// ===== Event Handlers =====
function setupEventListeners() {
    const departmentSelect = document.getElementById('department');
    const noteTypeSelect = document.getElementById('noteType');
    const noteForm = document.getElementById('noteForm');
    const viewDataBtn = document.getElementById('viewDataBtn');
    const backBtn = document.getElementById('backBtn');
    const exportBtn = document.getElementById('exportBtn');
    const filterLocation = document.getElementById('filterLocation');
    const filterDepartment = document.getElementById('filterDepartment');
    
    // Department change - update note types
    departmentSelect.addEventListener('change', (e) => {
        updateNoteTypes(e.target.value);
    });
    
    // Note type change - show/hide other description
    noteTypeSelect.addEventListener('change', (e) => {
        const otherDescGroup = document.getElementById('otherDescGroup');
        otherDescGroup.style.display = e.target.value === 'Other' ? 'block' : 'none';
        
        if (e.target.value !== 'Other') {
            document.getElementById('otherDesc').value = '';
        }
    });
    
    // Form submission
    noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const location = document.getElementById('location').value;
        const department = document.getElementById('department').value;
        const noteType = document.getElementById('noteType').value;
        const otherDesc = document.getElementById('otherDesc').value;
        const additionalNotes = document.getElementById('notes').value;
        
        if (!location || !department || !noteType) {
            showToast('Please fill in all required fields', true);
            return;
        }
        
        if (noteType === 'Other' && !otherDesc.trim()) {
            showToast('Please describe the violation', true);
            return;
        }
        
        try {
            await insertNote(location, department, noteType, otherDesc, additionalNotes);
            showToast('Note saved successfully!');
            
            // Reset form
            noteForm.reset();
            document.getElementById('noteTypeGroup').style.display = 'none';
            document.getElementById('otherDescGroup').style.display = 'none';
        } catch (error) {
            showToast('Error saving note. Please try again.', true);
        }
    });
    
    // View data button
    viewDataBtn.addEventListener('click', () => {
        document.getElementById('formScreen').classList.add('hidden');
        document.getElementById('dataScreen').classList.remove('hidden');
        refreshRecords();
    });
    
    // Back button
    backBtn.addEventListener('click', () => {
        document.getElementById('dataScreen').classList.add('hidden');
        document.getElementById('formScreen').classList.remove('hidden');
    });
    
    // Filter changes
    filterLocation.addEventListener('change', refreshRecords);
    filterDepartment.addEventListener('change', refreshRecords);
    
    // Export button
    exportBtn.addEventListener('click', () => {
        const location = document.getElementById('filterLocation').value;
        
        if (!location) {
            showToast('Please select a site to export', true);
            return;
        }
        
        exportToSpreadsheet(parseInt(location));
    });
}

async function refreshRecords() {
    const location = document.getElementById('filterLocation').value;
    const department = document.getElementById('filterDepartment').value;
    
    const notes = await getNotes(
        location ? parseInt(location) : null,
        department || null
    );
    
    renderRecords(notes);
}

// ===== PWA Service Worker Registration =====
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration.scope);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// ===== Initialize App =====
async function init() {
    await initDatabase();
    populateLocationDropdown();
    setupEventListeners();
    registerServiceWorker();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
