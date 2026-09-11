import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../components/ui/button';

/**
 * The body class that hides wp-admin's own chrome, and where it is remembered.
 *
 * ============================================================================
 * THE MECHANISM IS GUTENBERG'S, DELIBERATELY, DOWN TO THE SHAPE.
 * ============================================================================
 * `FullscreenMode` toggles a class on `document.body` and the hiding is CSS
 * elsewhere — no portal, no second root, nothing that could take this screen
 * out of the document it is in. Ours is spelled `wconvert-fullscreen` rather
 * than `is-fullscreen-mode` because the rules are ours: a shared class name
 * would mean the block editor's own stylesheet hiding our chrome, or ours
 * hiding theirs, on a screen where both are loaded.
 *
 * **`localStorage` rather than a user meta**, which is the whole reason this
 * needs no endpoint: it is a per-browser convenience about how one screen is
 * arranged, not a fact about the site. It reads once, on mount, and a browser
 * that refuses storage (private mode, blocked site data) simply starts folded —
 * which is the default anyway, so the failure is invisible rather than fatal.
 */
const CLASS = 'wconvert-fullscreen';
const REMEMBERED = 'wconvert:fullscreen';

/**
 * Hide wp-admin's chrome, and give the editor the ~192px back.
 *
 * ============================================================================
 * DEFAULT OFF, AND THAT IS THE DECISION RATHER THAN THE SAFE OPTION.
 * ============================================================================
 * It costs the merchant their navigation. Gutenberg shipped fullscreen ON by
 * default and *"where did the WordPress menu go"* became the single most
 * searched-for thing about the block editor — a plugin whose first screen
 * removes the admin menu is a plugin the merchant has to work out how to undo
 * before they can use it. Three panes fit at ~1040px of container without this;
 * fullscreen is what a merchant reaches for when they want more room, which is
 * a different thing from what they get on arrival.
 *
 * Escape exits, because a mode with no keyboard way out is a trap — and because
 * a merchant who cannot find the toggle will press it.
 */
export function Fullscreen() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(remembered());
  }, []);

  useEffect(() => {
    document.body.classList.toggle(CLASS, on);

    /*
      **Removed on unmount, always.** The class is on `<body>`, which outlives
      this component: leaving the builder with it set would hide the admin menu
      on the Optins list, which is a screen with no toggle on it at all.
    */
    return () => document.body.classList.remove(CLASS);
  }, [on]);

  const exit = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOn(false);
      remember(false);
    }
  }, []);

  useEffect(() => {
    if (!on) {
      return;
    }

    /*
      **On `document` and only while the mode is on.** A dialog inside the
      builder handles its own Escape and stops the event before it reaches here
      — Radix calls `preventDefault` and the listener order puts the dialog
      first — so pressing Escape in the design picker closes the picker rather
      than the mode.
    */
    document.addEventListener('keydown', exit);

    return () => document.removeEventListener('keydown', exit);
  }, [on, exit]);

  const Icon = on ? Minimize2 : Maximize2;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={on}
      title={on ? __('Show the menu', 'wconvert') : __('Full width', 'wconvert')}
      aria-label={on ? __('Show the menu', 'wconvert') : __('Full width', 'wconvert')}
      onClick={() => {
        setOn(!on);
        remember(!on);
      }}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

/**
 * Every read and write is wrapped, because `localStorage` THROWS rather than
 * returning null where site data is blocked — a private window, a browser set
 * to refuse storage, or an iframe with no storage access. An editor that fails
 * to open because it could not remember a layout preference would be the worst
 * possible trade.
 */
function remembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBERED) === 'on';
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    window.localStorage.setItem(REMEMBERED, on ? 'on' : 'off');
  } catch {
    // Nothing to do and nothing to say: the mode still works for this visit.
  }
}
