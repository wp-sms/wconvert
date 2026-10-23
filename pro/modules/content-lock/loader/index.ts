import { pageLabel } from '@renderer/page-labels';
import { notifyCampaign } from '@loader/events';
import type { LoaderModule, PayloadEntry, PresentationSession } from '@loader/types';
import { decide, audienceAnswer, rulesOf, type Decision } from '@loader/decide';
import { isWithinWindow } from '@loader/schedule';
import { captureEndpoint, googleFontsAllowed } from '@loader/payload';
import { bindJourney } from '@loader/journey';
import { whenInViewport } from '@loader/present';
import { mount, type Mounted } from '@renderer/mount';
import { unlockStore } from './state';

export const CONTENT_LOCK_MODULES: readonly LoaderModule[] = [];
export const REGION = 'data-wconvert-content-lock';
const CONTENT = 'data-wconvert-locked-content';
type Entry = PayloadEntry & { content_lock?: { mode?: string }; campaign?: string; inline_placement?: unknown };
export const lockConfigured = (entry: Entry) => entry.content_lock?.mode === 'hide';
export const lockFamily = (entry: Entry) => entry.campaign ?? entry.anchor ?? entry.id;
const firstMatch = (attribute: string, id: string) => [...document.querySelectorAll<HTMLElement>(`[${attribute}]`)].find(node => node.getAttribute(attribute) === id);
export function lockRegion(entry: Entry): HTMLElement | undefined {
  return firstMatch(REGION, lockFamily(entry));
}
export function lockAvailable(entry: Entry, input: Decision): boolean {
  return entry.display_type === 'inline' && entry.inline_placement == null && !!entry.template
    && entry.display_rules?.opening.mode === 'immediate'
    && isWithinWindow(entry, input.now) && audienceAnswer(entry, input) === true;
}
/** Translated by `PageLabels` and read off the page, as the close button's name is. */
function labels(): string[] {
  return [pageLabel(23, 'Content unlocked.'), pageLabel(24, 'Continue to content'), pageLabel(25, 'Your submission could not be confirmed. The content is available below.')];
}

