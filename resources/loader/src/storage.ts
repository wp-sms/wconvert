/**
 * Where per-visitor state goes, and the ladder it falls down.
 *
 * **`localStorage` → cookie → in-memory, failing OPEN** (issue #3). With both
 * stores blocked every visitor looks new, so no cap holds and the Optin fires
 * on every page view — annoying. Failing shut instead means a
 * privacy-refusing visitor sees nothing at all, which for a free plugin is a
 * large silent loss of function. Annoying beats broken.
 *
 * WHAT IS STORED IS THE RECORD ITSELF, NEVER A KEY TO ONE (ADR 0017). WConvert
 * mints no visitor identifier — no id cookie, no device id, no hashed
 * fingerprint — so there is nothing here to look a record up with. The
 * prototype's `wcv_id` cookie held a persistent random per-device value with a
 * one-year lifetime, which is an identifier whatever its comment said, and it
 * is the artefact this module exists not to have.
 */

const ONE_YEAR = 31_536_000;

export interface Store {
  read(): string | null;
  write(value: string): void;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));

  return match === null ? null : decodeURIComponent(match[1]);
}

function writeCookie(name: string, value: string): void {
  // `SameSite=Lax` and no `Secure`, because this must be readable on the plain
  // HTTP a development install still serves; nothing in it is a secret.
  document.cookie =
    name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + ONE_YEAR + ';SameSite=Lax';
}

/**
 * The ladder, closed over one key.
 *
 * Reads walk DOWN it, because a visitor whose `localStorage` was cleared may
 * still have the cookie a previous visit wrote — and a record that survives one
 * store's eviction is the whole point of having two.
 *
 * Writes go to memory first and always, so a page view is internally
 * consistent even when nothing can be persisted at all.
 */
export function persistentStore(key: string): Store {
  let memory: string | null = null;

  return {
    read(): string | null {
      try {
        const stored = localStorage.getItem(key);

        if (stored !== null) {
          return stored;
        }
      } catch {
        // Private browsing, ITP, a quota'd-out origin. Fall down the ladder.
      }

      try {
        const stored = readCookie(key);

        if (stored !== null) {
          return stored;
        }
      } catch {
        // Some embedded contexts throw on `document.cookie`.
      }

      return memory;
    },

    write(value: string): void {
      memory = value;

      try {
        localStorage.setItem(key, value);

        return;
      } catch {
        // Fall through to the cookie rather than giving up: this is the case
        // the ladder exists for.
      }

      try {
        writeCookie(key, value);
      } catch {
        // Memory only. The cap holds for this page view and no longer, which
        // is the fail-open end of the ladder.
      }
    },
  };
}
