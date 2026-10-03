import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { inlineShortcode, PlacementGuidance, siteCheckUrl } from '../../resources/admin/src/builder/PlacementGuidance';
import { ManualPlacement } from '../../resources/admin/src/builder/ManualPlacement';

const OPTIN = '01J00000000000000000000000';
const OTHER = '01J00000000000000000000001';
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

beforeEach(() => {
  window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.org/blog/', inspectParam: 'wconvert-inspect' };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  delete window.wconvertAdmin;
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('placing an inline Optin', () => {
  it('names the real WordPress block and generates the real shortcode contract', () => {
    const base = resolve(import.meta.dirname, '../..');
    const metadata = JSON.parse(readFileSync(resolve(base, 'resources/blocks/inline-optin/block.json'), 'utf8'));
    const php = readFileSync(resolve(base, 'src/Frontend/InlineOptinShortcode.php'), 'utf8');
    const tag = php.match(/public const TAG = '([^']+)'/u)?.[1];
    expect(tag).toBeDefined();
    expect(inlineShortcode(OPTIN)).toBe(`[${tag} id="${OPTIN}"]`);

    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published={false} />);

    expect(screen.getByText(/Add the/)).toHaveTextContent(`“${metadata.title}”`);
    expect(screen.getByText(/Publish this Campaign first/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Shortcode for other editors' })).toHaveValue(inlineShortcode(OPTIN));
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/The editor preview shows your draft/)).toBeInTheDocument();
  });

  it('keeps display conditions explicit after publishing and distinguishes the placement page', () => {
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    expect(screen.queryByText(/Publish this Campaign first/)).toBeNull();
    expect(screen.getByText(/display rules, schedule and visitor settings still decide/)).toBeInTheDocument();
    expect(screen.getByText(/also check the page where you placed its block or shortcode/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check your homepage' })).toHaveAttribute('href', 'https://example.org/blog/?wconvert-inspect=1');
  });

  it('names the exact Optin to select when its name is provided', () => {
    render(<PlacementGuidance optinId={OPTIN} optinName="Friday newsletter" displayType="inline" published />);
    expect(screen.getByText('Add the “Inline Campaign” block and choose “Friday newsletter”.')).toBeInTheDocument();
  });

  it('copies the exact shortcode and retains focus on the completed action', async () => {
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(inlineShortcode(OPTIN));
    expect(await screen.findByRole('status')).toHaveTextContent('Shortcode copied.');
    expect(screen.getByRole('button', { name: 'Copied' })).toHaveFocus();
  });

  it('selects the shortcode and explains the manual path when copying fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Permission refused'));
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The shortcode is selected');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(inlineShortcode(OPTIN).length);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('provides the same manual fallback where the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy automatically');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('does not claim the next Optin’s shortcode was copied', async () => {
    const { rerender } = render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));
    await screen.findByRole('status');
    rerender(<PlacementGuidance optinId={OTHER} displayType="inline" published />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy shortcode' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(inlineShortcode(OTHER));
  });

  it('waits for clipboard completion before announcing success', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(navigator.clipboard.writeText).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" published />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy shortcode' }));
    expect(screen.getByRole('button', { name: 'Copy shortcode' })).toBeDisabled();
    expect(screen.queryByRole('status')).toBeNull();
    finish();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Shortcode copied.'));
  });
});

describe('placing an inline Campaign in theme-owned areas', () => {
  it('links block themes to the Site Editor and keeps the shortcode fallback', () => {
    window.wconvertAdmin = {
      exportUrl: '',
      placementEditor: { type: 'site_editor', url: 'https://example.org/wp-admin/site-editor.php' },
    };

    render(<ManualPlacement optinId={OPTIN} published />);

    expect(screen.getByText(/template or template part/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Site Editor' })).toHaveAttribute(
      'href',
      'https://example.org/wp-admin/site-editor.php',
    );
    expect(screen.getByRole('textbox', { name: 'Shortcode for other editors' })).toHaveValue(inlineShortcode(OPTIN));
  });

  it('links classic themes to their registered widget areas and explains the classic fallback', () => {
    window.wconvertAdmin = {
      exportUrl: '',
      placementEditor: { type: 'widgets', url: 'https://example.org/wp-admin/widgets.php' },
    };

    render(<ManualPlacement optinId={OPTIN} published />);

    expect(screen.getByText(/Choose a sidebar or footer area/)).toHaveTextContent('Text widget');
    expect(screen.getByRole('link', { name: 'Open Widgets' })).toHaveAttribute(
      'href',
      'https://example.org/wp-admin/widgets.php',
    );
  });

  it('does not invent a theme destination or hide the publish requirement', () => {
    window.wconvertAdmin = { exportUrl: '' };

    render(<ManualPlacement optinId={OPTIN} published={false} />);

    expect(screen.getByText(/Publish this Campaign first/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/theme controls which site-wide areas exist/)).toBeInTheDocument();
  });
});

describe('checking overlay placement', () => {
  it.each(['popup', 'floating_bar', 'slide_in'])('describes %s eligibility without promising that publishing makes it appear', (displayType) => {
    render(<PlacementGuidance optinId={OPTIN} displayType={displayType} published />);
    expect(screen.getByText(/pages that match its display rules/)).toHaveTextContent('schedule, triggers and visitor settings');
    expect(screen.queryByRole('textbox')).toBeNull();
    const link = screen.getByRole('link', { name: 'Check your homepage' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleDescription(/published version in your signed-in session/);
    expect(link).toHaveAccessibleDescription(/does not show draft edits/);
  });

  it('does not offer the live-site inspector as a draft preview', () => {
    render(<PlacementGuidance optinId={OPTIN} displayType="popup" published={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/After publishing, this Campaign can appear/)).toBeInTheDocument();
    expect(screen.getByText(/editor preview shows your draft/)).toBeInTheDocument();
  });

  it('keeps guidance usable when inspector boot data is missing', () => {
    delete window.wconvertAdmin;
    render(<PlacementGuidance optinId={OPTIN} displayType="popup" published />);
    expect(screen.getByRole('heading', { name: 'Check where it appears' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('the real site-check URL', () => {
  it('preserves the configured site path, query and fragment and uses the server’s parameter', () => {
    expect(siteCheckUrl('https://example.org/blog/?lang=fr#top', 'diagnose-display'))
      .toBe('https://example.org/blog/?lang=fr&diagnose-display=1#top');
  });

  it('does not produce active links for malformed or executable URLs', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'not a URL']) {
      expect(siteCheckUrl(url, 'inspect')).toBeNull();
    }
    expect(siteCheckUrl('https://example.org/', undefined)).toBeNull();
    expect(siteCheckUrl(undefined, 'inspect')).toBeNull();
  });
});

describe('automatic placement saved on an install without Pro', () => {
  /** It describes manual placement and sells nothing (ADR 0116). */
  it('falls back to the manual steps on a free install', () => {
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" inlinePlacement={{ position: 'before_content' }} published />);
    expect(screen.queryByText(/Pro places this Campaign/)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Shortcode for other editors' })).toHaveValue(inlineShortcode(OPTIN));
  });

  it('keeps the automatic explanation on a paid install', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    render(<PlacementGuidance optinId={OPTIN} displayType="inline" inlinePlacement={{ position: 'before_content' }} published />);
    expect(screen.getByText(/Pro places this Campaign/)).toBeInTheDocument();
  });
});
