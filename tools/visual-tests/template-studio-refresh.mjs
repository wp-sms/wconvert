/* global openCampaign, DATA, step, selected, dialog */
/** Browser rehearsal of the currently curated setups. No live submissions. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.WCONVERT_STUDIO_URL || 'http://127.0.0.1:9452';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local studio required');
const [batch, evidence = 'docs/reviews/commerce-refresh-2026-10-12-journeys.json'] = process.argv.slice(2);
const ids = batch ? JSON.parse(fs.readFileSync('tools/design-library/out/pilot.json')).filter(e => e.batch === batch).map(e => e.id) : [...new Set(JSON.parse(fs.readFileSync('tools/design-library/collections/source.json')).collections.flatMap(c => c.items.map(i => i.setup_id)))];
if (!ids.length) throw Error('No setups in the selected batch');
const browser = await chromium.launch();
try {
 const page = await browser.newPage();
 await page.goto(base + '/pilot.html');
 const report = await page.evaluate(async ids => {
  const report = [];
  const root = () => document.querySelector('#preview').firstElementChild.firstElementChild.shadowRoot.querySelector('.wc-root');
  for (const id of ids) {
   openCampaign(DATA.entries.find(e => e.id === id));
   const visited = [];
   for (let n = 0; n < 10; n++) {
    const content = root(), previous = step;
    visited.push(selected.tree.steps[step].id);
    const action = content.querySelector('[data-action="next"],[data-action="submit"]');
    if (!action) break;
    if (content.querySelector('input[required]')) {
     action.click();
     if (step !== previous) throw Error(id + ': required input bypassed');
    }
    for (const input of content.querySelectorAll('input,select,textarea')) {
     if (input.type === 'checkbox') input.checked = true;
     else if (input.type === 'radio') { if (!content.querySelector('input[name="' + input.name + '"]:checked')) input.checked = true; }
     else if (input.tagName === 'SELECT') input.selectedIndex = Math.min(1, input.options.length - 1);
     else if (input.type === 'email') input.value = 'review@example.com';
     else if (input.type === 'tel') input.value = '7400123456';
     else if (input.type !== 'hidden') input.value = 'Review example';
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (action.dataset.action === 'submit') {
     document.getElementById('fail-next').checked = true;
     action.click();
     if (step !== previous || !document.getElementById('simulation').textContent.includes('not confirmed')) throw Error(id + ': failed submission did not preserve this screen');
    }
    action.click();
    if (step === previous) throw Error(id + ': valid action did not advance: ' + content.textContent);
   }
   report.push({ id, visited, finalKind: selected.tree.steps[step].kind, passed: true });
   dialog.close();
  }
  return report;
 }, ids);
 fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
 console.log('Passed ' + report.length + ' studio journeys (validation, simulated failure/retry and completion where applicable).');
} finally { await browser.close(); }
