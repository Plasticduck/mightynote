// Site Evaluations Dashboard JavaScript

// Check authentication
function checkAuth() {
    const userStr = localStorage.getItem('mightyops_user');
    if (!userStr) {
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(userStr);
}

const user = checkAuth();

// Site locations
const locations = Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`);

// Question definitions for PDF
const questions = [
    { id: 'q1', text: 'Was the General Manager present during your visit?' },
    { id: 'q2', text: 'How would you rate overall site leadership at the time of the visit?' },
    { id: 'q3', text: 'Staffing levels observed:' },
    { id: 'q4', text: 'Employee engagement during the visit:' },
    { id: 'q5', text: 'Was the site following the proper SOP flow?' },
    { id: 'q6', text: 'Cleanliness inside the site (office / lobby / waiting area):' },
    { id: 'q7', text: 'Cleanliness outside (lot / vacuums / entrance / signage):' },
    { id: 'q8', text: 'Equipment status at the time of inspection:' },
    { id: 'q9', text: 'Customer experience during your visit:' },
    { id: 'q10', text: 'Did you observe any safety concerns?' },
    { id: 'q11', text: 'Accuracy of POS operations you observed:' },
    { id: 'q12', text: 'Uniform compliance:' },
    { id: 'q13', text: 'Professionalism of staff:' },
    { id: 'q14', text: 'Was the site operating according to the posted hours?' },
    { id: 'q15', text: 'Fleet and vendor processes observed:' },
    { id: 'q16', text: 'Condition of chemical rooms / inventory areas:' },
    { id: 'q17', text: 'Did the GM provide an update on current initiatives?' },
    { id: 'q18', text: 'Overall assessment of site performance:' },
    { id: 'q19', text: 'Immediate follow-up required?' }
];

// State
let allReviews = [];
let filteredReviews = [];
let selectedIds = new Set();
let selectMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
    populateLocationCheckboxes();
    setupEventListeners();
    loadStats().then(() => {
        // Automatically generate report on page load
        generateReport();
    });
});

// Initialize date inputs for mobile
function initializeDateInputs() {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    
    if (startInput) {
        startInput.addEventListener('focus', function() {
            this.type = 'date';
        });
        startInput.addEventListener('blur', function() {
            if (!this.value) {
                this.type = 'text';
            }
        });
    }
    
    if (endInput) {
        endInput.addEventListener('focus', function() {
            this.type = 'date';
        });
        endInput.addEventListener('blur', function() {
            if (!this.value) {
                this.type = 'text';
            }
        });
    }
}

// Populate location checkboxes
function populateLocationCheckboxes() {
    const container = document.getElementById('locationCheckboxes');
    locations.forEach(loc => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" value="${loc}" checked class="location-checkbox">
            <span class="checkmark"></span>
            ${loc}
        `;
        container.appendChild(label);
    });
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch('/.netlify/functions/evaluations-get');
        if (!response.ok) throw new Error('Failed to fetch evaluations');
        
        allReviews = await response.json();
        updateStats(allReviews);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Update stats display
function updateStats(reviews) {
    document.getElementById('totalReviews').textContent = reviews.length;
    
    const excellent = reviews.filter(r => r.answers?.q18 === 'Excellent').length;
    const good = reviews.filter(r => r.answers?.q18 === 'Good').length;
    const followUp = reviews.filter(r => r.answers?.q19 && r.answers.q19.startsWith('Yes')).length;
    
    document.getElementById('excellentCount').textContent = excellent;
    document.getElementById('goodCount').textContent = good;
    document.getElementById('followUpCount').textContent = followUp;
}

// Date range helpers
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
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    
    startInput.type = 'date';
    endInput.type = 'date';
    startInput.value = range.start;
    endInput.value = range.end;
    
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

// Format date for display (CST 12-hour)
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

