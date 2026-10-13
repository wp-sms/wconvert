import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { GuideLink, SuspensionGuideLink } from '../../resources/admin/src/shell/GuideLink';
import { InfoTip } from '../../resources/admin/src/shell/InfoTip';
import { EmptyState } from '../../resources/admin/src/shell/EmptyState';
import { GUIDES, docsUrl, suspensionGuide } from '../../resources/admin/src/shell/docs';
import { errorCopy } from '../../pro/resources/admin/src/license/errorCopy';

/**
 * A guide on wconvert.io, linked where a merchant gets stuck (ADR 0145):
 * always a new tab, always said aloud as one.
 */
it('opens a guide in a new tab and says so', () => {
  render(<GuideLink href={docsUrl(GUIDES.retention, 'choose-policy')} />);

  const link = screen.getByRole('link', { name: 'Read the guide (opens in a new tab)' });
  expect(link).toHaveAttribute('href', 'https://wconvert.io/docs/set-submission-retention/#choose-policy');
  expect(link).toHaveAttribute('target', '_blank');
});

it('ends a tip with its guide, so the screen at rest gains nothing', async () => {
  render(<InfoTip label="How answer conditions work" guide={docsUrl(GUIDES.quizPaths)}><p>A skipped question never matches.</p></InfoTip>);

  expect(screen.queryByRole('link')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'How answer conditions work' }));
  expect(await screen.findByRole('link', { name: /^Read the guide/ })).toHaveAttribute('href', 'https://wconvert.io/docs/conditional-quiz-paths/');
});

it('puts an empty state\'s guide under its action', () => {
  render(<EmptyState icon={Inbox} title="Submission not found" guide={docsUrl(GUIDES.missingSubmissions)} guideLabel="What to check" action={<button type="button">Clear filters</button>} />);

  const link = screen.getByRole('link', { name: 'What to check (opens in a new tab)' });
  expect(screen.getByRole('button', { name: 'Clear filters' }).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('offers the troubleshooting guide when the license server cannot be reached', () => {
  expect(errorCopy({ code: 'network_error', message: '' }).ways).toContain('guide');
  expect(errorCopy({ code: 'license_expired', message: '' }).ways).not.toContain('guide');
});

/** A suspended campaign's "What to check" (ADR 0147): free never links the Pro guide. */
it('links the missing plugin’s guide, and the Pro guide only where Pro is installed', () => {
  expect(suspensionGuide('woocommerce', true)).toBe('https://wconvert.io/docs/#woocommerce');
  expect(suspensionGuide(null, true)).toBeNull();
  expect(suspensionGuide(null, false)).toBe('https://wconvert.io/docs/pro-features-unavailable/#identify-the-problem');

  window.wconvertAdmin = { exportUrl: '', installedTier: 'free' };
  const { unmount } = render(<p><SuspensionGuideLink needs={null} /></p>);
  expect(screen.queryByRole('link')).toBeNull();
  unmount();
  render(<p><SuspensionGuideLink needs="woocommerce" /></p>);
  expect(screen.getByRole('link', { name: 'What to check (opens in a new tab)' })).toHaveAttribute('href', 'https://wconvert.io/docs/#woocommerce');
  delete window.wconvertAdmin;
});
