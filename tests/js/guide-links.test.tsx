import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { GuideLink } from '../../resources/admin/src/shell/GuideLink';
import { InfoTip } from '../../resources/admin/src/shell/InfoTip';
import { EmptyState } from '../../resources/admin/src/shell/EmptyState';
import { GUIDES, docsUrl } from '../../resources/admin/src/shell/docs';
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
