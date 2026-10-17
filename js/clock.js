const DEFAULT_TIMEZONES = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];

// Older browsers may support timezone formatting without supportedValuesOf().
// This list contains identifiers only; the browser still supplies current rules.
const FALLBACK_TIMEZONES = [
    'UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
    'America/Vancouver', 'America/Phoenix', 'America/Denver', 'America/Chicago',
    'America/Mexico_City', 'America/New_York', 'America/Toronto', 'America/Bogota',
    'America/Lima', 'America/Santiago', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Atlantic/Reykjavik', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Rome', 'Europe/Madrid', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Moscow',
    'Africa/Casablanca', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
    'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Tehran', 'Asia/Karachi',
    'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Almaty', 'Asia/Yangon',
    'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Hong_Kong',
    'Asia/Taipei', 'Asia/Manila', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Perth',
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Sydney',
    'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Fiji', 'Pacific/Apia'
];

class WorldClock {
    constructor() {
        this.timeFormatters = new Map();
        this.loadPreferences();
        this.initTimezoneSelectors();
        this.startClock();
    }

    isValidTimezone(timezone) {
        if (typeof timezone !== 'string' || !timezone) return false;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: timezone });
            return true;
        } catch {
            return false;
        }
    }

    loadPreferences() {
        let preferences = {};
        try {
            const saved = JSON.parse(localStorage.getItem('clockPreferences') || '{}');
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                preferences = saved;
            }
        } catch {
            // Corrupt or unavailable storage must not prevent the clocks starting.
        }
        this.is24Hour = typeof preferences.is24Hour === 'boolean' ? preferences.is24Hour : true;
        const savedTimezones = Array.isArray(preferences.timezones) ? preferences.timezones : [];
        this.selectedTimezones = DEFAULT_TIMEZONES.map((fallback, index) =>
            this.isValidTimezone(savedTimezones[index]) ? savedTimezones[index] : fallback
        );
        document.getElementById('formatToggle').textContent = this.is24Hour ? '24H' : '12H';
    }

    savePreferences() {
        const preferences = {
            is24Hour: this.is24Hour,
            timezones: Array.from(document.querySelectorAll('.timezone-select'))
                .map(select => select.value)
        };
        try {
            localStorage.setItem('clockPreferences', JSON.stringify(preferences));
        } catch {
            // Controls remain usable if storage is blocked or its quota is full.
        }
    }

    getTimezones() {
        let timezones = FALLBACK_TIMEZONES;
        try {
            if (typeof Intl.supportedValuesOf === 'function') {
                timezones = Intl.supportedValuesOf('timeZone');
            }
        } catch {
            // Some older Intl implementations cannot enumerate timezone names.
        }
        // Keep valid saved aliases even if the browser lists only canonical names.
        return [...new Set([...timezones, 'UTC', ...DEFAULT_TIMEZONES, ...this.selectedTimezones])]
            .filter(timezone => this.isValidTimezone(timezone))
            .sort();
    }

    initTimezoneSelectors() {
        const timezones = this.getTimezones();
        document.querySelectorAll('.timezone-select').forEach((select, index) => {
            timezones.forEach(timezone => {
                const option = document.createElement('option');
                option.value = timezone;
                option.textContent = timezone.replace(/_/g, ' ');
                select.appendChild(option);
            });
            select.value = this.selectedTimezones[index];
            select.setAttribute('aria-label', `World clock ${index + 1} timezone`);
            select.addEventListener('change', () => {
                this.updateWorldClocks();
                this.savePreferences();
            });
        });
    }

    formatTime(now, timezone) {
        const key = `${this.is24Hour}:${timezone || 'local'}`;
        if (!this.timeFormatters.has(key)) {
            this.timeFormatters.set(key, new Intl.DateTimeFormat('en-US', {
                ...(timezone ? { timeZone: timezone } : {}),
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hourCycle: this.is24Hour ? 'h23' : 'h12'
            }));
        }
        return this.timeFormatters.get(key).format(now);
    }

    updateMainClock(now = new Date()) {
        // Intl formatters capture the device timezone when constructed. Refresh
        // local formatters if the user changes it while this page stays open.
        const localTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (this.localTimezone !== localTimezone) {
            this.localTimezone = localTimezone;
            this.timeFormatters.delete('true:local');
            this.timeFormatters.delete('false:local');
            this.dateFormatter = new Intl.DateTimeFormat('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        }
        document.getElementById('mainTime').textContent = this.formatTime(now);
        document.getElementById('mainDate').textContent = this.dateFormatter.format(now);
    }

    updateWorldClocks(now = new Date()) {
        const worldTimes = document.querySelectorAll('.world-time');
        document.querySelectorAll('.timezone-select').forEach((select, index) => {
            worldTimes[index].textContent = this.formatTime(now, select.value);
        });
    }

    updateClocks() {
        const now = new Date();
        this.updateMainClock(now);
        this.updateWorldClocks(now);
    }

    startClock() {
        this.updateClocks();
        setInterval(() => this.updateClocks(), 1000);
    }
}

const worldClock = new WorldClock();

document.getElementById('formatToggle').addEventListener('click', () => {
    worldClock.is24Hour = !worldClock.is24Hour;
    document.getElementById('formatToggle').textContent = worldClock.is24Hour ? '24H' : '12H';
    worldClock.updateClocks();
    worldClock.savePreferences();
});

document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});
