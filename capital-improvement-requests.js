// Capital Improvement Requests App JavaScript

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

const locations = Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`);
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

// Rating slider
const importanceSlider = document.getElementById('importanceRanking');
const importanceValue = document.getElementById('importanceValue');
importanceSlider.addEventListener('input', (e) => {
    importanceValue.textContent = e.target.value;
});

// Tag selector handlers
function setupTagSelectors() {
    document.querySelectorAll('.tag-selector').forEach(selector => {
        const checkboxes = selector.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const label = checkbox.closest('.tag-option');
                if (checkbox.checked) {
                    label.classList.add('selected');
                } else {
                    label.classList.remove('selected');
                }
            });
        });
    });
    
    // Handle "Other" option for request type
    const otherCheckbox = document.querySelector('#requestType input[value="Other"]');
    const otherInput = document.getElementById('requestTypeOther');
    if (otherCheckbox && otherInput) {
        otherCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                otherInput.classList.remove('hidden');
                otherInput.required = true;
            } else {
                otherInput.classList.add('hidden');
                otherInput.required = false;
                otherInput.value = '';
            }
        });
    }
}

setupTagSelectors();

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

function getSelectedTags(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

// Form submission
document.getElementById('requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    btnText.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        let requestTypes = getSelectedTags('requestType');
        const otherType = document.getElementById('requestTypeOther').value;
        if (requestTypes.includes('Other') && otherType) {
            requestTypes = requestTypes.filter(t => t !== 'Other');
            requestTypes.push(`Other: ${otherType}`);
        }
        
        let imagePdf = null;
        if (currentImageData) {
            imagePdf = await convertImageToPDF(currentImageData);
        }
        
        const formData = {
            location: document.getElementById('location').value,
            request_types: requestTypes,
            equipment_area: document.getElementById('equipmentArea').value,
            description: document.getElementById('description').value,
            image_pdf: imagePdf,
            operational_impact: document.getElementById('operationalImpact').value,
            customer_impact: document.getElementById('customerImpact').value,
            safety_impact: document.getElementById('safetyImpact').value,
            revenue_impact: document.getElementById('revenueImpact').value,
            importance_ranking: document.getElementById('importanceRanking').value,
            cost_range: document.getElementById('costRange').value,
            vendor_supplier: document.getElementById('vendorSupplier').value,
            operational_requirement: document.getElementById('operationalRequirement').value,
            recommendation: document.getElementById('recommendation').value,
            follow_up_actions: getSelectedTags('followUpActions'),
            justification: document.getElementById('justification').value,
            follow_up_deadline: document.getElementById('followUpDeadline').value || null,
            submitted_by: user.full_name,
            submitted_at: new Date().toISOString()
        };
        
        const response = await fetch('/.netlify/functions/capital-requests-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to save request');
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to save request');
        
        showToast('Request saved successfully!');
        e.target.reset();
        currentImageData = null;
        photoPreview.classList.add('hidden');
        previewImage.src = '';
        document.querySelectorAll('.tag-option').forEach(option => option.classList.remove('selected'));
        importanceSlider.value = 3;
        importanceValue.textContent = '3';
        
    } catch (error) {
        console.error('Error saving request:', error);
        showToast('Failed to save request. Please try again.', 'error');
    } finally {
        btnText.textContent = originalText;
        submitBtn.disabled = false;
    }
});



