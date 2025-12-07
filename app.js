// ===== Photo Upload State =====
let currentPhotoData = null;

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

async function insertNote(location, department, noteType, otherDesc, additionalNotes, imagePdf = null) {
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
                additional_notes: additionalNotes || null,
                image_pdf: imagePdf
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

async function getNoteImage(noteId) {
    try {
        const response = await fetch(`${API_BASE}/notes-image?id=${noteId}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.image_pdf;
    } catch (error) {
        console.error('Error fetching note image:', error);
        return null;
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
        
        const imageBadge = note.has_image ? `
            <span class="record-image-badge" onclick="openImageModal(${note.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                Photo
            </span>
        ` : '';
        
        return `
            <div class="record-card">
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

async function exportToExcel(location) {
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
    showToast(`Exported ${notes.length} records to Excel`);
}

async function exportToPDF(location) {
    const notes = await getNotesForExport(location);
    
    if (notes.length === 0) {
        showToast('No records to export for this site', true);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(`Site ${location} - Violation Report`, 14, 20);
    
    // Subtitle with date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Records: ${notes.length}`, 14, 34);
    
    // Table data
    const tableData = notes.map(note => [
        formatDate(note.created_at),
        note.department,
        note.note_type === 'Other' && note.other_description 
            ? `Other: ${note.other_description}` 
            : note.note_type,
        note.additional_notes || '-'
    ]);
    
    // Create table
    doc.autoTable({
        startY: 42,
        head: [['Date/Time', 'Department', 'Note Type', 'Details']],
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
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { cellWidth: 'auto' },
        },
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Site_${location}_Notes_${timestamp}.pdf`;
    
    // Download
    doc.save(filename);
    showToast(`Exported ${notes.length} records to PDF`);
}

async function handleExport(format) {
    const location = document.getElementById('filterLocation').value;
    
    if (!location) {
        showToast('Please select a site to export', true);
        return;
    }
    
    const locationNum = parseInt(location);
    
    switch (format) {
        case 'pdf':
            await exportToPDF(locationNum);
            break;
        case 'excel':
            await exportToExcel(locationNum);
            break;
        case 'both':
            await exportToExcel(locationNum);
            await exportToPDF(locationNum);
            break;
    }
    
    // Close the dropdown
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

// ===== Photo Handling Functions =====
function setupPhotoHandlers() {
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const cameraInput = document.getElementById('cameraInput');
    const fileInput = document.getElementById('fileInput');
    const removePhotoBtn = document.getElementById('removePhotoBtn');
    
    takePhotoBtn.addEventListener('click', () => {
        cameraInput.click();
    });
    
    uploadPhotoBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    cameraInput.addEventListener('change', handlePhotoSelect);
    fileInput.addEventListener('change', handlePhotoSelect);
    
    removePhotoBtn.addEventListener('click', clearPhoto);
}

async function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', true);
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image must be less than 10MB', true);
        return;
    }
    
    try {
        showToast('Processing image...');
        
        // Compress and convert to base64
        const compressedBase64 = await compressImage(file);
        
        // Convert to PDF
        const pdfBase64 = await convertImageToPDF(compressedBase64, file.name);
        
        // Store the PDF data
        currentPhotoData = pdfBase64;
        
        // Show preview
        showPhotoPreview(compressedBase64);
        
        showToast('Photo attached successfully');
    } catch (error) {
        console.error('Error processing photo:', error);
        showToast('Error processing photo', true);
    }
    
    // Reset input
    event.target.value = '';
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1200px)
                const maxSize = 1200;
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed base64 (JPEG at 80% quality)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedBase64);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

async function convertImageToPDF(imageBase64, filename) {
    const { jsPDF } = window.jspdf;
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            try {
                // Determine orientation based on image dimensions
                const isLandscape = img.width > img.height;
                const doc = new jsPDF({
                    orientation: isLandscape ? 'landscape' : 'portrait',
                    unit: 'mm'
                });
                
                // Get page dimensions
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                
                // Calculate image dimensions to fit page with margins
                const margin = 10;
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - (margin * 2) - 20; // Leave space for header
                
                let imgWidth = img.width;
                let imgHeight = img.height;
                
                // Scale to fit
                const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                imgWidth *= scale;
                imgHeight *= scale;
                
                // Center the image
                const x = (pageWidth - imgWidth) / 2;
                const y = margin + 15; // After header
                
                // Add header
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Photo Evidence - ${new Date().toLocaleString()}`, margin, margin + 5);
                
                // Add image
                doc.addImage(imageBase64, 'JPEG', x, y, imgWidth, imgHeight);
                
                // Get as base64
                const pdfBase64 = doc.output('datauristring');
                resolve(pdfBase64);
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = () => reject(new Error('Failed to process image for PDF'));
        img.src = imageBase64;
    });
}

function showPhotoPreview(imageBase64) {
    const preview = document.getElementById('photoPreview');
    const previewImage = document.getElementById('previewImage');
    
    previewImage.src = imageBase64;
    preview.classList.remove('hidden');
}

function clearPhoto() {
    currentPhotoData = null;
    const preview = document.getElementById('photoPreview');
    const previewImage = document.getElementById('previewImage');
    
    previewImage.src = '';
    preview.classList.add('hidden');
}

// ===== Image Modal Functions =====
let currentModalPdfData = null;

function setupImageModal() {
    const modal = document.getElementById('imageModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const downloadBtn = document.getElementById('downloadImageBtn');
    
    closeBtn.addEventListener('click', closeImageModal);
    downloadBtn.addEventListener('click', downloadCurrentImage);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeImageModal();
        }
    });
    
    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeImageModal();
        }
    });
}

