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

// ===== Configuration =====
const CONFIG = {
    locations: [...Array.from({ length: 31 }, (_, i) => i + 1), 'Spotless'],
    
    primaryItems: [
        { name: 'Pay Stations', criteria: 'Attended? Clean? Free of Sticky Notes? Etc.' },
        { name: 'Prep', criteria: 'Friendly? Neat Appearance? Efficient? Timely?' },
        { name: 'Tunnel', criteria: 'Clean? Uncluttered?' },
        { name: 'Equipment', criteria: 'Clean? Working/Spinning? Touching the car?' },
        { name: 'Chemical', criteria: 'Working? Good Coverage?' },
        { name: 'Blowers', criteria: 'Clean? Functioning? Free of Debris?' },
        { name: 'QC', criteria: 'Friendly? Neat Appearance? Efficient? Complete?' }
    ],
    
    secondaryItems: [
        { name: 'Mechanical Room', criteria: 'Clean? Neat? Organized?' },
        { name: 'Office', criteria: 'Clean? Neat? Organized?' },
        { name: 'Restrooms', criteria: 'Clean? Neat? Supplies?' },
        { name: 'Vac Shed', criteria: 'Uncluttered? Organized?' },
        { name: 'Vac Area', criteria: 'Clean? Hoses? Attachments? Trash Cans?' },
        { name: 'Vac Pressure', criteria: '' }
    ],
    
    priorityItems: [
        { name: 'Fire Extinguishers', criteria: 'Tagged? Off the Ground?' },
        { name: 'Safety Supplies', criteria: 'Stocked?' },
        { name: 'First Aid Kit', criteria: 'Stocked?' },
        { name: 'Hazmat Suits', criteria: 'Available?' },
        { name: 'Safety Signage', criteria: 'Visible? Clean?' },
        { name: 'Housekeeping', criteria: 'Complete?' },
        { name: 'Storage/Tool Room', criteria: 'Clean? Organized?' },
        { name: 'Site Hazards', criteria: 'Extension Cords? Ladders? Electrical Boxes?' }
    ],
    
    finalThoughtsItems: [
        { name: 'Customer Service', criteria: '' },
        { name: 'Fast', criteria: '' },
        { name: 'Friendly', criteria: '' },
        { name: 'Clean', criteria: '' },
        { name: 'Efficient', criteria: '' },
        { name: 'Anything Stand Out: (Good or Bad)', criteria: '' }
    ]
};

// ===== API Configuration =====
const API_BASE = '/.netlify/functions';

