// Invoice Approval Dashboard — tabbed workflow.
//
//   Accounting/Admin: Unassigned → Queue → Assigned → Approved → Exported,
//   plus Needs Attention and Cancelled. They assign site(s)+approver(s), submit
//   the queue (emails approvers), export approved invoices to QuickBooks CSV,
//   and can cancel / restart invoices.
//   Approvers: see only invoices assigned to them; must open an invoice before
//   approving or denying it.
//
// All privileged actions are independently enforced on the server — the role
// checks here only drive what the UI shows.

(async function () {
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
        if (!userStr) { window.location.href = 'login.html'; return null; }
        return JSON.parse(userStr);
    }
    const currentUser = checkAuth();
    if (!currentUser) return;

    function namesMatch(a, b) {
        if (!a || !b) return false;
        const aN = a.trim().toLowerCase();
        const bN = b.trim().toLowerCase();
        if (aN === bN) return true;
        const aP = aN.split(/\s+/), bP = bN.split(/\s+/);
        if (aP.length >= 2 && bP.length >= 2) {
            const aL = aP[aP.length - 1], bL = bP[bP.length - 1];
            if (aL === bL && (aP[0].startsWith(bP[0]) || bP[0].startsWith(aP[0]))) return true;
        }
        return false;
    }
    const nameInList = (name, list) => Array.isArray(list) && list.some((n) => namesMatch(n, name));

    // Roster + roles from the server (fallback baked in for offline resilience).
    let APPROVERS = ['Matt Canales', 'Isabel Castaneda', 'Lester Young', 'Rance Breed',
        'Aaron Messina', 'Justin Gamboa', 'Kevan Jowers', 'Ernest Contreras'];
    const isAdmin = currentUser.is_admin === true;
    let canManageInbox = isAdmin;
    let isApprover = APPROVERS.some((n) => namesMatch(n, currentUser.full_name));
    try {
        const r = await authFetch('/.netlify/functions/roles-get');
        if (r.ok) {
            const roles = await r.json();
            if (Array.isArray(roles.approvers)) APPROVERS = roles.approvers;
            if (roles.me) {
                canManageInbox = !!roles.me.can_manage_inbox;
                isApprover = !!roles.me.is_approver;
            }
        }
    } catch (e) { console.warn('[dashboard] roles-get failed — using fallback', e); }

    const SITES = [];
    for (let i = 1; i <= 32; i++) SITES.push(`Site #${i}`);
    SITES.push('Spotless');

    // ----- Tabs ------------------------------------------------------------
    // key, label, the invoice status it shows (or 'exported' = batch view).
    const ALL_TABS = [
        { key: 'unassigned', label: 'Unassigned', status: 'Unassigned' },
        { key: 'queue', label: 'Queue', status: 'Queued' },
        { key: 'assigned', label: 'Assigned', status: 'Assigned' },
        { key: 'approved', label: 'Approved', status: 'Approved' },
        { key: 'exported', label: 'Exported', status: 'Exported' },
        { key: 'needsattention', label: 'Needs Attention', status: 'NeedsAttention', attention: true },
        { key: 'cancelled', label: 'Cancelled', status: 'Cancelled' }
    ];
    const TABS = canManageInbox
        ? ALL_TABS
        : ALL_TABS.filter((t) => ['assigned', 'approved', 'needsattention'].includes(t.key));
    let activeTab = TABS[0].key;

    let allInvoices = [];
    let batches = [];

    // ----- DOM -------------------------------------------------------------
    const el = (id) => document.getElementById(id);
    const tabBar = el('tabBar');
    const tbody = el('invoicesBody');
    const thead = el('invoicesHead');
    const tableWrap = el('tableWrap');
    const batchList = el('batchList');
    const statCount = el('statCount');
    const statAmount = el('statAmount');
    const dashTitle = el('dashboardTitle');
    const dashSub = el('dashboardSubtitle');
    const submitQueueBtn = el('submitQueueBtn');
    const submitQueueCount = el('submitQueueCount');
    const exportBtn = el('exportBtn');
    const filterVendor = el('filterVendor');
    const filterFrom = el('filterFrom');
    const filterTo = el('filterTo');

    // ----- Helpers ---------------------------------------------------------
    function fmtMoney(n) {
        const num = parseFloat(n);
        return isNaN(num) ? '$0.00' : '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(s) {
        if (!s) return '—';
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (m) return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function fmtDateTime(s) {
        if (!s) return '—';
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function sitesOf(r) { return Array.isArray(r.sites) && r.sites.length ? r.sites : (r.site ? [r.site] : []); }
    function approversOf(r) { return Array.isArray(r.approvers) && r.approvers.length ? r.approvers : (r.assigned_to ? [r.assigned_to] : []); }
    function iAmApprover(r) { return nameInList(currentUser.full_name, approversOf(r)); }

    function showToast(message, type) {
        const toast = el('toast');
        toast.querySelector('.toast-message').textContent = message;
        toast.querySelector('.toast-icon').textContent = type === 'error' ? '✕' : '✓';
        toast.classList.remove('hidden'); toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 300); }, 2800);
    }

    function statusBadge(status) {
        const cls = (status || '').toLowerCase();
        const label = status === 'NeedsAttention' ? 'Needs Attention' : status;
        return `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
    }

    // ----- Tab bar ---------------------------------------------------------
    function tabCounts() {
        const counts = {};
        TABS.forEach((t) => {
            if (t.key === 'exported') counts[t.key] = batches.length;
            else counts[t.key] = allInvoices.filter((r) => (r.status || '') === t.status).length;
        });
        return counts;
    }
    function renderTabs() {
        const counts = tabCounts();
        tabBar.innerHTML = TABS.map((t) =>
            `<button type="button" class="tab-btn ${t.key === activeTab ? 'active' : ''} ${t.attention ? 'attention' : ''}" data-tab="${t.key}">
                ${escapeHtml(t.label)} <span class="tab-count">${counts[t.key] || 0}</span>
            </button>`
        ).join('');
    }
    tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        activeTab = btn.getAttribute('data-tab');
        render();
    });

    // ----- Filtering -------------------------------------------------------
    function currentTab() { return TABS.find((t) => t.key === activeTab) || TABS[0]; }
    function tabRows() {
        const status = currentTab().status;
        return allInvoices.filter((r) => (r.status || '') === status);
    }
    function applyFilters(rows) {
        const v = filterVendor.value.trim().toLowerCase();
        const from = filterFrom.value, to = filterTo.value;
        return rows.filter((r) => {
            if (v && !(r.vendor_name || '').toLowerCase().includes(v)) return false;
            if (from && r.invoice_date && r.invoice_date < from) return false;
            if (to && r.invoice_date && r.invoice_date > to) return false;
            return true;
        });
    }

    // ----- Row detail + actions -------------------------------------------
    function detailFor(r) {
        switch (r.status) {
            case 'Unassigned': return r.sender_email ? `From: ${escapeHtml(r.sender_email)}` : 'Emailed in';
            case 'Queued': return r.queued_by ? `Queued by ${escapeHtml(r.queued_by)}` : '';
            case 'Assigned': return 'Awaiting approval';
            case 'Approved': return r.decided_by ? `Approved by ${escapeHtml(r.decided_by)}${r.gl_code ? ' · GL ' + escapeHtml(r.gl_code) : ''}` : '';
            case 'Exported': return 'In QuickBooks';
            case 'NeedsAttention': return r.decision_reason ? `Denied: ${escapeHtml(r.decision_reason)}` : (r.decided_by ? `Denied by ${escapeHtml(r.decided_by)}` : 'Denied');
            case 'Cancelled': return r.cancelled_by ? `Cancelled by ${escapeHtml(r.cancelled_by)}` : 'Cancelled';
            default: return '';
        }
    }
    function actionsFor(r) {
        const btns = [];
        if (r.has_file) btns.push(`<button class="row-btn" data-action="view" data-id="${r.id}">View</button>`);
        if (canManageInbox) {
            if (r.status === 'Unassigned') btns.push(`<button class="row-btn approve" data-action="assign" data-id="${r.id}">Assign</button>`);
            if (r.status === 'Queued') btns.push(`<button class="row-btn" data-action="assign" data-id="${r.id}">Edit</button>`);
            if (r.status === 'NeedsAttention') btns.push(`<button class="row-btn approve" data-action="assign" data-id="${r.id}">Re-queue</button>`);
            if (r.status === 'Cancelled') btns.push(`<button class="row-btn approve" data-action="resend" data-id="${r.id}">Restart</button>`);
            if (['Unassigned', 'Queued', 'Assigned', 'Approved', 'NeedsAttention'].includes(r.status))
                btns.push(`<button class="row-btn danger" data-action="cancel" data-id="${r.id}">Cancel</button>`);
        }
        if (r.status === 'Assigned' && iAmApprover(r))
            btns.push(`<button class="row-btn approve" data-action="review" data-id="${r.id}">Review</button>`);
        return `<div class="row-actions">${btns.join('')}</div>`;
    }

    function renderTable(rows) {
        const cols = ['#', 'Vendor', 'Site(s)'];
        if (canManageInbox) cols.push('Approver(s)');
        cols.push('Amount', 'Detail', 'Submitted', 'Actions');
        thead.innerHTML = `<tr>${cols.map((c, i) =>
            `<th${c === 'Actions' ? ' style="text-align:right;"' : ''}>${c}</th>`).join('')}</tr>`;

        if (!rows.length) {
            const msg = activeTab === 'unassigned'
                ? 'No emailed-in invoices waiting. New invoices can be forwarded to payables@washlyfe.com'
                : 'Nothing here right now.';
            tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-state">${msg}</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map((r) => {
            const sites = sitesOf(r).map((s) => `<span class="pill site">${escapeHtml(s)}</span>`).join('') || '—';
            const apprs = approversOf(r).map((a) => `<span class="pill approver">${escapeHtml(a)}</span>`).join('') || '—';
            return `<tr>
                <td data-label="#">${r.id}</td>
                <td data-label="Vendor"><strong>${escapeHtml(r.vendor_name || '—')}</strong></td>
                <td data-label="Site(s)"><div class="pill-list">${sites}</div></td>
                ${canManageInbox ? `<td data-label="Approver(s)"><div class="pill-list">${apprs}</div></td>` : ''}
                <td data-label="Amount" class="amount-cell">${fmtMoney(r.amount)}</td>
                <td data-label="Detail"><span class="status-note">${detailFor(r)}</span></td>
                <td data-label="Submitted" class="date-cell">${escapeHtml(r.submitted_by || '—')}<br><span style="font-size:0.78rem;color:var(--text-muted)">${fmtDateTime(r.submitted_at)}</span></td>
                <td data-label="Actions" style="text-align:right;">${actionsFor(r)}</td>
            </tr>`;
        }).join('');
    }

    // ----- Export batches (Exported tab) ----------------------------------
    function renderBatches() {
        if (!batches.length) {
            batchList.innerHTML = `<div class="batch-card"><div class="empty-state" style="padding:var(--space-lg)">No exports yet. Approve invoices, then export them from the Approved tab.</div></div>`;
            return;
        }
        batchList.innerHTML = batches.map((b) => {
            const reexported = (b.export_count || 1) > 1;
            return `<div class="batch-card">
                <div>
                    <h4>${escapeHtml(b.file_name)}</h4>
                    <div class="batch-meta">${b.invoice_count} invoice${b.invoice_count === 1 ? '' : 's'} · ${fmtMoney(b.total_amount)}</div>
                    <div class="batch-exported ${reexported ? 'done' : ''}">Exported ${fmtDateTime(b.exported_at)} by ${escapeHtml(b.exported_by || '—')}${reexported ? ` · re-exported ${b.export_count - 1}×` : ''}</div>
                </div>
                <button type="button" class="btn-dl" data-batch="${b.id}">Export</button>
            </div>`;
        }).join('');
    }
    batchList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-batch]');
        if (!btn) return;
        const b = batches.find((x) => String(x.id) === btn.getAttribute('data-batch'));
        if (b) openDupModal(b);
    });

    // ----- Master render ---------------------------------------------------
    function render() {
        renderTabs();
        const tab = currentTab();
        dashTitle.textContent = tab.label;
        dashSub.textContent = subtitleFor(tab.key);

        // Context buttons
        submitQueueBtn.style.display = (canManageInbox && activeTab === 'queue') ? '' : 'none';
        const queuedCount = allInvoices.filter((r) => r.status === 'Queued').length;
        submitQueueCount.textContent = `(${queuedCount})`;
        submitQueueBtn.disabled = queuedCount === 0;
        const approvedCount = allInvoices.filter((r) => r.status === 'Approved').length;
        exportBtn.style.display = (canManageInbox && activeTab === 'approved') ? '' : 'none';
        exportBtn.disabled = approvedCount === 0;

        if (activeTab === 'exported' && canManageInbox) {
            tableWrap.style.display = 'none';
            batchList.style.display = '';
            renderBatches();
            statCount.textContent = batches.length;
            statAmount.textContent = fmtMoney(batches.reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0));
            return;
        }
        tableWrap.style.display = '';
        batchList.style.display = 'none';
        const rows = applyFilters(tabRows());
        renderTable(rows);
        statCount.textContent = rows.length;
        statAmount.textContent = fmtMoney(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
    }
    function subtitleFor(key) {
        switch (key) {
            case 'unassigned': return 'Invoices emailed to payables@washlyfe.com. Open one, set site(s) and approver(s), and add it to the queue.';
            case 'queue': return 'Assigned invoices waiting to be sent. Submit the queue to email each approver their review list.';
            case 'assigned': return canManageInbox ? 'Out for approval. Approvers have been emailed.' : 'Invoices awaiting your approval. Open each one before deciding.';
            case 'approved': return 'Approved invoices ready to export to QuickBooks.';
            case 'exported': return 'QuickBooks CSV batches. Re-exporting a batch warns about duplicate bills.';
            case 'needsattention': return 'Invoices an approver denied. Re-queue or cancel them.';
            case 'cancelled': return 'Cancelled invoices. Restart one to send it back through the workflow.';
            default: return '';
        }
    }

    // ----- Load ------------------------------------------------------------
    async function loadInvoices() {
        try {
            const res = await authFetch('/.netlify/functions/invoices-get');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load');
            allInvoices = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td class="empty-state">Error loading invoices: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
    async function loadBatches() {
        if (!canManageInbox) return;
        try {
            const res = await authFetch('/.netlify/functions/invoices-export-batches');
            if (res.ok) { const data = await res.json(); batches = Array.isArray(data) ? data : []; }
        } catch (err) { console.warn('[dashboard] batches load failed', err); }
    }

    // ----- View file (also records the view for approvers) -----------------
    async function viewFile(id) {
        try {
            const res = await authFetch('/.netlify/functions/invoices-view-file?id=' + encodeURIComponent(id));
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load file');
            if (!data.file_data) throw new Error('No file attached');
            const win = window.open('', '_blank');
            if (!win) { showToast('Popup blocked — allow popups to view the file.', 'error'); return false; }
            const title = escapeHtml(data.file_name || 'Invoice file');
            if ((data.file_type || '').startsWith('image/')) {
                win.document.write(`<!DOCTYPE html><title>${title}</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${data.file_data}" style="max-width:100%;max-height:100vh"/></body>`);
            } else {
                win.document.write(`<!DOCTYPE html><title>${title}</title><body style="margin:0"><iframe src="${data.file_data}" style="width:100vw;height:100vh;border:0"></iframe></body>`);
            }
            return true;
        } catch (err) { showToast(err.message, 'error'); return false; }
    }

    // ----- Assign modal (multi-site + multi-approver) ----------------------
    const assignModal = el('assignModal');
    const assignSites = el('assignSites');
    const assignApprovers = el('assignApprovers');
    const assignVendor = el('assignVendor');
    const assignAmount = el('assignAmount');
    const assignDate = el('assignDate');
    const assignConfirm = el('assignConfirm');
    let assignId = null;

    function chip(value, group) {
        return `<label class="chip"><input type="checkbox" value="${escapeHtml(value)}" data-group="${group}">${escapeHtml(value)}</label>`;
    }
    assignSites.innerHTML = SITES.map((s) => chip(s, 'site')).join('');
    assignApprovers.innerHTML = APPROVERS.map((a) => chip(a, 'approver')).join('');

    function chipValues(container) {
        return Array.from(container.querySelectorAll('input:checked')).map((i) => i.value);
    }
    function syncChip(input) { input.closest('.chip').classList.toggle('checked', input.checked); }
    function updateAssignUi() {
        assignConfirm.disabled = !(chipValues(assignSites).length && chipValues(assignApprovers).length);
    }
    [assignSites, assignApprovers].forEach((c) => c.addEventListener('change', (e) => {
        if (e.target.matches('input')) { syncChip(e.target); updateAssignUi(); }
    }));

    function setChips(container, values) {
        container.querySelectorAll('input').forEach((i) => {
            i.checked = values.some((v) => namesMatch(v, i.value) || v === i.value);
            syncChip(i);
        });
    }
    function openAssignModal(r) {
        assignId = r.id;
        el('assignTitle').textContent = r.status === 'Unassigned' ? 'Assign invoice' : 'Edit assignment';
        el('assignSummary').innerHTML = `
            <div><strong>Invoice #${r.id}</strong>${r.email_subject ? ' · ' + escapeHtml(r.email_subject) : ''}</div>
            ${r.sender_email ? `<div>From: ${escapeHtml(r.sender_email)}</div>` : ''}
            ${r.has_file ? `<div>Attachment: ${escapeHtml(r.file_name || 'file')}</div>` : '<div class="status-note">No attachment</div>'}`;
        assignVendor.value = r.vendor_name && r.vendor_name !== r.email_subject ? r.vendor_name : (r.email_subject || r.vendor_name || '');
        assignAmount.value = r.amount != null ? r.amount : '';
        assignDate.value = (r.invoice_date && /^\d{4}-\d{2}-\d{2}/.test(r.invoice_date)) ? r.invoice_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        setChips(assignSites, sitesOf(r));
        setChips(assignApprovers, approversOf(r));
        updateAssignUi();
        assignModal.classList.remove('hidden');
    }
    function closeAssign() { assignId = null; assignModal.classList.add('hidden'); }
    el('assignCancel').addEventListener('click', closeAssign);
    assignModal.addEventListener('click', (e) => { if (e.target === assignModal) closeAssign(); });
    assignConfirm.addEventListener('click', async () => {
        if (assignId == null) return;
        const payload = {
            id: assignId,
            sites: chipValues(assignSites),
            approvers: chipValues(assignApprovers),
            vendor_name: assignVendor.value.trim(),
            amount: assignAmount.value === '' ? null : parseFloat(assignAmount.value),
            invoice_date: assignDate.value || null
        };
        assignConfirm.disabled = true;
        try {
            const res = await authFetch('/.netlify/functions/invoices-assign', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Assign failed');
            mergeInvoice(data.invoice);
            closeAssign();
            showToast('Added to queue — submit the queue to notify approvers', 'success');
            render();
        } catch (err) { showToast(err.message, 'error'); assignConfirm.disabled = false; }
    });

    // ----- Submit queue ----------------------------------------------------
    submitQueueBtn.addEventListener('click', async () => {
        const n = allInvoices.filter((r) => r.status === 'Queued').length;
        if (!n) return;
        submitQueueBtn.disabled = true;
        try {
            const res = await authFetch('/.netlify/functions/invoices-submit-queue', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Submit failed');
            await loadInvoices();
            activeTab = 'assigned';
            render();
            showToast(`Queue submitted — ${data.submitted} invoice(s), approvers emailed`, 'success');
        } catch (err) { showToast(err.message, 'error'); submitQueueBtn.disabled = false; }
    });

    // ----- Review modal (view-gated) --------------------------------------
    const reviewModal = el('reviewModal');
    const viewGate = el('viewGate');
    const decisionApprove = el('decisionApprove');
    const decisionReject = el('decisionReject');
    const decisionApproveOption = el('decisionApproveOption');
    const decisionRejectOption = el('decisionRejectOption');
    const glCodeGroup = el('glCodeGroup');
    const glCodeInput = el('glCodeInput');
    const reviewNotes = el('reviewNotes');
    const notesLabel = el('notesLabel');
    const notesRequired = el('notesRequired');
    const reviewConfirm = el('reviewConfirm');
    let reviewId = null, hasViewed = false;

    function resetReview() {
        hasViewed = false;
        viewGate.classList.remove('viewed');
        el('viewGateText').textContent = 'Open the invoice to enable a decision.';
        decisionApprove.checked = decisionReject.checked = false;
        decisionApprove.disabled = decisionReject.disabled = true;
        decisionApproveOption.classList.add('disabled');
        decisionRejectOption.classList.add('disabled');
        decisionApproveOption.classList.remove('selected-approve');
        decisionRejectOption.classList.remove('selected-reject');
        glCodeInput.value = ''; reviewNotes.value = '';
        glCodeGroup.classList.add('hidden');
        notesLabel.textContent = 'Notes'; notesRequired.classList.add('hidden');
        reviewConfirm.disabled = true; reviewConfirm.textContent = 'Submit Decision';
        reviewConfirm.classList.remove('danger'); reviewConfirm.classList.add('primary');
    }
    function openReview(r) {
        reviewId = r.id;
        resetReview();
        el('reviewSummary').innerHTML = `
            <div><strong>${escapeHtml(r.vendor_name)}</strong> — <span class="amount">${fmtMoney(r.amount)}</span></div>
            ${sitesOf(r).length ? `<div>Site(s): ${escapeHtml(sitesOf(r).join(', '))}</div>` : ''}
            <div>Invoice date: ${fmtDate(r.invoice_date)}</div>
            <div>Submitted by: ${escapeHtml(r.submitted_by || '—')}</div>`;
        el('reviewViewBtn').style.display = r.has_file ? '' : 'none';
        if (!r.has_file) {
            // No file to view — allow decision (nothing to gate on).
            hasViewed = true; markViewed();
            el('viewGateText').textContent = 'No attachment on this invoice.';
        }
        reviewModal.classList.remove('hidden');
    }
    function markViewed() {
        hasViewed = true;
        viewGate.classList.add('viewed');
        el('viewGateText').textContent = 'Invoice viewed — you can now decide.';
        decisionApprove.disabled = decisionReject.disabled = false;
        decisionApproveOption.classList.remove('disabled');
        decisionRejectOption.classList.remove('disabled');
    }
    function closeReview() { reviewId = null; reviewModal.classList.add('hidden'); }
    el('reviewViewBtn').addEventListener('click', async () => {
        if (reviewId == null) return;
        const ok = await viewFile(reviewId);
        if (ok) markViewed();
    });
    function updateReviewUi() {
        const ap = decisionApprove.checked, rj = decisionReject.checked;
        decisionApproveOption.classList.toggle('selected-approve', ap);
        decisionRejectOption.classList.toggle('selected-reject', rj);
        if (ap) {
            glCodeGroup.classList.remove('hidden');
            notesLabel.textContent = 'Notes (optional)'; notesRequired.classList.add('hidden');
            reviewNotes.placeholder = 'Add any approval notes (optional)';
            reviewConfirm.disabled = false; reviewConfirm.textContent = 'Approve Invoice';
            reviewConfirm.classList.remove('danger'); reviewConfirm.classList.add('primary');
        } else if (rj) {
            glCodeGroup.classList.add('hidden');
            notesLabel.textContent = 'Reason'; notesRequired.classList.remove('hidden');
            reviewNotes.placeholder = 'Explain why this invoice is being denied';
            reviewConfirm.disabled = !reviewNotes.value.trim(); reviewConfirm.textContent = 'Deny Invoice';
            reviewConfirm.classList.add('danger'); reviewConfirm.classList.remove('primary');
        } else { reviewConfirm.disabled = true; }
    }
    decisionApprove.addEventListener('change', updateReviewUi);
    decisionReject.addEventListener('change', updateReviewUi);
    reviewNotes.addEventListener('input', updateReviewUi);
    el('reviewCancel').addEventListener('click', closeReview);
    reviewModal.addEventListener('click', (e) => { if (e.target === reviewModal) closeReview(); });
    reviewConfirm.addEventListener('click', async () => {
        if (reviewId == null || !hasViewed) return;
        const status = decisionApprove.checked ? 'Approved' : (decisionReject.checked ? 'Denied' : null);
        if (!status) return;
        const notes = reviewNotes.value.trim();
        if (status === 'Denied' && !notes) { reviewNotes.focus(); return; }
        const payload = { id: reviewId, status, reason: notes || null, gl_code: decisionApprove.checked ? glCodeInput.value.trim() : null };
        reviewConfirm.disabled = true;
        try {
            const res = await authFetch('/.netlify/functions/invoices-update-status', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');
            mergeInvoice(data.invoice);
            closeReview(); render();
            showToast(`Invoice ${status === 'Approved' ? 'approved' : 'denied'} — submitter notified`, 'success');
        } catch (err) { showToast(err.message, 'error'); reviewConfirm.disabled = false; }
    });

    // ----- Cancel modal ----------------------------------------------------
    const cancelModal = el('cancelModal');
    const cancelReason = el('cancelReason');
    let cancelId = null;
    function openCancel(r) {
        cancelId = r.id; cancelReason.value = '';
        el('cancelSub').textContent = `Invoice #${r.id} (${r.vendor_name || '—'}) will move to the Cancelled tab. You can restart it later.`;
        cancelModal.classList.remove('hidden');
    }
    function closeCancel() { cancelId = null; cancelModal.classList.add('hidden'); }
    el('cancelClose').addEventListener('click', closeCancel);
    cancelModal.addEventListener('click', (e) => { if (e.target === cancelModal) closeCancel(); });
    el('cancelConfirm').addEventListener('click', async () => {
        if (cancelId == null) return;
        el('cancelConfirm').disabled = true;
        try {
            const res = await authFetch('/.netlify/functions/invoices-cancel', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancelId, reason: cancelReason.value.trim() || null })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Cancel failed');
            await loadInvoices(); closeCancel(); render();
            showToast('Invoice cancelled', 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { el('cancelConfirm').disabled = false; }
    });

    // ----- Resend (restart cancelled) -------------------------------------
    async function resend(id) {
        try {
            const res = await authFetch('/.netlify/functions/invoices-resend', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Restart failed');
            await loadInvoices(); activeTab = 'unassigned'; render();
            showToast('Invoice restarted — back in Unassigned', 'success');
        } catch (err) { showToast(err.message, 'error'); }
    }

    // ----- Export (Approved → QuickBooks CSV) ------------------------------
    function downloadCsv(name, text) {
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Extracting & exporting…';
        try {
            const res = await authFetch('/.netlify/functions/invoices-export', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Export failed');
            if (data.exported === 0) { showToast(data.message || 'Nothing to export', 'error'); return; }
            downloadCsv(data.file_name, data.csv);
            await loadInvoices(); await loadBatches();
            activeTab = 'exported'; render();
            showToast(`Exported ${data.exported} invoice(s) to ${data.file_name}`, 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { exportBtn.disabled = false; exportBtn.textContent = 'Export to QuickBooks CSV'; }
    });

    // ----- Duplicate-export warning ---------------------------------------
    const dupModal = el('dupModal');
    const dupAck = el('dupAck');
    const dupConfirm = el('dupConfirm');
    let dupBatch = null;
    function openDupModal(b) {
        dupBatch = b;
        dupAck.checked = false; dupConfirm.disabled = true;
        el('dupIntro').innerHTML = `You exported this file on <strong>${fmtDateTime(b.exported_at)}</strong>. Importing it into QuickBooks again will create duplicate bills.`;
        el('dupTable').innerHTML = `
            <tr><td>File</td><td>${escapeHtml(b.file_name)}</td></tr>
            <tr><td>Invoices</td><td>${b.invoice_count}</td></tr>
            <tr><td>Total</td><td>${fmtMoney(b.total_amount)}</td></tr>
            <tr><td>Last exported</td><td>${fmtDateTime(b.last_exported_at || b.exported_at)} by ${escapeHtml(b.last_exported_by || b.exported_by || '—')}</td></tr>`;
        dupModal.classList.remove('hidden');
    }
    function closeDup() { dupBatch = null; dupModal.classList.add('hidden'); }
    dupAck.addEventListener('change', () => { dupConfirm.disabled = !dupAck.checked; });
    el('dupCancel').addEventListener('click', closeDup);
    dupModal.addEventListener('click', (e) => { if (e.target === dupModal) closeDup(); });
    dupConfirm.addEventListener('click', async () => {
        if (!dupBatch) return;
        dupConfirm.disabled = true;
        try {
            const res = await authFetch('/.netlify/functions/invoices-export-batches?id=' + encodeURIComponent(dupBatch.id));
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Re-export failed');
            downloadCsv(data.file_name, data.csv_data || '');
            await loadBatches(); closeDup(); render();
            showToast('Re-exported ' + data.file_name, 'success');
        } catch (err) { showToast(err.message, 'error'); dupConfirm.disabled = false; }
    });

    // ----- Table action dispatch ------------------------------------------
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = Number(btn.getAttribute('data-id'));
        const r = allInvoices.find((x) => x.id === id);
        if (!r) return;
        switch (btn.getAttribute('data-action')) {
            case 'view': viewFile(id); break;
            case 'assign': openAssignModal(r); break;
            case 'review': openReview(r); break;
            case 'cancel': openCancel(r); break;
            case 'resend': resend(id); break;
        }
    });

    function mergeInvoice(updated) {
        if (!updated) return;
        const i = allInvoices.findIndex((r) => r.id === updated.id);
        if (i >= 0) allInvoices[i] = Object.assign({}, allInvoices[i], updated);
        else allInvoices.unshift(updated);
    }

    [filterVendor, filterFrom, filterTo].forEach((node) => {
        node.addEventListener('input', render); node.addEventListener('change', render);
    });
    el('clearFiltersBtn').addEventListener('click', () => {
        filterVendor.value = ''; filterFrom.value = ''; filterTo.value = ''; render();
    });

    // ----- Init ------------------------------------------------------------
    await loadInvoices();
    await loadBatches();
    render();
})();
