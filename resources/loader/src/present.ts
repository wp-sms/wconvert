import type { Presenter } from './types';

/**
 * The presenter seam, and its stub.
 *
 * Deciding WHETHER to show an Optin and knowing HOW to draw one are different
 * jobs, and this is the join. The renderer that replaces this arrives with the
 * template vocabulary; it is a pure function of (tree, tokens) and is imported
 * by the admin too, so it cannot live in here.
 *
 * The stub draws nothing and reports the Impression at once — which is the
 * correct moment for the three overlays, since they render in the top layer
 * and being rendered IS being on screen. The `inline` refinement, where the
 * moment is entering the viewport, needs something rendered to observe.
 *
 * Everything upstream of this is real: the rules are evaluated, the contest is
 * settled, the Impression is recorded and the frequency cap holds across days.
 * What a visitor would see is the only part missing.
 */
export const noRenderer: Presenter = {
  show: (_entry, controls) => controls.impression(),
};
