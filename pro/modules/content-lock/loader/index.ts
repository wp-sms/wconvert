import type { LoaderModule, PayloadEntry, PresentationSession } from '@loader/types';
import { decide, type Decision } from '@loader/decide';
import { isWithinWindow } from '@loader/schedule';
import { captureEndpoint, PAYLOAD_ELEMENT_ID } from '@loader/payload';
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
const anchors = (id: string) => [...document.querySelectorAll<HTMLElement>('[data-wconvert-optin]')].filter(node => node.getAttribute('data-wconvert-optin') === id);
export function lockRegion(entry: Entry): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(`[${REGION}]`)].find(node => node.getAttribute(REGION) === lockFamily(entry));
}
export function lockAvailable(entry: Entry, input: Decision): boolean {
  return entry.display_type === 'inline' && entry.inline_placement == null && !!entry.template
    && entry.triggers?.length === 1 && entry.triggers[0].type === 'page_load'
    && isWithinWindow(entry, input.now) && !(entry.conditions ?? []).some(rule => input.withheld.has(rule.type))
    && (entry.conditions ?? []).every(rule => { try { return input.evaluators.get(rule.type)?.holds(rule) === true; } catch { return false; } });
}
function labels(): string[] {
  try {
    const value: unknown = JSON.parse(document.getElementById(PAYLOAD_ELEMENT_ID)?.getAttribute('data-content-lock') ?? 'null');
    if (Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'string')) return value;
  } catch { /* Missing labels do not block the content. */ }
  return ['Content unlocked.', 'Continue to content', 'Your submission could not be confirmed. The content is available below.'];
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
    watch: () => [...(base.watch?.() ?? []), ...(active?.entry.conditions ?? [])],
    show(entry: Entry, controls) {
      if (!lockConfigured(entry)) return base.show(entry, controls);
      const region = lockRegion(entry);
      const anchor = anchors(entry.anchor ?? entry.id)[0];
      if (!anchor || !entry.template) return false;
      const content = region?.querySelector<HTMLElement>(`:scope > [${CONTENT}]`);
      const ownAnchor = region?.querySelector<HTMLElement>(':scope > [data-wconvert-optin]');
      const validRegion = region && content && ownAnchor === anchor && !region.parentElement?.closest(`[${REGION}]`)
        && !content.querySelector(`[${REGION}],[data-wconvert-optin],form,iframe,video,audio,script`);
      const canLock = validRegion && !claimed && lockAvailable(entry, latest) && !content.contains(document.activeElement)
        && !(window.getSelection()?.anchorNode && content.contains(window.getSelection()!.anchorNode));
      if (region) region.dataset.wconvertLockState = !validRegion ? 'invalid' : claimed ? 'another' : 'fallback';
      if (ownAnchor === anchor && !canLock) return true;
      const reveal = (status: string) => { if (active?.entry.id === entry.id) open(status); };
      let mounted: Mounted | undefined;
      try {
        mounted = mount({ displayType: 'inline', template: entry.template, anchor, endsAt: entry.ends_at });
        if (!mounted.mounted || entry.template.tree.submissions.length === 0) { mounted.close(); return false; }
        const view = mounted;
        if (!view.root || !captureEndpoint()) { view.close(); return false; }
        mounts.push(view);
        bindJourney(view, entry, {
          onDismiss: () => controls.dismiss(),
          onCaptured() {
            const focus = view.root?.getRootNode() as ShadowRoot;
            const ownedFocus = !!focus.activeElement;
            reveal('captured');
            store.remember(lockFamily(entry));
            try { controls.convert(); } finally {
              if (!disposed) {
                if (canLock && content && view.root) {
                  const message = document.createElement('p');
                  message.textContent = labels()[0]; message.setAttribute('role', 'status'); message.tabIndex = -1;
                  view.root.append(message);
                  const button = document.createElement('button'); button.type = 'button'; button.className = 'wc-button'; button.textContent = labels()[1];
                  button.onclick = () => { content.tabIndex = -1; content.focus(); content.addEventListener('blur', () => content.removeAttribute('tabindex'), { once: true }); };
                  view.root.append(button);
                  if (ownedFocus) message.focus({ preventScroll: true });
                }
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
