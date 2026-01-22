// ===== App Version =====
const APP_VERSION = 22;

// ===== Authentication =====
let currentUser = null;

function checkAuth() {
    const userStr = localStorage.getItem('mightyops_user');
    if (!userStr) {
        window.location.href = 'login.html';
        return false;
    }
    currentUser = JSON.parse(userStr);
    return true;
}

// ===== Configuration =====
const CONFIG = {
    locations: [...Array.from({ length: 31 }, (_, i) => i + 1), 'Spotless'],
    
    primaryItems: [
        'Pay Stations', 'Prep', 'Tunnel', 'Equipment', 'Chemical', 'Blowers', 'QC'
    ],
    
    secondaryItems: [
        'Mechanical Room', 'Office', 'Restrooms', 'Vac Shed', 'Vac Area', 'Vac Pressure'
    ],
    
    priorityItems: [
        'Fire Extinguishers', 'Safety Supplies', 'First Aid Kit', 'Hazmat Suits', 
        'Safety Signage', 'Housekeeping', 'Storage/Tool Room', 'Site Hazards'
    ],
    
    finalThoughtsItems: [
        'Customer Service', 'Fast', 'Friendly', 'Clean', 'Efficient', 
        'Anything Stand Out: (Good or Bad)'
    ]
};

// ===== State Management =====
let audits = [];

// ===== API Configuration =====
const API_BASE = '/.netlify/functions';

// ===== Database API Functions =====
async function initDatabase() {
    try {
        const response = await fetch(`${API_BASE}/site-audit-init`);
        const result = await response.json();
        
        if (result.success) {
            console.log('Site audits database initialized');
        } else {
            console.error('Database initialization failed:', result.error);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

async function getAudits(location = null, date = null) {
    try {
        let url = `${API_BASE}/site-audit-get`;
        const params = new URLSearchParams();
        
        if (location) params.append('location', location);
        if (date) params.append('date', date);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.audits;
    } catch (error) {
        console.error('Error fetching audits:', error);
        return [];
    }
}

// ===== UI Functions =====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateOnly(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatLocation(location) {
    if (typeof location === 'string' && isNaN(parseInt(location))) {
        return location;
    }
    return `Site ${location}`;
}

function getRatingBadge(rating) {
    if (!rating) return '';
    
    const labels = {
        'pass': 'Pass',
        'needs-work': 'Needs Work',
        'fail': 'Fail'
    };
    
    return `<span class="rating-badge ${rating}">${labels[rating] || rating}</span>`;
}

function renderSection(sectionData, itemNames, sectionTitle) {
    if (!sectionData || Object.keys(sectionData).length === 0) {
        return '';
    }
    
    let html = `
        <div class="section-display">
            <div class="section-title">${sectionTitle}</div>
    `;
    
    itemNames.forEach((itemName, index) => {
        const rating = sectionData[index];
        if (rating) {
            html += `
                <div class="item-display">
                    <div class="item-name-display">${itemName}</div>
                    ${getRatingBadge(rating)}
                </div>
            `;
        }
    });
    
    html += `</div>`;
    return html;
}

function renderAudit(audit) {
    const location = formatLocation(audit.location);
    const timestamp = formatDate(audit.created_at);
    const submitter = audit.submitted_by || 'Unknown';
    
    let html = `
        <div class="audit-card">
            <div class="audit-header">
                <div class="audit-meta">
                    <div class="audit-location">${location}</div>
                    <div class="audit-timestamp">${timestamp}</div>
                    <div class="audit-submitter">Submitted by: ${submitter}</div>
                </div>
            </div>
    `;
    
    // Initial Observations
    if (audit.initial_observations) {
        html += `
            <div class="section-display">
                <div class="section-title">Initial Observations (Curb Appeal)</div>
                <p style="color: var(--white); line-height: 1.6;">${audit.initial_observations}</p>
            </div>
        `;
    }
    
    // Section comments for initial
    if (audit.section_comments && audit.section_comments.initial) {
        html += `<div class="comments-display">Comments: ${audit.section_comments.initial}</div>`;
    }
    
    // Primary Section
    if (audit.primary_section) {
        html += renderSection(audit.primary_section, CONFIG.primaryItems, 'Primary (Washing your Car)');
        if (audit.section_comments && audit.section_comments.primary) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.primary}</div>`;
        }
    }
    
    // Secondary Section
    if (audit.secondary_section) {
        html += renderSection(audit.secondary_section, CONFIG.secondaryItems, 'Secondary (Behind the Scenes)');
        if (audit.section_comments && audit.section_comments.secondary) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.secondary}</div>`;
        }
    }
    
    // Priority Section
    if (audit.priority_section) {
        html += renderSection(audit.priority_section, CONFIG.priorityItems, 'Priority (Safety)');
        if (audit.section_comments && audit.section_comments.priority) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.priority}</div>`;
        }
    }
    
    // Final Thoughts
    if (audit.final_thoughts) {
        html += renderSection(audit.final_thoughts, CONFIG.finalThoughtsItems, 'Final Thoughts (Customer Takeaways)');
        if (audit.section_comments && audit.section_comments.finalThoughts) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.finalThoughts}</div>`;
        }
    }
    
    // Explanation
    if (audit.explanation) {
        html += `
            <div class="explanation-display">
                <label>Explanation</label>
                <p>${audit.explanation}</p>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

function renderAudits(auditsList) {
    const container = document.getElementById('auditsContainer');
    
    if (auditsList.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                No audits found
            </p>
        `;
        return;
    }
    
    container.innerHTML = auditsList.map(audit => renderAudit(audit)).join('');
}

