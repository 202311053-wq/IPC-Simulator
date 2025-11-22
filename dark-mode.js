// ============================================================================
// DARK MODE
// ============================================================================

class DarkModeManager {
    constructor() {
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.toggle = document.getElementById('dark-mode-toggle');
        
        this.init();
    }

    init() {
        if (this.isDarkMode) {
            this.enable();
        } else {
            this.disable();
        }

        this.toggle.addEventListener('click', () => {
            this.isDarkMode ? this.disable() : this.enable();
        });
    }

    enable() {
        document.body.classList.add('dark-mode');
        this.isDarkMode = true;
        localStorage.setItem('darkMode', 'true');
        this.toggle.textContent = '☀️ Light Mode';
    }

    disable() {
        document.body.classList.remove('dark-mode');
        this.isDarkMode = false;
        localStorage.setItem('darkMode', 'false');
        this.toggle.textContent = '🌙 Dark Mode';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DarkModeManager();
});
