// Staffing, Leadership & Culture Notes App JavaScript

// Check authentication
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

// Site locations
const locations = Array.from({ length: 31 }, (_, i) => `Site #${i + 1}`);

// Populate locations dropdown
const locationSelect = document.getElementById('location');
locations.forEach(loc => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    locationSelect.appendChild(option);
});

// Star rating handlers
function setupStarRating(ratingContainerId, valueInputId, valueDisplayId, labels) {
    const container = document.getElementById(ratingContainerId);
    const valueInput = document.getElementById(valueInputId);
    const valueDisplay = document.getElementById(valueDisplayId);
    const stars = container.querySelectorAll('.star');
    
    let currentValue = 0;
    
    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            currentValue = index + 1;
            valueInput.value = currentValue;
            
            stars.forEach((s, i) => {
                if (i < currentValue) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            if (valueDisplay) {
                valueDisplay.textContent = labels ? labels[currentValue - 1] : `(${currentValue}/5)`;
            }
        });
        
        star.addEventListener('mouseenter', () => {
            stars.forEach((s, i) => {
                if (i <= index) {
                    s.style.color = 'var(--accent-yellow)';
                }
            });
        });
        
        star.addEventListener('mouseleave', () => {
            stars.forEach((s, i) => {
                if (i >= currentValue) {
                    s.style.color = 'var(--text-muted)';
                }
            });
        });
    });
}

// Setup star ratings
setupStarRating('skillLevelRating', 'skillLevel', 'skillLevelValue', [
    '1 = Low skill',
    '2',
    '3',
    '4',
    '5 = Highly skilled'
]);

setupStarRating('gmPerformanceRating', 'gmPerformance', 'gmPerformanceValue', [
    '1 = Poor',
    '2',
    '3',
    '4',
    '5 = Excellent'
]);

setupStarRating('customerInteractionsRating', 'customerInteractions', 'customerInteractionsValue', [
    '1 = Poor',
    '2',
    '3',
    '4',
    '5 = Excellent'
]);

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

// Show toast notification
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

// Get selected tags
function getSelectedTags(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

// Form submission
document.getElementById('evaluationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    btnText.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        // Collect all form data
        const formData = {
            location: document.getElementById('location').value,
            
            // Section 1
            staffing_levels: document.getElementById('staffingLevels').value,
            skill_level: document.getElementById('skillLevel').value,
            staffing_concerns: getSelectedTags('staffingConcerns'),
            high_potential_employees: document.getElementById('highPotentialEmployees').value,
            employees_needing_coaching: document.getElementById('employeesNeedingCoaching').value,
            staffing_summary: document.getElementById('staffingSummary').value,
            
            // Section 2
            leadership_presence: document.getElementById('leadershipPresence').value,
            leadership_behaviors: getSelectedTags('leadershipBehaviors'),
            gm_performance: document.getElementById('gmPerformance').value,
            gm_notes: document.getElementById('gmNotes').value,
            leadership_follow_up: document.getElementById('leadershipFollowUp').value,
            potential_leaders: document.getElementById('potentialLeaders').value,
            
            // Section 3
            team_morale: document.getElementById('teamMorale').value,
            culture_observed: getSelectedTags('cultureObserved'),
            customer_interactions: document.getElementById('customerInteractions').value,
            customer_interactions_notes: document.getElementById('customerInteractionsNotes').value,
            recognition_moments: document.getElementById('recognitionMoments').value,
            culture_issues: document.getElementById('cultureIssues').value,
            overall_culture: document.getElementById('overallCulture').value,
            
            // Section 4
            key_takeaways: document.getElementById('keyTakeaways').value,
            follow_up_actions: getSelectedTags('followUpActions'),
            follow_up_instructions: document.getElementById('followUpInstructions').value,
            
            submitted_by: user.full_name,
            submitted_at: new Date().toISOString()
        };
        
        // Save to database
        const response = await fetch('/.netlify/functions/staffing-culture-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to save notes');
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to save notes');
        
        showToast('Notes saved successfully!');
        
        // Reset form
        e.target.reset();
        
        // Reset star ratings
        document.querySelectorAll('.star-rating .star').forEach(star => {
            star.classList.remove('active');
        });
        document.querySelectorAll('.tag-option').forEach(option => {
            option.classList.remove('selected');
        });
        
    } catch (error) {
        console.error('Error saving notes:', error);
        showToast('Failed to save notes. Please try again.', 'error');
    } finally {
        btnText.textContent = originalText;
        submitBtn.disabled = false;
    }
});



