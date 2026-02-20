// Monthly Site Review – form logic

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

// Site locations (Site #1–31 + Spotless)
const locations = [...Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`), 'Spotless'];
const locationSelect = document.getElementById('location');
locations.forEach(loc => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    locationSelect.appendChild(option);
});

// Default review date to today (CST-friendly)
const reviewDateEl = document.getElementById('reviewDate');
if (reviewDateEl) {
    const now = new Date();
    reviewDateEl.value = now.toISOString().slice(0, 10);
}

// Section config: radio name prefix -> count (matches PDF exactly)
const SECTION_ITEMS = {
    site_approach: 7,
    tunnel: 9,
    procedures: 9,
    vacuum: 7,
    office: 7,
    chemical: 8
};

function collectSection(sectionKey, count) {
    const items = [];
    for (let i = 1; i <= count; i++) {
        const name = `${sectionKey}_${i}`;
        const radio = document.querySelector(`input[name="${name}"]:checked`);
        const commentEl = document.querySelector(`input[data-comment="${name}"]`);
        items.push({
            pass_fail: radio ? radio.value : '',
            comments: commentEl ? commentEl.value.trim() : ''
        });
    }
    return items;
}

function collectFormAnswers() {
    const answers = {
        review_date: document.getElementById('reviewDate')?.value || '',
        weather: document.getElementById('weather')?.value?.trim() || '',
        time_arrived: document.getElementById('timeArrived')?.value || '',
        site_approach: collectSection('site_approach', SECTION_ITEMS.site_approach),
        tunnel: collectSection('tunnel', SECTION_ITEMS.tunnel),
        mighty_wash_comments: document.getElementById('mightyWashComments')?.value?.trim() || '',
        procedures_management: collectSection('procedures', SECTION_ITEMS.procedures),
        procedures_prep_time: document.getElementById('proceduresPrepTime')?.value?.trim() || '',
        procedures_labor_pct: document.getElementById('proceduresLaborPct')?.value?.trim() || '',
        vacuum_area: collectSection('vacuum', SECTION_ITEMS.vacuum),
        office_breakroom: collectSection('office', SECTION_ITEMS.office),
        chemical_room: collectSection('chemical', SECTION_ITEMS.chemical),
        chemical_ppm: document.getElementById('chemicalPpm')?.value?.trim() || ''
    };
    return answers;
}

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

document.getElementById('evaluationForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;

    btnText.textContent = 'Saving...';
    submitBtn.disabled = true;

    try {
        const answers = collectFormAnswers();

        let imagePdf = null;
        if (currentImageData) {
            imagePdf = await convertImageToPDF(currentImageData);
        }

        const evaluationData = {
            location: document.getElementById('location').value,
            answers: answers,
            additional_notes: document.getElementById('additionalNotes').value,
            follow_up_instructions: '',
            image_pdf: imagePdf,
            submitted_by: user.full_name,
            submitted_at: new Date().toISOString()
        };

        const response = await fetch('/.netlify/functions/evaluations-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evaluationData)
        });

        if (!response.ok) throw new Error('Failed to save evaluation');

        showToast('Review saved successfully!');

        e.target.reset();
        if (reviewDateEl) reviewDateEl.value = new Date().toISOString().slice(0, 10);
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
