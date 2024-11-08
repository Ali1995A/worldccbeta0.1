class WorldClock {
    constructor() {
        this.is24Hour = true;
        this.loadPreferences();
        this.initTimezoneSelectors();
        this.startClock();
    }

    loadPreferences() {
        const preferences = JSON.parse(localStorage.getItem('clockPreferences') || '{}');
        this.is24Hour = preferences.is24Hour ?? true;
        this.selectedTimezones = preferences.timezones || [
            'America/New_York',
            'Europe/London',
            'Asia/Tokyo'
        ];
        
        document.getElementById('formatToggle').textContent = 
            this.is24Hour ? '24H' : '12H';
    }

    savePreferences() {
        const preferences = {
            is24Hour: this.is24Hour,
            timezones: Array.from(document.querySelectorAll('.timezone-select'))
                           .map(select => select.value)
        };
        localStorage.setItem('clockPreferences', JSON.stringify(preferences));
    }

    initTimezoneSelectors() {
        const timezones = moment.tz.names();
        const selects = document.querySelectorAll('.timezone-select');
        
        selects.forEach((select, index) => {
            timezones.forEach(timezone => {
                const option = document.createElement('option');
                option.value = timezone;
                option.textContent = timezone.replace(/_/g, ' ');
                select.appendChild(option);
            });
            
            select.value = this.selectedTimezones[index];
            select.addEventListener('change', () => {
                this.updateWorldClocks();
                this.savePreferences();
            });
        });
    }

    updateMainClock() {
        const now = new Date();
        const timeFormat = this.is24Hour ? 'HH:mm:ss' : 'hh:mm:ss A';
        
        document.getElementById('mainTime').textContent = 
            moment().format(timeFormat);
        document.getElementById('mainDate').textContent = 
            now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
    }

    updateWorldClocks() {
        const worldTimes = document.querySelectorAll('.world-time');
        const selects = document.querySelectorAll('.timezone-select');
        const timeFormat = this.is24Hour ? 'HH:mm:ss' : 'hh:mm:ss A';
        
        selects.forEach((select, index) => {
            const timezone = select.value;
            const time = moment().tz(timezone).format(timeFormat);
            worldTimes[index].textContent = time;
        });
    }

    startClock() {
        this.updateMainClock();
        this.updateWorldClocks();
        
        setInterval(() => {
            this.updateMainClock();
            this.updateWorldClocks();
        }, 1000);
    }
}

const worldClock = new WorldClock();

document.getElementById('formatToggle').addEventListener('click', () => {
    worldClock.is24Hour = !worldClock.is24Hour;
    document.getElementById('formatToggle').textContent = 
        worldClock.is24Hour ? '24H' : '12H';
    worldClock.savePreferences();
});

document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}); 
