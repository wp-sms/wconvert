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
 * The `instanceof Error` narrowing was written out in four screens and got the
 * same two lines every time. It lives here because the alternative is a fifth
 * copy that says `String(cause)` for an `Error` and prints `[object Object]`.
 */
export const failed = (cause: unknown): Loadable<never> => ({
  status: 'failed',
  message: cause instanceof Error ? cause.message : String(cause),
});
