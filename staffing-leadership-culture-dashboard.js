// Staffing, Leadership & Culture Dashboard JavaScript

function checkAuth() {
    const userStr = localStorage.getItem('mightyops_user');
    if (!userStr) {
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(userStr);
}

const user = checkAuth();
const locations = Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`);

let allNotes = [];
let filteredNotes = [];
let selectedIds = new Set();
let selectMode = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
    populateLocationCheckboxes();
    setupEventListeners();
    loadStats().then(() => generateReport());
});

function initializeDateInputs() {
    ['startDate', 'endDate'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('focus', () => input.type = 'date');
            input.addEventListener('blur', () => { if (!input.value) input.type = 'text'; });
        }
    });
}

function populateLocationCheckboxes() {
    const container = document.getElementById('locationCheckboxes');
    locations.forEach(loc => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `<input type="checkbox" value="${loc}" checked class="location-checkbox"><span class="checkmark"></span>${loc}`;
        container.appendChild(label);
    });
}

async function loadStats() {
    try {
        const response = await fetch('/.netlify/functions/staffing-culture-get');
        if (!response.ok) throw new Error('Failed to fetch notes');
        allNotes = await response.json();
        updateStats(allNotes);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStats(notes) {
    document.getElementById('totalNotes').textContent = notes.length;
    document.getElementById('followUpCount').textContent = notes.filter(n => n.leadership_follow_up && n.leadership_follow_up !== 'None').length;
    document.getElementById('positiveCultureCount').textContent = notes.filter(n => n.overall_culture && ['Strong and healthy', 'Mostly healthy'].includes(n.overall_culture)).length;
    document.getElementById('strongLeadershipCount').textContent = notes.filter(n => n.leadership_presence === 'Strong leadership present').length;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function generateReport() {
    const selectedLocations = Array.from(document.querySelectorAll('.location-checkbox:checked')).map(cb => cb.value);
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    filteredNotes = allNotes.filter(note => {
        if (selectedLocations.length > 0 && !selectedLocations.includes(note.location)) return false;
        if (startDate || endDate) {
            const noteDate = new Date(note.submitted_at);
            if (startDate && noteDate < new Date(startDate)) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (noteDate > endDateTime) return false;
            }
        }
        return true;
    });
    
    sortResults();
    document.getElementById('reportResults').classList.remove('hidden');
    updateReportStats();
}

function updateReportStats() {
    const statsContainer = document.getElementById('reportStats');
    statsContainer.innerHTML = `<span class="report-stat">${filteredNotes.length} Total</span>`;
}

function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;
    if (sortBy === 'newest') filteredNotes.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    else if (sortBy === 'oldest') filteredNotes.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    else if (sortBy === 'location') filteredNotes.sort((a, b) => a.location.localeCompare(b.location));
    renderResults();
}

function renderResults() {
    const container = document.getElementById('resultsContainer');
    if (filteredNotes.length === 0) {
        container.innerHTML = '<div class="no-records">No notes match your filters</div>';
        return;
    }
    
    container.innerHTML = filteredNotes.map(note => {
        const isSelected = selectedIds.has(note.id);
        const needsFollowup = note.leadership_follow_up && note.leadership_follow_up !== 'None';
        return `
            <div class="review-card ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${note.id}">
                <label class="review-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelection(${note.id})">
                    <span class="review-check"></span>
                </label>
                <div class="review-header">
                    <span class="review-location">${note.location}</span>
                    <span class="review-timestamp">${formatDate(note.submitted_at)}</span>
                </div>
                <div class="review-meta">
                    ${needsFollowup ? `<span class="review-badge followup">${note.leadership_follow_up}</span>` : ''}
                </div>
                <div class="review-submitter">Submitted by: ${note.submitted_by || 'Unknown'}</div>
            </div>
        `;
    }).join('');
}

function toggleSelectMode() {
    selectMode = !selectMode;
    const btn = document.getElementById('selectModeBtn');
    const bar = document.getElementById('selectionBar');
    const resultsSection = document.getElementById('reportResults');
    
    if (selectMode) {
        btn.classList.add('active');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel`;
        bar.classList.remove('hidden');
        resultsSection.classList.add('select-mode');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Select`;
        bar.classList.add('hidden');
        resultsSection.classList.remove('select-mode');
        clearSelection();
    }
    renderResults();
}

function toggleSelection(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateSelectionUI();
    renderResults();
}

function toggleSelectAll() {
    const checkbox = document.getElementById('selectAllCheckbox');
    if (checkbox.checked) filteredNotes.forEach(n => selectedIds.add(n.id));
    else selectedIds.clear();
    updateSelectionUI();
    renderResults();
}

function clearSelection() {
    selectedIds.clear();
    document.getElementById('selectAllCheckbox').checked = false;
    updateSelectionUI();
    renderResults();
}

function updateSelectionUI() {
    const count = selectedIds.size;
    document.getElementById('selectionCount').textContent = `${count} selected`;
    document.getElementById('exportSelectedBtn').disabled = count === 0;
    document.getElementById('deleteSelectedBtn').disabled = count === 0;
    document.getElementById('selectAllCheckbox').checked = count === filteredNotes.length && count > 0;
}

async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} note(s)?`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/staffing-culture-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (!response.ok) throw new Error('Failed to delete');
        showToast(`Deleted ${selectedIds.size} note(s)`);
        selectedIds.clear();
        setTimeout(async () => {
            await loadStats();
            generateReport();
        }, 500);
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error deleting notes', 'error');
    }
}

function exportSelectedToPDF() {
    const selected = filteredNotes.filter(n => selectedIds.has(n.id));
    if (selected.length === 0) {
        showToast('No notes selected', 'error');
        return;
    }
    generatePDF(selected);
}

