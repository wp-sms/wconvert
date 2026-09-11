import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECTION,
  SECTIONS,
  destinationHref,
  editorHref,
  hashFor,
  leadsHref,
  reportHref,
  routeFrom,
  sectionFrom,
} from '../../resources/admin/src/nav';

/**
 * The admin's section router.
 *
 * The v1 map decided **"conventional nav in v1"** and the screen shipped as one
 * scroll with none, so this is the piece that closes that gap. It is a pure
 * translation between a URL hash and a section id, held here rather than in the
 * tab strip, because #29 drew the line at exactly that: *"Not a TDD seam: React
 * component structure, panel layout, gallery chrome."* Which section a URL
 * names is not chrome — it decides what a reload, a bookmark and the browser's
 * back button do.
 */
describe('the section a URL names', () => {
  it('defaults when the hash is empty, so /admin.php?page=wconvert opens somewhere', () => {
    expect(sectionFrom('')).toBe(DEFAULT_SECTION);
    expect(sectionFrom('#')).toBe(DEFAULT_SECTION);
  });

  it('reads every section the tab strip offers', () => {
    for (const section of SECTIONS) {
      expect(sectionFrom(hashFor(section.id))).toBe(section.id);
    }
  });

  it('opens on the Optins list, which is the screen a returning merchant wants', () => {
    expect(DEFAULT_SECTION).toBe('optins');
    expect(SECTIONS[0].id).toBe('optins');
  });

  /**
   * A hash is user-editable and outlives a release: a bookmark saved against a
   * section that has since been renamed must land on a real screen rather than
   * on a blank one, which is what rendering an unknown id would produce.
   */
  it('falls back rather than rendering nothing when the hash names no section', () => {
    expect(sectionFrom('#leaderboard')).toBe(DEFAULT_SECTION);
    expect(sectionFrom('#')).toBe(DEFAULT_SECTION);
    expect(sectionFrom('#optins/../destinations')).toBe(DEFAULT_SECTION);
  });

  it('ignores the leading # either way, because location.hash carries one and a link may not', () => {
    expect(sectionFrom('leads')).toBe('leads');
    expect(sectionFrom('#leads')).toBe('leads');
  });

  it('writes a hash a browser will navigate to', () => {
    expect(hashFor('leads')).toBe('#leads');
  });

  it('gives every section a distinct id and a label to put on the tab', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);

    for (const section of SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
    }
  });
});

describe('bookmarked admin flows', () => {
  it('reads a bookmarked editor and its return to the filtered report', () => {
    const back = reportHref({ days: 7, goal: 'grow_email_list', optinId: 'OPTIN1' });
    const href = editorHref('OPTIN1', back);

    expect(href).toContain('back=%23analytics%3F');
    expect(routeFrom(href)).toMatchObject({ section: 'optins', editId: 'OPTIN1', returnTo: back });
    expect(routeFrom(routeFrom(href).returnTo)).toMatchObject({
      section: 'analytics',
      report: { days: 7, goal: 'grow_email_list', optinId: 'OPTIN1' },
    });
  });

  it('preserves lead identifier, record and date filters through an editor roundtrip', () => {
    const query = {
      optinId: 'OPTIN1',
      identifier: 'sarah+offers@example.com',
      leadId: 'LEAD1',
      from: '2026-09-01',
      to: '2026-09-10',
    };
    const back = leadsHref(query);
    const editor = routeFrom(editorHref('OPTIN1', back));

    expect(back).toContain('identifier=sarah%2Boffers%40example.com');
    expect(editor.returnTo).toBe(back);
    expect(routeFrom(editor.returnTo)).toMatchObject({ section: 'leads', leads: query });
  });

  it('encodes reserved characters as values without allowing them to add route parameters', () => {
    const id = 'offer & edit=OTHER #preview';
    const identifier = 'a?b&from=1900-01-01@example.com';

    expect(routeFrom(editorHref(id)).editId).toBe(id);
    expect(routeFrom(editorHref(id)).returnTo).toBe('#optins');
    expect(routeFrom(leadsHref({ identifier })).leads).toMatchObject({ identifier, from: undefined });
    expect(routeFrom(destinationHref('email&destination=OTHER')).destinationId).toBe('email&destination=OTHER');
  });

  it('keeps default links compact and reads query-bearing sections correctly', () => {
    expect(editorHref('OPTIN1')).toBe('#optins?edit=OPTIN1');
    expect(reportHref()).toBe('#analytics');
    expect(leadsHref()).toBe('#leads');
    expect(destinationHref()).toBe('#destinations');
    expect(sectionFrom('#leads?optin=OPTIN1')).toBe('leads');
    expect(sectionFrom('analytics?days=7')).toBe('analytics');
    expect(routeFrom('#leads?edit=OPTIN1').editId).toBeUndefined();
  });

  it.each([
    '#optins',
    '#analytics?days=90&goal=promote_offer',
    '#leads?optin=OPTIN1&from=2026-09-01&to=2026-09-10',
    '#destinations?destination=EMAIL1',
  ])('accepts a same-admin return to %s', (back) => {
    expect(routeFrom(editorHref('OPTIN1', back)).returnTo).toBe(back);
  });

  it.each([
    'https://example.com/#leads',
    '//example.com/#leads',
    'javascript:alert(1)',
    '/wp-admin/admin.php?page=another-plugin',
    'analytics?days=7',
    '#unknown',
    '#optins?edit=OTHER',
    '#analytics?edit=OTHER',
    '#optins?note=a?b&edit=OTHER',
  ])('refuses an external, unknown or nested-editor return: %s', (back) => {
    expect(routeFrom(editorHref('OPTIN1', back)).returnTo).toBe('#optins');
    expect(routeFrom(`#optins?edit=OPTIN1&back=${encodeURIComponent(back)}`).returnTo).toBe('#optins');
  });

  it('refuses oversized return bookmarks', () => {
    const back = `#leads?identifier=${'a'.repeat(2048)}`;
    expect(routeFrom(editorHref('OPTIN1', back)).returnTo).toBe('#optins');
    expect(routeFrom(`#optins?edit=OPTIN1&back=${encodeURIComponent(back)}`).returnTo).toBe('#optins');
  });

  it.each([1, 7, 30, 90, 365, 366])('preserves the supported %d-day reporting period', (days) => {
    // StatRange::MAX_DAYS allows a full leap year; a bookmark must not silently
    // replace that valid window with the server's default.
    expect(routeFrom(reportHref({ days })).report.days).toBe(days);
  });

  it.each(['0', '-1', '1.5', '367', 'not-a-number'])('leaves an invalid report period %s to the server default', (days) => {
    expect(routeFrom(`#analytics?days=${days}`).report.days).toBeUndefined();
  });
});
