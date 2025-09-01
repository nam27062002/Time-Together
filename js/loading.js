// ===================== Loading Screen Manager =====================
// Shared loading functionality for the entire project

class LoadingManager {
  constructor() {
    this.loadingScreen = null;
    this.isVisible = false;
    // Don't initialize immediately, wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initLoadingScreen());
    } else {
      this.initLoadingScreen();
    }
  }

  // Create loading screen HTML structure
  initLoadingScreen() {
    // Check if document.body exists
    if (!document.body) {
      console.warn('Document body not ready, retrying...');
      setTimeout(() => this.initLoadingScreen(), 100);
      return;
    }

    // Remove existing loading screen if any
    const existingScreen = document.querySelector('.loading-screen');
    if (existingScreen) {
      existingScreen.remove();
    }

    // Create new loading screen
    const loadingHTML = `
      <div class="loading-screen">
        <div class="loading-container">
          <div class="loading-hearts">
            <div class="heart heart-1">💖</div>
            <div class="heart heart-2">💖</div>
            <div class="heart heart-3">💖</div>
          </div>
          <div class="loading-text">Time Together</div>
        </div>
      </div>
    `;

    // Add to document
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    this.loadingScreen = document.querySelector('.loading-screen');
  }

  // Show loading screen
  show() {
    if (!this.loadingScreen) {
      this.initLoadingScreen();
    }
    
    this.loadingScreen.classList.remove('fade-out');
    this.loadingScreen.style.display = 'flex';
    this.isVisible = true;
  }

  // Hide loading screen
  hide() {
    if (!this.loadingScreen) return;
    
    this.loadingScreen.classList.add('fade-out');
    this.isVisible = false;
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (this.loadingScreen && !this.isVisible) {
        this.loadingScreen.remove();
        this.loadingScreen = null;
      }
    }, 800);
  }

  // Show loading for minimum duration
  showWithMinDuration(minDuration = 1000) {
    this.show();
    const startTime = Date.now();
    
    return {
      hide: () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDuration - elapsed);
        
        setTimeout(() => {
          this.hide();
        }, remaining);
      }
    };
  }
}

// Create global loading manager instance when DOM is ready
let globalLoadingManager = null;

// Initialize after DOM is ready
function initializeGlobalLoadingManager() {
  if (!globalLoadingManager) {
    globalLoadingManager = new LoadingManager();
    window.LoadingManager = globalLoadingManager;
  }
}

// Convenience global functions
window.showLoading = () => {
  if (!globalLoadingManager) initializeGlobalLoadingManager();
  return globalLoadingManager.show();
};

window.hideLoading = () => {
  if (!globalLoadingManager) initializeGlobalLoadingManager();
  return globalLoadingManager.hide();
};

window.showLoadingWithMinDuration = (duration) => {
  if (!globalLoadingManager) initializeGlobalLoadingManager();
  return globalLoadingManager.showWithMinDuration(duration);
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGlobalLoadingManager);
} else {
  initializeGlobalLoadingManager();
}