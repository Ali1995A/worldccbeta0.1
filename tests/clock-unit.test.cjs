process.env.TZ = 'UTC';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// Small DOM/storage adapters keep the actual application classes, Intl and Date
// under test without requiring a browser. Rendering has a separate Playwright suite.
function loadApp({ preferences, theme, brokenStorage = false, noSupportedValues = false, instant = '2026-07-15T12:34:56Z' } = {}) {
    const elements = new Map();
    function element(select = false) {
        const node = { textContent: '', style: {}, children: [], listeners: {}, appendChild(child) { this.children.push(child); }, addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute() {} };
        if (select) {
            let selected = '';
            Object.defineProperty(node, 'value', { get() { return selected; }, set(value) { selected = node.children.some(option => option.value === value) ? value : ''; } });
        }
        return node;
    }
    for (const id of ['mainTime', 'mainDate', 'formatToggle', 'themeToggle', 'starfield']) elements.set(id, element());
    const selects = Array.from({ length: 3 }, () => element(true));
    const times = Array.from({ length: 3 }, () => element());
    const classes = new Set(['dark-theme']);
    const data = new Map([['clockPreferences', preferences], ['theme', theme]]);
    const document = {
        body: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
        getElementById: id => elements.get(id),
        querySelectorAll: selector => selector === '.timezone-select' ? selects : times,
        createElement: () => element(),
        addEventListener() {},
    };
    const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return new Date(instant).getTime(); } };
    const context = vm.createContext({
        Date: FakeDate, Intl: { DateTimeFormat: Intl.DateTimeFormat, supportedValuesOf: noSupportedValues ? undefined : Intl.supportedValuesOf },
        document, console, setInterval() {},
        localStorage: {
            getItem(key) { if (brokenStorage) throw Error('Storage denied'); return data.get(key) ?? null; },
            setItem(key, value) { if (brokenStorage) throw Error('Storage full'); data.set(key, value); },
        },
    });
    // Used only to demonstrate regressions on the original revision, before its
    // original CDN dependencies are removed. Normal test runs need no network.
    if (process.env.LEGACY_MOMENT_DIR) {
        for (const file of ['moment.min.js', 'moment-timezone.min.js']) vm.runInContext(fs.readFileSync(path.join(process.env.LEGACY_MOMENT_DIR, file), 'utf8'), context);
    }
    for (const file of ['js/clock.js', 'js/theme.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    return { elements, selects, times, classes, data, context };
}

for (const [zone, expected] of [['Asia/Almaty', '17:34:56'], ['Africa/Cairo', '15:34:56'], ['America/Mexico_City', '06:34:56']]) {
    test(`current timezone rules: ${zone}`, () => {
        const app = loadApp({ preferences: JSON.stringify({ timezones: [zone, 'UTC', 'Asia/Tokyo'] }) });
        assert.equal(app.times[0].textContent, expected);
    });
}

for (const [instant, zone, expected] of [
    ['2026-03-08T06:59:59Z', 'America/New_York', '01:59:59'],
    ['2026-03-08T07:00:00Z', 'America/New_York', '03:00:00'],
    ['2026-11-01T05:59:59Z', 'America/New_York', '01:59:59'],
    ['2026-11-01T06:00:00Z', 'America/New_York', '01:00:00'],
    ['2026-04-23T21:59:59Z', 'Africa/Cairo', '23:59:59'],
    ['2026-04-23T22:00:00Z', 'Africa/Cairo', '01:00:00'],
    ['2026-10-29T20:59:59Z', 'Africa/Cairo', '23:59:59'],
    ['2026-10-29T21:00:00Z', 'Africa/Cairo', '23:00:00'],
    ['2026-01-01T00:00:00Z', 'UTC', '00:00:00'],
]) {
    test(`${zone} at ${instant}`, () => {
        const app = loadApp({ instant, preferences: JSON.stringify({ timezones: [zone, 'UTC', 'Asia/Tokyo'] }) });
        assert.equal(app.times[0].textContent, expected);
    });
}

for (const preferences of ['null', '{oops', '[]', '42', '"text"', '{"is24Hour":"false","timezones":"UTC"}', '{"timezones":[null,33,{}]}', '{"timezones":["Invalid/Zone","",false]}']) {
    test(`invalid preferences recover: ${preferences}`, () => {
        const app = loadApp({ preferences });
        assert.equal(app.elements.get('mainTime').textContent, '12:34:56');
        assert.deepEqual(app.selects.map(node => node.value), ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
    });
}

test('valid values and aliases are preserved; missing entries get defaults', () => {
    const app = loadApp({ preferences: JSON.stringify({ is24Hour: false, timezones: ['US/Eastern', 'Asia/Kathmandu'] }) });
    assert.deepEqual(app.selects.map(node => node.value), ['US/Eastern', 'Asia/Kathmandu', 'Asia/Tokyo']);
    assert.deepEqual(app.times.map(node => node.textContent), ['08:34:56 AM', '06:19:56 PM', '09:34:56 PM']);
});

test('fallback selectors work without Intl.supportedValuesOf', () => {
    const app = loadApp({ noSupportedValues: true });
    const zones = app.selects[0].children.map(option => option.value);
    for (const zone of ['UTC', 'Asia/Almaty', 'Africa/Cairo', 'America/Mexico_City', 'Asia/Shanghai', 'Australia/Sydney']) assert.ok(zones.includes(zone));
    app.selects[0].value = 'Asia/Almaty';
    app.selects[0].listeners.change();
    assert.equal(app.times[0].textContent, '17:34:56');
});

for (const theme of ['unknown', 'toString', '__proto__', '']) {
    test(`invalid theme defaults safely: ${theme}`, () => {
        const app = loadApp({ theme });
        assert.deepEqual([...app.classes], ['dark-theme']);
        app.elements.get('themeToggle').listeners.click();
        assert.deepEqual([...app.classes], ['light-theme']);
    });
}

test('storage failures do not stop clock or controls', () => {
    const app = loadApp({ brokenStorage: true });
    assert.equal(app.elements.get('mainTime').textContent, '12:34:56');
    app.elements.get('formatToggle').listeners.click();
    assert.equal(app.elements.get('mainTime').textContent, '12:34:56 PM');
    app.selects[0].value = 'Asia/Almaty';
    app.selects[0].listeners.change();
    assert.equal(app.times[0].textContent, '05:34:56 PM');
    app.elements.get('themeToggle').listeners.click();
    assert.deepEqual([...app.classes], ['light-theme']);
});

test('controls update immediately and save compatible preference keys', () => {
    const app = loadApp();
    app.elements.get('formatToggle').listeners.click();
    assert.equal(app.elements.get('mainTime').textContent, '12:34:56 PM');
    assert.equal(app.times[0].textContent, '08:34:56 AM');
    app.selects[0].value = 'Asia/Almaty';
    app.selects[0].listeners.change();
    app.elements.get('themeToggle').listeners.click();
    assert.deepEqual(JSON.parse(app.data.get('clockPreferences')), { is24Hour: false, timezones: ['Asia/Almaty', 'Europe/London', 'Asia/Tokyo'] });
    assert.equal(app.data.get('theme'), 'light');
});

test('no remote script dependencies and narrowly scoped security headers', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<script[^>]*src=["']https?:/);
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const headers = Object.fromEntries(config.headers.find(rule => rule.source === '/(.*)').headers.map(header => [header.key.toLowerCase(), header.value]));
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
    const policy = headers['content-security-policy'];
    assert.match(policy, /default-src 'self'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /script-src 'self' https:\/\/static\.cloudflareinsights\.com/);
    assert.match(policy, /connect-src 'self';/);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    assert.doesNotMatch(policy.match(/script-src[^;]*/)[0], /\*/);
});

test('local clock and calendar follow device timezone changes without reloading', () => {
    const app = loadApp({ instant: '2026-07-15T02:00:00Z' });
    assert.equal(app.elements.get('mainTime').textContent, '02:00:00');
    assert.equal(app.elements.get('mainDate').textContent, 'Wednesday, July 15, 2026');
    const worldTimes = app.times.map(node => node.textContent);
    try {
        process.env.TZ = 'America/New_York';
        vm.runInContext('worldClock.updateClocks()', app.context);
        assert.equal(app.elements.get('mainTime').textContent, '22:00:00');
        assert.equal(app.elements.get('mainDate').textContent, 'Tuesday, July 14, 2026');
        assert.deepEqual(app.times.map(node => node.textContent), worldTimes);
        app.elements.get('formatToggle').listeners.click();
        assert.equal(app.elements.get('mainTime').textContent, '10:00:00 PM');
        process.env.TZ = 'UTC';
        vm.runInContext('worldClock.updateClocks()', app.context);
        assert.equal(app.elements.get('mainTime').textContent, '02:00:00 AM');
        assert.equal(app.elements.get('mainDate').textContent, 'Wednesday, July 15, 2026');
    } finally {
        process.env.TZ = 'UTC';
    }
});
