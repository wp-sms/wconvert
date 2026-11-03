import { useLayoutEffect, type RefObject } from 'react';

/**
 * wp-admin's menu is a float that sets the document's height, so a menu taller
 * than the page leaves wp-admin's body showing under the frame. Publishing its
 * height lets the frame's floor reach the true bottom of the page. A CSS
 * variable, so a resize never re-renders the screen.
 *
 * The list as well as its wrap, because under 782px the open list is out of
 * flow: the wrap stays 0 tall and the list overflows it to set the document's
 * height, and can grow without the wrap changing size at all. Measured against
 * the wrap, so scrolling a pinned menu cannot move the result.
 */
export function useAdminMenuFloor(panelRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const wrap = document.getElementById('adminmenuwrap');
    const list = document.getElementById('adminmenu');
    if (!enabled || !panel || !wrap || !list || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const box = wrap.getBoundingClientRect();
      const floor = Math.max(box.height, list.getBoundingClientRect().bottom - box.top);
      panel.style.setProperty('--wconvert-menu-floor', `${floor}px`);
    });
    observer.observe(wrap);
    observer.observe(list);

    return () => {
      observer.disconnect();
      panel.style.removeProperty('--wconvert-menu-floor');
    };
  }, [panelRef, enabled]);
}
