import { describe, expect, it } from 'vitest';
import { destinationsSaid, hintIn, hintSaid } from '../../resources/admin/src/builder/readiness';
import type { Destination, DestinationType } from '../../resources/admin/src/destinations/api';

/**
 * The readiness panel's two sentences, as pure functions.
 *
 * ============================================================================
 * ONE OF THEM READS A KEY THAT HAS BEEN WRITTEN AND NEVER READ.
 * ============================================================================
 * `Prefill::fromPlaybook()` has copied `destination_hint` into every
 * Playbook-started Optin since prefill shipped, `PublishedProjection` strips it
 * on the way to the browser because it is authoring state, and no screen has
 * ever opened it. `PrefillSnapshotTest` asserts it is stored; nothing asserted
 * anybody could see it.
 *
 * ============================================================================
 * THE HARD CASE IS A TYPE THIS INSTALL DOES NOT HAVE, AND IT IS NOT HYPOTHETICAL.
 * ============================================================================
 * `welcome-discount` names `email_service_provider`, which is not the id of any
 * registered [[Destination]] type on any install — the ESPs are Pro's and are
 * named for the vendor. A hint is written for every install rather than for
 * this one, so a type it names may simply be absent, and there is nothing here
 * that could put words to one: the words for a type come FROM the type.
 */

const type = (id: string, label: string): DestinationType => ({
  id,
  label,
  icon: 'send',
  tier: 'free',
  requires: null,
  requires_label: null,
  availability: 'ready',
  needs_connection: false,
  settings_schema: {},
});

const destination = (over: Partial<Destination> & { id: string; label: string }): Destination => ({
  type: 'wsms',
  connection: null,
  settings: {},
  availability: 'ready',
  health: {
    last_success_at: null,
    last_error: null,
    last_error_at: null,
    consecutive_failures: 0,
    skipped_captures: 0,
    last_skipped_at: null,
  },
  ...over,
});

const TYPES = [type('wsms', 'WP SMS'), type('lead_magnet_email', 'Lead magnet email')];

const FIELDS = { email: 'Email address', name: 'Name', phone: 'Phone number' };

describe('the playbook’s destination hint', () => {
  it('is read out of a config that has one', () => {
    expect(hintIn({ destination_hint: { types: ['wsms'], fields: ['email'] } })).toEqual({
      types: ['wsms'],
      fields: ['email'],
    });
  });

  it('is null on an Optin that started from no playbook', () => {
    expect(hintIn({})).toBeNull();
  });

  /**
   * `config` is a JSON blob a merchant's install may have been through several
   * versions of. A hint that arrived as a string would otherwise reach the
   * list joiner as characters, and the sentence would read *"captures w, s,
   * m, s"*.
   */
  it('keeps only the strings out of a hint that is not the shape it should be', () => {
    expect(hintIn({ destination_hint: { types: 'wsms', fields: ['email', 7, null] } })).toEqual({
      types: [],
      fields: ['email'],
    });
  });

  it('names both halves where the install has the type', () => {
    const said = hintSaid({ types: ['wsms'], fields: ['email'] }, TYPES, FIELDS);

    expect(said).toContain('Email address');
    expect(said).toContain('WP SMS');
  });

  /**
   * **The `welcome-discount` case.** It names `wsms` and
   * `email_service_provider`; only the first is a type any install registers,
   * so the sentence names WP SMS and says nothing about the other. Printing an
   * unresolved key at a merchant is printing our own vocabulary at them.
   */
  it('drops a type this install cannot name, and keeps the one it can', () => {
    const said = hintSaid(
      { types: ['wsms', 'email_service_provider'], fields: ['email'] },
      TYPES,
      FIELDS,
    );

    expect(said).toContain('WP SMS');
    expect(said).not.toContain('email_service_provider');
  });

  /**
   * And where it can name NONE of them, the fields are still the answer: they
   * are the closed capture vocabulary, named on every install.
   */
  it('still says what is captured when it can name no type at all', () => {
    const said = hintSaid({ types: ['email_service_provider'], fields: ['email'] }, [], FIELDS);

    expect(said).toBe('The playbook this started from captures Email address.');
  });

  it('says nothing at all where there is nothing to say', () => {
    expect(hintSaid(null, TYPES, FIELDS)).toBeNull();
    expect(hintSaid({ types: [], fields: [] }, TYPES, FIELDS)).toBeNull();
  });
});

