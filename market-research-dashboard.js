// Market Research Dashboard JavaScript

function checkAuth() {
    const userStr = localStorage.getItem('mightyops_user');
    if (!userStr) {
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(userStr);
}

const user = checkAuth();
let allResearch = [];
let filteredResearch = [];
let selectedIds = new Set();
let selectMode = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
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

async function loadStats() {
    try {
        const response = await fetch('/.netlify/functions/market-research-get');
        if (!response.ok) throw new Error('Failed to fetch research');
        allResearch = await response.json();
        updateStats(allResearch);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStats(research) {
    document.getElementById('totalResearch').textContent = research.length;
    const uniqueBrands = new Set(research.map(r => r.competitor_brand));
    document.getElementById('uniqueBrands').textContent = uniqueBrands.size;
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
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    filteredResearch = allResearch.filter(research => {
        if (startDate || endDate) {
            const researchDate = new Date(research.submitted_at);
            if (startDate && researchDate < new Date(startDate)) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (researchDate > endDateTime) return false;
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
    statsContainer.innerHTML = `<span class="report-stat">${filteredResearch.length} Total</span>`;
}

function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;
    if (sortBy === 'newest') filteredResearch.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    else if (sortBy === 'oldest') filteredResearch.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    else if (sortBy === 'brand') filteredResearch.sort((a, b) => (a.competitor_brand || '').localeCompare(b.competitor_brand || ''));
    renderResults();
}

function renderResults() {
    const container = document.getElementById('resultsContainer');
    if (filteredResearch.length === 0) {
        container.innerHTML = '<div class="no-records">No research entries match your filters</div>';
        return;
    }
    
    container.innerHTML = filteredResearch.map(research => {
        const isSelected = selectedIds.has(research.id);
        return `
            <div class="review-card ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${research.id}">
                <label class="review-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelection(${research.id})">
                    <span class="review-check"></span>
                </label>
                <div class="review-header">
                    <span class="review-location">${research.competitor_brand || 'Unknown Brand'}</span>
                    <span class="review-timestamp">${formatDate(research.submitted_at)}</span>
                </div>
                <div class="review-meta">
                    <span class="review-badge">${research.operation_type || 'N/A'}</span>
                    <span class="review-badge">${research.competitor_address || 'N/A'}</span>
                </div>
                <div class="review-submitter">Submitted by: ${research.submitted_by || 'Unknown'}</div>
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
    if (checkbox.checked) filteredResearch.forEach(r => selectedIds.add(r.id));
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
    document.getElementById('selectAllCheckbox').checked = count === filteredResearch.length && count > 0;
}

async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} research entry/entries?`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/market-research-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (!response.ok) throw new Error('Failed to delete');
        showToast(`Deleted ${selectedIds.size} entry/entries`);
        selectedIds.clear();
        setTimeout(async () => {
            await loadStats();
            generateReport();
        }, 500);
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error deleting entries', 'error');
    }
}

function exportSelectedToPDF() {
    const selected = filteredResearch.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
        showToast('No entries selected', 'error');
        return;
    }
    generatePDF(selected);
}

function generatePDF(research) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Market Research Report', 14, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 28);
    doc.text(`Total Entries: ${research.length}`, 14, 34);
    
    let yPos = 45;
    research.forEach((entry, index) => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Entry ${index + 1}: ${entry.competitor_brand || 'Unknown'}`, 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${formatDate(entry.submitted_at)} | Submitted by: ${entry.submitted_by || 'Unknown'}`, 14, yPos);
        yPos += 6;
        if (entry.competitor_standout) {
            const splitText = doc.splitTextToSize(`Standout: ${entry.competitor_standout}`, 180);
            doc.text(splitText, 14, yPos);
            yPos += splitText.length * 4;
        }
        yPos += 5;
    });
    
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Market_Research_${dateStr}.pdf`);
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
            generatePDF(filteredResearch);
            document.getElementById('exportMenu').classList.add('hidden');
        });
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

