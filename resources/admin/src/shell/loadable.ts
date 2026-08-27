/**
 * The three states a region that fetches is in, as one value.
 *
 * **Loading is a state and not the absence of data** (ADR 0039). Every screen in
 * this admin initialised from an `EMPTY` constant and rendered its *empty* state
 * during the first fetch — which on the creation flow produced a sentence that
 * was not true ("No ready-to-run starts for this Goal yet", while they were
 * loading). A union is what makes that unwritable: there is no value of this
 * type that is both loading and empty.
 *
 * It is a discriminated union rather than three `useState` calls because the
 * three are exclusive and three booleans are eight states, five of which are
 * nonsense. `data` and `message` are reachable only from the arm that has one,
 * so a component cannot read a message off a successful fetch.
 */
export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'failed'; readonly message: string };

/**
 * The state every region opens in.
 *
 * A shared constant rather than a literal per screen: `Loadable<never>` widens
 * to any `Loadable<T>`, so one value serves them all and nothing has to spell
 * the arm.
 */
export const LOADING: Loadable<never> = { status: 'loading' };

export const ready = <T>(data: T): Loadable<T> => ({ status: 'ready', data });

/**
 * A thrown thing, as the sentence a region will show.
 *
 * **`apiFetch` does not reject with an `Error`.** It rejects with WordPress's
 * REST error body — a plain `{ code, message, data }` object — so the
 * `instanceof Error ? cause.message : String(cause)` that all five screens
 * carried rendered every server-side failure as the string `[object Object]`.
 * Found in a browser against a real 500, not in a test: the four screens' own
 * suites all threw `new Error()` at it, which is the one shape it handled.
 *
 * So the object's `message` is read before falling back. `String(cause)` stays
 * as the last resort, because a rejection is not obliged to be either of the
 * two things above and a banner reading something odd is still better than a
 * banner reading nothing.
 *
 * It lives here rather than in four copies because that is what let one bug be
 * in four places.
 */
export const messageOf = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string' &&
    cause.message !== ''
  ) {
    return cause.message;
  }

  return String(cause);
};

export const failed = (cause: unknown): Loadable<never> => ({
  status: 'failed',
  message: messageOf(cause),
});
