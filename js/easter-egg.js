class EasterEgg {
    constructor(config) {
        this.config = config;
        this.activeElements = 0;
        this.init();
    }

    init() {
        this.startLoop();
    }

    isEasterEggTime() {
        const now = new Date();
        const hours = now.getHours();
        return hours >= this.config.startHour && hours < this.config.endHour;
    }

    getRandomValue(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    createCC() {
        // 如果已达到最大元素数量，则不创建新元素
        if (this.activeElements >= this.config.maxElements) return;

        const cc = document.createElement('div');
        cc.className = 'easter-egg';
        cc.textContent = 'CC Merry Christmas!';
        
        // 随机样式
        const size = this.getRandomValue(this.config.minSize, this.config.maxSize);
        const colorIndex = this.getRandomValue(0, this.config.colors.length - 1);
        
        cc.style.fontSize = `${size}px`;
        cc.style.color = this.config.colors[colorIndex];
        cc.style.left = `${this.getRandomValue(0, window.innerWidth - size)}px`;
        cc.style.top = `${this.getRandomValue(0, window.innerHeight - size)}px`;
        cc.style.animation = `twinkle ${this.config.animationDuration}ms ease-in-out`;

        // 添加模糊效果
        cc.style.filter = `blur(${this.getRandomValue(0, 2)}px)`;
        
        document.body.appendChild(cc);
        this.activeElements++;

        // 动画结束后移除元素
        setTimeout(() => {
            cc.remove();
            this.activeElements--;
        }, this.config.animationDuration);
    }

    startLoop() {
        setInterval(() => {
            if (this.isEasterEggTime()) {
                // 随机决定是否创建多个CC
                const count = Math.random() < 0.2 ? 2 : 1; // 20%的概率创建2个CC
                for (let i = 0; i < count; i++) {
                    this.createCC();
                }
            }
        }, this.config.interval);
    }
}

// 页面加载时启动
document.addEventListener('DOMContentLoaded', () => {
    new EasterEgg(EASTER_EGG_CONFIG);
}); 