// Generate report
function generateReport() {
    // Get selected locations (exclude "Select All" checkbox)
    const selectedLocations = Array.from(document.querySelectorAll('#locationCheckboxes .location-checkbox:checked'))
        .map(cb => cb.value);
    
    // Get selected ratings (exclude "Select All" checkbox)
    const selectedRatings = Array.from(document.querySelectorAll('#ratingCheckboxes .rating-checkbox:checked'))
        .map(cb => cb.value);
    
    // Get selected follow-up statuses (exclude "Select All" checkbox)
    const selectedFollowups = Array.from(document.querySelectorAll('#followupCheckboxes .followup-checkbox:checked'))
        .map(cb => cb.value);
    
    // Get date range
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Filter reviews
    filteredReviews = allReviews.filter(review => {
        // Location filter
        if (selectedLocations.length > 0 && !selectedLocations.includes(review.location)) return false;
        
        // Rating filter
        const rating = review.answers?.q18;
        if (selectedRatings.length > 0 && rating && !selectedRatings.includes(rating)) return false;
        
        // Follow-up filter
        const followup = review.answers?.q19;
        if (selectedFollowups.length > 0 && followup && !selectedFollowups.includes(followup)) return false;
        
        // Date filter
        if (startDate || endDate) {
            const reviewDate = new Date(review.submitted_at);
            if (startDate && reviewDate < new Date(startDate)) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (reviewDate > endDateTime) return false;
            }
        }
        
        return true;
    });
    
    // Sort and display
    sortResults();
    
    // Show results section
    document.getElementById('reportResults').classList.remove('hidden');
    
    // Update report stats
    updateReportStats();
}

// Update report stats
function updateReportStats() {
    const statsContainer = document.getElementById('reportStats');
    const total = filteredReviews.length;
    const excellent = filteredReviews.filter(r => r.answers?.q18 === 'Excellent').length;
    const good = filteredReviews.filter(r => r.answers?.q18 === 'Good').length;
    const fair = filteredReviews.filter(r => r.answers?.q18 === 'Fair').length;
    const poor = filteredReviews.filter(r => r.answers?.q18 === 'Poor').length;
    
    statsContainer.innerHTML = `
        <span class="report-stat">${total} Total</span>
        <span class="report-stat stat-ops">${excellent} Excellent</span>
        <span class="report-stat stat-safety">${good} Good</span>
        <span class="report-stat stat-acct">${fair + poor} Fair/Poor</span>
    `;
}

// Sort results
function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;
    
    switch(sortBy) {
        case 'newest':
            filteredReviews.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            break;
        case 'oldest':
            filteredReviews.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
            break;
        case 'location':
            filteredReviews.sort((a, b) => a.location.localeCompare(b.location));
            break;
        case 'rating':
            const ratingOrder = { 'Excellent': 0, 'Good': 1, 'Fair': 2, 'Poor': 3 };
            filteredReviews.sort((a, b) => {
                const ratingA = ratingOrder[a.answers?.q18] ?? 4;
                const ratingB = ratingOrder[b.answers?.q18] ?? 4;
                return ratingA - ratingB;
            });
            break;
    }
    
    renderResults();
}

