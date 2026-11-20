import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The review card (ADR 0191; approved mockup
 * claude.ai/artifact/MY4VZ6U5niMSoPjk5vTopT): the server picks the look, the
 * card posts the choice and hides for the rest of the page load.
 */
const api = vi.hoisted(() => ({ recordReviewChoice: vi.fn() }));
vi.mock('../../resources/admin/src/onboarding/reviewAskApi', () => api);

const { ReviewCard, REVIEW_URL, resetReviewCardForTests } = await import('../../resources/admin/src/onboarding/ReviewCard');

const boot = (reviewAsk: 'first' | 'last' | null) => {
  window.wconvertAdmin = { reviewAsk } as typeof window.wconvertAdmin;
};

beforeEach(() => {
  vi.clearAllMocks();
  resetReviewCardForTests();
  api.recordReviewChoice.mockResolvedValue({});
});

const buttons = (card: HTMLElement) => [
  ...within(card).getAllByRole('link').map((link) => link.textContent),
  ...within(card).getAllByRole('button').map((button) => button.textContent),
];

describe('the review card', () => {
  it('shows nothing when the server says not to ask', () => {
    boot(null);
    const { container } = render(<ReviewCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('first asks with Rate, Maybe later and No thanks', () => {
    boot('first');
    render(<ReviewCard />);

    const card = screen.getByRole('region', { name: 'Thank you for using WConvert.' });
    expect(buttons(card)).toEqual(['Rate WConvert(opens in a new tab)', 'Maybe later', 'No thanks']);
    expect(within(card).getByText('— the WConvert team')).toBeInTheDocument();
    const rate = within(card).getByRole('link');
    expect(rate).toHaveAttribute('href', REVIEW_URL);
    expect(rate).toHaveAttribute('target', '_blank');
    expect(REVIEW_URL).not.toContain('utm_');
  });

  it('asks the last time without a third “later”', () => {
    boot('last');
    render(<ReviewCard />);

    const card = screen.getByRole('region', { name: 'Thanks for sticking with WConvert.' });
    expect(buttons(card)).toEqual(['Rate WConvert(opens in a new tab)', 'No thanks']);
    expect(within(card).getByText('If you have a minute, a review would mean a lot. We won’t ask again.')).toBeInTheDocument();
  });

  it.each([
    ['Rate WConvert', 'rated'],
    ['Maybe later', 'later'],
    ['No thanks', 'declined'],
  ])('posts %s as %s and hides', async (name, choice) => {
    boot('first');
    render(<ReviewCard />);

    const card = screen.getByRole('region');
    const control = within(card).queryByRole('button', { name }) ?? within(card).getByRole('link', { name: new RegExp(name) });
    // The link opens a new tab in a browser; jsdom would only log that it can't navigate.
    control.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(control);

    expect(api.recordReviewChoice).toHaveBeenCalledWith(choice);
    await vi.waitFor(() => expect(screen.queryByRole('region')).toBeNull());
  });

  it('stays hidden on the next screen without a reload', async () => {
    boot('first');
    const first = render(<ReviewCard />);
    await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    await vi.waitFor(() => expect(screen.queryByRole('region')).toBeNull());
    first.unmount();

    render(<ReviewCard />);

    expect(screen.queryByRole('region')).toBeNull();
  });
});
