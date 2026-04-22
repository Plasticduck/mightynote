// Invoice Approval Dashboard
//   - Approvers see only invoices assigned to them (strict)
//   - Accounting users see ALL invoices, with a toggle to view "My Queue"
//     (useful if they're also occasionally assigned one)
//   - Others (submitters): empty queue

(function () {
    function checkAuth() {
        const userStr = localStorage.getItem('mightyops_user');
        if (!userStr) {
            window.location.href = 'login.html';
            return null;
        }
        return JSON.parse(userStr);
    }
    const currentUser = checkAuth();
    if (!currentUser) return;

    const APPROVERS = [
        'Matt Canales', 'Isabel Castaneda', 'Lester Young', 'Rance Breed',
        'Aaron Messina', 'Justin Gamboa', 'Kevan Jowers', 'Ernest Contreras'
    ];

    // Accounting team — can view everyone's invoices (primarily for post-approval
    // reconciliation). Names here must be resolved against the flexible matcher
    // so e.g. "Mikayla" resolves to "Mikala Niemeyer".
    const ACCOUNTING = [
        'Heather Murry', 'Rebecca Hipp', 'Mikala Niemeyer', 'Erica Campbell',
        'Kimber Thornton', 'Elda Pineda', 'Kevan Jowers'
    ];

    function namesMatch(a, b) {
        if (!a || !b) return false;
        const aN = a.trim().toLowerCase();
        const bN = b.trim().toLowerCase();
        if (aN === bN) return true;
        const aParts = aN.split(/\s+/);
        const bParts = bN.split(/\s+/);
        if (aParts.length >= 2 && bParts.length >= 2) {
            const aLast = aParts[aParts.length - 1];
            const bLast = bParts[bParts.length - 1];
            if (aLast === bLast && (aParts[0].startsWith(bParts[0]) || bParts[0].startsWith(aParts[0]))) return true;
        }
        return false;
    }

    const isAccounting = ACCOUNTING.some((n) => namesMatch(n, currentUser.full_name));
    const isApprover = APPROVERS.some((n) => namesMatch(n, currentUser.full_name));

    // queueMode: 'all' | 'mine'
    //   Accounting defaults to 'all'. Approvers (non-accounting) are always 'mine'.
    //   Non-accounting submitters are 'mine' (which will be empty for them).
    let queueMode = isAccounting ? 'all' : 'mine';
    let allInvoices = [];

    const tbody = document.getElementById('invoicesBody');
    const statTotal = document.getElementById('statTotal');
    const statAmount = document.getElementById('statAmount');
    const statPending = document.getElementById('statPending');
    const statApprovers = document.getElementById('statApprovers');
    const filterStatus = document.getElementById('filterStatus');
    const filterAssignee = document.getElementById('filterAssignee');
    const filterAssigneeGroup = document.getElementById('filterAssigneeGroup');
    const filterVendor = document.getElementById('filterVendor');
    const filterFrom = document.getElementById('filterFrom');
    const filterTo = document.getElementById('filterTo');
    const dashboardTitle = document.getElementById('dashboardTitle');
    const dashboardSubtitle = document.getElementById('dashboardSubtitle');
    const queueToggle = document.getElementById('queueToggle');
    const myQueueCountEl = document.getElementById('myQueueCount');

    // Populate the assignee filter
    APPROVERS.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        filterAssignee.appendChild(opt);
    });

    // Update UI based on role
    function applyRoleUi() {
        if (isAccounting) {
            queueToggle.classList.remove('hidden');
            filterAssigneeGroup.classList.remove('hidden');
            document.querySelectorAll('.col-assigned').forEach((el) => el.classList.remove('hidden'));
            if (queueMode === 'all') {
                dashboardTitle.textContent = 'All Invoices';
                dashboardSubtitle.textContent = 'Accounting view — all invoices from every approver. Filter by status or assignee as needed.';
            } else {
                dashboardTitle.textContent = 'My Invoices';
                dashboardSubtitle.textContent = 'Invoices assigned to you.';
            }
        } else {
            queueToggle.classList.add('hidden');
            filterAssigneeGroup.classList.add('hidden');
            document.querySelectorAll('.col-assigned').forEach((el) => el.classList.add('hidden'));
        }
    }
    applyRoleUi();

    const approversLabel = statApprovers.parentElement.querySelector('.stat-label');
    if (approversLabel) approversLabel.textContent = 'Approved';

    function fmtMoney(n) {
        const num = parseFloat(n);
        if (isNaN(num)) return '$0.00';
        return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(s) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function fmtDateTime(s) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.querySelector('.toast-message').textContent = message;
        toast.querySelector('.toast-icon').textContent = type === 'error' ? '✕' : '✓';
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    function scopedInvoices() {
        // Accounting user in All mode: every invoice.
        // Accounting user in Mine mode, OR any approver/submitter: only theirs.
        if (isAccounting && queueMode === 'all') return allInvoices.slice();
        return allInvoices.filter((r) => namesMatch(r.assigned_to, currentUser.full_name));
    }

    function applyFilters(rows) {
        const status = filterStatus.value;
        const assignee = filterAssignee.value;
        const v = filterVendor.value.trim().toLowerCase();
        const from = filterFrom.value;
        const to = filterTo.value;
        return rows.filter((r) => {
            if (status && (r.status || 'Pending') !== status) return false;
            if (assignee && !namesMatch(r.assigned_to, assignee)) return false;
            if (v && !(r.vendor_name || '').toLowerCase().includes(v)) return false;
            if (from && r.invoice_date && r.invoice_date < from) return false;
            if (to && r.invoice_date && r.invoice_date > to) return false;
            return true;
        });
    }

    function renderStats(rows) {
        statTotal.textContent = rows.length;
        const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        statAmount.textContent = fmtMoney(total);
        const pending = rows.filter((r) => (r.status || 'Pending') === 'Pending').length;
        statPending.textContent = pending;
        const approved = rows.filter((r) => r.status === 'Approved').length;
        statApprovers.textContent = approved;
    }

    function statusDetailHtml(r) {
        if (r.status === 'Approved' && r.gl_code) {
            return `<div class="gl-code-chip">GL: ${escapeHtml(r.gl_code)}</div>`;
        }
        if (r.status === 'Rejected' && r.decision_reason) {
            return `<div class="status-note">${escapeHtml(r.decision_reason)}</div>`;
        }
        if (r.status === 'Approved' && r.decision_reason) {
            return `<div class="status-note">${escapeHtml(r.decision_reason)}</div>`;
        }
        return '';
    }

    function renderTable(rows) {
        const colCount = isAccounting ? 9 : 8;
        if (!rows.length) {
            const msg = queueMode === 'all' ? 'No invoices match the current filters.' : 'No invoices assigned to you right now.';
            tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-state">${msg}</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map((r) => {
            const status = (r.status || 'Pending');
            const statusClass = status === 'Approved' ? 'approved' : (status === 'Rejected' ? 'rejected' : '');
            const isMine = namesMatch(r.assigned_to, currentUser.full_name);
            const canReview = status === 'Pending' && isMine;
            return `
                <tr>
                    <td data-label="#">${r.id}</td>
                    <td data-label="Vendor">
                        <strong>${escapeHtml(r.vendor_name)}</strong>
                        ${r.site ? `<div class="status-note" style="margin-top:2px;">${escapeHtml(r.site)}</div>` : ''}
                    </td>
                    ${isAccounting ? `<td data-label="Assigned" class="col-assigned assignee-cell">${escapeHtml(r.assigned_to || '—')}</td>` : ''}
                    <td data-label="Date" class="date-cell">${fmtDate(r.invoice_date)}</td>
                    <td data-label="Amount" class="amount-cell">${fmtMoney(r.amount)}</td>
                    <td data-label="Status">
                        <span class="status-badge ${statusClass}">${escapeHtml(status === 'Rejected' ? 'Not Approved' : status)}</span>
                        ${statusDetailHtml(r)}
                    </td>
                    <td data-label="Submitted By">${escapeHtml(r.submitted_by || '—')}</td>
                    <td data-label="Submitted" class="date-cell">${fmtDateTime(r.submitted_at)}</td>
                    <td data-label="Actions" style="text-align: right;">
                        <div class="row-actions">
                            ${canReview ? `<button class="row-btn approve" data-action="review" data-id="${r.id}">Review</button>` : ''}
                            ${r.has_file ? `<button class="row-btn" data-action="view" data-id="${r.id}">View</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function myPendingCount() {
        return allInvoices.filter((r) =>
            (r.status || 'Pending') === 'Pending' && namesMatch(r.assigned_to, currentUser.full_name)
        ).length;
    }

    function render() {
        const scoped = scopedInvoices();
        const filtered = applyFilters(scoped);
        renderStats(filtered);
        renderTable(filtered);
        if (myQueueCountEl) myQueueCountEl.textContent = myPendingCount();
        applyRoleUi();
    }

    async function loadInvoices() {
        try {
            const res = await fetch('/.netlify/functions/invoices-get');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load');
            allInvoices = Array.isArray(data) ? data : [];
            render();
        } catch (err) {
            console.error(err);
            const colCount = isAccounting ? 9 : 8;
            tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-state">Error loading invoices: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function viewFile(id) {
        try {
            const res = await fetch('/.netlify/functions/invoices-view-file?id=' + encodeURIComponent(id));
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load file');
            if (!data.file_data) throw new Error('No file attached');
            const win = window.open('', '_blank');
            if (!win) {
                showToast('Popup blocked — allow popups to view the file.', 'error');
                return;
            }
            const title = escapeHtml(data.file_name || 'Invoice file');
            const isImage = (data.file_type || '').startsWith('image/');
            if (isImage) {
                win.document.write(`<!DOCTYPE html><title>${title}</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${data.file_data}" style="max-width:100%;max-height:100vh"/></body>`);
            } else {
                win.document.write(`<!DOCTYPE html><title>${title}</title><body style="margin:0"><iframe src="${data.file_data}" style="width:100vw;height:100vh;border:0"></iframe></body>`);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function submitDecision(id, status, reason, glCode) {
        try {
            const res = await fetch('/.netlify/functions/invoices-update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: Number(id),
                    status,
                    reason: reason || null,
                    gl_code: glCode || null,
                    decided_by: currentUser.full_name
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
            const updated = data.invoice;
            allInvoices = allInvoices.map((r) => r.id === updated.id ? Object.assign({}, r, updated) : r);
            render();
            const verb = status === 'Approved' ? 'approved' : 'rejected';
            showToast(`Invoice ${verb} — submitter notified`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // Review modal
    const reviewModal = document.getElementById('reviewModal');
    const reviewSummary = document.getElementById('reviewSummary');
    const reviewModalSub = document.getElementById('reviewModalSub');
    const decisionApprove = document.getElementById('decisionApprove');
    const decisionReject = document.getElementById('decisionReject');
    const decisionApproveOption = document.getElementById('decisionApproveOption');
    const decisionRejectOption = document.getElementById('decisionRejectOption');
    const glCodeGroup = document.getElementById('glCodeGroup');
    const glCodeInput = document.getElementById('glCodeInput');
    const reviewNotes = document.getElementById('reviewNotes');
    const notesLabel = document.getElementById('notesLabel');
    const notesRequired = document.getElementById('notesRequired');
    const reviewConfirm = document.getElementById('reviewConfirm');
    let pendingReviewId = null;

    function resetReviewModal() {
        decisionApprove.checked = false;
        decisionReject.checked = false;
        decisionApproveOption.classList.remove('selected-approve');
        decisionRejectOption.classList.remove('selected-reject');
        glCodeInput.value = '';
        reviewNotes.value = '';
        reviewNotes.placeholder = '';
        glCodeGroup.classList.add('hidden');
        notesLabel.textContent = 'Notes';
        notesRequired.classList.add('hidden');
        reviewConfirm.disabled = true;
        reviewConfirm.textContent = 'Submit Decision';
        reviewConfirm.classList.remove('danger');
        reviewConfirm.classList.add('primary');
    }

    function openReviewModal(invoice) {
        pendingReviewId = invoice.id;
        resetReviewModal();
        reviewModalSub.textContent = `Decide whether to approve this invoice. Your choice will be emailed to the submitter.`;
        reviewSummary.innerHTML = `
            <div><strong>${escapeHtml(invoice.vendor_name)}</strong> — <span class="amount">${fmtMoney(invoice.amount)}</span></div>
            ${invoice.site ? `<div>Site: ${escapeHtml(invoice.site)}</div>` : ''}
            <div>Invoice date: ${fmtDate(invoice.invoice_date)}</div>
            <div>Submitted by: ${escapeHtml(invoice.submitted_by || '—')}</div>
        `;
        reviewModal.classList.remove('hidden');
    }
    function closeReviewModal() {
        pendingReviewId = null;
        reviewModal.classList.add('hidden');
    }

    function updateReviewUi() {
        const approved = decisionApprove.checked;
        const rejected = decisionReject.checked;
        decisionApproveOption.classList.toggle('selected-approve', approved);
        decisionRejectOption.classList.toggle('selected-reject', rejected);

        if (approved) {
            glCodeGroup.classList.remove('hidden');
            notesLabel.textContent = 'Notes (optional)';
            notesRequired.classList.add('hidden');
            reviewNotes.placeholder = 'Add any approval notes (optional)';
            reviewConfirm.disabled = false;
            reviewConfirm.textContent = 'Approve Invoice';
            reviewConfirm.classList.remove('danger');
            reviewConfirm.classList.add('primary');
        } else if (rejected) {
            glCodeGroup.classList.add('hidden');
            notesLabel.textContent = 'Reason';
            notesRequired.classList.remove('hidden');
            reviewNotes.placeholder = 'Explain why this invoice is not being approved';
            reviewConfirm.disabled = !reviewNotes.value.trim();
            reviewConfirm.textContent = 'Reject Invoice';
            reviewConfirm.classList.add('danger');
            reviewConfirm.classList.remove('primary');
        } else {
            glCodeGroup.classList.add('hidden');
            reviewConfirm.disabled = true;
        }
    }

    decisionApprove.addEventListener('change', updateReviewUi);
    decisionReject.addEventListener('change', updateReviewUi);
    reviewNotes.addEventListener('input', updateReviewUi);

    document.getElementById('reviewCancel').addEventListener('click', closeReviewModal);
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) closeReviewModal();
    });

    reviewConfirm.addEventListener('click', () => {
        if (pendingReviewId == null) return;
        const id = pendingReviewId;
        const status = decisionApprove.checked ? 'Approved' : (decisionReject.checked ? 'Rejected' : null);
        if (!status) return;
        const notes = reviewNotes.value.trim();
        const glCode = decisionApprove.checked ? glCodeInput.value.trim() : null;
        if (status === 'Rejected' && !notes) {
            reviewNotes.focus();
            return;
        }
        closeReviewModal();
        submitDecision(id, status, notes || null, glCode || null);
    });

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'view') viewFile(id);
        else if (action === 'review') {
            const invoice = allInvoices.find((r) => r.id === Number(id));
            if (invoice) openReviewModal(invoice);
        }
    });

    queueToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-queue]');
        if (!btn) return;
        queueMode = btn.getAttribute('data-queue');
        queueToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        render();
    });

    [filterStatus, filterAssignee, filterVendor, filterFrom, filterTo].forEach((el) => {
        el.addEventListener('input', render);
        el.addEventListener('change', render);
    });
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        filterStatus.value = '';
        filterAssignee.value = '';
        filterVendor.value = '';
        filterFrom.value = '';
        filterTo.value = '';
        render();
    });

    document.getElementById('exportCSVBtn').addEventListener('click', () => {
        const rows = applyFilters(scopedInvoices());
        const header = ['ID', 'Site', 'Vendor', 'Assigned To', 'Invoice Date', 'Amount', 'Status', 'GL Code', 'Decision Notes', 'Submitted By', 'Submitted At'];
        const lines = [header.join(',')];
        rows.forEach((r) => {
            const line = [
                r.id,
                `"${(r.site || '').replace(/"/g, '""')}"`,
                `"${(r.vendor_name || '').replace(/"/g, '""')}"`,
                `"${(r.assigned_to || '').replace(/"/g, '""')}"`,
                r.invoice_date || '',
                parseFloat(r.amount) || 0,
                r.status || 'Pending',
                `"${(r.gl_code || '').replace(/"/g, '""')}"`,
                `"${(r.decision_reason || '').replace(/"/g, '""')}"`,
                `"${(r.submitted_by || '').replace(/"/g, '""')}"`,
                r.submitted_at || ''
            ].join(',');
            lines.push(line);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const prefix = queueMode === 'all' ? 'invoices' : 'my-invoices';
        a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('exportPDFBtn').addEventListener('click', () => {
        const rows = applyFilters(scopedInvoices());
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        const title = queueMode === 'all' ? 'Invoice Approval Database' : `${currentUser.full_name} — Invoice Queue`;
        pdf.text(title, 40, 40);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(110);
        pdf.text(`Generated ${new Date().toLocaleString()} — ${rows.length} invoice(s)`, 40, 58);

        const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        pdf.setTextColor(30);
        pdf.text(`Total: ${fmtMoney(total)}`, 40, 74);

        const body = rows.map((r) => [
            r.id,
            r.site || '',
            r.vendor_name || '',
            r.assigned_to || '',
            fmtDate(r.invoice_date),
            fmtMoney(r.amount),
            r.status || 'Pending',
            r.gl_code || '',
            r.decision_reason || '',
            r.submitted_by || ''
        ]);

        pdf.autoTable({
            startY: 90,
            head: [['#', 'Site', 'Vendor', 'Assigned To', 'Invoice Date', 'Amount', 'Status', 'GL Code', 'Notes', 'Submitted By']],
            body,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
            headStyles: { fillColor: [10, 132, 255], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 251] },
            columnStyles: {
                0: { cellWidth: 26, halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                8: { cellWidth: 120 }
            }
        });

        const prefix = queueMode === 'all' ? 'invoices' : 'my-invoices';
        pdf.save(`${prefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
    });

    loadInvoices();
})();
