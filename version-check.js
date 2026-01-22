// ===== Version Check Utility =====
// This file checks if the user's cached version is outdated
// and shows a banner prompting them to update

const VERSION_CHECK_API = '/.netlify/functions/app-version';

// Check version and show banner if outdated
async function checkVersionAndShowBanner() {
    try {
        // Get stored version from localStorage
        const storedVersion = parseInt(localStorage.getItem('mightyops_app_version') || '0');
        
        // Fetch current version from server
        const response = await fetch(`${VERSION_CHECK_API}?t=${Date.now()}`);
        const result = await response.json();
        
        if (!result.success) {
            return; // Silently fail if version check fails
        }
        
        const currentVersion = parseInt(result.version);
        
        // If stored version is older than current version, show banner
        if (storedVersion > 0 && storedVersion < currentVersion) {
            showOutdatedBanner();
        }
    } catch (error) {
        // Silently fail - don't interrupt user experience
        console.log('[Version Check] Error checking version:', error);
    }
}

// Show the outdated version banner
function showOutdatedBanner() {
    // Don't show if banner already exists
    if (document.getElementById('outdatedVersionBanner')) {
        return;
    }
    
    const banner = document.createElement('div');
    banner.id = 'outdatedVersionBanner';
    banner.innerHTML = `
        <div class="outdated-banner-content">
            <span class="outdated-banner-text">This version is outdated</span>
            <button id="updateNowBtn" class="outdated-banner-btn">Update Now</button>
        </div>
    `;
    
    // Add styles
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10000;
        background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
        color: white;
        padding: 14px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .outdated-banner-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
        }
        
        .outdated-banner-text {
            font-size: 15px;
            font-weight: 600;
            flex: 1;
        }
        
        .outdated-banner-btn {
            background: rgba(255, 255, 255, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.4);
            color: white;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
        }
        
        .outdated-banner-btn:hover {
            background: rgba(255, 255, 255, 0.35);
            border-color: rgba(255, 255, 255, 0.5);
            transform: translateY(-1px);
        }
        
        .outdated-banner-btn:active {
            transform: translateY(0);
        }
        
        /* Add padding to body when banner is shown */
        body.has-outdated-banner {
            padding-top: 60px;
        }
        
        body.has-outdated-banner .main-content,
        body.has-outdated-banner .container,
        body.has-outdated-banner .home-container {
            padding-top: 0;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(banner);
    document.body.classList.add('has-outdated-banner');
    
    // Handle Update Now button click
    document.getElementById('updateNowBtn').addEventListener('click', async () => {
        await clearCacheAndRedirect();
    });
}

// Clear all cache and redirect to login
async function clearCacheAndRedirect() {
    try {
        // Clear localStorage (except version to prevent immediate re-show)
        const version = localStorage.getItem('mightyops_app_version');
        localStorage.clear();
        localStorage.setItem('mightyops_app_version', version); // Keep old version temporarily
        
        // Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }
        
        // Unregister service worker
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(
                registrations.map(registration => registration.unregister())
            );
        }
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Redirect to login
        window.location.href = 'login.html';
    } catch (error) {
        console.error('[Version Check] Error clearing cache:', error);
        // Still redirect even if cache clearing fails
        window.location.href = 'login.html';
    }
}

// Run version check on page load (with a small delay to not block initial render)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkVersionAndShowBanner, 1000);
    });
} else {
    setTimeout(checkVersionAndShowBanner, 1000);
}
