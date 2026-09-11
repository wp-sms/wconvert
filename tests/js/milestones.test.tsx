import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('sends a converting site whose destinations have received nothing to that screen', async () => {
    api.readMilestones.mockResolvedValue({
      ...WORKING,
      destinations: { configured: true, landed: false, failing: false },
    });

    render(<Milestones />);

    expect(
      await screen.findByText('Converting, and your destinations have received nothing'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Destinations' })).toHaveAttribute(
      'href',
      '#destinations',
    );
  });

  /**
   * **A failing Destination draws no step.** It is the one state that already
   * has a screen with the error text and the re-push beside it, so a step here
   * would be the second, staler spelling of an outage (ADR 0042). It is still
   * on the payload and still read in the disclosure.
   */
  it('draws no step for a failing Destination, and still says so in the record', async () => {
    api.readMilestones.mockResolvedValue({
      ...WORKING,
      destinations: { configured: true, landed: true, failing: true },
    });

    render(<Milestones />);

    await userEvent.click(await screen.findByText('What WConvert has recorded about this site'));

    expect(screen.queryByRole('link', { name: 'Go to Destinations' })).not.toBeInTheDocument();
    expect(screen.getByText('One is failing — see Destinations')).toBeInTheDocument();
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

  /**
   * **A failure IS drawn, even though a met milestone is not.** "The values
   * are readable on an admin screen" is the acceptance criterion, and a read
   * that failed silently makes them unreadable with nothing saying so — which
   * is worse than the checklist ADR 0042 refuses, because the merchant cannot
   * tell there was anything to see.
   */
  it('says the read failed rather than rendering nothing', async () => {
    api.readMilestones.mockRejectedValue(new Error('The site did not answer'));

    render(<Milestones />);

    expect(await screen.findByText(/The site did not answer/)).toBeInTheDocument();
    expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
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
    expect(
      screen.getByText('When and to whom it shows, from “welcome-discount”, on 2026-03-06'),
    ).toBeInTheDocument();
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

    expect(
      screen.getByText('A label from the server, from “welcome-discount”, on 2026-03-06'),
    ).toBeInTheDocument();
  });
  it('does not claim nothing was published when impressions are recorded', async () => {
    api.readMilestones.mockResolvedValue({ ...NOTHING, first_impression: '2026-03-05' });
    render(<Milestones />);
    expect(await screen.findByText('Shown, and nobody has converted yet')).toBeInTheDocument();
    expect(screen.queryByText('Nothing is live yet')).not.toBeInTheDocument();
  });

  it('uses a recorded conversion without inventing missing earlier dates', () => {
    const partial = { ...WORKING, first_publish: null, first_impression: null };
    expect(real.stuckAt(partial)).toBeNull();
    expect(partial.first_publish).toBeNull();
    expect(partial.first_impression).toBeNull();
  });

});
