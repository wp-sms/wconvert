import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

/**
 * ============================================================================
 * ONE COMPONENT IS A SECTION'S CHUNK FALLBACK AND ITS OWN FIRST LOAD (§12).
 * ============================================================================
 * A section whose code is split shows a Suspense fallback while the chunk
 * downloads, then the screen's own loading state while its first read is in
 * flight. When those were two components they were two shapes in a row, and
 * every one of them drifted: a bare table that grew filters above it, a
 * full-width card that became a rail and a column, a region that became three.
 *
 * So each pair is rendered here both ways — the section with its chunk held
 * forever, and the screen itself with every read held forever — and the
 * fallback's markup must appear, byte for byte, in the screen's. Markup and not
 * a component reference, because what the merchant sees is the markup, and two
 * components that drew the same markup would be fine.
 */

// Every lazy screen suspends forever: what is on screen is the fallback.
vi.mock('../../resources/admin/src/lib/requestActivity', async (original) => ({
  ...(await original<typeof import('../../resources/admin/src/lib/requestActivity')>()),
  lazyScreen: () => function Held(): never { throw new Promise(() => undefined); },
}));

// Every read is in flight forever: what is on screen is the first-load state.
vi.mock('@wordpress/api-fetch', () => ({ default: Object.assign(vi.fn(() => new Promise(() => undefined)), { use: vi.fn() }) }));

afterEach(cleanup);

const markup = (element: Parameters<typeof render>[0], select?: string): string => {
  const { container } = render(element);
  const root = select ? container.querySelector(select) : container;
  const html = root?.innerHTML ?? '';
  cleanup();
  return html;
};

/** The fallback must be drawn, and drawn inside the screen's own loading state. */
function expectHandOff(fallback: string, own: string) {
  expect(fallback.length).toBeGreaterThan(200);
  expect(own).toContain(fallback);
}

describe('the chunk fallback is the screen’s own first-load state', () => {
  it('Analytics', async () => {
    const { AnalyticsSection } = await import('../../resources/admin/src/sections');
    const { Dashboard } = await import('../../resources/admin/src/stats/Dashboard');
    expectHandOff(markup(<AnalyticsSection />), markup(<Dashboard />));
  });

  it('Leads', async () => {
    const { LeadsSection } = await import('../../resources/admin/src/sections');
    const { LeadLog } = await import('../../resources/admin/src/leads/LeadLog');
    expectHandOff(markup(<LeadsSection />), markup(<LeadLog />));
  });

  it.each(['connections', 'experience', 'protection', 'data', 'reports'] as const)('Settings: %s', async (group) => {
    const { SettingsSection } = await import('../../resources/admin/src/sections');
    const { Settings } = await import('../../resources/admin/src/settings-page/Settings');
    // The rail is the page's own from the moment its code lands; the column is what loads.
    const column = '.max-w-\\[900px\\]';
    const own = markup(<Settings group={group} />, column);
    const { container } = render(<SettingsSection group={group} />);
    const regions = [...container.querySelector(column)!.firstElementChild!.children]
      // Data & privacy's export region is static text, drawn at once and never read.
      .filter((region) => region.getAttribute('aria-label') !== 'Export and personal data');
    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) expect(own).toContain(region.outerHTML);
  });

  it('Sending issues', async () => {
    const { SendingIssuesSection } = await import('../../resources/admin/src/sections');
    const { Destinations } = await import('../../resources/admin/src/destinations/Destinations');
    expectHandOff(markup(<SendingIssuesSection mode="issues" />), markup(<Destinations mode="issues" />));
  });

  it('Occasion', async () => {
    const { OccasionSection } = await import('../../resources/admin/src/sections');
    const { OccasionPage } = await import('../../resources/admin/src/occasions/OccasionPage');
    const props = { id: 'spring', notice: null, onNotice: () => undefined, onDismissNotice: () => undefined, navigate: () => undefined, onEdit: () => undefined };
    // The frame's header tools are left out: they read on their own clock.
    const body = 'main';
    expectHandOff(markup(<OccasionSection {...props} />, body), markup(<OccasionPage {...props} />, body));
  });

  it('Creation', async () => {
    const { GoalScreen: Lazy } = await import('../../resources/admin/src/builder/lazy');
    const { GoalScreen } = await import('../../resources/admin/src/goals/GoalScreen');
    expectHandOff(markup(<Lazy onCreated={() => undefined} />), markup(<GoalScreen onCreated={() => undefined} />));
  });

  it('the builder', async () => {
    const { OptinBuilder: Lazy } = await import('../../resources/admin/src/builder/lazy');
    const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');
    const props = { id: '01J0000000AAAAAAAAAAAAAAAA', onClose: () => undefined, backLabel: 'Back to Campaigns' };
    expectHandOff(markup(<Lazy {...props} />), markup(<OptinBuilder {...props} />));
  });
});

describe('a placeholder', () => {
  it('is static and one colour', async () => {
    const { Skeleton } = await import('../../resources/admin/src/components/ui/skeleton');
    const { container } = render(<Skeleton />);
    const bar = container.firstElementChild!;
    expect(bar).toHaveClass('bg-skeleton');
    expect(bar.className).not.toMatch(/animate-|bg-accent/);
  });

  it('says what is loading to a screen reader only, once per region, from the region’s name', async () => {
    const { RegionSkeleton } = await import('../../resources/admin/src/shell/RegionSkeleton');
    const { StatRowSkeleton } = await import('../../resources/admin/src/shell/Stat');
    const { container, getAllByRole } = render(<RegionSkeleton label="License"><StatRowSkeleton stats={3} /></RegionSkeleton>);
    const [status, ...more] = getAllByRole('status');
    expect(more).toHaveLength(0);
    expect(status).toHaveTextContent('Loading license…');
    expect(status).toHaveClass('sr-only');
    // The nested stat row does not say it a second time.
    expect(container.textContent?.match(/Loading/g)).toHaveLength(1);
  });

  it('reserves the header’s description line and its action', async () => {
    const { RegionSkeleton } = await import('../../resources/admin/src/shell/RegionSkeleton');
    const plain = markup(<RegionSkeleton label="Answers" />);
    const full = markup(<RegionSkeleton label="Answers" description trailing />);
    expect(full.match(/data-slot="skeleton"/g)!.length).toBe(plain.match(/data-slot="skeleton"/g)!.length + 2);
  });
});

describe('the skeleton delay', () => {
  it('paints a first fill at once and holds a re-read back', async () => {
    vi.useFakeTimers();
    try {
      const { TableSkeleton } = await import('../../resources/admin/src/shell/TableSkeleton');
      const table = (Component: ComponentType) => render(<table><Component /></table>);
      const first = table(() => <TableSkeleton columns={3} />);
      expect(first.container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
      cleanup();
      const reread = table(() => <TableSkeleton columns={3} wait />);
      expect(reread.container.querySelector('[data-slot="skeleton"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
