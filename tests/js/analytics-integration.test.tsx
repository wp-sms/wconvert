import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';
import { AnalyticsIntegrationSettings, CampaignAnalytics, analyticsIntegration } from '../../resources/admin/src/analyticsIntegration';

/**
 * The analytics fallbacks render only where Pro's module did not register its
 * own screens. A free install is shown nothing there (ADR 0116); a paid install
 * without the module is told which one has it.
 */
afterEach(() => {
  cleanup();
  delete window.wconvertAdmin;
});

describe('the campaign’s analytics section before its code', () => {
  it('draws the form’s shape under its heading, not a card, and says what is loading once', () => {
    analyticsIntegration.campaign = lazy(() => new Promise<never>(() => undefined));
    window.wconvertAdmin = { exportUrl: '', installedTier: 'pro' };
    const { container } = render(<CampaignAnalytics value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading analytics preferences…');
    expect(container.querySelector('section')).toBeNull();
    delete analyticsIntegration.campaign;
  });
});

describe('analytics integrations where the module is absent', () => {
  it('render nothing on a free install', () => {
    const settings = render(<AnalyticsIntegrationSettings />);
    expect(settings.container).toBeEmptyDOMElement();
    settings.unmount();

    const campaign = render(<CampaignAnalytics value={null} onChange={vi.fn()} />);
    expect(campaign.container).toBeEmptyDOMElement();
  });

  it('name the tier that has them on a paid install', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'pro' };
    render(<AnalyticsIntegrationSettings />);
    expect(screen.getByText('Analytics integrations')).toBeInTheDocument();
    expect(screen.getByText(/with WConvert Pro\./)).toBeInTheDocument();
  });
});