async function openImageModal(noteId) {
    const modal = document.getElementById('imageModal');
    const modalBody = document.getElementById('modalBody');
    
    // Show modal with loading state
    modal.classList.remove('hidden');
    modalBody.innerHTML = `
        <div class="modal-loading">
            <div class="spinner"></div>
            <span>Loading image...</span>
        </div>
    `;
    
    try {
        const pdfData = await getNoteImage(noteId);
        
        if (!pdfData) {
            throw new Error('No image found');
        }
        
        currentModalPdfData = pdfData;
        
        // Display PDF in iframe
        modalBody.innerHTML = `<iframe src="${pdfData}" title="Photo Evidence"></iframe>`;
    } catch (error) {
        modalBody.innerHTML = `
            <div class="modal-loading">
                <span style="color: var(--accent-red);">Failed to load image</span>
            </div>
        `;
    }
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.add('hidden');
    currentModalPdfData = null;
}

function downloadCurrentImage() {
    if (!currentModalPdfData) return;
    
    // Create download link
    const link = document.createElement('a');
    link.href = currentModalPdfData;
    link.download = `photo_evidence_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Image downloaded');
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
            // Include photo data if available
            await insertNote(location, department, noteType, otherDesc, additionalNotes, currentPhotoData);
            showToast('Note saved successfully!');
            
            // Reset form
            noteForm.reset();
            document.getElementById('noteTypeGroup').style.display = 'none';
            document.getElementById('otherDescGroup').style.display = 'none';
            clearPhoto(); // Clear the photo
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
    
    // Export button - toggle dropdown
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExportMenu();
    });
    
    // Export menu options
    document.querySelectorAll('#exportMenu .export-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = e.currentTarget.dataset.format;
            handleExport(format);
        });
    });
    
    // Close export menu when clicking outside
    document.addEventListener('click', () => {
        closeExportMenu();
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
            
            // Check for updates periodically (every 5 minutes)
            setInterval(() => {
                registration.update();
            }, 5 * 60 * 1000);
            
            // Listen for new service worker waiting
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available, show update prompt
                        showUpdatePrompt();
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('App updated to version:', event.data.version);
            }
        });
        
        // Handle controller change (new SW took over)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Reload to get fresh content
            window.location.reload();
        });
    }
}

// Show update available prompt
function showUpdatePrompt() {
    // Create update banner
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.innerHTML = `
        <div class="update-banner">
            <span>A new version is available</span>
            <button onclick="applyUpdate()">Update Now</button>
        </div>
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

// Apply the update
function applyUpdate() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
}

// ===== Initialize App =====
async function init() {
    await initDatabase();
    populateLocationDropdown();
    setupEventListeners();
    setupPhotoHandlers();
    setupImageModal();
    registerServiceWorker();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
