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
    
    // Show results section
    document.getElementById('reportResults').classList.remove('hidden');
    document.getElementById('resultsCount').textContent = `${notes.length} records`;
    
    // Generate summary charts
    renderLocationSummary(notes);
    renderDepartmentSummary(notes);
    renderNoteTypeSummary(notes);
    
    // Render table
    renderReportTable(notes);
    
    // Scroll to results
    document.getElementById('reportResults').scrollIntoView({ behavior: 'smooth' });
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
    
    // All records sheet
    const allData = notes.map(note => ({
        'Date/Time': formatDate(note.created_at),
        'Site': `Site ${note.location}`,
        'Department': note.department,
        'Note Type': note.note_type,
        'Other Description': note.other_description || '',
        'Additional Notes': note.additional_notes || ''
    }));
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    allWs['!cols'] = [
        { wch: 22 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 30 },
        { wch: 50 }
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
                'Additional Notes': note.additional_notes || ''
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 22 },
                { wch: 12 },
                { wch: 30 },
                { wch: 30 },
                { wch: 50 }
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
            'Additional Notes': note.additional_notes || ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 22 },
            { wch: 12 },
            { wch: 30 },
            { wch: 30 },
            { wch: 50 }
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
    
    // Table data
    const tableData = notes.map(note => [
        formatDate(note.created_at),
        `Site ${note.location}`,
        note.department,
        note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description.substring(0, 30)}${note.other_description.length > 30 ? '...' : ''}` 
            : note.note_type,
        (note.additional_notes || '-').substring(0, 50) + ((note.additional_notes || '').length > 50 ? '...' : '')
    ]);
    
    // Create table
    doc.autoTable({
        startY: 50,
        head: [['Date/Time', 'Site', 'Department', 'Note Type', 'Details']],
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
            0: { cellWidth: 40 },
            1: { cellWidth: 25 },
            2: { cellWidth: 30 },
            3: { cellWidth: 50 },
            4: { cellWidth: 'auto' },
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
    initServiceWorkerUpdates();
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', init);
