/**
 * The loader's module vocabulary.
 *
 * A LoaderModule is a build-time unit of loader behaviour. It is deliberately
 * NOT a runtime registration seam: ADR 0014 rejected `registerRule` and every
 * shape like it, because a second script that must register before the first
 * evaluates is exactly the silent failure ADR 0004 catalogued. Composition
 * happens where the bundler can see it, in an entry file, and the page never
 * has two scripts to reorder.
 *
 * The interface carries an id and nothing else yet. What a module actually
 * CONTRIBUTES — trigger implementations, condition implementations, the fields
 * the rule manifest declares beside them — arrives with the manifest, in the
 * ticket that introduces it. Guessing at it here would be writing the shape
 * before its subject.
 */
export interface LoaderModule {
  /** Stable identifier, unique across free's modules and Pro's together. */
  readonly id: string;
}

/**
 * A composed loader: the module set an entry point assembled.
 */
export interface Loader {
  readonly modules: readonly LoaderModule[];
}
