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

function renderSection(sectionData, itemNames, sectionTitle, photos = null, sectionKey = '') {
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
            let photoLink = '';
            if (photos && photos[index]) {
                const photoData = photos[index];
                photoLink = `
                    <a href="#" class="photo-link" data-photo="${encodeURIComponent(photoData)}" onclick="event.preventDefault(); viewPhoto('${encodeURIComponent(photoData)}'); return false;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                        View Photo
                    </a>
                `;
            }
            
            html += `
                <div class="item-display">
                    <div class="item-name-display">${itemName}${photoLink}</div>
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
        const primaryPhotos = audit.photos && audit.photos.primary ? audit.photos.primary : null;
        html += renderSection(audit.primary_section, CONFIG.primaryItems, 'Primary (Washing your Car)', primaryPhotos, 'primary');
        if (audit.section_comments && audit.section_comments.primary) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.primary}</div>`;
        }
    }
    
    // Secondary Section
    if (audit.secondary_section) {
        const secondaryPhotos = audit.photos && audit.photos.secondary ? audit.photos.secondary : null;
        html += renderSection(audit.secondary_section, CONFIG.secondaryItems, 'Secondary (Behind the Scenes)', secondaryPhotos, 'secondary');
        if (audit.section_comments && audit.section_comments.secondary) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.secondary}</div>`;
        }
    }
    
    // Priority Section
    if (audit.priority_section) {
        const priorityPhotos = audit.photos && audit.photos.priority ? audit.photos.priority : null;
        html += renderSection(audit.priority_section, CONFIG.priorityItems, 'Priority (Safety)', priorityPhotos, 'priority');
        if (audit.section_comments && audit.section_comments.priority) {
            html += `<div class="comments-display">Comments: ${audit.section_comments.priority}</div>`;
        }
    }
    
    // Final Thoughts
    if (audit.final_thoughts) {
        const finalPhotos = audit.photos && audit.photos.final_thoughts ? audit.photos.final_thoughts : null;
        html += renderSection(audit.final_thoughts, CONFIG.finalThoughtsItems, 'Final Thoughts (Customer Takeaways)', finalPhotos, 'final_thoughts');
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

function getPhotoLinkText(photoData) {
    if (!photoData) return '';
    // For Excel, we'll indicate photo is available
    // Note: Excel doesn't support data URIs in hyperlinks, so we'll just indicate availability
    return 'Photo Available';
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
    const allData = audits.map((audit, auditIndex) => {
        const row = {
            'Date/Time': formatDate(audit.created_at),
            'Site': formatLocation(audit.location),
            'Submitted By': audit.submitted_by || '',
            'Initial Observations': audit.initial_observations || '',
            'Explanation': audit.explanation || ''
        };
        
        // Add primary section ratings and photo links
        if (audit.primary_section) {
            CONFIG.primaryItems.forEach((item, index) => {
                const rating = audit.primary_section[index] || '';
                const photoData = audit.photos && audit.photos.primary && audit.photos.primary[index] ? audit.photos.primary[index] : null;
                row[`Primary: ${item}`] = rating;
                if (photoData) {
                    // Store photo data in a separate column for reference
                    // Users can view photos in the dashboard
                    row[`Primary: ${item} Photo`] = getPhotoLinkText(photoData);
                    row[`Primary: ${item} Photo Data`] = photoData; // Store full data for reference
                }
            });
        }
        
        // Add secondary section ratings and photo links
        if (audit.secondary_section) {
            CONFIG.secondaryItems.forEach((item, index) => {
                const rating = audit.secondary_section[index] || '';
                const photoData = audit.photos && audit.photos.secondary && audit.photos.secondary[index] ? audit.photos.secondary[index] : null;
                row[`Secondary: ${item}`] = rating;
                if (photoData) {
                    row[`Secondary: ${item} Photo`] = getPhotoLinkText(photoData);
                    row[`Secondary: ${item} Photo Data`] = photoData;
                }
            });
        }
        
        // Add priority section ratings and photo links
        if (audit.priority_section) {
            CONFIG.priorityItems.forEach((item, index) => {
                const rating = audit.priority_section[index] || '';
                const photoData = audit.photos && audit.photos.priority && audit.photos.priority[index] ? audit.photos.priority[index] : null;
                row[`Priority: ${item}`] = rating;
                if (photoData) {
                    row[`Priority: ${item} Photo`] = getPhotoLinkText(photoData);
                    row[`Priority: ${item} Photo Data`] = photoData;
                }
            });
        }
        
        // Add final thoughts ratings and photo links
        if (audit.final_thoughts) {
            CONFIG.finalThoughtsItems.forEach((item, index) => {
                const rating = audit.final_thoughts[index] || '';
                const photoData = audit.photos && audit.photos.final_thoughts && audit.photos.final_thoughts[index] ? audit.photos.final_thoughts[index] : null;
                row[`Final: ${item}`] = rating;
                if (photoData) {
                    row[`Final: ${item} Photo`] = getPhotoLinkText(photoData);
                    row[`Final: ${item} Photo Data`] = photoData;
                }
            });
        }
        
        return row;
    });
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    allWs['!cols'] = Array.from({ length: 50 }, () => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(wb, allWs, 'All Audits');
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Mighty_Ops_Site_Audits_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${audits.length} audits to Excel`);
}

