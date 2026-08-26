import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { readDestinations, type Destination } from '../destinations/api';

/**
 * Which [[Destination]]s this [[Optin]] pushes to.
 *
 * **An Optin holds Destination ids and nothing more.** No audience, no tags,
 * no field map: a Destination is configured once, site-wide, and *includes*
 * whatever selects the target inside the remote system, so two Optins feeding
 * one audience reference one Destination. The per-Optin field map that would
 * normally sit here is eliminated by canonical field keys (CONTEXT.md,
 * Destination).
 *
 * A Destination whose type is not `ready` is still shown and still bindable —
 * the binding is a decision the merchant made, and unbinding it because a
 * plugin was deactivated for an afternoon would lose it silently. It is the
 * DISPATCH that skips it, on every capture, and self-heals when the dependency
 * comes back (ADR 0027 draws the same line for a suspended [[Condition]]).
 */
export interface DestinationsEditorProps {
  readonly bound: readonly string[];
  readonly onChange: (bound: string[]) => void;
  readonly onError: (cause: unknown) => void;
}

export function DestinationsEditor({ bound, onChange, onError }: DestinationsEditorProps) {
  const [available, setAvailable] = useState<Destination[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setAvailable((await readDestinations()).destinations);
      } catch (cause) {
        onError(cause);
      }
    })();
    // The list is site-level configuration rather than a function of this
    // Optin, so it is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="wconvert-destinations-editor">
      <h3>{__('Where these Leads go', 'wconvert')}</h3>

      {available === null ? (
        <p className="description">{__('Loading…', 'wconvert')}</p>
      ) : available.length === 0 ? (
        <p className="description">
          {__(
            'No Destinations are set up yet. Leads are still captured and still exported — a Destination only sends them on.',
            'wconvert'
          )}
        </p>
      ) : (
        <ul>
          {available.map((destination) => (
            <li key={destination.id}>
              <label>
                <input
                  type="checkbox"
                  checked={bound.includes(destination.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...bound, destination.id]
                        : bound.filter((id) => id !== destination.id)
                    )
                  }
                />{' '}
                {destination.label}
              </label>{' '}
              {destination.availability !== 'ready' && (
                <span className="description">
                  {__('Not running right now — captures still work, pushes wait.', 'wconvert')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