/** A single explicit region, composed around the existing presentation session. */
export function connectContentLock(base: PresentationSession, entries: readonly Entry[], changed: () => void): PresentationSession {
  const configured = entries.filter(lockConfigured);
  if (!configured.length) return base;
  const store = unlockStore();
  const skipped = new Set<string>();
  let initialized = false;
  let claimed = false;
  let active: { entry: Entry; region: HTMLElement; content: HTMLElement; mounted: Mounted } | undefined;
  let latest: Decision;
  const releases: (() => void)[] = [];
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mounts: Mounted[] = [];
  let disposed = false;
  function open(status: string) {
    if (!active) return;
    active.content.hidden = false;
    active.content.style.removeProperty('display');
    active.region.dataset.wconvertLockState = status;
    observer?.disconnect();
    active = undefined;
    clearTimeout(timer);
  }
  const notify = () => { if (!disposed) changed(); };
  const storage = (event: StorageEvent) => { if (event.key === store.key || event.key === null) notify(); };
  window.addEventListener('storage', storage);
  window.addEventListener('pageshow', notify);
  return {
    select: base.select,
    activeOverlay: base.activeOverlay,
    decide(input) {
      latest = input;
      if (active && (!lockAvailable(active.entry, input) || !active.region.isConnected || !active.mounted.root?.isConnected)) {
        active.mounted.close(); open('fallback');
      }
      if (active && store.has(lockFamily(active.entry))) { active.mounted.close(); open('remembered'); }
      const verdict = (base.decide ?? decide)(input);
      if (!initialized) {
        initialized = true;
        for (const entry of configured) {
          const region = lockRegion(entry);
          if (store.has(lockFamily(entry))) {
            if (region) region.dataset.wconvertLockState = 'remembered';
            skipped.add(entry.id);
          } else if (!verdict.show.some(candidate => candidate.id === entry.id)) {
            if (region) region.dataset.wconvertLockState = 'unavailable';
            skipped.add(entry.id);
          }
        }
      }
      clearTimeout(timer);
      if (active?.entry.ends_at !== undefined) timer = setTimeout(notify, Math.max(0, Math.min(active.entry.ends_at - input.now, 2147483647)));
      // DOM order decides between manual regions, independently of overlay priority.
      const show = verdict.show.filter(entry => !skipped.has(entry.id));
      const lockers = show.filter(lockConfigured).sort((a, b) => {
        const left = lockRegion(a), right = lockRegion(b);
        return left && right && (left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_PRECEDING) ? 1 : -1;
      });
      return { ...verdict, show: [...show.filter(entry => !lockConfigured(entry)), ...lockers], live: verdict.live || !!active || lockers.length > 0 };
    },
    watch: () => [...(base.watch?.() ?? []), ...(active ? rulesOf(active.entry) : [])],
    show(entry: Entry, controls) {
      if (!lockConfigured(entry)) return base.show(entry, controls);
      const region = lockRegion(entry);
      const anchor = firstMatch('data-wconvert-optin', entry.anchor ?? entry.id);
      if (!anchor || !entry.template) return false;
      const content = region?.querySelector<HTMLElement>(`:scope > [${CONTENT}]`);
      const ownAnchor = region?.querySelector<HTMLElement>(':scope > [data-wconvert-optin]');
      const validRegion = region && content && ownAnchor === anchor && !region.parentElement?.closest(`[${REGION}]`)
        && !content.querySelector(`[${REGION}],[data-wconvert-optin],form,iframe,video,audio,script`);
      const selection = window.getSelection()?.anchorNode;
      const canLock = validRegion && !claimed && lockAvailable(entry, latest) && !content.contains(document.activeElement)
        && !(selection && content.contains(selection));
      if (region) region.dataset.wconvertLockState = !validRegion ? 'invalid' : claimed ? 'another' : 'fallback';
      if (ownAnchor === anchor && !canLock) return true;
      const reveal = (status: string) => { if (active?.entry.id === entry.id) open(status); };
      let mounted: Mounted | undefined;
      try {
        mounted = mount({ displayType: 'inline', template: entry.template, anchor, endsAt: entry.ends_at, googleFonts: googleFontsAllowed() });
        if (!mounted.mounted || entry.template.tree.submissions.length === 0) { mounted.close(); return false; }
        const view = mounted;
        if (!view.root || !captureEndpoint()) { view.close(); return false; }
        mounts.push(view);
        bindJourney(view, entry, {
          onLeadAccepted: () => notifyCampaign(entry, 'capture'),
          onDismiss: () => controls.dismiss(),
          onCaptured() {
            const root = view.root!;
            const ownedFocus = (root.getRootNode() as ShadowRoot).activeElement;
            reveal('captured');
            store.remember(lockFamily(entry));
            try { controls.convert(); } finally {
              if (!disposed && canLock) {
                // Join the success copy's column so nested panels supply their
                // padding, gap and scoped styles (including narrow overrides).
                const layout = root.querySelector('.wc-heading,.wc-text')?.closest<HTMLElement>('.wc-stack,.wc-panel,.wc-media') ?? root;
                if (layout === root) layout.className += ' wc-stack';
                const message = document.createElement('p');
                message.className = 'wc-text';
                message.textContent = labels()[0]; message.role = 'status'; message.tabIndex = -1;
                const button = document.createElement('button'); button.type = 'button'; button.className = 'wc-button'; button.textContent = labels()[1];
                button.onclick = () => { content.tabIndex = -1; content.focus(); content.addEventListener('blur', () => content.removeAttribute('tabindex'), { once: true }); };
                layout.append(message, button);
                if (ownedFocus) message.focus({ preventScroll: true });
              }
            }
            notify();
          },
          onRefused(kind) {
            if (kind === 'unconfirmed') {
              reveal('fallback');
              const error = view.root?.querySelector('.wc-error');
              if (error && canLock) error.textContent = labels()[2];
              notify();
            }
          },
        });
        view.show();
        if (canLock && region && content) {
          active = { entry, region, content, mounted: view };
          content.hidden = true; content.style.setProperty('display', 'none', 'important');
          if (getComputedStyle(content).display !== 'none') { reveal('fallback'); view.close(); return false; }
          claimed = true; region.dataset.wconvertLockState = 'locked';
          observer = new MutationObserver(notify);
          observer.observe(region, { childList: true, subtree: true });
        }
        releases.push(whenInViewport(anchor, () => controls.impression()));
        queueMicrotask(notify);
        return true;
      } catch { reveal('fallback'); mounted?.close(); return false; }
    },
    dispose() {
      disposed = true; open('fallback'); clearTimeout(timer); releases.forEach(release => release());
      for (const mounted of mounts) mounted.close();
      window.removeEventListener('storage', storage); window.removeEventListener('pageshow', notify);
      base.dispose?.();
    },
  };
}
