import { isChoiceHeld, valueOfChoice } from './panel';

/**
 * One setting of a block, as the closed list the manifest offers for it.
 *
 * ============================================================================
 * ONE CONTROL FOR BOTH LEVELS OF THE VOCABULARY, BECAUSE THERE IS ONE QUESTION.
 * ============================================================================
 * A layout's `split.ratio` and a leaf's `heading.level`, `image.fit` and
 * `field.required` are the same shape: a param, a handful of offered values,
 * and words for each that the merchant reads instead of the value. The layout
 * half shipped first and lived inside {@see BlockInspector}; writing the leaf
 * half beside it would have been a second radio group with its own idea of
 * what *selected* looks like — which is the failure ADR 0042 rule 5 names, and
 * this screen has already had four of.
 *
 * So it is one component and the caller supplies the words. That is also what
 * keeps the two label maps apart where they belong: a layout's are keyed
 * `"{layout}.{param}"` and a leaf's `"{node}.{param}"`, and neither this file
 * nor its callers spell a param or a value of their own.
 *
 * ============================================================================
 * ABSENT IS AN ANSWER. OFF-LIST IS NOT.
 * ============================================================================
 * `choices` is what the panel OFFERS and never what is allowed — the vocabulary
 * does not validate a param's value, so a design shipping `ratio: 0.4` or
 * `fit: "none"` keeps it. The control then has no answer to highlight, and the
 * honest thing is to highlight none: checking the nearest one would be the
 * screen quietly telling the merchant their design is something it is not.
 *
 * **An ABSENT key is the opposite case and was being given the same answer.**
 * No shipped [[Template]] carries a `level`, so every heading in the library
 * drew two chips with neither ticked while the renderer drew an unambiguous
 * `h2`. `fallback` is the manifest's declared default — what the renderer does
 * with nothing — and it is what a merchant is actually looking at.
 */
export function ParamChoice({
  id,
  label,
  offered,
  held,
  fallback,
  nameOfValue,
  onChange,
}: {
  /** A stable key for the radio group — never a translated string. */
  readonly id: string;
  readonly label: string;
  readonly offered: readonly string[];
  /** What the node holds, which may be absent and may be off the list. */
  readonly held: unknown;
  /**
   * What the renderer draws where it holds nothing — the manifest's declared
   * default, never a guess made here.
   */
  readonly fallback?: string;
  readonly nameOfValue: (choice: string) => string;
  readonly onChange: (value: unknown) => void;
}) {
  if (offered.length === 0) {
    return null;
  }

  return (
    <div className="wconvert-token">
      <span id={`wconvert-param-${id}`}>{label}</span>
      {/*
        **A group with a name, because a set of radios is one control.** Without
        it a screen reader announces four unrelated buttons and never the
        question they answer — and the question is the whole of what
        distinguishes *Required* from *Optional*.
      */}
      <span role="group" aria-labelledby={`wconvert-param-${id}`} className="wconvert-choice-set">
        {offered.map((choice) => (
          <label key={choice} className="wconvert-choice">
            <input
              type="radio"
              className="sr-only"
              name={`wconvert-param-${id}`}
              value={choice}
              checked={isChoiceHeld(held, choice, fallback)}
              onChange={() => onChange(valueOfChoice(choice))}
            />
            <span className="wconvert-choice__label">{nameOfValue(choice)}</span>
          </label>
        ))}
      </span>
    </div>
  );
}
