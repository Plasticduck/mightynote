// Invoice Approval App - client logic

(function () {
    function checkAuth() {
        const userStr = localStorage.getItem('mightyops_user');
        if (!userStr) {
            window.location.href = 'login.html';
            return null;
        }
        return JSON.parse(userStr);
    }

    const user = checkAuth();
    if (!user) return;
    document.getElementById('submitterName').textContent = user.full_name;

    // Default the date picker to today
    const dateInput = document.getElementById('invoiceDate');
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    let currentFile = { data: null, name: null, type: null, size: 0 };

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileChip = document.getElementById('fileChip');
    const fileNameEl = document.getElementById('fileName');
    const fileSizeEl = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const maxWidth = 1600;
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
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleFile(file) {
        if (!file) return;
        if (file.size > MAX_BYTES) {
            showToast('File is larger than 10 MB.', 'error');
            return;
        }
        let dataUrl;
        if (file.type.startsWith('image/')) {
            dataUrl = await compressImage(file);
        } else {
            dataUrl = await readFileAsDataURL(file);
        }
        currentFile = {
            data: dataUrl,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size
        };
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatSize(file.size);
        fileChip.classList.remove('hidden');
        dropzone.classList.add('hidden');
    }

    function resetFile() {
        currentFile = { data: null, name: null, type: null, size: 0 };
        fileInput.value = '';
        fileChip.classList.add('hidden');
        dropzone.classList.remove('hidden');
    }

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    removeFileBtn.addEventListener('click', resetFile);

    ['dragenter', 'dragover'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        })
    );
    ['dragleave', 'drop'].forEach((evt) =>
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        })
    );
    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    function showToast(message, type) {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        toastMessage.textContent = message;
        toastIcon.textContent = type === 'error' ? '✕' : '✓';
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    }

    document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('.btn-submit');
        const btnText = submitBtn.querySelector('.btn-text');
        const originalText = btnText.textContent;

        btnText.textContent = 'Submitting...';
        submitBtn.disabled = true;

        try {
            const payload = {
                assigned_to: document.getElementById('assignedTo').value,
                vendor_name: document.getElementById('vendorName').value.trim(),
                invoice_date: document.getElementById('invoiceDate').value || null,
                amount: parseFloat(document.getElementById('amount').value) || 0,
                file_data: currentFile.data,
                file_name: currentFile.name,
                file_type: currentFile.type,
                submitted_by: user.full_name,
                submitted_at: new Date().toISOString()
            };

            const res = await fetch('/.netlify/functions/invoices-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Submission failed');
            }

            showToast('Invoice submitted for approval!', 'success');
            e.target.reset();
            dateInput.value = today;
            resetFile();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Submission failed', 'error');
        } finally {
            btnText.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
})();
