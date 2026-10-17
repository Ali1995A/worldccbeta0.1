const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
const block = selector => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';
  return css.slice(start + selector.length + 2, css.indexOf('}', start));
};
const declaration = (selector, property) => {
  const match = block(selector).match(new RegExp(`(?:^|[;\\n])\\s*${property}\\s*:\\s*([^;]+);`));
  return match && match[1].trim();
};
const checks = {
  'body permits vertical scrolling': () => assert.ok(!['hidden','clip'].includes(declaration('body','overflow-y') || declaration('body','overflow'))),
  'container can grow beyond viewport': () => {
    assert.equal(declaration('.container','height'), null);
    assert.equal(declaration('.container','min-height'),'100vh');
  },
  'container reserves clearance for settings': () => assert.equal(declaration('.container','padding'),'4.5rem 1rem'),
  'light theme defines a complete palette': () => {
    for (const property of ['--bg-color','--text-color','--select-bg','--option-bg']) assert.ok(declaration('.light-theme',property), `Missing ${property}`);
  },
  'main clock text follows theme': () => assert.equal(declaration('.main-clock .time','color'),'var(--text-color)'),
  'native dropdown options follow theme': () => assert.equal(declaration('select option','background-color'),'var(--option-bg)'),
  'light dropdown text stays opaque': () => assert.equal(declaration('.light-theme select','opacity'),'1'),
  'light canvas does not paint black backdrop': () => assert.equal(declaration('.light-theme canvas','filter'),'invert(1)'),
  'dark palette is preserved': () => {
    assert.equal(declaration('.dark-theme','--bg-color'),'#000');
    assert.equal(declaration('.dark-theme','--text-color'),'#fff');
    assert.equal(declaration('.dark-theme','--select-bg'),'rgba(255, 255, 255, 0.1)');
  }
};
// These are source-level safeguards, not a substitute for browser layout tests.
for (const [name, check] of Object.entries(checks)) test(name, check);
