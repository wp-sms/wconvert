/**
 * How a counter and a rate are written, wherever they are read.
 *
 * Three screens show them now — the analytics cards, the Optin list, and the
 * builder's own header — and the rule below is a decision rather than a
 * formatting detail, so it is spelled once. A second copy is how "—" quietly
 * becomes "0%" on one screen and not another.
 */

export const formatCount = (count: number) => new Intl.NumberFormat().format(count);

/**
 * A rate, or an em dash.
 *
 * **Undefined is not zero.** Nothing was shown, so there is no denominator —
 * and "0%" is a claim that visitors saw it and did not act, which is a
 * different and much worse thing to tell a merchant about an Optin that never
 * rendered.
 */
export const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(rate * 100)}%`;
