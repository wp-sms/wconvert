import type { Presenter } from './types';

/**
 * The presenter seam, and its stub.
 *
 * Deciding WHETHER to show an Optin and knowing HOW to draw one are different
 * jobs, and this is the join. The renderer that replaces this arrives with the
 * template vocabulary; it is a pure function of (tree, tokens) and is imported
 * by the admin too, so it cannot live in here.
 *
 * The stub shows nothing and reports nothing. Everything upstream of it is
 * real: the rules are evaluated, the contest is settled, the Impression is
 * recorded and the frequency cap holds across days. What a visitor would see
 * is the only part missing.
 */
export const noRenderer: Presenter = {
  show: () => {
    // Deliberately empty. `controls.dismiss()` and `controls.convert()` are
    // what a real renderer calls back on, and there is nothing here to call
    // them from.
  },
};
