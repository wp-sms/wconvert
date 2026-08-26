import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTION, SECTIONS, hashFor, sectionFrom } from '../../resources/admin/src/nav';

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
