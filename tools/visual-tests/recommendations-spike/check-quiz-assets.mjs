// Inspect HTTP output and assets from the disposable installed packages.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const origin = 'http://127.0.0.1:9445';
const f = await (await fetch(origin + '/?wconvert_quiz_fixture=1')).json();
const page = await fetch(f.url); assert.equal(page.status, 200);
const doc = new JSDOM(await page.text(), { url: f.url }).window.document;
const tag = doc.getElementById('wconvert-payload'); assert.ok(tag);
const entries = JSON.parse(tag.textContent); const quiz = entries.find(entry => entry.id === f.id); assert.ok(quiz);
assert.ok(quiz.commerce_revision); assert.notEqual(quiz.server_conversion, true);
assert.ok(quiz.template.tree.steps.some(screen => screen.results?.some(result => result.product_action === 'add_to_cart')));
assert.ok(tag.getAttribute('data-commerce-quiz')); assert.ok(tag.getAttribute('data-commerce-add'));
const urls = [...doc.querySelectorAll('script[src],link[href]')].map(node => node.src || node.href).filter(url => url.includes('/plugins/wconvert'));
urls.push(new URL(tag.getAttribute('data-commerce-runtime'), f.url).href);
const hash = value => createHash('sha256').update(value).digest('hex');
for (const url of new Set(urls)) {
  const response = await fetch(url); assert.equal(response.status, 200, url);
  const body = Buffer.from(await response.arrayBuffer()); assert.ok(body.length > 100, url);
  const relative = new URL(url).pathname.split('/plugins/')[1];
  assert.ok(relative && !relative.includes('..'));
  assert.equal(hash(body), hash(readFileSync('/tmp/wconvert-quiz-installed/' + relative)), url);
}
console.log(`PASS published quiz keeps quiz conversion, retains cart intent and serves ${new Set(urls).size} matching package assets`);
