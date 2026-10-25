import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MountOptions } from '../../resources/renderer/src/mount';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn(() => new Promise(() => {})) }));

const mounts = vi.hoisted(() => [] as MountOptions[]);

vi.mock('@renderer/mount', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../resources/renderer/src/mount')>();

  return { ...real, mount: (options: MountOptions) => { mounts.push(options); return real.mount(options); } };
});

const { DesignStage } = await import('../../resources/admin/src/stage/DesignStage');

const ENTRY = JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/templates/editor-card.json'), 'utf8')) as TemplateEntry;
const template = { tree: ENTRY.tree, tokens: { ...ENTRY.tokens, width: '30rem' } };

afterEach(() => {
  mounts.length = 0;
  vi.unstubAllGlobals();
});

describe('a live design on the stage', () => {
  it('is drawn by Preview at its render width, filling it', () => {
    const { container } = render(<DesignStage displayType="popup" size="inspect" source={{ live: { template } }} />);

    expect(mounts).toHaveLength(1);
    expect(mounts[0].displayType).toBe('inline');
    // The anchor is the render width; the design is told to fill it.
    expect(mounts[0].template.tokens.width).toBe('100%');
    expect((mounts[0].anchor as HTMLElement).style.inlineSize).toBe('480px');
    expect(container.querySelector('.wconvert-stage__design')).toHaveStyle({ inlineSize: '480px' });
  });

  it('keeps a fullscreen’s own width token, inside a 1024 page', () => {
    render(<DesignStage displayType="fullscreen" size="card" lazy={false} source={{ live: { template } }} />);

    expect(mounts[0].template.tokens.width).toBe('30rem');
    expect((mounts[0].anchor as HTMLElement).style.inlineSize).toBe('1024px');
  });

  it('draws every format at 360 or less on a phone', () => {
    render(<DesignStage displayType="popup" size="inspect" device="mobile" source={{ live: { template } }} />);

    expect((mounts[0].anchor as HTMLElement).style.inlineSize).toBe('328px');
  });

  it('names the format, the size and the placement it was drawn for', () => {
    const { container } = render(<DesignStage displayType="floating_bar" size="canvas" placement="block_start" source={{ live: { template } }} />);
    const stage = container.querySelector('.wconvert-stage');

    expect(stage).toHaveAttribute('data-display-type', 'floating_bar');
    expect(stage).toHaveAttribute('data-size', 'canvas');
    expect(stage).toHaveAttribute('data-placement', 'block_start');
  });

  it('is a picture to everything but the canvas', () => {
    const { container } = render(<DesignStage displayType="popup" size="inspect" source={{ live: { template } }} />);

    expect(container.querySelector('.wconvert-stage__design')).toHaveAttribute('inert');
  });
});

describe('an online design on the stage', () => {
  it('is the catalogue’s picture, offered at 1x and 2x and never sending a referrer', () => {
    const { container } = render(<DesignStage displayType="popup" size="inspect"
      source={{ image: { '1x': 'https://cdn.example/a.webp', '2x': 'https://cdn.example/a@2x.webp' } }} />);
    const picture = container.querySelector('img')!;

    expect(mounts).toHaveLength(0);
    expect(picture).toHaveAttribute('srcset', 'https://cdn.example/a.webp 600w, https://cdn.example/a@2x.webp 1200w');
    expect(picture).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(picture).toHaveAttribute('decoding', 'async');
    expect(picture).toHaveAttribute('alt', '');
    // Until it is placed it is asked for at its own width.
    expect(picture).toHaveAttribute('sizes', '600px');
  });
});

describe('a card far from the viewport', () => {
  it('draws only the page until it comes near, then asks for its design', () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof report) { report = callback; }
      observe() {}
      disconnect() {}
    });
    const near = vi.fn();
    const { container } = render(<DesignStage displayType="popup" size="card" source={{ live: { template } }} onNear={near} />);

    expect(mounts).toHaveLength(0);
    expect(near).not.toHaveBeenCalled();
    expect(container.querySelector('.wconvert-ghost')).not.toBeNull();

    act(() => report([{ isIntersecting: true }]));

    expect(mounts).toHaveLength(1);
    expect(near).toHaveBeenCalledOnce();
  });
});

describe('the canvas’s own screen', () => {
  it('stands on the page in place of the design, with no ghost page under an in-flow one', () => {
    const { container, getByText } = render(<DesignStage displayType="inline" size="canvas" inFlow source={{ live: { template } }}><p>Lock</p></DesignStage>);

    expect(getByText('Lock').closest('.wconvert-stage__screen')).not.toBeNull();
    expect(container.querySelector('.wconvert-ghost')).toBeNull();
    expect(mounts).toHaveLength(0);
  });
});
