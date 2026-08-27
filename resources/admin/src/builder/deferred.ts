/**
 * Everything on the far side of the lazy boundary (#73).
 *
 * ============================================================================
 * THIS FILE IS THE CHUNK. THAT IS ITS ONLY JOB.
 * ============================================================================
 * `builder/lazy.tsx` reaches the two screens below through a single `import()`
 * of this module, and one dynamic import is what makes one chunk: Rollup names
 * a chunk after the module the import points at, and everything reachable only
 * from here — the gallery, the settings panel, the rules and targeting and
 * destinations editors, the preview, `react-colorful`, Radix's Popover, and the
 * renderer the loader also imports — lands in it. Two separate `import()`s
 * would give two chunks plus a third for what they share, which is three
 * requests and two more figures to explain in a build log.
 *
 * **Nothing may import this file statically.** A static import from anything
 * the reading screens reach pulls the whole subtree back into `main.js` and
 * undoes the split silently — the build still succeeds, the screens still work,
 * and the only symptom is a number in the build log nobody was watching. The
 * one legitimate importer is the `import()` in `lazy.tsx`.
 *
 * **Creation is on this side of the line, and that is not a stretch.** The
 * goal-first flow ends in the builder by construction — *"pick a [[Goal]], pick
 * a [[Playbook]] under it, land in an editor holding a prefilled [[Optin]]"* —
 * and its own last step draws the real design through the renderer, because
 * there are no static thumbnails anywhere in this flow (ADR 0010). Leaving it
 * eager would put the renderer back in every reading screen to serve a screen
 * whose next click loads the builder anyway.
 */

export { OptinBuilder } from './OptinBuilder';
export { GoalScreen } from '../goals/GoalScreen';
