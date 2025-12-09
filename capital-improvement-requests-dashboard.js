// Capital Improvement Requests Dashboard JavaScript

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
let allRequests = [];
let filteredRequests = [];
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
        const response = await fetch('/.netlify/functions/capital-requests-get');
        if (!response.ok) throw new Error('Failed to fetch requests');
        allRequests = await response.json();
        updateStats(allRequests);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStats(requests) {
    document.getElementById('totalRequests').textContent = requests.length;
    document.getElementById('pendingCount').textContent = requests.filter(r => r.recommendation === 'Needs further review' || !r.recommendation).length;
    document.getElementById('approvedCount').textContent = requests.filter(r => r.recommendation === 'Approve').length;
    document.getElementById('criticalCount').textContent = requests.filter(r => r.importance_ranking == 5).length;
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
    
    filteredRequests = allRequests.filter(request => {
        if (selectedLocations.length > 0 && !selectedLocations.includes(request.location)) return false;
        if (startDate || endDate) {
            const requestDate = new Date(request.submitted_at);
            if (startDate && requestDate < new Date(startDate)) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (requestDate > endDateTime) return false;
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
    statsContainer.innerHTML = `<span class="report-stat">${filteredRequests.length} Total</span>`;
}

function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;
    if (sortBy === 'newest') filteredRequests.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    else if (sortBy === 'oldest') filteredRequests.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    else if (sortBy === 'location') filteredRequests.sort((a, b) => a.location.localeCompare(b.location));
    else if (sortBy === 'importance') filteredRequests.sort((a, b) => (b.importance_ranking || 0) - (a.importance_ranking || 0));
    renderResults();
}

function renderResults() {
    const container = document.getElementById('resultsContainer');
    if (filteredRequests.length === 0) {
        container.innerHTML = '<div class="no-records">No requests match your filters</div>';
        return;
    }
    
    container.innerHTML = filteredRequests.map(request => {
        const isSelected = selectedIds.has(request.id);
        const importance = request.importance_ranking || 0;
        return `
            <div class="review-card ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${request.id}">
                <label class="review-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelection(${request.id})">
                    <span class="review-check"></span>
                </label>
                <div class="review-header">
                    <span class="review-location">${request.location}</span>
                    <span class="review-timestamp">${formatDate(request.submitted_at)}</span>
                </div>
                <div class="review-meta">
                    <span class="review-badge">${request.equipment_area || 'N/A'}</span>
                    <span class="review-badge">${request.cost_range || 'N/A'}</span>
                    ${importance == 5 ? '<span class="review-badge" style="color: var(--accent-red);">Critical</span>' : ''}
                </div>
                <div class="review-submitter">Submitted by: ${request.submitted_by || 'Unknown'}</div>
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
    if (checkbox.checked) filteredRequests.forEach(r => selectedIds.add(r.id));
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
    document.getElementById('selectAllCheckbox').checked = count === filteredRequests.length && count > 0;
}

async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} request(s)?`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/capital-requests-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (!response.ok) throw new Error('Failed to delete');
        showToast(`Deleted ${selectedIds.size} request(s)`);
        selectedIds.clear();
        setTimeout(async () => {
            await loadStats();
            generateReport();
        }, 500);
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error deleting requests', 'error');
    }
}

function exportSelectedToPDF() {
    const selected = filteredRequests.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
        showToast('No requests selected', 'error');
        return;
    }
    generatePDF(selected);
}

function generatePDF(requests) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Capital Improvement Requests Report', 14, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 28);
    doc.text(`Total Requests: ${requests.length}`, 14, 34);
    
    let yPos = 45;
    
    requests.forEach((request, index) => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Request header
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Request ${index + 1}: ${request.location}`, 14, yPos);
        yPos += 6;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${formatDate(request.submitted_at)} | Submitted by: ${request.submitted_by || 'Unknown'}`, 14, yPos);
        yPos += 8;
        
        // Section 1 - Request Details
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 1 — Request Details', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (request.request_types && Array.isArray(request.request_types) && request.request_types.length > 0) {
            doc.text(`Type of Request: ${request.request_types.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (request.equipment_area) doc.text(`Equipment/Area: ${request.equipment_area}`, 14, yPos);
        yPos += 5;
        if (request.description) {
            const splitDesc = doc.splitTextToSize(`Description: ${request.description}`, 180);
            doc.text(splitDesc, 14, yPos);
            yPos += splitDesc.length * 4;
        }
        yPos += 3;
        
        // Section 2 - Impact Assessment
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 2 — Impact Assessment', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (request.operational_impact) doc.text(`Operational Impact: ${request.operational_impact}`, 14, yPos);
        yPos += 5;
        if (request.customer_impact) doc.text(`Customer Experience Impact: ${request.customer_impact}`, 14, yPos);
        yPos += 5;
        if (request.safety_impact) doc.text(`Safety Impact: ${request.safety_impact}`, 14, yPos);
        yPos += 5;
        if (request.revenue_impact) doc.text(`Revenue/Throughput Impact: ${request.revenue_impact}`, 14, yPos);
        yPos += 5;
        if (request.importance_ranking) doc.text(`Importance Ranking: ${request.importance_ranking}/5 (1 = Not urgent, 5 = Critical)`, 14, yPos);
        yPos += 3;
        
        // Section 3 - Financial Scope
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 3 — Financial Scope', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (request.cost_range) doc.text(`Estimated Cost Range: ${request.cost_range}`, 14, yPos);
        yPos += 5;
        if (request.vendor_supplier) doc.text(`Vendor/Supplier: ${request.vendor_supplier}`, 14, yPos);
        yPos += 5;
        if (request.operational_requirement) doc.text(`Can Site Operate Without This: ${request.operational_requirement}`, 14, yPos);
        yPos += 3;
        
        // Section 4 - Approvals & Follow-Up
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('SECTION 4 — Approvals & Follow-Up', 14, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (request.recommendation) doc.text(`Recommendation: ${request.recommendation}`, 14, yPos);
        yPos += 5;
        if (request.follow_up_actions && Array.isArray(request.follow_up_actions) && request.follow_up_actions.length > 0) {
            doc.text(`Follow-Up Actions: ${request.follow_up_actions.join(', ')}`, 14, yPos);
            yPos += 5;
        }
        if (request.justification) {
            const splitText = doc.splitTextToSize(`Justification: ${request.justification}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        if (request.follow_up_deadline) {
            const deadline = new Date(request.follow_up_deadline).toLocaleDateString('en-US', {
                timeZone: 'America/Chicago',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            doc.text(`Follow-Up Deadline: ${deadline}`, 14, yPos);
            yPos += 5;
        }
        
        // Separator
        yPos += 10;
        if (index < requests.length - 1) {
            doc.setDrawColor(200);
            doc.line(14, yPos - 5, 196, yPos - 5);
        }
    });
    
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Capital_Requests_${dateStr}.pdf`);
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
            generatePDF(filteredRequests);
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