describe('where the leads go', () => {
  /**
   * **"Nowhere" is not a fault.** The local [[Lead]] log is not a
   * [[Destination]] — it is written first and always — and CSV export works
   * with nothing configured, so a [[Standalone]] install is a fully working
   * install and the sentence must not read as a warning.
   */
  it('says leads are still captured when nothing is bound', () => {
    const said = destinationsSaid([], []);

    expect(said.empty).toBe(true);
    expect(said.problems).toEqual([]);
    expect(said.said).toContain('captured');
  });

  it('names what is bound', () => {
    const said = destinationsSaid(
      ['a', 'b'],
      [destination({ id: 'a', label: 'WP SMS' }), destination({ id: 'b', label: 'Newsletter' })],
    );

    expect(said.said).toBe('WP SMS and Newsletter');
    expect(said.problems).toEqual([]);
  });

  /**
   * A Destination whose type is not `ready` is skipped at dispatch and never
   * enqueued, so the captures are kept and the pushes are LOST until a re-push
   * replays them (#4, ADR 0008). The panel says which one.
   */
  it('names the destination that is not running here, rather than counting them', () => {
    const said = destinationsSaid(
      ['a', 'b'],
      [
        destination({ id: 'a', label: 'WP SMS', availability: 'unavailable' }),
        destination({ id: 'b', label: 'Newsletter' }),
      ],
    );

    expect(said.problems).toHaveLength(1);
    expect(said.problems[0]).toContain('WP SMS');
    expect(said.problems[0]).not.toContain('Newsletter');
  });

  it('reports an outage as the run of failures it is', () => {
    const said = destinationsSaid(
      ['a'],
      [
        destination({
          id: 'a',
          label: 'WP SMS',
          health: {
            last_success_at: null,
            last_error: 'nope',
            last_error_at: null,
            consecutive_failures: 3,
            skipped_captures: 0,
            last_skipped_at: null,
          },
        }),
      ],
    );

    expect(said.problems[0]).toBe('WP SMS has failed 3 times in a row.');
  });

  /**
   * **A binding whose Destination has been deleted is otherwise silent.** The
   * Destinations tab draws a checkbox per Destination that EXISTS, so a binding
   * to one that does not appears nowhere on that screen at all — the Optin
   * simply pushes to one fewer place than the merchant believes.
   */
  it('reports a binding whose destination is gone', () => {
    const said = destinationsSaid(['a', 'gone'], [destination({ id: 'a', label: 'WP SMS' })]);

    expect(said.said).toBe('WP SMS');
    expect(said.problems).toHaveLength(1);
    expect(said.problems[0]).toContain('deleted');
  });

  /**
   * **Every binding gone at once.** *"Leads go to 2 destinations"* is a sentence
   * the line under it contradicts, and *"Nowhere"* is the answer for an Optin
   * nobody ever bound — which is not this one.
   */
  it('says nothing still exists where every binding has been deleted', () => {
    const said = destinationsSaid(['gone', 'also-gone'], []);

    expect(said.empty).toBe(false);
    expect(said.said).toBe('Nothing that still exists.');
    expect(said.problems[0]).toContain('2 destinations');
  });

  /**
   * The read is swallowed on failure and is null while in flight. The panel
   * still knows the Optin is bound to something, and saying how many is honest
   * where naming them is not yet possible — an empty *"Nowhere"* would be a
   * claim the config contradicts.
   */
  it('counts rather than names while the destinations have not arrived', () => {
    const said = destinationsSaid(['a', 'b'], null);

    expect(said.empty).toBe(false);
    expect(said.said).toBe('2 destinations');
  });
});
