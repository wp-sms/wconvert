import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { campaignIssues, type CampaignIssueInputs } from '../../resources/admin/src/builder/readiness/campaignIssues';
import { CAPTURE_OUTCOME, CLICK_OUTCOME } from './support/outcomes';
import { ruleTypes } from './support/rule-types';
import type { Template } from '@renderer/types';

/**
 * **One list feeds every count** (ADR 0133): the review, the header's "n to
 * fix", each screen's warning and the map's badges all read
 * `campaignIssues()`, so what it returns is what every one of them says.
 */
const design = (id: string): Template => JSON.parse(readFileSync(
  resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8',
));
const FORM = design('centred-card');
const OFFER = design('offer-panel');
const MAGNET = { ...CAPTURE_OUTCOME, audience_channel: null, destination_type: 'lead_magnet_email' };

const inputs = (overrides: Partial<CampaignIssueInputs> = {}): CampaignIssueInputs => ({
  template: FORM,
  rules: { display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } }, targeting: {}, frequency: {}, schedule: {}, priority: 0 },
  vocabulary: ruleTypes(), displayType: 'popup', outcome: CAPTURE_OUTCOME,
  bound: [], destinations: [], captureMode: 'local',
  ...overrides,
});

const withHref = (template: Template, id: string, href: string): Template =>
  JSON.parse(JSON.stringify(template).replace(`"id":"${id}"`, `"id":"${id}","href":"${href}"`));

describe('a campaign’s issues', () => {
  it('has nothing to fix on a fresh email setup that keeps leads in WConvert', () => {
    expect(campaignIssues(inputs()).filter(issue => issue.blocks)).toEqual([]);
  });

  /** A goal still loading is not a goal that failed to load: a fresh setup must not flash "1 to fix". */
  it('says nothing about the goal while it is loading, and asks to retry only when the read failed', () => {
    expect(campaignIssues(inputs({ outcome: undefined })).map(issue => issue.key)).not.toContain('goal-unread');
    expect(campaignIssues(inputs({ outcome: null })).map(issue => issue.key)).toContain('goal-unread');
  });

  it('asks for a service only once connecting one is chosen, with the local answer beside it', () => {
    const [handoff] = campaignIssues(inputs({ captureMode: 'connected' })).filter(issue => issue.blocks);
    expect(handoff).toMatchObject({ tab: 'destinations', go: { to: 'destinations' }, offersKeepLocal: true });
  });

  /** D9: the lead is saved, so it publishes; the missing file is said, not blocked. */
  it('warns, without blocking, that a lead magnet kept in WConvert sends no file', () => {
    const issues = campaignIssues(inputs({ outcome: MAGNET }));
    expect(issues.filter(issue => issue.blocks)).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      said: 'Visitors won’t get the file until you set up the delivery email.', blocks: false, go: { to: 'destinations' },
    }));
  });

  /** D10: the guessed address is checked, not fixed, until the merchant changes it. */
  it('asks the merchant to check a prefilled link until its address changes', () => {
    const prefilled = withHref(OFFER, 'n3', 'https://shop.test/shop/');
    const unchecked = { n3: { href: 'https://shop.test/shop/', place: 'shop' } };
    const issues = campaignIssues(inputs({ template: prefilled, outcome: CLICK_OUTCOME, uncheckedLinks: unchecked }));

    expect(issues.filter(issue => issue.blocks)).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      said: 'Check where “Shop the sale” goes (now: Shop page).', blocks: false, screenId: prefilled.tree.steps[0].id,
    }));

    const edited = withHref(OFFER, 'n3', 'https://shop.test/sale/');
    expect(campaignIssues(inputs({ template: edited, outcome: CLICK_OUTCOME, uncheckedLinks: unchecked }))
      .some(issue => issue.said.startsWith('Check where'))).toBe(false);
  });

  it('still blocks an offer whose address the merchant cleared', () => {
    const issues = campaignIssues(inputs({ template: OFFER, outcome: CLICK_OUTCOME }));
    expect(issues.filter(issue => issue.blocks).map(issue => issue.said)).toEqual([CLICK_OUTCOME.requirement]);
  });

  /** Only consent wording and fine print take the policy; anywhere else an empty link is unfinished. */
  it('blocks a link in body text that has no address, on its screen', () => {
    const unfinished = JSON.parse(JSON.stringify(FORM)) as Template;
    const content = unfinished.tree.steps[0].content as unknown as { children: unknown[] };
    content.children.unshift({ type: 'text', role: 'body', text: 'Read %s first.', link: { label: 'the guide' } });

    expect(campaignIssues(inputs({ template: unfinished }))).toContainEqual(expect.objectContaining({
      said: 'Add a web address for “the guide”.', blocks: true, screenId: unfinished.tree.steps[0].id,
    }));
  });

  /** The server refuses an optional signup forwarded nowhere while the main one is forwarded. */
  it('blocks an optional signup with no service while leads are sent on', () => {
    const twoForms = design('journey-email-then-sms');
    const second = twoForms.tree.submissions[1].id;
    const connected = inputs({ template: twoForms, captureMode: 'connected', bound: ['main'] });

    expect(campaignIssues(connected).map(issue => issue.key)).toContain(`signup-route:${second}`);
    expect(campaignIssues({ ...connected, submissionSettings: { [second]: { destination_ids: ['sms'] } } })
      .map(issue => issue.key)).not.toContain(`signup-route:${second}`);
    expect(campaignIssues(inputs({ template: twoForms })).map(issue => issue.key)).not.toContain(`signup-route:${second}`);
  });

  /** The main product is the one missing choice; the Goal's "needs a link" would say it twice. */
  it('asks once for the product a recommendation is about', () => {
    const recommending = JSON.parse(JSON.stringify(OFFER)) as Template;
    const content = recommending.tree.steps[0].content as unknown as { children: unknown[] };
    content.children = [{ type: 'products', context: 'product', action: 'link', product_ids: [] }];
    const blockers = campaignIssues(inputs({ template: recommending, outcome: CLICK_OUTCOME })).filter(issue => issue.blocks);
    expect(blockers.map(issue => issue.said)).toEqual(['Choose the main product for these recommendations.']);
  });
});