function generatePDF(notes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Staffing, Leadership & Culture Notes Report', 14, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 28);
    doc.text(`Total Notes: ${notes.length}`, 14, 34);
    
    let yPos = 45;
    
    notes.forEach((note, index) => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Note header
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Note ${index + 1}: ${note.location}`, 14, yPos);
        yPos += 6;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${formatDate(note.submitted_at)} | Submitted by: ${note.submitted_by || 'Unknown'}`, 14, yPos);
        yPos += 8;
        
        // Section 1 - Staffing Assessment
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 1 — Staffing Assessment', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (note.staffing_levels) doc.text(`Staffing Levels: ${note.staffing_levels}`, 14, yPos);
        yPos += 5;
        if (note.skill_level) doc.text(`Skill Level: ${note.skill_level}/5`, 14, yPos);
        yPos += 5;
        if (note.staffing_concerns && Array.isArray(note.staffing_concerns) && note.staffing_concerns.length > 0) {
            doc.text(`Key Staffing Concerns: ${note.staffing_concerns.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (note.high_potential_employees) {
            const splitText = doc.splitTextToSize(`High-Potential Employees: ${note.high_potential_employees}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.employees_needing_coaching) {
            const splitText = doc.splitTextToSize(`Employees Needing Coaching: ${note.employees_needing_coaching}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.staffing_summary) {
            const splitText = doc.splitTextToSize(`Staffing Summary: ${note.staffing_summary}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        yPos += 3;
        
        // Section 2 - Leadership Evaluation
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 2 — Leadership Evaluation', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (note.leadership_presence) doc.text(`Leadership Presence: ${note.leadership_presence}`, 14, yPos);
        yPos += 5;
        if (note.leadership_behaviors && Array.isArray(note.leadership_behaviors) && note.leadership_behaviors.length > 0) {
            doc.text(`Leadership Behaviors: ${note.leadership_behaviors.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (note.gm_performance) doc.text(`GM Performance: ${note.gm_performance}/5`, 14, yPos);
        yPos += 5;
        if (note.gm_notes) {
            const splitText = doc.splitTextToSize(`GM/Leadership Notes: ${note.gm_notes}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.leadership_follow_up) doc.text(`Leadership Follow-Up Needed: ${note.leadership_follow_up}`, 14, yPos);
        yPos += 5;
        if (note.potential_leaders) {
            const splitText = doc.splitTextToSize(`Potential Future Leaders: ${note.potential_leaders}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        yPos += 3;
        
        // Section 3 - Culture & Morale
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 3 — Culture & Morale', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (note.team_morale) doc.text(`Team Morale: ${note.team_morale}`, 14, yPos);
        yPos += 5;
        if (note.culture_observed && Array.isArray(note.culture_observed) && note.culture_observed.length > 0) {
            doc.text(`Culture Observed: ${note.culture_observed.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (note.customer_interactions) doc.text(`Customer Interactions: ${note.customer_interactions}/5`, 14, yPos);
        yPos += 5;
        if (note.customer_interactions_notes) {
            const splitText = doc.splitTextToSize(`Customer Interactions Notes: ${note.customer_interactions_notes}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.recognition_moments) {
            const splitText = doc.splitTextToSize(`Recognition Moments: ${note.recognition_moments}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.culture_issues) {
            const splitText = doc.splitTextToSize(`Culture Issues/Risks: ${note.culture_issues}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.overall_culture) doc.text(`Overall Culture Assessment: ${note.overall_culture}`, 14, yPos);
        yPos += 3;
        
        // Section 4 - Summary & Action Items
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 4 — Summary & Action Items', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (note.key_takeaways) {
            const splitText = doc.splitTextToSize(`Key Takeaways: ${note.key_takeaways}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (note.follow_up_actions && Array.isArray(note.follow_up_actions) && note.follow_up_actions.length > 0) {
            doc.text(`Follow-Up Actions: ${note.follow_up_actions.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (note.follow_up_instructions) {
            const splitText = doc.splitTextToSize(`Follow-Up Instructions: ${note.follow_up_instructions}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        
        // Separator
        yPos += 10;
        if (index < notes.length - 1) {
            doc.setDrawColor(200);
            doc.line(14, yPos - 5, 196, yPos - 5);
        }
    });
    
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Staffing_Culture_Notes_${dateStr}.pdf`);
    showToast('PDF exported successfully');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

function setupEventListeners() {
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('exportReportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('exportMenu').classList.toggle('hidden');
    });
    document.querySelectorAll('#exportMenu .export-option').forEach(option => {
        option.addEventListener('click', () => {
            generatePDF(filteredNotes);
            document.getElementById('exportMenu').classList.add('hidden');
        });
    });
    
    const selectAllLocations = document.getElementById('selectAllLocations');
    if (selectAllLocations) {
        selectAllLocations.addEventListener('change', (e) => {
            document.querySelectorAll('.location-checkbox').forEach(cb => cb.checked = e.target.checked);
            generateReport();
        });
    }
    
    document.getElementById('locationCheckboxes').addEventListener('change', (e) => {
        if (e.target.classList.contains('location-checkbox')) {
            const allChecked = document.querySelectorAll('.location-checkbox:not(:checked)').length === 0;
            if (selectAllLocations) selectAllLocations.checked = allChecked;
            generateReport();
        }
    });
    
    ['startDate', 'endDate'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', generateReport);
            input.addEventListener('blur', () => {
                if (input.value || document.getElementById(id === 'startDate' ? 'endDate' : 'startDate')?.value) {
                    generateReport();
                }
            });
        }
    });
}

