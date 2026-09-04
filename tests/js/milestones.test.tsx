import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * ============================================================================
 * THE SCREEN DRAWS THE STEP THAT IS STUCK, AND NOTHING ONCE NONE IS.
 * ============================================================================
 * Five milestones as five dates is the screen ADR 0042 rule 2 refuses: a
 * milestone that has been reached is true, permanent and attached to no
 * action. What changes what a merchant does next is the first step they have
 * NOT reached — and each one has a different cause and a different door.
 *
 * The most valuable of them is *published and never shown*, because it is the
 * only state on this admin that looks completely correct from every other
 * screen: the Optin exists, it says "published", and a caching plugin has
 * quietly removed the loader (ADR 0004).
 *
 * The dates are still readable, behind a disclosure whose real content is its
 * last sentence — the `readme.txt` promise, made checkable.
 */
const api = vi.hoisted(() => ({
  readMilestones: vi.fn(),
  // Re-exported rather than mocked: `stuckAt` is the ordering under test, and
  // a mocked one would mean this file asserted against its own fixture.
  stuckAt: undefined as unknown,
}));

const real = await vi.importActual<typeof import('../../resources/admin/src/milestones/api')>(
  '../../resources/admin/src/milestones/api',
);

api.stuckAt = real.stuckAt;

vi.mock('../../resources/admin/src/milestones/api', () => api);

const { Milestones } = await import('../../resources/admin/src/milestones/Milestones');

const NOTHING = {
  first_publish: null,
  first_impression: null,
  first_conversion: null,
  first_edit: null,
  destinations: { configured: false, landed: false, failing: false },
};

const WORKING = {
  first_publish: '2026-03-04',
  first_impression: '2026-03-05',
  first_conversion: '2026-03-09',
  first_edit: {
    on: '2026-03-06',
    playbook: 'welcome-discount',
    part: 'rules',
    part_label: 'When and to whom it shows',
  },
  destinations: { configured: true, landed: true, failing: false },
};

beforeEach(() => {
  api.readMilestones.mockReset();
});

describe('the step that is stuck', () => {
  it('sends a site with nothing published to the Optins list', async () => {
    api.readMilestones.mockResolvedValue(NOTHING);

    render(<Milestones />);

    expect(await screen.findByText('Nothing is live yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Optins' })).toHaveAttribute('href', '#optins');
  });

  /**
   * **The one that is invisible from every other screen.** The Optin exists,
   * the list says "published", and nothing is being counted — which is the
   * display rules, the targeting, or an optimiser that stripped the loader.
   */
  it('names the published-and-never-shown case with its date and its usual causes', async () => {
    api.readMilestones.mockResolvedValue({ ...NOTHING, first_publish: '2026-03-04' });

    render(<Milestones />);

    expect(
      await screen.findByText('Published, and not shown to anyone yet'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Live since 2026-03-04/)).toBeInTheDocument();
    expect(screen.getByText(/caching or optimisation plugin/)).toBeInTheDocument();
  });

  it('sends a converting site with a failing Destination to the Destinations screen', async () => {
    api.readMilestones.mockResolvedValue({
      ...WORKING,
      destinations: { configured: true, landed: true, failing: true },
    });

    render(<Milestones />);

    expect(
      await screen.findByText('A Destination is refusing what you capture'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Destinations' })).toHaveAttribute(
      'href',
      '#destinations',
    );
  });

  /**
   * A [[Destination]] is optional — the lead log is the capture and always
   * happens — so a site with none configured is finished at its first
   * conversion rather than permanently one step short.
   */
  it('does not hold a site short for a Destination it never asked for', async () => {
    api.readMilestones.mockResolvedValue({
      ...WORKING,
      destinations: { configured: false, landed: false, failing: false },
    });

    render(<Milestones />);

    await screen.findByText('What WConvert has recorded about this site');

    expect(screen.queryByRole('link', { name: 'Go to Destinations' })).not.toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * THE ASSERTION THIS FILE EXISTS FOR.
   * ==========================================================================
   * A working site gets **no step at all**. A checklist of four ticks is the
   * screen that taxes every visit and informs one.
   */
  it('draws no step once every milestone is met', async () => {
    api.readMilestones.mockResolvedValue(WORKING);

    render(<Milestones />);

    await screen.findByText('What WConvert has recorded about this site');

    expect(screen.queryByRole('link', { name: 'Go to Optins' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to Destinations' })).not.toBeInTheDocument();
  });

  /**
   * And nothing is drawn before the read lands. A region reserving height for
   * something it will usually not draw pushes the numbers down on every visit
   * and then takes the space back.
   */
  it('reserves no space while it is loading', () => {
    api.readMilestones.mockReturnValue(new Promise(() => {}));

    const { container } = render(<Milestones />);

    expect(container).toBeEmptyDOMElement();
  });

  /** A read that fails takes the whole region with it rather than the screen. */
  it('says nothing at all when the read fails', async () => {
    api.readMilestones.mockRejectedValue(new Error('nope'));

    const { container } = render(<Milestones />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('what was recorded', () => {
  it('is closed until it is asked for', async () => {
    api.readMilestones.mockResolvedValue(WORKING);

    render(<Milestones />);

    await screen.findByText('What WConvert has recorded about this site');

    expect(screen.getByText('First published').closest('details')).not.toHaveAttribute('open');
  });

  it('shows all five values, and the sentence it exists for', async () => {
    api.readMilestones.mockResolvedValue(WORKING);

    render(<Milestones />);

    await userEvent.click(await screen.findByText('What WConvert has recorded about this site'));

    expect(screen.getByText('2026-03-04')).toBeInTheDocument();
    expect(screen.getByText('2026-03-05')).toBeInTheDocument();
    expect(screen.getByText('2026-03-09')).toBeInTheDocument();
    expect(screen.getByText('When and to whom it shows, on 2026-03-06')).toBeInTheDocument();
    expect(screen.getByText(/none of it is sent anywhere/)).toBeInTheDocument();
  });

  /**
   * **A milestone not reached says so rather than being absent.** A gap in a
   * list of dates reads as missing data, and "not yet" is a real answer for
   * four of the five.
   */
  it('says not yet rather than leaving a gap', async () => {
    api.readMilestones.mockResolvedValue(NOTHING);

    render(<Milestones />);

    await userEvent.click(await screen.findByText('What WConvert has recorded about this site'));

    expect(screen.getAllByText('Not yet')).toHaveLength(4);
    expect(screen.getByText('None configured')).toBeInTheDocument();
  });

  /**
   * **The words for the part come from the server.** `part` is one of a closed
   * set of five and this bundle never branches on it — a `switch` here would
   * ship five sentences `wp i18n make-pot` cannot see, which is exactly the
   * rule a [[Goal]]'s `headline_label` follows.
   */
  it('never spells the words for a part itself', async () => {
    api.readMilestones.mockResolvedValue({
      ...WORKING,
      first_edit: { ...WORKING.first_edit, part: 'design', part_label: 'A label from the server' },
    });

    render(<Milestones />);

    await userEvent.click(await screen.findByText('What WConvert has recorded about this site'));

    expect(screen.getByText('A label from the server, on 2026-03-06')).toBeInTheDocument();
  });
});
