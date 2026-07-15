// ===== App Version =====
const APP_VERSION = 22;

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

// ===== State Management =====
let inventoryCounts = [];
let categories = [];

// ===== API Configuration =====
const API_BASE = '/.netlify/functions';

// ===== Database API Functions =====
async function initDatabase() {
    try {
        const response = await fetch(`${API_BASE}/inventory-init`);
        const result = await response.json();
        
        if (result.success) {
            console.log('Inventory database initialized');
        } else {
            console.error('Database initialization failed:', result.error);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

async function getInventoryCounts(category = null, startDate = null, endDate = null) {
    try {
        let url = `${API_BASE}/inventory-counts-get`;
        const params = new URLSearchParams();

        if (category) params.append('category', category);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.counts;
    } catch (error) {
        console.error('Error fetching inventory counts:', error);
        return [];
    }
}

async function getCategories() {
    try {
        const response = await fetch(`${API_BASE}/inventory-items-get`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return [...new Set(result.data.map(row => row.category))].sort();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

// ===== UI Functions =====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateOnly(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function renderInventoryTable(counts) {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (counts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                    No inventory counts found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = counts.map(count => `
        <tr>
            <td>${count.category}</td>
            <td>${count.brand}</td>
            <td>${count.item}</td>
            <td class="quantity-cell">${count.quantity}</td>
            <td>${count.submitted_by || '-'}</td>
            <td>${formatDate(count.created_at)}</td>
        </tr>
    `).join('');
}

function updateStats(counts) {
    document.getElementById('totalItems').textContent = counts.length;
    
    const uniqueCategories = new Set(counts.map(c => c.category));
    document.getElementById('totalCategories').textContent = uniqueCategories.size;
    
    if (counts.length > 0) {
        const latest = counts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        document.getElementById('lastUpdate').textContent = formatDateOnly(latest.created_at);
    } else {
        document.getElementById('lastUpdate').textContent = '-';
    }
}

function populateCategoryFilter() {
    const select = document.getElementById('filterCategory');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Categories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

async function refreshInventoryCounts() {
    const category = document.getElementById('filterCategory').value || null;
    const startDate = document.getElementById('startDate').value || null;
    const endDate = document.getElementById('endDate').value || null;

    inventoryCounts = await getInventoryCounts(category, startDate, endDate);
    
    // Filter out items with no quantity (shouldn't happen, but just in case)
    inventoryCounts = inventoryCounts.filter(c => c.quantity > 0);
    
    renderInventoryTable(inventoryCounts);
    updateStats(inventoryCounts);
}

function exportToExcel() {
    if (inventoryCounts.length === 0) {
        showToast('No inventory counts to export', true);
        return;
    }
    
    // Group by category for better organization
    const grouped = {};
    inventoryCounts.forEach(count => {
        if (!grouped[count.category]) {
            grouped[count.category] = [];
        }
        grouped[count.category].push(count);
    });
    
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Mighty Ops - Inventory Count Report'],
        ['Generated:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: true })],
        [''],
        ['Total Items Counted:', inventoryCounts.length],
        ['Categories:', Object.keys(grouped).length],
        ['']
    ];
    
    // Add category summaries
    Object.keys(grouped).sort().forEach(category => {
        const totalQty = grouped[category].reduce((sum, item) => sum + item.quantity, 0);
        summaryData.push([`${category}:`, `${grouped[category].length} items, Total Qty: ${totalQty}`]);
    });
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // All counts sheet
    const allData = inventoryCounts.map(count => ({
        'Category': count.category,
        'Brand': count.brand,
        'Item': count.item,
        'Quantity': count.quantity,
        'Submitted By': count.submitted_by || '',
        'Date': formatDate(count.created_at)
    }));
    
    const allWs = XLSX.utils.json_to_sheet(allData);
    allWs['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 30 },
        { wch: 12 },
        { wch: 20 },
        { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, allWs, 'All Counts');
    
    // Category-specific sheets
    Object.keys(grouped).sort().forEach(category => {
        const data = grouped[category].map(count => ({
            'Brand': count.brand,
            'Item': count.item,
            'Quantity': count.quantity,
            'Submitted By': count.submitted_by || '',
            'Date': formatDate(count.created_at)
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 20 },
            { wch: 30 },
            { wch: 12 },
            { wch: 20 },
            { wch: 25 }
        ];
        
        // Truncate sheet name if too long (Excel limit is 31 chars)
        const sheetName = category.length > 31 ? category.substring(0, 31) : category;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Mighty_Ops_Inventory_${timestamp}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${inventoryCounts.length} items to Excel`);
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

// ===== Event Handlers =====
function setupEventListeners() {
    document.getElementById('filterCategory').addEventListener('change', refreshInventoryCounts);
    document.getElementById('startDate').addEventListener('change', refreshInventoryCounts);
    document.getElementById('endDate').addEventListener('change', refreshInventoryCounts);
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterCategory').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        refreshInventoryCounts();
    });
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
}

// ===== Initialize Dashboard =====
async function init() {
    if (!checkAuth()) return;
    
    await initDatabase();
    
    // Load categories
    categories = await getCategories();
    populateCategoryFilter();
    
    setupEventListeners();
    await refreshInventoryCounts();
}

document.addEventListener('DOMContentLoaded', init);
