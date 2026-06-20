// Invoice Approval App - client logic

(function () {
    // Use the shared helper when present; otherwise a self-contained fallback
    // that still attaches the bearer token — so a stale cached page that hasn't
    // loaded auth-client.js yet won't throw "authFetch is not defined".
    const authFetch = window.authFetch || function (input, init) {
        init = init || {};
        const h = new Headers(init.headers || {});
        const t = localStorage.getItem('mightyops_token');
        if (t) h.set('Authorization', 'Bearer ' + t);
        init.headers = h;
        return fetch(input, init);
    };

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

    // Refresh the approver dropdown from the server roster (single source of
    // truth in _lib-roles.js). The hardcoded <option>s in the HTML are only a
    // fallback used if this fetch fails.
    (async () => {
        try {
            const res = await authFetch('/.netlify/functions/roles-get');
            if (!res.ok) return;
            const roles = await res.json();
            if (!Array.isArray(roles.approvers) || !roles.approvers.length) return;
            const sel = document.getElementById('assignedTo');
            const current = sel.value;
            sel.innerHTML = '<option value="">Select an approver...</option>';
            roles.approvers.forEach((name) => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
            if (current) sel.value = current;
        } catch (e) {
            console.warn('[invoice] roles-get failed — using fallback approver list', e);
        }
    })();

    // Populate the Site dropdown: Site #1..#32 + Spotless
    const siteSelect = document.getElementById('site');
    for (let i = 1; i <= 32; i++) {
        const opt = document.createElement('option');
        opt.value = `Site #${i}`;
        opt.textContent = `Site #${i}`;
        siteSelect.appendChild(opt);
    }
    const spotless = document.createElement('option');
    spotless.value = 'Spotless';
    spotless.textContent = 'Spotless';
    siteSelect.appendChild(spotless);

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
                site: document.getElementById('site').value,
                assigned_to: document.getElementById('assignedTo').value,
                vendor_name: document.getElementById('vendorName').value.trim(),
                invoice_date: document.getElementById('invoiceDate').value || null,
                amount: parseFloat(document.getElementById('amount').value) || 0,
                file_data: currentFile.data,
                file_name: currentFile.name,
                file_type: currentFile.type,
                submitted_by: user.full_name,
                submitted_by_email: user.email || null,
                submitted_at: new Date().toISOString()
            };

            const res = await authFetch('/.netlify/functions/invoices-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Submission failed');
            }

            showToast('Invoice submitted — Accounting will route it for approval.', 'success');
            e.target.reset();
            dateInput.value = today;
            siteSelect.value = '';
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
