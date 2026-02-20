// Monthly Site Review Dashboard JavaScript

function checkAuth() {
    const userStr = localStorage.getItem('mightyops_user');
    if (!userStr) {
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(userStr);
}

const user = checkAuth();

const locations = [...Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`), 'Spotless'];

// Monthly Site Review section definitions for PDF export (exact text from PDF)
const MONTHLY_REVIEW_SECTIONS = [
    { key: 'site_approach', title: 'Site Approach', items: ['Trash on lot and curbs', 'Signs are clean, visible, and not fading', 'XPT screens and area are clean', 'Building clean and yard maintained with no weeds', 'Employees clean and in proper attire', 'Employee present at XPT\'s when arrived', 'Dumpster pad clean of debris and gates shut'] },
    { key: 'tunnel', title: 'Tunnel', items: ['Cleanliness of walls', 'Windows cleaned outside and in (including sills)', 'Equipment working properly', 'Equipment cleaned properly', 'Chain tension', 'Tool room cleaned and organized', 'Floor and ceiling cleaned', 'Trash cleaned from power locks', 'All Cameras Wiped'] },
    { key: 'mighty_wash', title: 'Mighty Wash', commentsOnly: true, commentKey: 'mighty_wash_comments' },
    { key: 'procedures_management', title: 'Procedures/Management', items: ['Proper prepping procedures', 'Proper hand dry procedures', 'Proper QC procedures', 'Proper interior procedures', 'Finished product', 'Prep time under 45 seconds Time:', 'Correct monthly labor % Labor %:', 'Rewash % (goal is <2%)', 'Auto Damage Claims'] },
    { key: 'vacuum_area', title: 'Vacuum Area', items: ['Hoses hung and clean', 'Suction on vac and crevice tool', 'Vacs with low suction or missing (3 or more fails)', 'Trash cans clean and empty', 'Vacuum area swept and free of debris', 'Worn or broken vac/crevice tool or air guns (4 or more fails)', 'Vending machine and mat washer clean'] },
    { key: 'office_breakroom', title: 'Office and Breakroom', items: ['Office and breakroom windows clean', 'Restrooms clean and stocked', 'Office(s) swept, mopped, and trash empty', 'Countertops clean and organized', 'Lights in and out of building all working and free of bugs', 'Breakroom clean', 'Water machine stocked and working'] },
    { key: 'chemical_room', title: 'Chemical Room', items: ['Clean and organized', 'Chemicals organized and tops cleaned', 'Chemicals stocked', 'Salt in brine tank', 'R.O. system working and tanks full PPM:', 'Water drained from air compressors', 'All RTC and breaker box doors closed and clear', 'Marvel Air Tool oil filled'] }
];

// Legacy question definitions for old-format PDF export
const legacyQuestions = [
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

function isNewFormat(review) {
    const a = review.answers;
    return a && Array.isArray(a.site_approach);
}

function getReviewResult(review) {
    if (isNewFormat(review)) {
        let pass = 0, fail = 0;
        const sectionKeys = ['site_approach', 'tunnel', 'procedures_management', 'vacuum_area', 'office_breakroom', 'chemical_room'];
        sectionKeys.forEach(key => {
            const arr = review.answers[key];
            if (Array.isArray(arr)) arr.forEach(item => {
                if (item.pass_fail === 'Pass') pass++;
                else if (item.pass_fail === 'Fail') fail++;
            });
        });
        return { allPass: fail === 0 && pass > 0, hasFail: fail > 0, withPhoto: !!review.has_image };
    }
    const rating = review.answers?.q18;
    const followUp = review.answers?.q19;
    return {
        allPass: rating === 'Excellent',
        hasFail: rating === 'Fair' || rating === 'Poor' || (followUp && followUp.startsWith('Yes')),
        withPhoto: !!review.has_image
    };
}

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
    let allPass = 0, hasFail = 0, withPhoto = 0;
    reviews.forEach(r => {
        const res = getReviewResult(r);
        if (res.allPass) allPass++;
        if (res.hasFail) hasFail++;
        if (res.withPhoto) withPhoto++;
    });
    document.getElementById('excellentCount').textContent = allPass;
    document.getElementById('goodCount').textContent = hasFail;
    document.getElementById('followUpCount').textContent = withPhoto;
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
    const selectedLocations = Array.from(document.querySelectorAll('#locationCheckboxes .location-checkbox:checked'))
        .map(cb => cb.value);
    const selectedResults = Array.from(document.querySelectorAll('#resultCheckboxes .result-checkbox:checked'))
        .map(cb => cb.value);
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    filteredReviews = allReviews.filter(review => {
        if (selectedLocations.length > 0 && !selectedLocations.includes(review.location)) return false;

        const res = getReviewResult(review);
        if (selectedResults.length > 0) {
            const matchAllPass = selectedResults.includes('all_pass') && res.allPass;
            const matchHasFail = selectedResults.includes('has_fail') && res.hasFail;
            if (!matchAllPass && !matchHasFail) return false;
        }

        if (startDate || endDate) {
            const reviewDateStr = isNewFormat(review) ? review.answers?.review_date : null;
            const reviewDate = reviewDateStr ? new Date(reviewDateStr + 'T12:00:00') : new Date(review.submitted_at);
            if (startDate && reviewDate < new Date(startDate)) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (reviewDate > endDateTime) return false;
            }
        }
        return true;
    });

    sortResults();
    document.getElementById('reportResults').classList.remove('hidden');
    updateReportStats();
}

// Update report stats
function updateReportStats() {
    const statsContainer = document.getElementById('reportStats');
    const total = filteredReviews.length;
    let allPass = 0, hasFail = 0;
    filteredReviews.forEach(r => {
        const res = getReviewResult(r);
        if (res.allPass) allPass++;
        if (res.hasFail) hasFail++;
    });
    statsContainer.innerHTML = `
        <span class="report-stat">${total} Total</span>
        <span class="report-stat stat-ops">${allPass} All Pass</span>
        <span class="report-stat stat-safety">${hasFail} Has Fail</span>
    `;
}

// Sort results
function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;

    switch (sortBy) {
        case 'newest':
            filteredReviews.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            break;
        case 'oldest':
            filteredReviews.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
            break;
        case 'location':
            filteredReviews.sort((a, b) => a.location.localeCompare(b.location));
            break;
        case 'result':
            filteredReviews.sort((a, b) => {
                const ra = getReviewResult(a), rb = getReviewResult(b);
                if (ra.allPass && !rb.allPass) return -1;
                if (!ra.allPass && rb.allPass) return 1;
                return 0;
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
        const res = getReviewResult(review);
        const resultLabel = res.allPass ? 'All Pass' : (res.hasFail ? 'Has Fail' : '—');
        const resultClass = res.allPass ? 'excellent' : (res.hasFail ? 'poor' : '');
        const reviewDate = isNewFormat(review) && review.answers?.review_date
            ? new Date(review.answers.review_date + 'T12:00:00').toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit', year: 'numeric' })
            : formatDate(review.submitted_at);
        const isSelected = selectedIds.has(review.id);

        return `
            <div class="review-card ${selectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${review.id}">
                <label class="review-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelection(${review.id})">
                    <span class="review-check"></span>
                </label>
                <div class="review-header">
                    <span class="review-location">${review.location}</span>
                    <span class="review-timestamp">${reviewDate}</span>
                </div>
                <div class="review-meta">
                    <span class="review-badge ${resultClass}">${resultLabel}</span>
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

// Load MW logo as base64 for PDF (same folder as dashboard)
function loadLogoDataUrl() {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = 'MW Logo.png';
    });
}

