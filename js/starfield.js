class Star {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * 2;
        this.brightness = Math.random();
        this.speed = Math.random() * 0.05;
    }

    update() {
        this.brightness += Math.random() * 0.2 - 0.1;
        this.brightness = Math.max(0, Math.min(1, this.brightness));
        
        if (Math.random() < 0.001) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let stars = [];

function initStarfield() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array(200).fill().map(() => new Star(canvas));
}

function animateStars() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    stars.forEach(star => {
        star.update();
        star.draw(ctx);
    });
    
    requestAnimationFrame(animateStars);
}

initStarfield();
animateStars();
window.addEventListener('resize', initStarfield);
