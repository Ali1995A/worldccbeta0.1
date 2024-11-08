class ThemeManager {
    constructor() {
        this.themes = {
            dark: {
                name: 'dark-theme',
                icon: '🌙'
            },
            light: {
                name: 'light-theme',
                icon: '☀️'
            }
        };
        this.currentTheme = 'dark'; // 默认深色主题
        this.loadPreferences();
        this.initThemeToggle();
    }

    loadPreferences() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
        }
        this.applyTheme();
    }

    savePreferences() {
        localStorage.setItem('theme', this.currentTheme);
    }

    applyTheme() {
        // 移除所有主题类
        Object.values(this.themes).forEach(theme => {
            document.body.classList.remove(theme.name);
        });
        
        // 应用当前主题
        document.body.classList.add(this.themes[this.currentTheme].name);
        
        // 更新主题切换按钮图标
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.textContent = this.themes[this.currentTheme].icon;
        
        // 调整星空背景透明度
        const canvas = document.getElementById('starfield');
        canvas.style.opacity = this.currentTheme === 'dark' ? '1' : '0.3';
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.savePreferences();
    }

    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => this.toggleTheme());
    }
}

// 初始化主题管理器
const themeManager = new ThemeManager(); 
