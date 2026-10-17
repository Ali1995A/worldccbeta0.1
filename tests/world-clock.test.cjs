const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let server, browser, origin;

before(async () => {
    const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
    server = createServer(async (req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
        try {
            const data = await readFile(file);
            for (const rule of config.headers || []) {
                for (const header of rule.headers) res.setHeader(header.key, header.value);
            }
            res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
            res.end(data);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
});

after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
});

async function openPage(t, { preferences, theme, brokenStorage = false, noSupportedValues = false, instant = '2026-07-15T12:34:56Z', viewport = { width: 1280, height: 800 } } = {}) {
    const context = await browser.newContext({ viewport, timezoneId: 'UTC' });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(new Date(instant).getTime() - 60000) });
    await page.clock.pauseAt(new Date(instant));
    await page.addInitScript(({ preferences, theme, brokenStorage, noSupportedValues }) => {
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', event => window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
        if (preferences !== undefined) localStorage.setItem('clockPreferences', preferences);
        if (theme !== undefined) localStorage.setItem('theme', theme);
        if (brokenStorage) {
            Storage.prototype.getItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
            Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
        }
        if (noSupportedValues) Object.defineProperty(Intl, 'supportedValuesOf', { value: undefined });
    }, { preferences, theme, brokenStorage, noSupportedValues });
    await page.goto(origin);
    return { page, errors };
}

async function values(page, selector) { return page.locator(selector).allTextContents(); }

for (const [timezone, expected] of [
    ['Asia/Almaty', '17:34:56'],
    ['Africa/Cairo', '15:34:56'],
    ['America/Mexico_City', '06:34:56'],
]) {
    test(`uses current timezone rules for ${timezone}`, async t => {
        const { page, errors } = await openPage(t, { preferences: JSON.stringify({ timezones: [timezone] }) });
        assert.equal(await page.locator('.world-time').first().textContent(), expected);
        assert.deepEqual(errors, []);
    });
}

for (const [instant, timezone, expected] of [
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
    test(`${timezone} formats ${instant} as ${expected}`, async t => {
        const { page, errors } = await openPage(t, { instant, preferences: JSON.stringify({ timezones: [timezone] }) });
        assert.equal(await page.locator('.world-time').first().textContent(), expected);
        assert.deepEqual(errors, []);
    });
}

for (const preferences of ['null', '{oops', '[]', '42', '"text"', '{"is24Hour":"false","timezones":"UTC"}', '{"timezones":[null,33,{}]}', '{"timezones":["Invalid/Zone","",false]}']) {
    test(`recovers from clockPreferences=${preferences}`, async t => {
        const { page, errors } = await openPage(t, { preferences });
        assert.deepEqual(errors, []);
        assert.equal(await page.locator('#mainTime').textContent(), '12:34:56');
        assert.deepEqual(await page.locator('.timezone-select').evaluateAll(nodes => nodes.map(node => node.value)), ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
        assert.equal((await values(page, '.world-time')).every(value => /^\d\d:\d\d:\d\d$/.test(value)), true);
    });
}

test('preserves valid saved timezone aliases and defaults missing entries', async t => {
    const { page, errors } = await openPage(t, { preferences: JSON.stringify({ is24Hour: false, timezones: ['US/Eastern', 'Asia/Kathmandu'] }) });
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.locator('.timezone-select').evaluateAll(nodes => nodes.map(node => node.value)), ['US/Eastern', 'Asia/Kathmandu', 'Asia/Tokyo']);
    assert.deepEqual(await values(page, '.world-time'), ['08:34:56 AM', '06:19:56 PM', '09:34:56 PM']);
});

test('timezones remain usable when Intl.supportedValuesOf is absent', async t => {
    const { page, errors } = await openPage(t, { noSupportedValues: true });
    const zones = await page.locator('.timezone-select').first().locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    for (const zone of ['UTC', 'Asia/Almaty', 'Africa/Cairo', 'America/Mexico_City', 'Asia/Shanghai', 'Australia/Sydney']) assert.ok(zones.includes(zone), `missing ${zone}`);
    await page.locator('.timezone-select').first().selectOption('Asia/Almaty');
    assert.equal(await page.locator('.world-time').first().textContent(), '17:34:56');
    assert.deepEqual(errors, []);
});

test('unknown or inherited theme names recover to dark', async t => {
    for (const theme of ['unknown', 'toString', '__proto__']) {
        const { page, errors } = await openPage(t, { theme });
        assert.deepEqual(errors, []);
        assert.equal(await page.locator('body').getAttribute('class'), 'dark-theme');
        await page.locator('#themeToggle').click();
        assert.equal(await page.locator('body').getAttribute('class'), 'light-theme');
    }
});

test('storage denial does not stop startup or controls', async t => {
    const { page, errors } = await openPage(t, { brokenStorage: true });
    assert.equal(await page.locator('#mainTime').textContent(), '12:34:56');
    await page.locator('#formatToggle').click();
    assert.equal(await page.locator('#mainTime').textContent(), '12:34:56 PM');
    await page.locator('.timezone-select').first().selectOption('Asia/Almaty');
    assert.equal(await page.locator('.world-time').first().textContent(), '05:34:56 PM');
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('body').getAttribute('class'), 'light-theme');
    assert.deepEqual(errors, []);
});