// Generate PDF
function generatePDF(reviews) {
    loadLogoDataUrl().then((logoData) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let yPos = 20;
        const hasNew = reviews.some(r => isNewFormat(r));
        const hasLegacy = reviews.some(r => !isNewFormat(r));

        if (logoData) {
            try {
                doc.addImage(logoData, 'PNG', 14, 8, 28, 14);
                yPos = 26;
            } catch (e) { /* ignore */ }
        }

    reviews.forEach((review, index) => {
        const a = review.answers || {};

        if (isNewFormat(review)) {
            // Monthly Site Review format (matches the PDF layout)
            if (yPos > 30) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Monthly Site Review', 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const reviewDate = a.review_date
                ? new Date(a.review_date + 'T12:00:00').toLocaleDateString('en-US')
                : formatDate(review.submitted_at);
            doc.text(
                `Site: ${review.location}  |  Date: ${reviewDate}  |  Weather: ${a.weather || '—'}  |  Time Arrived: ${a.time_arrived || '—'}`,
                14,
                yPos
            );
            yPos += 8;

            MONTHLY_REVIEW_SECTIONS.forEach(sec => {
                if (yPos > 265) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text(sec.title, 14, yPos);
                yPos += 6;

                if (sec.commentsOnly) {
                    const text = (sec.commentKey && a[sec.commentKey]) ? a[sec.commentKey] : (a[sec.key] || '—');
                    doc.setFont(undefined, 'normal');
                    const lines = doc.splitTextToSize(text, 180);
                    doc.text(lines, 14, yPos);
                    yPos += lines.length * 5 + 4;
                    return;
                }

                const arr = a[sec.key];
                if (!Array.isArray(arr) || arr.length === 0) { yPos += 4; return; }

                const tableData = (sec.items || []).slice(0, arr.length).map((label, i) => {
                    const item = arr[i] || {};
                    let comments = item.comments || '';
                    if (sec.key === 'procedures_management' && i === 5 && a.procedures_prep_time) comments = (comments ? comments + ' ' : '') + 'Time: ' + a.procedures_prep_time;
                    if (sec.key === 'procedures_management' && i === 6 && a.procedures_labor_pct) comments = (comments ? comments + ' ' : '') + 'Labor %: ' + a.procedures_labor_pct;
                    if (sec.key === 'chemical_room' && i === 4 && a.chemical_ppm) comments = (comments ? comments + ' ' : '') + 'PPM: ' + a.chemical_ppm;
                    return [label, item.pass_fail || '—', comments || '—'];
                });
                doc.autoTable({
                    startY: yPos,
                    head: [['Item', 'Pass/Fail', 'Comments']],
                    body: tableData,
                    theme: 'striped',
                    headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
                    bodyStyles: { fontSize: 7 },
                    columnStyles: {
                        0: { cellWidth: 70 },
                        1: { cellWidth: 25 },
                        2: { cellWidth: 85 }
                    },
                    margin: { left: 14, right: 14 }
                });
                yPos = doc.lastAutoTable.finalY + 6;
            });

            if (yPos > 268) { doc.addPage(); yPos = 20; }
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(`Submitted by: ${review.submitted_by || '—'}`, 14, yPos);
            yPos += 8;
            if (review.additional_notes) {
                if (yPos > 265) { doc.addPage(); yPos = 20; }
                doc.setFont(undefined, 'bold');
                doc.text('Overall Notes/Comments:', 14, yPos);
                yPos += 5;
                doc.setFont(undefined, 'normal');
                const lines = doc.splitTextToSize(review.additional_notes, 180);
                doc.text(lines, 14, yPos);
                yPos += lines.length * 4 + 8;
            }
        } else {
            // Legacy evaluation format (older question set)
            if (yPos > 30) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Legacy Site Evaluation', 14, yPos);
            yPos += 6;

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Site: ${review.location} | Date: ${formatDate(review.submitted_at)} | Submitted by: ${review.submitted_by || 'Unknown'}`, 14, yPos);
            yPos += 8;

            const rating = review.answers?.q18 || 'N/A';
            const followup = review.answers?.q19 || 'No';
            doc.text(`Overall Rating: ${rating} | Follow-up: ${followup}`, 14, yPos);
            yPos += 8;

            const tableData = legacyQuestions.map((q, i) => [
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

            if (review.additional_notes) {
                if (yPos > 250) { doc.addPage(); yPos = 20; }
                doc.setFont(undefined, 'bold');
                doc.text('Additional Notes:', 14, yPos);
                yPos += 5;
                doc.setFont(undefined, 'normal');
                const legacyLines = doc.splitTextToSize(review.additional_notes, 180);
                doc.text(legacyLines, 14, yPos);
                yPos += legacyLines.length * 4 + 5;
            }
            if (review.follow_up_instructions) {
                if (yPos > 250) { doc.addPage(); yPos = 20; }
                doc.setFont(undefined, 'bold');
                doc.text('Follow-Up Instructions:', 14, yPos);
                yPos += 5;
                doc.setFont(undefined, 'normal');
                const fuLines = doc.splitTextToSize(review.follow_up_instructions, 180);
                doc.text(fuLines, 14, yPos);
                yPos += fuLines.length * 4 + 5;
            }
        }

        yPos += 10;
        if (index < reviews.length - 1) {
            doc.setDrawColor(200);
            doc.line(14, yPos - 5, 196, yPos - 5);
        }
    });

    const dateStr = new Date().toISOString().split('T')[0];
    if (hasNew && !hasLegacy) {
        doc.save(`Monthly_Site_Review_${dateStr}.pdf`);
    } else if (!hasNew && hasLegacy) {
        doc.save(`Site_Evaluation_Report_${dateStr}.pdf`);
    } else {
        doc.save(`Site_Reviews_${dateStr}.pdf`);
    }
    showToast('PDF exported successfully');
    });
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
    
    // "Select All" for result filter
    const selectAllResults = document.getElementById('selectAllResults');
    if (selectAllResults) {
        selectAllResults.addEventListener('change', (e) => {
            document.querySelectorAll('.result-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
            generateReport();
        });
    }

    const resultContainer = document.getElementById('resultCheckboxes');
    if (resultContainer) {
        resultContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('result-checkbox')) {
                const allChecked = document.querySelectorAll('.result-checkbox:not(:checked)').length === 0;
                if (selectAllResults) selectAllResults.checked = allChecked;
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