// ===== Database API Functions =====
async function initDatabase() {
    try {
        const response = await fetch(`${API_BASE}/site-audit-init`);
        const result = await response.json();
        
        if (result.success) {
            console.log('Site audits database initialized');
        } else {
            console.error('Database initialization failed:', result.error);
            showToast('Error connecting to database', true);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        showToast('Error connecting to database', true);
    }
}

async function submitAudit(auditData) {
    try {
        const response = await fetch(`${API_BASE}/site-audit-create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(auditData)
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.audit;
    } catch (error) {
        console.error('Error submitting audit:', error);
        throw error;
    }
}

// ===== UI Functions =====
function populateLocationDropdown() {
    const locationSelect = document.getElementById('location');
    
    CONFIG.locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = typeof loc === 'number' ? `Site ${loc}` : loc;
        locationSelect.appendChild(option);
    });
}

function createRatingButtons(itemId) {
    const container = document.createElement('div');
    container.className = 'rating-buttons';
    
    const passBtn = document.createElement('button');
    passBtn.type = 'button';
    passBtn.className = 'rating-btn pass';
    passBtn.textContent = '✓';
    passBtn.dataset.rating = 'pass';
    passBtn.title = 'Pass';
    passBtn.addEventListener('click', () => selectRating(itemId, 'pass', passBtn, needsWorkBtn, failBtn));
    
    const needsWorkBtn = document.createElement('button');
    needsWorkBtn.type = 'button';
    needsWorkBtn.className = 'rating-btn needs-work';
    needsWorkBtn.textContent = '!';
    needsWorkBtn.dataset.rating = 'needs-work';
    needsWorkBtn.title = 'Needs Work';
    needsWorkBtn.addEventListener('click', () => selectRating(itemId, 'needs-work', passBtn, needsWorkBtn, failBtn));
    
    const failBtn = document.createElement('button');
    failBtn.type = 'button';
    failBtn.className = 'rating-btn fail';
    failBtn.textContent = '✗';
    failBtn.dataset.rating = 'fail';
    failBtn.title = 'Fail';
    failBtn.addEventListener('click', () => selectRating(itemId, 'fail', passBtn, needsWorkBtn, failBtn));
    
    container.appendChild(passBtn);
    container.appendChild(needsWorkBtn);
    container.appendChild(failBtn);
    
    return container;
}

function selectRating(itemId, rating, passBtn, needsWorkBtn, failBtn) {
    // Remove all selected classes
    passBtn.classList.remove('selected');
    needsWorkBtn.classList.remove('selected');
    failBtn.classList.remove('selected');
    
    // Add selected class to chosen button
    if (rating === 'pass') {
        passBtn.classList.add('selected');
    } else if (rating === 'needs-work') {
        needsWorkBtn.classList.add('selected');
    } else if (rating === 'fail') {
        failBtn.classList.add('selected');
    }
    
    // Store rating in data attribute
    const itemElement = document.getElementById(itemId);
    if (itemElement) {
        itemElement.dataset.rating = rating;
    }
}

function renderAuditItems(items, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    items.forEach((item, index) => {
        const itemId = `${containerId}_${index}`;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'audit-item';
        itemDiv.id = itemId;
        itemDiv.dataset.rating = '';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.textContent = item.name;
        
        const criteriaDiv = document.createElement('div');
        criteriaDiv.className = 'item-criteria';
        criteriaDiv.textContent = item.criteria || '';
        
        infoDiv.appendChild(nameDiv);
        if (item.criteria) {
            infoDiv.appendChild(criteriaDiv);
        }
        
        const ratingButtons = createRatingButtons(itemId);
        
        itemDiv.appendChild(infoDiv);
        itemDiv.appendChild(ratingButtons);
        container.appendChild(itemDiv);
    });
}

function collectSectionRatings(containerId) {
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll('.audit-item');
    const ratings = {};
    
    items.forEach((item, index) => {
        const rating = item.dataset.rating || null;
        if (rating && rating !== '') {
            ratings[index] = rating;
        }
    });
    
    return Object.keys(ratings).length > 0 ? ratings : null;
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
    const auditForm = document.getElementById('auditForm');
    
    auditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const location = document.getElementById('location').value;
        if (!location) {
            showToast('Please select a site location', true);
            return;
        }
        
        // Collect all data
        const initialObservations = document.getElementById('initialObservations').value;
        const primarySection = collectSectionRatings('primaryItems');
        const secondarySection = collectSectionRatings('secondaryItems');
        const prioritySection = collectSectionRatings('priorityItems');
        const finalThoughts = collectSectionRatings('finalThoughtsItems');
        
        const sectionComments = {
            initial: document.getElementById('initialComments').value || null,
            primary: document.getElementById('primaryComments').value || null,
            secondary: document.getElementById('secondaryComments').value || null,
            priority: document.getElementById('priorityComments').value || null,
            finalThoughts: document.getElementById('finalThoughtsComments').value || null
        };
        
        const explanation = document.getElementById('explanation').value || null;
        
        try {
            await submitAudit({
                location: typeof location === 'number' ? location.toString() : location,
                initial_observations: initialObservations || null,
                primary_section: primarySection,
                secondary_section: secondarySection,
                priority_section: prioritySection,
                final_thoughts: finalThoughts,
                section_comments: sectionComments,
                explanation: explanation,
                submitted_by: currentUser ? currentUser.full_name : null,
                user_id: currentUser ? currentUser.id : null
            });
            
            showToast('Audit submitted successfully!');
            
            // Reset form
            auditForm.reset();
            
            // Clear all ratings
            document.querySelectorAll('.audit-item').forEach(item => {
                item.dataset.rating = '';
                item.querySelectorAll('.rating-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
            });
            
        } catch (error) {
            showToast('Error submitting audit. Please try again.', true);
        }
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
    populateLocationDropdown();
    
    // Render all audit sections
    renderAuditItems(CONFIG.primaryItems, 'primaryItems');
    renderAuditItems(CONFIG.secondaryItems, 'secondaryItems');
    renderAuditItems(CONFIG.priorityItems, 'priorityItems');
    renderAuditItems(CONFIG.finalThoughtsItems, 'finalThoughtsItems');
    
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
