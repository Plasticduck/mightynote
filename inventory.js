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
let categories = [];
let currentCategory = null;
let brands = [];
let currentBrand = null;
let items = [];
let selectedItems = new Map(); // Map of itemId -> {category, brand, item, quantity}

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
            showToast('Error connecting to database', true);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        showToast('Error connecting to database', true);
    }
}

async function getCategories() {
    try {
        const response = await fetch(`${API_BASE}/inventory-items-get`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data.map(row => row.category);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

async function getBrands(category) {
    try {
        const response = await fetch(`${API_BASE}/inventory-items-get?category=${encodeURIComponent(category)}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data.map(row => row.brand);
    } catch (error) {
        console.error('Error fetching brands:', error);
        return [];
    }
}

async function getItems(category, brand) {
    try {
        const response = await fetch(`${API_BASE}/inventory-items-get?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
    } catch (error) {
        console.error('Error fetching items:', error);
        return [];
    }
}

async function submitInventoryCounts() {
    try {
        const counts = Array.from(selectedItems.values()).filter(item => item.quantity > 0);
        
        if (counts.length === 0) {
            showToast('No items with quantities to submit', true);
            return;
        }
        
        const response = await fetch(`${API_BASE}/inventory-counts-submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                counts: counts,
                submitted_by: currentUser ? currentUser.full_name : null,
                user_id: currentUser ? currentUser.id : null
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        showToast(`Successfully submitted ${result.count} item(s)`);
        
        // Clear selections
        selectedItems.clear();
        updateSummary();
        
        // Reset form
        currentCategory = null;
        currentBrand = null;
        items = [];
        renderCategories();
        document.getElementById('brandGroup').style.display = 'none';
        document.getElementById('itemsGroup').style.display = 'none';
        
    } catch (error) {
        console.error('Error submitting inventory counts:', error);
        showToast('Error submitting inventory count', true);
    }
}

// ===== UI Functions =====
function renderCategories() {
    const container = document.getElementById('categoryTabs');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `category-tab ${category === currentCategory ? 'active' : ''}`;
        tab.textContent = category;
        tab.addEventListener('click', () => selectCategory(category));
        container.appendChild(tab);
    });
}

async function selectCategory(category) {
    currentCategory = category;
    currentBrand = null;
    items = [];
    
    renderCategories();
    
    // Show brand selection
    const brandGroup = document.getElementById('brandGroup');
    brandGroup.style.display = 'block';
    
    // Load brands
    const brandSelect = document.getElementById('brand');
    brandSelect.innerHTML = '<option value="">Select a brand...</option>';
    brandSelect.disabled = true;
    
    brands = await getBrands(category);
    
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });
    
    brandSelect.disabled = false;
    
    // Hide items group
    document.getElementById('itemsGroup').style.display = 'none';
}

async function selectBrand(brand) {
    currentBrand = brand;
    items = [];
    
    // Load items
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '<div class="empty-state">Loading items...</div>';
    document.getElementById('itemsGroup').style.display = 'block';
    
    items = await getItems(currentCategory, brand);
    
    if (items.length === 0) {
        itemsList.innerHTML = '<div class="empty-state">No items found</div>';
        return;
    }
    
    renderItems();
}

function renderItems() {
    const container = document.getElementById('itemsList');
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">No items found</div>';
        return;
    }
    
    items.forEach(item => {
        const itemId = `${item.category}|${item.brand}|${item.item}`;
        const existing = selectedItems.get(itemId);
        const quantity = existing ? existing.quantity : '';
        
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <div class="item-info">
                <div class="item-brand">${item.brand}</div>
                <div class="item-name">${item.item}</div>
            </div>
            <input 
                type="number" 
                class="quantity-input" 
                placeholder="Qty" 
                min="0" 
                value="${quantity}"
                data-item-id="${itemId}"
                data-category="${item.category}"
                data-brand="${item.brand}"
                data-item="${item.item}"
            >
        `;
        
        const input = row.querySelector('.quantity-input');
        input.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value > 0) {
                selectedItems.set(itemId, {
                    category: item.category,
                    brand: item.brand,
                    item: item.item,
                    quantity: value
                });
            } else {
                selectedItems.delete(itemId);
            }
            updateSummary();
        });
        
        container.appendChild(row);
    });
}

function updateSummary() {
    const summarySection = document.getElementById('summarySection');
    const selectedItemsList = document.getElementById('selectedItemsList');
    
    const itemsWithQuantities = Array.from(selectedItems.values()).filter(item => item.quantity > 0);
    
    if (itemsWithQuantities.length === 0) {
        summarySection.style.display = 'none';
        return;
    }
    
    summarySection.style.display = 'block';
    
    // Group by category
    const grouped = {};
    itemsWithQuantities.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });
    
    selectedItemsList.innerHTML = '';
    
    Object.keys(grouped).sort().forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.style.marginBottom = 'var(--space-md)';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.style.fontSize = '0.85rem';
        categoryHeader.style.fontWeight = '600';
        categoryHeader.style.color = 'var(--accent-blue)';
        categoryHeader.style.marginBottom = 'var(--space-sm)';
        categoryHeader.textContent = category;
        categoryDiv.appendChild(categoryHeader);
        
        grouped[category].forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'selected-item';
            itemDiv.innerHTML = `
                <div class="selected-item-info">
                    <div class="selected-item-details">${item.brand} - ${item.item}</div>
                </div>
                <div class="selected-item-quantity">${item.quantity}</div>
            `;
            categoryDiv.appendChild(itemDiv);
        });
        
        selectedItemsList.appendChild(categoryDiv);
    });
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
    const brandSelect = document.getElementById('brand');
    brandSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            selectBrand(e.target.value);
        } else {
            document.getElementById('itemsGroup').style.display = 'none';
        }
    });
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        await submitInventoryCounts();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Inventory Count';
    });
}