function updateStats(auditsList) {
    document.getElementById('totalAudits').textContent = auditsList.length;
    
    const uniqueSites = new Set(auditsList.map(a => a.location));
    document.getElementById('totalSites').textContent = uniqueSites.size;
    
    if (auditsList.length > 0) {
        const latest = auditsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        document.getElementById('lastUpdate').textContent = formatDateOnly(latest.created_at);
    } else {
        document.getElementById('lastUpdate').textContent = '-';
    }
}

function populateLocationFilter() {
    const select = document.getElementById('filterLocation');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Sites</option>';
    
    CONFIG.locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = formatLocation(loc);
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

async function refreshAudits() {
    const location = document.getElementById('filterLocation').value || null;
    const date = document.getElementById('filterDate').value || null;
    
    audits = await getAudits(location, date);
    renderAudits(audits);
    updateStats(audits);
}

function exportToExcel() {
    if (audits.length === 0) {
        showToast('No audits to export', true);
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Mighty Ops - Site Audit Report'],
        ['Generated:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: true })],
        [''],
        ['Total Audits:', audits.length],
        ['']
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Detailed audits sheet
    const allData = audits.map(audit => {
        const row = {
            'Date/Time': formatDate(audit.created_at),
            'Site': formatLocation(audit.location),
            'Submitted By': audit.submitted_by || '',
            'Initial Observations': audit.initial_observations || '',
            'Explanation': audit.explanation || ''
        };
        
        // Add primary section ratings
        if (audit.primary_section) {
            CONFIG.primaryItems.forEach((item, index) => {
                row[`Primary: ${item}`] = audit.primary_section[index] || '';
            });
        }
        
        // Add secondary section ratings
        if (audit.secondary_section) {
            CONFIG.secondaryItems.forEach((item, index) => {
                row[`Secondary: ${item}`] = audit.secondary_section[index] || '';
            });
        }
        
        // Add priority section ratings
        if (audit.priority_section) {
            CONFIG.priorityItems.forEach((item, index) => {
                row[`Priority: ${item}`] = audit.priority_section[index] || '';
            });
        }
        
        // Add final thoughts ratings
        if (audit.final_thoughts) {
            CONFIG.finalThoughtsItems.forEach((item, index) => {
                row[`Final: ${item}`] = audit.final_thoughts[index] || '';
            });
        }
        
        return row;
    });
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    allWs['!cols'] = Array.from({ length: 30 }, () => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, allWs, 'All Audits');
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Mighty_Ops_Site_Audits_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${audits.length} audits to Excel`);
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

// ===== Event Handlers =====
function setupEventListeners() {
    document.getElementById('filterLocation').addEventListener('change', refreshAudits);
    document.getElementById('filterDate').addEventListener('change', refreshAudits);
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterLocation').value = '';
        document.getElementById('filterDate').value = '';
        refreshAudits();
    });
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
}

// ===== Initialize Dashboard =====
async function init() {
    if (!checkAuth()) return;
    
    await initDatabase();
    
    populateLocationFilter();
    setupEventListeners();
    await refreshAudits();
}

document.addEventListener('DOMContentLoaded', init);
