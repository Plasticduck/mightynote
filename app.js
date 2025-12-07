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
                image_pdf: imagePdf,
                submitted_by: currentUser ? currentUser.full_name : null,
                user_id: currentUser ? currentUser.id : null
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

// ===== UI Functions =====
function populateLocationDropdown() {
    const locationSelect = document.getElementById('location');
    
    CONFIG.locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = `Site ${loc}`;
        locationSelect.appendChild(option);
    });
}

function updateNoteTypes(department) {
    const noteTypeGroup = document.getElementById('noteTypeGroup');
    const noteTypeSelect = document.getElementById('noteType');
    const otherDescGroup = document.getElementById('otherDescGroup');
    
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
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', true);
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image must be less than 10MB', true);
        return;
    }
    
    try {
        showToast('Processing image...');
        
        const compressedBase64 = await compressImage(file);
        const pdfBase64 = await convertImageToPDF(compressedBase64, file.name);
        
        currentPhotoData = pdfBase64;
        showPhotoPreview(compressedBase64);
        
        showToast('Photo attached successfully');
    } catch (error) {
        console.error('Error processing photo:', error);
        showToast('Error processing photo', true);
    }
    
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
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
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
                const isLandscape = img.width > img.height;
                const doc = new jsPDF({
                    orientation: isLandscape ? 'landscape' : 'portrait',
                    unit: 'mm'
                });
    
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                
                const margin = 10;
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - (margin * 2) - 20;
                
                let imgWidth = img.width;
                let imgHeight = img.height;
                
                const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                imgWidth *= scale;
                imgHeight *= scale;
                
                const x = (pageWidth - imgWidth) / 2;
                const y = margin + 15;
                
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Photo Evidence - ${new Date().toLocaleString()}`, margin, margin + 5);
                
                doc.addImage(imageBase64, 'JPEG', x, y, imgWidth, imgHeight);
                
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

// ===== Event Handlers =====
function setupEventListeners() {
    const departmentSelect = document.getElementById('department');
    const noteTypeSelect = document.getElementById('noteType');
    const noteForm = document.getElementById('noteForm');
    
    departmentSelect.addEventListener('change', (e) => {
        updateNoteTypes(e.target.value);
    });
    
    noteTypeSelect.addEventListener('change', (e) => {
        const otherDescGroup = document.getElementById('otherDescGroup');
        otherDescGroup.style.display = e.target.value === 'Other' ? 'block' : 'none';
        
        if (e.target.value !== 'Other') {
            document.getElementById('otherDesc').value = '';
        }
    });
    
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
            await insertNote(location, department, noteType, otherDesc, additionalNotes, currentPhotoData);
            showToast('Note saved successfully!');
            
            noteForm.reset();
            document.getElementById('noteTypeGroup').style.display = 'none';
            document.getElementById('otherDescGroup').style.display = 'none';
            clearPhoto();
        } catch (error) {
            showToast('Error saving note. Please try again.', true);
        }
    });
}

// ===== PWA Service Worker Registration =====
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration.scope);
            
            setInterval(() => {
                registration.update();
            }, 5 * 60 * 1000);
            
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdatePrompt();
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
        
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log('App updated to version:', event.data.version);
            }
        });
        
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
}

function showUpdatePrompt() {
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

function applyUpdate() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
}

// ===== Initialize App =====
async function init() {
    // Check authentication first
    if (!checkAuth()) return;
    
    // Display submitter name
    const submitterEl = document.getElementById('submitterName');
    if (submitterEl && currentUser) {
        submitterEl.textContent = currentUser.full_name;
    }
    
    await initDatabase();
    populateLocationDropdown();
    setupEventListeners();
    setupPhotoHandlers();
    registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
