class ThemeManager {
    constructor() {
        this.isDark = true;
        this.loadPreferences();
        this.initThemeToggle();
    }

    loadPreferences() {
        const preferences = JSON.parse(localStorage.getItem('themePreferences') || '{}');
        this.isDark = preferences.isDark ?? true;
        this.applyTheme();
    }

    savePreferences() {
        const preferences = {
            isDark: this.isDark
        };
        localStorage.setItem('themePreferences', JSON.stringify(preferences));
    }

    applyTheme() {
        document.body.classList.toggle('dark-theme', this.isDark);
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        this.applyTheme();
        this.savePreferences();
    }

    initThemeToggle() {
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });
    }
}

const themeManager = new ThemeManager(); 