test('format and timezone controls update immediately and survive reload', async t => {
    const { page, errors } = await openPage(t);
    await page.locator('#formatToggle').click();
    assert.equal(await page.locator('#mainTime').textContent(), '12:34:56 PM');
    await page.locator('.timezone-select').first().selectOption('Asia/Almaty');
    await page.locator('#themeToggle').click();
    await page.reload();
    assert.equal(await page.locator('#formatToggle').textContent(), '12H');
    assert.equal(await page.locator('.timezone-select').first().inputValue(), 'Asia/Almaty');
    assert.equal(await page.locator('body').getAttribute('class'), 'light-theme');
    assert.deepEqual(errors, []);
});

test('security headers are configured and the app works with third parties blocked', async t => {
    const { page, errors } = await openPage(t);
    await page.route('https://**/*', route => route.abort());
    const response = await page.reload();
    const headers = response.headers();
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
    assert.equal(await page.locator('script[src^="https://"]').count(), 0);
    assert.equal(await page.locator('#mainTime').textContent(), '12:34:56');
    assert.deepEqual(errors, []);
});

for (const viewport of [{ width: 671, height: 374 }, { width: 400, height: 639 }, { width: 1280, height: 800 }]) {
    test(`all clocks and controls are reachable at ${viewport.width}x${viewport.height}`, async t => {
        const { page } = await openPage(t, { viewport });
        await page.clock.runFor(1100);
        for (const selector of ['#themeToggle', '#formatToggle', '#mainTime', '#mainDate', '.world-clock:nth-child(1)', '.world-clock:nth-child(2)', '.world-clock:nth-child(3)']) {
            const target = page.locator(selector);
            await target.scrollIntoViewIfNeeded();
            const box = await target.boundingBox();
            assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${selector} vertically clipped: ${JSON.stringify(box)}`);
            assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1, `${selector} horizontally clipped`);
        }
        const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
        assert.ok(dimensions.width <= dimensions.viewport, 'unexpected horizontal overflow');
    });
}

test('light theme changes background, clock and dropdown colors coherently', async t => {
    const { page } = await openPage(t);
    await page.locator('#themeToggle').click();
    await page.clock.runFor(1100);
    const colors = await page.evaluate(() => Object.fromEntries(['body', '#mainTime', '.timezone-select', '.timezone-select option'].map(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return [selector, { background: style.backgroundColor, color: style.color }];
    })));
    assert.notEqual(colors.body.background, 'rgb(0, 0, 0)');
    assert.notEqual(colors['#mainTime'].color, 'rgb(255, 255, 255)');
    assert.equal(colors['#mainTime'].color, colors.body.color);
    assert.notEqual(colors['.timezone-select option'].background, 'rgb(26, 26, 26)');
});

test('CC easter egg still animates and is removed under the CSP', async t => {
    const { page, errors } = await openPage(t);
    await page.clock.runFor(3000);
    assert.ok(await page.locator('.easter-egg').count() >= 1);
    assert.equal(await page.locator('.easter-egg').first().textContent(), 'CC，超可爱！');
    const style = await page.locator('.easter-egg').first().evaluate(node => ({ font: node.style.fontSize, animation: getComputedStyle(node).animationName }));
    assert.notEqual(style.font, '');
    assert.equal(style.animation, 'twinkle');
    await page.clock.runFor(2000);
    assert.equal(await page.locator('.easter-egg').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    assert.deepEqual(errors, []);
});
