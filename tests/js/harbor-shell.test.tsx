import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '../../resources/admin/src/shell/Shell';
import { PageAction, PageBack, PageHeading } from '../../resources/admin/src/shell/PageActions';

afterEach(() => { delete window.wconvertAdmin; vi.unstubAllGlobals(); });

it('keeps section navigation and portaled actions in the light heading area', () => {
  render(<Shell section="analytics"><PageAction><button>Choose period</button></PageAction><p>Report</p></Shell>);
  expect(within(screen.getByRole('navigation', { name: 'WConvert sections' })).getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { level: 1, name: 'Analytics' }).closest('.wconvert-panel-nav')).toBeNull();
  expect(screen.getByRole('button', { name: 'Choose period' }).closest('.wconvert-panel-heading')).not.toBeNull();
  // The footer carries resources, not a fourth copy of a Settings shortcut.
  const resources = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Resources' });
  expect(within(resources).getByRole('link', { name: 'Guides' })).toBeInTheDocument();
  expect(within(screen.getByRole('contentinfo')).queryByRole('link', { name: 'Visitor experience' })).toBeNull();
});

it('shows publisher branding without site identity and opens working footer help', async () => {
  window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.test/shop/', siteName: 'A & B', installedTier: 'free' };
  render(<Shell section="optins"><p>Campaigns</p></Shell>);
  expect(screen.queryByRole('link', { name: 'A & B' })).toBeNull();
  expect(screen.queryByText(/A & B/)).toBeNull();
  expect(within(screen.getByRole('contentinfo')).getByText('Free')).toBeVisible();
  expect(screen.getByRole('link', { name: 'By VeronaLabs (opens in a new tab)' })).toHaveAttribute('href', 'https://veronalabs.com/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=footer');
  expect(screen.getByRole('img', { name: 'VeronaLabs' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Need a hand? Help' }));
  // Help is help: where to learn and who to ask, never a Settings shortcut.
  const help = await screen.findByRole('dialog');
  expect(within(help).getByRole('link', { name: /^Getting started/ })).toBeInTheDocument();
  expect(within(help).getByRole('link', { name: /^Contact support/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Connections & destinations' })).toBeNull();
  expect(screen.getByRole('link', { name: 'WConvert website' })).toHaveAttribute('href', 'https://wconvert.io/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=help');
});

it('omits the service footer and visible page heading during creation', () => {
  render(<Shell section="optins" hidePageHeading><p>Choose a goal</p></Shell>);
  expect(screen.queryByRole('contentinfo')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('sr-only');
  expect(screen.queryByRole('link', { name: 'View website' })).toBeNull();
});

it('puts the way back above the title and outside the toolbar, whose rules would resize it (ADR 0187)', () => {
  render(<Shell section="analytics"><PageBack href="#overview">Back to the overview</PageBack><p>Report</p></Shell>);
  const back = screen.getByRole('link', { name: 'Back to the overview' });
  expect(back.closest('.wconvert-panel-heading')).not.toBeNull();
  expect(back.closest('.wconvert-page-actions')).toBeNull();
  expect(back.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

describe('a screen titling the page (ADR 0190)', () => {
  it('replaces the section’s title and line, and gives them back when it leaves', () => {
    const page = (report: boolean) => <Shell section="analytics">{report && <PageHeading title="Submissions" description="Under the title" />}</Shell>;
    const { rerender } = render(page(true));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Submissions' })).toBeInTheDocument();
    expect(screen.getByText('Under the title')).toBeInTheDocument();
    expect(screen.queryByText('How each goal is performing.')).toBeNull();

    rerender(page(false));
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByText('How each goal is performing.')).toBeInTheDocument();
    expect(screen.queryByText('Under the title')).toBeNull();
  });

  it('draws no section line when the screen gives none', () => {
    render(<Shell section="analytics"><PageHeading title="Submissions" /></Shell>);
    expect(screen.queryByText('How each goal is performing.')).toBeNull();
  });

  it('keeps what stands beside the title out of the heading’s name', () => {
    render(<Shell section="analytics"><PageHeading title="Submissions" aside={<button>About Submissions</button>} /></Shell>);
    const title = screen.getByRole('heading', { level: 1, name: 'Submissions' });
    expect(title).not.toContainElement(screen.getByRole('button', { name: 'About Submissions' }));
  });

  it('draws in place with no frame above it', () => {
    render(<PageHeading title="Submissions" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Submissions' })).toBeInTheDocument();
  });
});

describe('height floor from the wp-admin menu', () => {
  const observers: { targets: Element[]; disconnected: boolean; fire: () => void }[] = [];

  /** wp-admin's menu: a wrap holding the list, at sizes jsdom cannot lay out. `listReach` runs from the wrap's top. */
  function addMenu(wrapHeight: number, listReach = 0) {
    const wrap = document.createElement('div');
    wrap.id = 'adminmenuwrap';
    const list = document.createElement('ul');
    list.id = 'adminmenu';
    wrap.append(list);
    document.body.append(wrap);
    const place = (nextWrap: number, nextReach: number) => {
      wrap.getBoundingClientRect = () => ({ top: 32, height: nextWrap, bottom: 32 + nextWrap }) as DOMRect;
      list.getBoundingClientRect = () => ({ bottom: 32 + nextReach }) as DOMRect;
    };
    place(wrapHeight, listReach);
    return { menu: wrap, list, place };
  }

  function stubResizeObserver() {
    vi.stubGlobal('ResizeObserver', class {
      record: (typeof observers)[number];
      constructor(callback: () => void) {
        this.record = { targets: [], disconnected: false, fire: callback };
        observers.push(this.record);
      }
      observe(target: Element) { this.record.targets.push(target); }
      unobserve() {}
      disconnect() { this.record.disconnected = true; }
    });
  }

  const floorOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('.wconvert-panel')?.style.getPropertyValue('--wconvert-menu-floor');
  const menuObserver = (menu: Element) => observers.find((observer) => observer.targets.includes(menu));

  afterEach(() => {
    document.getElementById('adminmenuwrap')?.remove();
    observers.length = 0;
  });

  it('follows the menu height as the menu resizes', () => {
    stubResizeObserver();
    const { menu, place } = addMenu(1156);
    const { container } = render(<Shell section="analytics"><p>Report</p></Shell>);
    menuObserver(menu)?.fire();
    expect(floorOf(container)).toBe('1156px');
    place(640, 628);
    menuObserver(menu)?.fire();
    expect(floorOf(container)).toBe('640px');
  });

  // Under 782px wp-admin takes the list out of flow: the wrap stays 0 tall and
  // the list alone sets the document's height.
  it('follows the list when the responsive menu opens out of a collapsed wrap', () => {
    stubResizeObserver();
    const { list, place } = addMenu(0);
    const { container } = render(<Shell section="analytics"><p>Report</p></Shell>);
    place(0, 2230);
    menuObserver(list)?.fire();
    expect(floorOf(container)).toBe('2230px');
    place(0, 0);
    menuObserver(list)?.fire();
    expect(floorOf(container)).toBe('0px');
  });

  it('stops watching the menu on unmount', () => {
    stubResizeObserver();
    const { menu } = addMenu(1156);
    const { unmount } = render(<Shell section="analytics"><p>Report</p></Shell>);
    expect(menuObserver(menu)?.disconnected).toBe(false);
    unmount();
    expect(observers.length).toBeGreaterThan(0);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it('drops the floor when a live frame enters the creation flow', () => {
    stubResizeObserver();
    const { menu } = addMenu(1156);
    const { container, rerender } = render(<Shell section="optins"><p>Campaigns</p></Shell>);
    const observer = menuObserver(menu);
    observer?.fire();
    expect(floorOf(container)).toBe('1156px');
    rerender(<Shell section="optins" hidePageHeading><p>Choose a goal</p></Shell>);
    expect(observer?.disconnected).toBe(true);
    expect(floorOf(container)).toBe('');
  });

  it('leaves the creation flow, which has no footer, on the window floor', () => {
    stubResizeObserver();
    const { menu } = addMenu(1156);
    const { container } = render(<Shell section="optins" hidePageHeading><p>Choose a goal</p></Shell>);
    expect(menuObserver(menu)).toBeUndefined();
    expect(floorOf(container)).toBe('');
  });

  it('renders with no menu on the page', () => {
    stubResizeObserver();
    const { container } = render(<Shell section="analytics"><p>Report</p></Shell>);
    expect(screen.getByText('Report')).toBeVisible();
    expect(floorOf(container)).toBe('');
  });

  it('renders where ResizeObserver does not exist', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    addMenu(1156);
    const { container } = render(<Shell section="analytics"><p>Report</p></Shell>);
    expect(screen.getByText('Report')).toBeVisible();
    expect(floorOf(container)).toBe('');
  });
});
