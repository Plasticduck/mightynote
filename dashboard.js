// ===== Selection State =====
let selectedNotes = new Set();
let currentNotes = [];
let currentSortOrder = 'newest';

// Report selection state
let reportSelectedNotes = new Set();
let reportNotes = [];
let reportSelectMode = false;

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

// Get all note types as flat array
const ALL_NOTE_TYPES = [
    ...CONFIG.noteTypes.Accounting,
    ...CONFIG.noteTypes.Operations,
    ...CONFIG.noteTypes.Safety
].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates (like "Other")

// ===== API Configuration =====
const API_BASE = '/.netlify/functions';

// ===== Database API Functions =====
async function initDatabase() {
    try {
        const response = await fetch(`${API_BASE}/init-db`);
        const result = await response.json();
        
        if (result.success) {
            console.log('Dashboard database initialized');
        } else {
            console.error('Database initialization failed:', result.error);
            showToast('Error connecting to database', true);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        showToast('Error connecting to database', true);
    }
}

async function getAllNotes() {
    try {
        const response = await fetch(`${API_BASE}/notes-get`);
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

async function getFilteredNotes(filters) {
    try {
        const response = await fetch(`${API_BASE}/notes-filter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filters)
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.notes;
    } catch (error) {
        console.error('Error filtering notes:', error);
        return [];
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

async function deleteNotes(ids) {
    try {
        const response = await fetch(`${API_BASE}/notes-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result;
    } catch (error) {
        console.error('Error deleting notes:', error);
        throw error;
    }
}

// ===== Helper Functions =====
function getPhotoUrl(noteId) {
    return `${window.location.origin}/.netlify/functions/notes-view-image?id=${noteId}`;
}

function populateLocationFilter() {
    const filterLocationSelect = document.getElementById('filterLocation');
    if (!filterLocationSelect) return;
    
    CONFIG.locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = `Site ${loc}`;
        filterLocationSelect.appendChild(option);
    });
}

function sortNotes(notes, sortOrder) {
    const sorted = [...notes];
    
    switch (sortOrder) {
        case 'newest':
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'site-asc':
            sorted.sort((a, b) => a.location - b.location);
            break;
        case 'site-desc':
            sorted.sort((a, b) => b.location - a.location);
            break;
        case 'dept':
            sorted.sort((a, b) => a.department.localeCompare(b.department));
            break;
        default:
            break;
    }
    
    return sorted;
}

// ===== Notes Rendering =====
function renderRecords(notes) {
    const container = document.getElementById('recordsContainer');
    currentNotes = notes;
    
    if (notes.length === 0) {
        container.innerHTML = '<p class="no-records">No records found</p>';
        updateSelectionUI();
        return;
    }
    
    container.innerHTML = notes.map(note => {
        const deptClass = `dept-${note.department.toLowerCase()}`;
        const displayType = note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}` 
            : note.note_type;
        const isSelected = selectedNotes.has(note.id);
        
        const imageBadge = note.has_image ? `
            <a href="${getPhotoUrl(note.id)}" target="_blank" class="record-image-badge" onclick="event.stopPropagation()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                View Photo
            </a>
        ` : '';
        
        return `
            <div class="record-card ${isSelected ? 'selected' : ''}" data-id="${note.id}">
                <label class="record-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleNoteSelection(${note.id}, this.checked)">
                    <span class="record-check"></span>
                </label>
                <div class="record-header">
                    <span class="record-type">${displayType}</span>
                    <span class="record-timestamp">${formatDate(note.created_at)}</span>
                </div>
                <div class="record-meta">
                    <span class="record-badge">Site ${note.location}</span>
                    <span class="record-badge ${deptClass}">${note.department}</span>
                    ${imageBadge}
                </div>
                ${note.additional_notes ? `<p class="record-notes">${note.additional_notes}</p>` : ''}
            </div>
        `;
    }).join('');
    
    updateSelectionUI();
}

async function refreshNotesList() {
    const location = document.getElementById('filterLocation')?.value;
    const department = document.getElementById('filterDepartment')?.value;
    
    let notes = await getNotes(
        location ? parseInt(location) : null,
        department || null
    );
    
    notes = sortNotes(notes, currentSortOrder);
    renderRecords(notes);
}

// ===== Selection Functions =====
function toggleNoteSelection(noteId, isSelected) {
    if (isSelected) {
        selectedNotes.add(noteId);
    } else {
        selectedNotes.delete(noteId);
    }
    
    const card = document.querySelector(`.record-card[data-id="${noteId}"]`);
    if (card) {
        card.classList.toggle('selected', isSelected);
    }
    
    updateSelectionUI();
}

function selectAllNotes() {
    const selectAll = document.getElementById('selectAllCheckbox').checked;
    
    currentNotes.forEach(note => {
        if (selectAll) {
            selectedNotes.add(note.id);
        } else {
            selectedNotes.delete(note.id);
        }
    });
    
    document.querySelectorAll('.record-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = selectAll;
            card.classList.toggle('selected', selectAll);
        }
    });
    
    updateSelectionUI();
}

function clearSelection() {
    selectedNotes.clear();
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    document.querySelectorAll('.record-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = false;
            card.classList.remove('selected');
        }
    });
    
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedNotes.size;
    const countEl = document.getElementById('selectionCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const exportBtn = document.getElementById('exportSelectedBtn');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    
    if (countEl) {
        countEl.textContent = `${count} selected`;
    }
    
    if (selectAllCheckbox && currentNotes.length > 0) {
        const allSelected = currentNotes.every(note => selectedNotes.has(note.id));
        const someSelected = currentNotes.some(note => selectedNotes.has(note.id));
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
    
    if (exportBtn) exportBtn.disabled = count === 0;
    if (deleteBtn) deleteBtn.disabled = count === 0;
}

// ===== Delete Functions =====
async function deleteSelectedNotes() {
    if (selectedNotes.size === 0) {
        showToast('No notes selected', true);
        return;
    }
    
    const count = selectedNotes.size;
    const confirmed = confirm(`Are you sure you want to delete ${count} note(s)? This cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
        const ids = Array.from(selectedNotes);
        const result = await deleteNotes(ids);
        
        showToast(`Deleted ${result.deleted} note(s)`);
        selectedNotes.clear();
        await refreshNotesList();
        await updateStats();
    } catch (error) {
        showToast('Error deleting notes', true);
    }
}

// ===== Export Selected Notes =====
async function exportSelectedNotes(format) {
    if (selectedNotes.size === 0) {
        showToast('No notes selected', true);
        return;
    }
    
    const selectedData = currentNotes.filter(note => selectedNotes.has(note.id));
    
    if (format === 'pdf' || format === 'both') {
        exportSelectedToPDF(selectedData);
    }
    
    if (format === 'excel' || format === 'both') {
        exportSelectedToExcel(selectedData);
    }
    
    closeExportSelectedMenu();
}

function exportSelectedToExcel(notes) {
    const wb = XLSX.utils.book_new();
    
    const data = notes.map(note => ({
        'Date/Time': formatDate(note.created_at),
        'Site': `Site ${note.location}`,
        'Department': note.department,
        'Note Type': note.note_type,
        'Other Description': note.other_description || '',
        'Additional Notes': note.additional_notes || '',
        'Photo': note.has_image ? getPhotoUrl(note.id) : ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    notes.forEach((note, index) => {
        if (note.has_image) {
            const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: 6 });
            if (ws[cellRef]) {
                ws[cellRef].l = { Target: getPhotoUrl(note.id), Tooltip: 'View Photo' };
            }
        }
    });
    
    ws['!cols'] = [
        { wch: 22 }, { wch: 12 }, { wch: 12 },
        { wch: 30 }, { wch: 30 }, { wch: 50 }, { wch: 40 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Notes');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Selected_Notes_${timestamp}.xlsx`);
    showToast(`Exported ${notes.length} notes to Excel`);
}

function exportSelectedToPDF(notes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Selected Notes Export', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Records: ${notes.length}`, 14, 34);
    
    const tableData = notes.map(note => [
        formatDate(note.created_at),
        `Site ${note.location}`,
        note.department,
        note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}` 
            : note.note_type,
        note.has_image ? 'View Photo' : '-'
    ]);
    
    const photoLinks = [];
    
    doc.autoTable({
        startY: 42,
        head: [['Date/Time', 'Site', 'Dept', 'Note Type', 'Photo']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 20 },
            2: { cellWidth: 25 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 22, halign: 'center' }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
                const note = notes[data.row.index];
                if (note && note.has_image) {
                    photoLinks.push({
                        x: data.cell.x, y: data.cell.y,
                        width: data.cell.width, height: data.cell.height,
                        url: getPhotoUrl(note.id)
                    });
                }
            }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
                const note = notes[data.row.index];
                if (note && note.has_image) {
                    data.cell.styles.textColor = [10, 132, 255];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });
    
    photoLinks.forEach(link => {
        doc.link(link.x, link.y, link.width, link.height, { url: link.url });
    });
    
    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`Selected_Notes_${timestamp}.pdf`);
    showToast(`Exported ${notes.length} notes to PDF`);
}

function toggleExportSelectedMenu() {
    const menu = document.getElementById('exportSelectedMenu');
    if (menu) menu.classList.toggle('hidden');
}

function closeExportSelectedMenu() {
    const menu = document.getElementById('exportSelectedMenu');
    if (menu) menu.classList.add('hidden');
}

// ===== Report Selection Functions =====
function toggleReportSelectMode() {
    reportSelectMode = !reportSelectMode;
    const resultsSection = document.getElementById('reportResults');
    const selectionBar = document.getElementById('reportSelectionBar');
    const selectBtn = document.getElementById('toggleSelectMode');
    
    if (reportSelectMode) {
        resultsSection.classList.add('select-mode');
        selectionBar.classList.remove('hidden');
        selectBtn.classList.add('active');
        selectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
        `;
    } else {
        resultsSection.classList.remove('select-mode');
        selectionBar.classList.add('hidden');
        selectBtn.classList.remove('active');
        selectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Select
        `;
        // Clear selection when exiting select mode
        reportSelectedNotes.clear();
        updateReportSelectionUI();
        renderReportNotes(reportNotes);
    }
}

function toggleReportNoteSelection(noteId, isSelected) {
    if (isSelected) {
        reportSelectedNotes.add(noteId);
    } else {
        reportSelectedNotes.delete(noteId);
    }
    
    const card = document.querySelector(`#reportRecordsContainer .record-card[data-id="${noteId}"]`);
    if (card) {
        card.classList.toggle('selected', isSelected);
    }
    
    updateReportSelectionUI();
}

function selectAllReportNotes() {
    const selectAll = document.getElementById('reportSelectAllCheckbox').checked;
    
    reportNotes.forEach(note => {
        if (selectAll) {
            reportSelectedNotes.add(note.id);
        } else {
            reportSelectedNotes.delete(note.id);
        }
    });
    
    document.querySelectorAll('#reportRecordsContainer .record-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = selectAll;
            card.classList.toggle('selected', selectAll);
        }
    });
    
    updateReportSelectionUI();
}

function updateReportSelectionUI() {
    const count = reportSelectedNotes.size;
    const countEl = document.getElementById('reportSelectionCount');
    const selectAllCheckbox = document.getElementById('reportSelectAllCheckbox');
    const exportBtn = document.getElementById('reportExportSelectedBtn');
    const deleteBtn = document.getElementById('reportDeleteSelectedBtn');
    
    if (countEl) countEl.textContent = `${count} selected`;
    
    if (selectAllCheckbox && reportNotes.length > 0) {
        const allSelected = reportNotes.every(note => reportSelectedNotes.has(note.id));
        const someSelected = reportNotes.some(note => reportSelectedNotes.has(note.id));
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
    
    if (exportBtn) exportBtn.disabled = count === 0;
    if (deleteBtn) deleteBtn.disabled = count === 0;
}

async function deleteReportSelectedNotes() {
    if (reportSelectedNotes.size === 0) {
        showToast('No notes selected', true);
        return;
    }
    
    const count = reportSelectedNotes.size;
    const confirmed = confirm(`Are you sure you want to delete ${count} note(s)? This cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
        const ids = Array.from(reportSelectedNotes);
        const result = await deleteNotes(ids);
        
        showToast(`Deleted ${result.deleted} note(s)`);
        reportSelectedNotes.clear();
        
        // Refresh both views
        await updateStats();
        await refreshNotesList();
        await generateReport(); // Re-run the report
    } catch (error) {
        showToast('Error deleting notes', true);
    }
}

function exportReportSelectedNotes(format) {
    if (reportSelectedNotes.size === 0) {
        showToast('No notes selected', true);
        return;
    }
    
    const selectedData = reportNotes.filter(note => reportSelectedNotes.has(note.id));
    
    if (format === 'pdf' || format === 'both') {
        exportSelectedToPDF(selectedData);
    }
    
    if (format === 'excel' || format === 'both') {
        exportSelectedToExcel(selectedData);
    }
    
    closeReportExportSelectedMenu();
}

function toggleReportExportSelectedMenu() {
    const menu = document.getElementById('reportExportSelectedMenu');
    if (menu) menu.classList.toggle('hidden');
}

function closeReportExportSelectedMenu() {
    const menu = document.getElementById('reportExportSelectedMenu');
    if (menu) menu.classList.add('hidden');
}

// ===== UI Functions =====
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

async function updateStats() {
    const notes = await getAllNotes();
    
    document.getElementById('totalNotes').textContent = notes.length;
    document.getElementById('operationsCount').textContent = notes.filter(n => n.department === 'Operations').length;
    document.getElementById('safetyCount').textContent = notes.filter(n => n.department === 'Safety').length;
    document.getElementById('accountingCount').textContent = notes.filter(n => n.department === 'Accounting').length;
}

function populateFilterCheckboxes() {
    // Populate location checkboxes
    const locationContainer = document.getElementById('locationCheckboxes');
    CONFIG.locations.forEach(loc => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" value="${loc}" checked class="location-checkbox">
            <span class="checkmark"></span>
            Site ${loc}
        `;
        locationContainer.appendChild(label);
    });
    
    // Populate note type checkboxes
    const noteTypeContainer = document.getElementById('noteTypeCheckboxes');
    ALL_NOTE_TYPES.forEach(type => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" value="${type}" checked class="notetype-checkbox">
            <span class="checkmark"></span>
            ${type}
        `;
        noteTypeContainer.appendChild(label);
    });
    
    // Setup "Select All" functionality for locations
    document.getElementById('selectAllLocations').addEventListener('change', (e) => {
        document.querySelectorAll('.location-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
    
    // Setup "Select All" functionality for note types
    document.getElementById('selectAllNoteTypes').addEventListener('change', (e) => {
        document.querySelectorAll('.notetype-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
}

function getSelectedFilters() {
    const locations = Array.from(document.querySelectorAll('.location-checkbox:checked'))
        .map(cb => parseInt(cb.value));
    
    const departments = Array.from(document.querySelectorAll('.dept-checkbox:checked'))
        .map(cb => cb.value);
    
    const noteTypes = Array.from(document.querySelectorAll('.notetype-checkbox:checked'))
        .map(cb => cb.value);
    
    const startDate = document.getElementById('startDate').value || null;
    const endDate = document.getElementById('endDate').value || null;
    
    return { locations, departments, noteTypes, startDate, endDate };
}

async function generateReport() {
    const filters = getSelectedFilters();
    const notes = await getFilteredNotes(filters);
    
    reportNotes = notes;
    reportSelectedNotes.clear();
    reportSelectMode = false;
    
    // Show results section
    const resultsSection = document.getElementById('reportResults');
    resultsSection.classList.remove('hidden');
    resultsSection.classList.remove('select-mode');
    
    // Update stats
    document.getElementById('resultsCount').textContent = `${notes.length} records`;
    document.getElementById('reportOpsCount').textContent = `${notes.filter(n => n.department === 'Operations').length} Ops`;
    document.getElementById('reportSafetyCount').textContent = `${notes.filter(n => n.department === 'Safety').length} Safety`;
    document.getElementById('reportAcctCount').textContent = `${notes.filter(n => n.department === 'Accounting').length} Acct`;
    
    // Reset select button
    document.getElementById('toggleSelectMode').classList.remove('active');
    document.getElementById('toggleSelectMode').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Select
    `;
    
    // Hide selection bar
    document.getElementById('reportSelectionBar').classList.add('hidden');
    
    // Render notes as cards
    renderReportNotes(notes);
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function renderReportNotes(notes) {
    const container = document.getElementById('reportRecordsContainer');
    
    if (notes.length === 0) {
        container.innerHTML = '<p class="no-records">No records match the selected criteria</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => {
        const deptClass = `dept-${note.department.toLowerCase()}`;
        const displayType = note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}` 
            : note.note_type;
        const isSelected = reportSelectedNotes.has(note.id);
        
        const imageBadge = note.has_image ? `
            <a href="${getPhotoUrl(note.id)}" target="_blank" class="record-image-badge" onclick="event.stopPropagation()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                View Photo
            </a>
        ` : '';
        
        return `
            <div class="record-card ${isSelected ? 'selected' : ''}" data-id="${note.id}">
                <label class="record-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleReportNoteSelection(${note.id}, this.checked)">
                    <span class="record-check"></span>
                </label>
                <div class="record-header">
                    <span class="record-type">${displayType}</span>
                    <span class="record-timestamp">${formatDate(note.created_at)}</span>
                </div>
                <div class="record-meta">
                    <span class="record-badge">Site ${note.location}</span>
                    <span class="record-badge ${deptClass}">${note.department}</span>
                    ${imageBadge}
                </div>
                ${note.additional_notes ? `<p class="record-notes">${note.additional_notes}</p>` : ''}
            </div>
        `;
    }).join('');
}

function renderLocationSummary(notes) {
    const container = document.getElementById('locationBars');
    const locationCounts = {};
    
    notes.forEach(note => {
        locationCounts[note.location] = (locationCounts[note.location] || 0) + 1;
    });
    
    const maxCount = Math.max(...Object.values(locationCounts), 1);
    
    // Sort by count descending, show top 10
    const sortedLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedLocations.length === 0) {
        container.innerHTML = '<p class="no-data">No site data</p>';
        return;
    }
    
    container.innerHTML = sortedLocations.map(([loc, count]) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="summary-bar">
                <span class="bar-label">Site ${loc}</span>
                <div class="bar-container">
                    <div class="bar-fill location" style="width: ${percentage}%">
                        <span>${count}</span>
                    </div>
                </div>
                <span class="bar-value">${count}</span>
            </div>
        `;
    }).join('');
}

function renderDepartmentSummary(notes) {
    const container = document.getElementById('departmentBars');
    const deptCounts = {
        Operations: 0,
        Safety: 0,
        Accounting: 0
    };
    
    notes.forEach(note => {
        if (deptCounts.hasOwnProperty(note.department)) {
            deptCounts[note.department]++;
        }
    });
    
    const maxCount = Math.max(...Object.values(deptCounts), 1);
    
    container.innerHTML = Object.entries(deptCounts).map(([dept, count]) => {
        const percentage = (count / maxCount) * 100;
        const deptClass = dept.toLowerCase();
        return `
            <div class="summary-bar">
                <span class="bar-label">${dept}</span>
                <div class="bar-container">
                    <div class="bar-fill ${deptClass}" style="width: ${percentage}%">
                        <span>${count}</span>
                    </div>
                </div>
                <span class="bar-value">${count}</span>
            </div>
        `;
    }).join('');
}

function renderNoteTypeSummary(notes) {
    const container = document.getElementById('noteTypeBars');
    const typeCounts = {};
    
    notes.forEach(note => {
        const type = note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description.substring(0, 20)}...`
            : note.note_type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const maxCount = Math.max(...Object.values(typeCounts), 1);
    
    // Sort by count descending, show top 10
    const sortedTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sortedTypes.length === 0) {
        container.innerHTML = '<p class="no-data">No note type data</p>';
        return;
    }
    
    container.innerHTML = sortedTypes.map(([type, count]) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="summary-bar">
                <span class="bar-label">${type}</span>
                <div class="bar-container">
                    <div class="bar-fill note-type" style="width: ${percentage}%">
                        <span>${count}</span>
                    </div>
                </div>
                <span class="bar-value">${count}</span>
            </div>
        `;
    }).join('');
}

function renderReportTable(notes) {
    const tbody = document.getElementById('reportTableBody');
    
    if (notes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-records">No records match the selected criteria</td></tr>';
        return;
    }
    
    tbody.innerHTML = notes.map(note => {
        const deptClass = note.department.toLowerCase();
        const displayType = note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}`
            : note.note_type;
        const details = note.additional_notes || '-';
        
        return `
            <tr>
                <td class="cell-timestamp">${formatDate(note.created_at)}</td>
                <td class="cell-location">Site ${note.location}</td>
                <td><span class="cell-department ${deptClass}">${note.department}</span></td>
                <td>${displayType}</td>
                <td class="cell-details" title="${details}">${details}</td>
            </tr>
        `;
    }).join('');
}

function getPhotoUrl(noteId) {
    return `${window.location.origin}/.netlify/functions/notes-view-image?id=${noteId}`;
}

async function exportReportToExcel() {
    const filters = getSelectedFilters();
    const notes = await getFilteredNotes(filters);
    
    if (notes.length === 0) {
        showToast('No records to export', true);
        return;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Mighty Note - Report Summary'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Total Records:', notes.length],
        ['Operations:', notes.filter(n => n.department === 'Operations').length],
        ['Safety:', notes.filter(n => n.department === 'Safety').length],
        ['Accounting:', notes.filter(n => n.department === 'Accounting').length],
        [''],
        ['Filters Applied:'],
        ['Sites:', filters.locations.length === CONFIG.locations.length ? 'All' : filters.locations.join(', ')],
        ['Departments:', filters.departments.join(', ') || 'All'],
        ['Date Range:', filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : 'All dates']
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // All records sheet with photo links
    const allData = notes.map(note => ({
        'Date/Time': formatDate(note.created_at),
        'Site': `Site ${note.location}`,
        'Department': note.department,
        'Note Type': note.note_type,
        'Other Description': note.other_description || '',
        'Additional Notes': note.additional_notes || '',
        'Photo': note.has_image ? getPhotoUrl(note.id) : ''
    }));
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    
    // Add hyperlinks for photos
    notes.forEach((note, index) => {
        if (note.has_image) {
            const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: 6 }); // Photo column (G)
            if (allWs[cellRef]) {
                allWs[cellRef].l = { Target: getPhotoUrl(note.id), Tooltip: 'View Photo' };
            }
        }
    });
    
    allWs['!cols'] = [
        { wch: 22 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 30 },
        { wch: 50 },
        { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, allWs, 'All Records');
    
    // Department-specific sheets
    CONFIG.departments.forEach(dept => {
        const deptNotes = notes.filter(n => n.department === dept);
        
        if (deptNotes.length > 0) {
            const data = deptNotes.map(note => ({
                'Date/Time': formatDate(note.created_at),
                'Site': `Site ${note.location}`,
                'Note Type': note.note_type,
                'Other Description': note.other_description || '',
                'Additional Notes': note.additional_notes || '',
                'Photo': note.has_image ? getPhotoUrl(note.id) : ''
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            
            // Add hyperlinks for photos
            deptNotes.forEach((note, index) => {
                if (note.has_image) {
                    const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: 5 }); // Photo column (F)
                    if (ws[cellRef]) {
                        ws[cellRef].l = { Target: getPhotoUrl(note.id), Tooltip: 'View Photo' };
                    }
                }
            });
            
            ws['!cols'] = [
                { wch: 22 },
                { wch: 12 },
                { wch: 30 },
                { wch: 30 },
                { wch: 50 },
                { wch: 40 }
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, dept);
        }
    });
    
    // Site-specific sheets (for sites with data)
    const sitesWithData = [...new Set(notes.map(n => n.location))].sort((a, b) => a - b);
    
    sitesWithData.forEach(loc => {
        const locNotes = notes.filter(n => n.location === loc);
        
        const data = locNotes.map(note => ({
            'Date/Time': formatDate(note.created_at),
            'Department': note.department,
            'Note Type': note.note_type,
            'Other Description': note.other_description || '',
            'Additional Notes': note.additional_notes || '',
            'Photo': note.has_image ? getPhotoUrl(note.id) : ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Add hyperlinks for photos
        locNotes.forEach((note, index) => {
            if (note.has_image) {
                const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: 5 }); // Photo column (F)
                if (ws[cellRef]) {
                    ws[cellRef].l = { Target: getPhotoUrl(note.id), Tooltip: 'View Photo' };
                }
            }
        });
        
        ws['!cols'] = [
            { wch: 22 },
            { wch: 12 },
            { wch: 30 },
            { wch: 30 },
            { wch: 50 },
            { wch: 40 }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, `Site ${loc}`);
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Mighty_Note_Report_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${notes.length} records to Excel`);
}

async function exportReportToPDF() {
    const filters = getSelectedFilters();
    const notes = await getFilteredNotes(filters);
    
    if (notes.length === 0) {
        showToast('No records to export', true);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text('Mighty Note - Violation Report', 14, 20);
    
    // Summary info
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    
    // Stats
    const operationsCount = notes.filter(n => n.department === 'Operations').length;
    const safetyCount = notes.filter(n => n.department === 'Safety').length;
    const accountingCount = notes.filter(n => n.department === 'Accounting').length;
    
    doc.text(`Total: ${notes.length}  |  Operations: ${operationsCount}  |  Safety: ${safetyCount}  |  Accounting: ${accountingCount}`, 14, 36);
    
    // Filters applied
    const sitesText = filters.locations.length === CONFIG.locations.length ? 'All Sites' : `Sites: ${filters.locations.slice(0, 10).join(', ')}${filters.locations.length > 10 ? '...' : ''}`;
    const dateText = filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : 'All dates';
    doc.text(`${sitesText}  |  Date Range: ${dateText}`, 14, 42);
    
    // Table data with photo column
    const tableData = notes.map(note => [
        formatDate(note.created_at),
        `Site ${note.location}`,
        note.department,
        note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description.substring(0, 30)}${note.other_description.length > 30 ? '...' : ''}` 
            : note.note_type,
        (note.additional_notes || '-').substring(0, 40) + ((note.additional_notes || '').length > 40 ? '...' : ''),
        note.has_image ? 'View Photo' : '-'
    ]);
    
    // Store row positions for adding links later
    const photoLinks = [];
    
    // Create table
    doc.autoTable({
        startY: 50,
        head: [['Date/Time', 'Site', 'Department', 'Note Type', 'Details', 'Photo']],
        body: tableData,
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [10, 10, 10],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
        columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 22 },
            2: { cellWidth: 25 },
            3: { cellWidth: 45 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 22, halign: 'center' },
        },
        didDrawCell: (data) => {
            // Track photo cells for adding links
            if (data.section === 'body' && data.column.index === 5) {
                const note = notes[data.row.index];
                if (note && note.has_image) {
                    photoLinks.push({
                        x: data.cell.x,
                        y: data.cell.y,
                        width: data.cell.width,
                        height: data.cell.height,
                        url: getPhotoUrl(note.id)
                    });
                }
            }
        },
        didParseCell: (data) => {
            // Style photo links as blue
            if (data.section === 'body' && data.column.index === 5) {
                const note = notes[data.row.index];
                if (note && note.has_image) {
                    data.cell.styles.textColor = [10, 132, 255];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: function(data) {
            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Page ${doc.internal.getNumberOfPages()}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }
    });
    
    // Add clickable links for photos
    photoLinks.forEach(link => {
        doc.link(link.x, link.y, link.width, link.height, { url: link.url });
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Mighty_Note_Report_${timestamp}.pdf`;
    
    // Download
    doc.save(filename);
    showToast(`Exported ${notes.length} records to PDF`);
}

async function handleReportExport(format) {
    switch (format) {
        case 'pdf':
            await exportReportToPDF();
            break;
        case 'excel':
            await exportReportToExcel();
            break;
        case 'both':
            await exportReportToExcel();
            await exportReportToPDF();
            break;
    }
    
    closeExportMenu();
}

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    menu.classList.toggle('hidden');
}

function closeExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.add('hidden');
}

// ===== Quick Report Functions =====
function getDateRange(period) {
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
        case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
        default:
            return null;
    }
    
    // Format as YYYY-MM-DD
    const formatDateStr = (d) => d.toISOString().split('T')[0];
    
    return {
        start: formatDateStr(startDate),
        end: formatDateStr(endDate)
    };
}

function applyQuickReport(period) {
    const range = getDateRange(period);
    if (!range) return;
    
    // Set the date inputs
    document.getElementById('startDate').value = range.start;
    document.getElementById('endDate').value = range.end;
    
    // Close any open dropdowns
    closeAllDropdowns();
    
    // Generate the report
    generateReport();
    
    // Show toast with period name
    const periodNames = {
        'current-month': 'Current Month',
        'last-month': 'Last Month',
        'current-year': 'Current Year',
        'last-year': 'Last Year'
    };
    showToast(`Showing ${periodNames[period]} report`);
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const isHidden = dropdown.classList.contains('hidden');
    
    // Close all dropdowns first
    closeAllDropdowns();
    
    // Toggle the clicked dropdown
    if (isHidden) {
        dropdown.classList.remove('hidden');
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
}

// ===== Event Handlers =====
function setupEventListeners() {
    // Generate report button
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    
    // Export report button - toggle dropdown
    document.getElementById('exportReportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExportMenu();
    });
    
    // Export menu options
    document.querySelectorAll('#exportMenu .export-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = e.currentTarget.dataset.format;
            handleReportExport(format);
        });
    });
    
    // Close export menu when clicking outside
    document.addEventListener('click', () => {
        closeExportMenu();
    });
    
    // Monthly report dropdown
    document.getElementById('monthlyReportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown('monthlyDropdown');
    });
    
    // Yearly report dropdown
    document.getElementById('yearlyReportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown('yearlyDropdown');
    });
    
    // Handle dropdown item clicks
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const period = e.target.dataset.period;
            applyQuickReport(period);
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        closeAllDropdowns();
    });
    
    // Update "Select All" checkbox states when individual checkboxes change
    document.getElementById('locationCheckboxes').addEventListener('change', (e) => {
        if (e.target.classList.contains('location-checkbox')) {
            const allChecked = document.querySelectorAll('.location-checkbox:not(:checked)').length === 0;
            document.getElementById('selectAllLocations').checked = allChecked;
        }
    });
    
    document.getElementById('noteTypeCheckboxes').addEventListener('change', (e) => {
        if (e.target.classList.contains('notetype-checkbox')) {
            const allChecked = document.querySelectorAll('.notetype-checkbox:not(:checked)').length === 0;
            document.getElementById('selectAllNoteTypes').checked = allChecked;
        }
    });
}