function exportToPDF() {
    if (audits.length === 0) {
        showToast('No audits to export', true);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const lineHeight = 7;
    
    audits.forEach((audit, auditIndex) => {
        if (auditIndex > 0 || yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 20;
        }
        
        // Header
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`Site Audit - ${formatLocation(audit.location)}`, margin, yPos);
        yPos += lineHeight + 2;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Date: ${formatDate(audit.created_at)}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Submitted by: ${audit.submitted_by || 'Unknown'}`, margin, yPos);
        yPos += lineHeight + 3;
        
        // Initial Observations
        if (audit.initial_observations) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Initial Observations', margin, yPos);
            yPos += lineHeight;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const initialLines = doc.splitTextToSize(audit.initial_observations, 180);
            doc.text(initialLines, margin, yPos);
            yPos += initialLines.length * lineHeight + 3;
        }
        
        // Sections with photos
        const sections = [
            { key: 'primary', title: 'Primary (Washing your Car)', data: audit.primary_section, items: CONFIG.primaryItems },
            { key: 'secondary', title: 'Secondary (Behind the Scenes)', data: audit.secondary_section, items: CONFIG.secondaryItems },
            { key: 'priority', title: 'Priority (Safety)', data: audit.priority_section, items: CONFIG.priorityItems },
            { key: 'final_thoughts', title: 'Final Thoughts (Customer Takeaways)', data: audit.final_thoughts, items: CONFIG.finalThoughtsItems }
        ];
        
        sections.forEach(section => {
            if (!section.data || Object.keys(section.data).length === 0) return;
            
            if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(section.title, margin, yPos);
            yPos += lineHeight + 2;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            section.items.forEach((item, index) => {
                const rating = section.data[index];
                if (rating) {
                    if (yPos > pageHeight - 20) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    const photoData = audit.photos && audit.photos[section.key] && audit.photos[section.key][index] ? audit.photos[section.key][index] : null;
                    let itemText = `${item}: ${rating}`;
                    doc.text(itemText, margin, yPos);
                    yPos += lineHeight;
                    
                    if (photoData) {
                        // Add photo link in PDF
                        doc.setTextColor(0, 0, 255);
                        doc.textWithLink('[View Photo]', margin + 5, yPos, {
                            url: photoData
                        });
                        doc.setTextColor(0, 0, 0);
                        yPos += lineHeight;
                    }
                }
            });
            
            yPos += 3;
        });
        
        // Explanation
        if (audit.explanation) {
            if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Explanation', margin, yPos);
            yPos += lineHeight;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const explanationLines = doc.splitTextToSize(audit.explanation, 180);
            doc.text(explanationLines, margin, yPos);
            yPos += explanationLines.length * lineHeight + 5;
        }
        
        yPos += 5;
    });
    
    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`Mighty_Ops_Site_Audits_${timestamp}.pdf`);
    showToast(`Exported ${audits.length} audits to PDF`);
}

function viewPhoto(photoData) {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoImage');
    img.src = decodeURIComponent(photoData);
    modal.classList.remove('hidden');
}

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    modal.classList.add('hidden');
    const img = document.getElementById('photoImage');
    img.src = '';
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
    document.getElementById('exportPDFBtn').addEventListener('click', exportToPDF);
    document.getElementById('closePhotoModal').addEventListener('click', closePhotoModal);
    document.getElementById('photoModal').addEventListener('click', (e) => {
        if (e.target.id === 'photoModal') {
            closePhotoModal();
        }
    });
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
