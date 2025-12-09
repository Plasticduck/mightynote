// Site Evaluations App JavaScript

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
if (user) {
    document.getElementById('submitterName').textContent = user.full_name;
}

// Site locations
const locations = Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`);

// Populate locations dropdown
const locationSelect = document.getElementById('location');
locations.forEach(loc => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    locationSelect.appendChild(option);
});

// Photo handling
let currentImageData = null;

const takePhotoBtn = document.getElementById('takePhotoBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const photoPreview = document.getElementById('photoPreview');
const previewImage = document.getElementById('previewImage');
const removePhotoBtn = document.getElementById('removePhotoBtn');

takePhotoBtn.addEventListener('click', () => cameraInput.click());
uploadPhotoBtn.addEventListener('click', () => fileInput.click());

async function handleImageSelect(file) {
    if (!file) return;
    
    // Compress and convert to base64
    const compressedImage = await compressImage(file);
    currentImageData = compressedImage;
    
    previewImage.src = compressedImage;
    photoPreview.classList.remove('hidden');
}

async function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

cameraInput.addEventListener('change', (e) => handleImageSelect(e.target.files[0]));
fileInput.addEventListener('change', (e) => handleImageSelect(e.target.files[0]));

removePhotoBtn.addEventListener('click', () => {
    currentImageData = null;
    photoPreview.classList.add('hidden');
    previewImage.src = '';
    cameraInput.value = '';
    fileInput.value = '';
});

// Convert image to PDF
async function convertImageToPDF(imageData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const img = new Image();
    return new Promise((resolve) => {
        img.onload = () => {
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            let imgWidth = img.width;
            let imgHeight = img.height;
            
            // Scale to fit page
            const ratio = Math.min((pageWidth - 20) / imgWidth, (pageHeight - 20) / imgHeight);
            imgWidth *= ratio;
            imgHeight *= ratio;
            
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;
            
            pdf.addImage(imageData, 'JPEG', x, y, imgWidth, imgHeight);
            resolve(pdf.output('datauristring'));
        };
        img.src = imageData;
    });
}

// Format date for CST
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toast.style.setProperty('--toast-color', type === 'success' ? 'var(--success)' : 'var(--danger)');
    
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Form submission
document.getElementById('evaluationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    btnText.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        // Collect all answers
        const answers = {};
        for (let i = 1; i <= 19; i++) {
            answers[`q${i}`] = document.getElementById(`q${i}`).value;
        }
        
        // Convert image to PDF if exists
        let imagePdf = null;
        if (currentImageData) {
            imagePdf = await convertImageToPDF(currentImageData);
        }
        
        const evaluationData = {
            location: document.getElementById('location').value,
            answers: answers,
            additional_notes: document.getElementById('additionalNotes').value,
            follow_up_instructions: document.getElementById('followUpInstructions').value,
            image_pdf: imagePdf,
            submitted_by: user.full_name,
            submitted_at: new Date().toISOString()
        };
        
        // Save to database
        const response = await fetch('/.netlify/functions/evaluations-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evaluationData)
        });
        
        if (!response.ok) throw new Error('Failed to save evaluation');
        
        showToast('Review saved successfully!');
        
        // Reset form
        e.target.reset();
        currentImageData = null;
        photoPreview.classList.add('hidden');
        previewImage.src = '';
        
    } catch (error) {
        console.error('Error saving evaluation:', error);
        showToast('Failed to save review. Please try again.', 'error');
    } finally {
        btnText.textContent = originalText;
        submitBtn.disabled = false;
    }
});