// ===== PWA Service Worker Update Handling =====
function initServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('Dashboard updated to version:', event.data.version);
            }
        });
        
        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
        
        // Check for waiting service worker
        navigator.serviceWorker.ready.then(registration => {
            if (registration.waiting) {
                showUpdatePrompt();
            }
            
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdatePrompt();
                    }
                });
            });
        });
    }
}

function showUpdatePrompt() {
    if (document.getElementById('updateBanner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.innerHTML = `
        <span>A new version is available</span>
        <button onclick="applyUpdate()">Update Now</button>
    `;
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999;
        background: linear-gradient(135deg, #0a84ff, #0077ed);
        color: white;
        padding: 12px 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    const button = banner.querySelector('button');
    button.style.cssText = `
        background: white;
        color: #0a84ff;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
    `;
    
    document.body.prepend(banner);
}

function applyUpdate() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
}

// ===== Initialize Dashboard =====
async function init() {
    await initDatabase();
    await updateStats();
    populateFilterCheckboxes();
    setupEventListeners();
    setupReportListeners();
    initServiceWorkerUpdates();
}

// ===== Report Selection Event Listeners =====
function setupReportListeners() {
    // Close menus on outside click
    document.addEventListener('click', () => {
        closeReportExportSelectedMenu();
    });
    
    // Report selection handlers
    const toggleSelectBtn = document.getElementById('toggleSelectMode');
    const reportSelectAllCheckbox = document.getElementById('reportSelectAllCheckbox');
    const reportCancelSelectBtn = document.getElementById('reportCancelSelectBtn');
    const reportDeleteSelectedBtn = document.getElementById('reportDeleteSelectedBtn');
    const reportExportSelectedBtn = document.getElementById('reportExportSelectedBtn');
    
    if (toggleSelectBtn) {
        toggleSelectBtn.addEventListener('click', toggleReportSelectMode);
    }
    
    if (reportSelectAllCheckbox) {
        reportSelectAllCheckbox.addEventListener('change', selectAllReportNotes);
    }
    
    if (reportCancelSelectBtn) {
        reportCancelSelectBtn.addEventListener('click', toggleReportSelectMode);
    }
    
    if (reportDeleteSelectedBtn) {
        reportDeleteSelectedBtn.addEventListener('click', deleteReportSelectedNotes);
    }
    
    if (reportExportSelectedBtn) {
        reportExportSelectedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReportExportSelectedMenu();
        });
    }
    
    // Report export selected menu options
    document.querySelectorAll('#reportExportSelectedMenu .export-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = e.currentTarget.dataset.format;
            exportReportSelectedNotes(format);
        });
    });
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', init);
