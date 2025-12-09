// Market Research App JavaScript

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

// Photo handling - multiple images
let currentImages = [];
const takePhotoBtn = document.getElementById('takePhotoBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const photoPreview = document.getElementById('photoPreview');
const photoGrid = document.getElementById('photoGrid');

takePhotoBtn.addEventListener('click', () => cameraInput.click());
uploadPhotoBtn.addEventListener('click', () => fileInput.click());

async function handleImageSelect(files) {
    if (!files || files.length === 0) return;
    for (let file of Array.from(files)) {
        const compressedImage = await compressImage(file);
        currentImages.push(compressedImage);
    }
    updatePhotoPreview();
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

function updatePhotoPreview() {
    if (currentImages.length === 0) {
        photoPreview.classList.add('hidden');
        return;
    }
    photoPreview.classList.remove('hidden');
    photoGrid.innerHTML = currentImages.map((img, index) => `
        <div style="position: relative; display: inline-block; margin: 4px;">
            <img src="${img}" alt="Preview ${index + 1}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
            <button type="button" onclick="removePhoto(${index})" style="position: absolute; top: -4px; right: -4px; background: var(--accent-red); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;">×</button>
        </div>
    `).join('');
}

window.removePhoto = function(index) {
    currentImages.splice(index, 1);
    updatePhotoPreview();
};

cameraInput.addEventListener('change', (e) => handleImageSelect(e.target.files));
fileInput.addEventListener('change', (e) => handleImageSelect(e.target.files));

// Rating sliders
const sliders = ['staffProfessionalism', 'speedOfService', 'customerServiceQuality', 'siteCleanliness', 'vacuumAreaCondition'];
sliders.forEach(id => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    if (slider && valueDisplay) {
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
        });
    }
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
}

setupTagSelectors();

// Convert images to PDF
async function convertImagesToPDF(images) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();
        const img = new Image();
        await new Promise((resolve) => {
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
                pdf.addImage(images[i], 'JPEG', x, y, imgWidth, imgHeight);
                resolve();
            };
            img.src = images[i];
        });
    }
    return pdf.output('datauristring');
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
document.getElementById('researchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    btnText.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        let imagePdf = null;
        if (currentImages.length > 0) {
            imagePdf = await convertImagesToPDF(currentImages);
        }
        
        const formData = {
            competitor_brand: document.getElementById('competitorBrand').value,
            competitor_address: document.getElementById('competitorAddress').value,
            operation_type: document.getElementById('operationType').value,
            tunnel_length: document.getElementById('tunnelLength').value,
            visit_date_time: document.getElementById('visitDateTime').value,
            staffing_levels: document.getElementById('staffingLevels').value,
            staff_professionalism: document.getElementById('staffProfessionalism').value,
            speed_of_service: document.getElementById('speedOfService').value,
            queue_length: document.getElementById('queueLength').value,
            equipment_condition: getSelectedTags('equipmentCondition'),
            technology_used: getSelectedTags('technologyUsed'),
            operational_strengths: document.getElementById('operationalStrengths').value,
            operational_weaknesses: document.getElementById('operationalWeaknesses').value,
            customer_service_quality: document.getElementById('customerServiceQuality').value,
            site_cleanliness: document.getElementById('siteCleanliness').value,
            vacuum_area_condition: document.getElementById('vacuumAreaCondition').value,
            amenities_offered: getSelectedTags('amenitiesOffered'),
            upkeep_issues: document.getElementById('upkeepIssues').value,
            customer_volume: document.getElementById('customerVolume').value,
            wash_packages: document.getElementById('washPackages').value,
            pricing: document.getElementById('pricing').value,
            membership_pricing: document.getElementById('membershipPricing').value,
            membership_perks: getSelectedTags('membershipPerks'),
            promotional_offers: document.getElementById('promotionalOffers').value,
            upgrades_addons: document.getElementById('upgradesAddons').value,
            competitor_standout: document.getElementById('competitorStandout').value,
            competitor_strengths: getSelectedTags('competitorStrengths'),
            competitor_weaknesses: getSelectedTags('competitorWeaknesses'),
            opportunities: document.getElementById('opportunities').value,
            image_pdf: imagePdf,
            submitted_by: user.full_name,
            submitted_at: new Date().toISOString()
        };
        
        const response = await fetch('/.netlify/functions/market-research-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to save research');
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to save research');
        
        showToast('Research saved successfully!');
        e.target.reset();
        currentImages = [];
        photoPreview.classList.add('hidden');
        photoGrid.innerHTML = '';
        document.querySelectorAll('.tag-option').forEach(option => option.classList.remove('selected'));
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(id + 'Value');
            if (slider && valueDisplay) {
                slider.value = 3;
                valueDisplay.textContent = '3';
            }
        });
        
    } catch (error) {
        console.error('Error saving research:', error);
        showToast('Failed to save research. Please try again.', 'error');
    } finally {
        btnText.textContent = originalText;
        submitBtn.disabled = false;
    }
});

