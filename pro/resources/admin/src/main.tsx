import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/index.css';
import { PRO_SCREENS } from './screens';
import { previewSurfaces } from '@/previewSurfaces';
import { decorateFullscreen } from '../../../modules/display-types/loader/surface';
import { reopenControls } from '@/reopenControls';
import { inlinePlacementControls } from '@/inlinePlacement';

reopenControls.component = lazy(() => import('../../../modules/display-types/admin/ReopenSettings'));
previewSurfaces.fullscreen = decorateFullscreen;
inlinePlacementControls.component = lazy(() => import('../../../modules/inline-placement/admin/PlacementSettings'));

/**
 * WConvert Pro's admin entry — free's screens plus Pro's, in ONE bundle.
 *
 * =============================================================================
 * PRO REPLACES THE ADMIN BUNDLE RATHER THAN AUGMENTING IT (ADR 0014).
 * =============================================================================
 * This is the same composition ADR 0014 already describes for the loader,
 * applied to the admin: Pro's entry imports free's app through the `@` alias
 * the shadcn CLI already writes against, adds its own, and Pro's PHP dequeues
 * free's script before a byte of HTML exists
 * ({@link ../../../src/Admin/ProAdminEnqueue.php}).
 *
 * **The rejected alternative is runtime injection**, and it is what two
 * separately-installed plugins normally force: free's bundle boots, Pro's
 * second script finds free's React on the page and mounts extra screens into
 * it. Both reference products dodge that question entirely because their
 * premium build IS the plugin rather than a companion beside it — so neither
 * has an answer to borrow.
 *
 * Injection fails the way ADR 0004 catalogues. It needs Pro's script to run
 * after free's app has mounted and before the merchant clicks anything, which
 * is a load-order contract across two script tags on a page an optimiser is
 * free to reorder, aggregate and defer. It also needs free to grow a
 * registration seam — a public API that becomes a compatibility surface the
 * moment it exists — and it puts a SECOND React copy one bundling mistake
 * away, whose first `useState` throws *"Invalid hook call"* against a copy
 * that never rendered it. Replacement has none of those: one script, one
 * React, and a swap that happens in PHP.
 *
 * **The import direction is one-way**, exactly as the loader's is: Pro reaches
 * into free, free never reaches into Pro. `bin/pro-ts-scan.php` proves it on
 * every pull request and needed no change to cover this file.
 *
 * =============================================================================
 * THE MOUNT NODE IS FREE'S, AND SO IS THE GUARD AROUND IT.
 * =============================================================================
 * `#wconvert-admin` is written by free's `AdminMenu::renderScreen()`, which
 * still runs — Pro replaces the SCRIPT, not the screen. Missing it means the
 * page changed and this was left behind, so this does nothing rather than
 * throwing into a wp-admin page that is otherwise fine.
 */
const mount = document.getElementById('wconvert-admin');

if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/**
 * What this entry composed, stated rather than only used.
 *
 * Exported for the reason Pro's loader entry exports its presenter: the whole
 * content of the file is a pair of choices, and a test is what stops either
 * being made wrongly. Nothing at runtime reads it.
 */
export const screens = PRO_SCREENS;