// Render results
function renderResults() {
    const container = document.getElementById('resultsContainer');
    
    if (filteredReviews.length === 0) {
        container.innerHTML = '<div class="no-records">No reviews match your filters</div>';
        return;
    }
    
    container.innerHTML = filteredReviews.map(review => {
        const rating = review.answers?.q18 || 'N/A';
        const ratingClass = rating.toLowerCase();
        const followup = review.answers?.q19 || 'No';
        const needsFollowup = followup.startsWith('Yes');
        const isSelected = selectedIds.has(review.id);
        
        return `
            <div class="review-card ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${review.id}">
                <label class="review-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelection(${review.id})">
                    <span class="review-check"></span>
                </label>
                <div class="review-header">
                    <span class="review-location">${review.location}</span>
                    <span class="review-timestamp">${formatDate(review.submitted_at)}</span>
                </div>
                <div class="review-meta">
                    <span class="review-badge ${ratingClass}">${rating}</span>
                    ${needsFollowup ? `<span class="review-badge followup">${followup}</span>` : ''}
                    ${review.has_image ? `<a href="/.netlify/functions/evaluations-view-image?id=${review.id}" target="_blank" class="btn-view-pdf" onclick="event.stopPropagation()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        View Photo
                    </a>` : ''}
                </div>
                <div class="review-submitter">Submitted by: ${review.submitted_by || 'Unknown'}</div>
                ${review.additional_notes ? `<div class="record-notes">${review.additional_notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Toggle select mode
function toggleSelectMode() {
    selectMode = !selectMode;
    const btn = document.getElementById('selectModeBtn');
    const bar = document.getElementById('selectionBar');
    const resultsSection = document.getElementById('reportResults');
    
    if (selectMode) {
        btn.classList.add('active');
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
        `;
        bar.classList.remove('hidden');
        resultsSection.classList.add('select-mode');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Select
        `;
        bar.classList.add('hidden');
        resultsSection.classList.remove('select-mode');
        clearSelection();
    }
    
    renderResults();
}

// Toggle selection
function toggleSelection(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    updateSelectionUI();
    renderResults();
}

// Toggle select all
function toggleSelectAll() {
    const checkbox = document.getElementById('selectAllCheckbox');
    if (checkbox.checked) {
        filteredReviews.forEach(r => selectedIds.add(r.id));
    } else {
        selectedIds.clear();
    }
    updateSelectionUI();
    renderResults();
}

// Clear selection
function clearSelection() {
    selectedIds.clear();
    document.getElementById('selectAllCheckbox').checked = false;
    updateSelectionUI();
    renderResults();
}

// Update selection UI
function updateSelectionUI() {
    const count = selectedIds.size;
    document.getElementById('selectionCount').textContent = `${count} selected`;
    document.getElementById('exportSelectedBtn').disabled = count === 0;
    document.getElementById('deleteSelectedBtn').disabled = count === 0;
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    selectAllCheckbox.checked = count === filteredReviews.length && count > 0;
}

// Delete selected
async function deleteSelected() {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} review(s)?`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/evaluations-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        
        if (!response.ok) throw new Error('Failed to delete');
        
        showToast(`Deleted ${selectedIds.size} review(s)`);
        selectedIds.clear();
        
        // Refresh data
        setTimeout(async () => {
            await loadStats();
            generateReport();
        }, 500);
        
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Error deleting reviews', 'error');
    }
}

// Export all to PDF
function exportAllToPDF() {
    if (filteredReviews.length === 0) {
        showToast('No reviews to export', 'error');
        return;
    }
    generatePDF(filteredReviews);
}

// Export selected to PDF
function exportSelectedToPDF() {
    const selected = filteredReviews.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
        showToast('No reviews selected', 'error');
        return;
    }
    generatePDF(selected);
}

// Generate PDF
function generatePDF(reviews) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Site Evaluation Report', 14, 20);
    
    // Generated date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 28);
    doc.text(`Total Reviews: ${reviews.length}`, 14, 34);
    
    let yPos = 45;
    
    reviews.forEach((review, index) => {
        // Check if we need a new page
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Review header
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Review ${index + 1}: ${review.location}`, 14, yPos);
        yPos += 6;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${formatDate(review.submitted_at)} | Submitted by: ${review.submitted_by || 'Unknown'}`, 14, yPos);
        yPos += 8;
        
        // Overall rating and follow-up status
        const rating = review.answers?.q18 || 'N/A';
        const followup = review.answers?.q19 || 'No';
        doc.text(`Overall Rating: ${rating} | Follow-up: ${followup}`, 14, yPos);
        yPos += 8;
        
        // Questions table
        const tableData = questions.map((q, i) => [
            `${i + 1}`,
            q.text,
            review.answers?.[q.id] || 'N/A'
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['#', 'Question', 'Answer']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [10, 132, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 100 },
                2: { cellWidth: 60 }
            },
            margin: { left: 14, right: 14 }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Additional notes
        if (review.additional_notes) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Additional Notes:', 14, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const splitNotes = doc.splitTextToSize(review.additional_notes, 180);
            doc.text(splitNotes, 14, yPos);
            yPos += splitNotes.length * 4 + 5;
        }
        
        // Follow-up instructions
        if (review.follow_up_instructions) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Follow-Up Instructions:', 14, yPos);
            yPos += 5;
            doc.setFont(undefined, 'normal');
            const splitInstr = doc.splitTextToSize(review.follow_up_instructions, 180);
            doc.text(splitInstr, 14, yPos);
            yPos += splitInstr.length * 4 + 5;
        }
        
        // Separator
        yPos += 10;
        if (index < reviews.length - 1) {
            doc.setDrawColor(200);
            doc.line(14, yPos - 5, 196, yPos - 5);
        }
    });
    
    // Save
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Site_Evaluation_Report_${dateStr}.pdf`);
    showToast('PDF exported successfully');
}

// Show toast
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

// Setup event listeners
function setupEventListeners() {
    // Generate report button
    const generateBtn = document.getElementById('generateReportBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateReport);
    }
    
    // Export report button - toggle dropdown
    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExportMenu();
        });
    }
    
    // Export menu options
    document.querySelectorAll('#exportMenu .export-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = e.currentTarget.dataset.format;
            if (format === 'pdf') {
                exportAllToPDF();
            }
            closeExportMenu();
        });
    });
    
    // Close export menu when clicking outside
    document.addEventListener('click', () => {
        closeExportMenu();
    });
    
    // Monthly report dropdown
    const monthlyBtn = document.getElementById('monthlyReportBtn');
    if (monthlyBtn) {
        monthlyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown('monthlyDropdown');
        });
    }
    
    // Yearly report dropdown
    const yearlyBtn = document.getElementById('yearlyReportBtn');
    if (yearlyBtn) {
        yearlyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown('yearlyDropdown');
        });
    }
    
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
    
    // "Select All" for locations
    const selectAllLocations = document.getElementById('selectAllLocations');
    if (selectAllLocations) {
        selectAllLocations.addEventListener('change', (e) => {
            document.querySelectorAll('.location-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
            generateReport();
        });
    }
    
    // Update "Select All" locations checkbox when individual checkboxes change
    const locationContainer = document.getElementById('locationCheckboxes');
    if (locationContainer) {
        locationContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('location-checkbox')) {
                const allChecked = document.querySelectorAll('.location-checkbox:not(:checked)').length === 0;
                if (selectAllLocations) selectAllLocations.checked = allChecked;
                generateReport();
            }
        });
    }
    
    // "Select All" for ratings
    const selectAllRatings = document.getElementById('selectAllRatings');
    if (selectAllRatings) {
        selectAllRatings.addEventListener('change', (e) => {
            document.querySelectorAll('.rating-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
            generateReport();
        });
    }
    
    // Update "Select All" ratings checkbox when individual checkboxes change
    const ratingContainer = document.getElementById('ratingCheckboxes');
    if (ratingContainer) {
        ratingContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('rating-checkbox')) {
                const allChecked = document.querySelectorAll('.rating-checkbox:not(:checked)').length === 0;
                if (selectAllRatings) selectAllRatings.checked = allChecked;
                generateReport();
            }
        });
    }
    
    // "Select All" for follow-ups
    const selectAllFollowups = document.getElementById('selectAllFollowups');
    if (selectAllFollowups) {
        selectAllFollowups.addEventListener('change', (e) => {
            document.querySelectorAll('.followup-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
            generateReport();
        });
    }
    
    // Update "Select All" follow-ups checkbox when individual checkboxes change
    const followupContainer = document.getElementById('followupCheckboxes');
    if (followupContainer) {
        followupContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('followup-checkbox')) {
                const allChecked = document.querySelectorAll('.followup-checkbox:not(:checked)').length === 0;
                if (selectAllFollowups) selectAllFollowups.checked = allChecked;
                generateReport();
            }
        });
    }
    
    // Auto-generate report when date inputs change
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    if (startDateInput) {
        startDateInput.addEventListener('change', generateReport);
        startDateInput.addEventListener('blur', () => {
            if (startDateInput.value || endDateInput?.value) {
                generateReport();
            }
        });
    }
    if (endDateInput) {
        endDateInput.addEventListener('change', generateReport);
        endDateInput.addEventListener('blur', () => {
            if (endDateInput.value || startDateInput?.value) {
                generateReport();
            }
        });
    }
}

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function closeExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.classList.add('hidden');
    }
}