// ===== Initialize App =====
async function init() {
    if (!checkAuth()) return;
    
    // Display submitter name
    const submitterEl = document.getElementById('submitterName');
    if (submitterEl && currentUser) {
        submitterEl.textContent = currentUser.full_name;
    }
    
    await initDatabase();
    
    // Load categories
    categories = await getCategories();
    
    // If no categories exist, seed initial data
    if (categories.length === 0) {
        try {
            // Seed BULK OIL
            const bulkOilResponse = await fetch(`${API_BASE}/inventory-seed-bulk-oil`);
            const bulkOilResult = await bulkOilResponse.json();
            if (bulkOilResult.success) {
                console.log('Seeded BULK OIL category');
            }
            
            // Seed BOTTLED OIL
            const bottledOilResponse = await fetch(`${API_BASE}/inventory-seed-bottled-oil`);
            const bottledOilResult = await bottledOilResponse.json();
            if (bottledOilResult.success) {
                console.log('Seeded BOTTLED OIL category');
            }
            
            // Seed OIL FILTERS
            const oilFiltersResponse = await fetch(`${API_BASE}/inventory-seed-oil-filters`);
            const oilFiltersResult = await oilFiltersResponse.json();
            if (oilFiltersResult.success) {
                console.log('Seeded OIL FILTERS category');
            }
            
            // Seed WIPERS
            const wipersResponse = await fetch(`${API_BASE}/inventory-seed-wipers`);
            const wipersResult = await wipersResponse.json();
            if (wipersResult.success) {
                console.log('Seeded WIPERS category');
            }
            
            // Seed AIR FILTERS
            const airFiltersResponse = await fetch(`${API_BASE}/inventory-seed-air-filters`);
            const airFiltersResult = await airFiltersResponse.json();
            if (airFiltersResult.success) {
                console.log('Seeded AIR FILTERS category');
            }
            
            // Seed CABIN AIR FILTERS
            const cabinAirFiltersResponse = await fetch(`${API_BASE}/inventory-seed-cabin-air-filters`);
            const cabinAirFiltersResult = await cabinAirFiltersResponse.json();
            if (cabinAirFiltersResult.success) {
                console.log('Seeded CABIN AIR FILTERS category');
            }
            
            // Seed FUEL FILTERS
            const fuelFiltersResponse = await fetch(`${API_BASE}/inventory-seed-fuel-filters`);
            const fuelFiltersResult = await fuelFiltersResponse.json();
            if (fuelFiltersResult.success) {
                console.log('Seeded FUEL FILTERS category');
            }
            
            // Seed LUBE PARTS/SUPPLIES
            const lubePartsSuppliesResponse = await fetch(`${API_BASE}/inventory-seed-lube-parts-supplies`);
            const lubePartsSuppliesResult = await lubePartsSuppliesResponse.json();
            if (lubePartsSuppliesResult.success) {
                console.log('Seeded LUBE PARTS/SUPPLIES category');
            }
            
            // Seed WASH SUPPLIES
            const washSuppliesResponse = await fetch(`${API_BASE}/inventory-seed-wash-supplies`);
            const washSuppliesResult = await washSuppliesResponse.json();
            if (washSuppliesResult.success) {
                console.log('Seeded WASH SUPPLIES category');
            }
            
            // Seed WASH CHEMICALS
            const washChemicalsResponse = await fetch(`${API_BASE}/inventory-seed-wash-chemicals`);
            const washChemicalsResult = await washChemicalsResponse.json();
            if (washChemicalsResult.success) {
                console.log('Seeded WASH CHEMICALS category');
            }
            
            // Seed AUTO ACCESSORIES
            const autoAccessoriesResponse = await fetch(`${API_BASE}/inventory-seed-auto-accessories`);
            const autoAccessoriesResult = await autoAccessoriesResponse.json();
            if (autoAccessoriesResult.success) {
                console.log('Seeded AUTO ACCESSORIES category');
            }
            
            // Seed CAR AUDIO
            const carAudioResponse = await fetch(`${API_BASE}/inventory-seed-car-audio`);
            const carAudioResult = await carAudioResponse.json();
            if (carAudioResult.success) {
                console.log('Seeded CAR AUDIO category');
            }
            
            // Seed BATTERIES
            const batteriesResponse = await fetch(`${API_BASE}/inventory-seed-batteries`);
            const batteriesResult = await batteriesResponse.json();
            if (batteriesResult.success) {
                console.log('Seeded BATTERIES category');
            }
            
            // Reload categories
            categories = await getCategories();
        } catch (error) {
            console.error('Error seeding initial data:', error);
        }
    }
    
    renderCategories();
    
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
