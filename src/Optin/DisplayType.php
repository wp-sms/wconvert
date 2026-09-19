<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * How an [[Optin]] arrives on the page — the four containers, closed.
 *
 * ============================================================================
 * THE ONE PAYLOAD KEY THAT REACHED THE BROWSER WITHOUT BEING VALIDATED.
 * ============================================================================
 * `display_type` is shipped: the loader reads it to decide whether an entry is
 * an overlay at all (`decide.ts`), and the renderer reads it to choose between
 * mounting inline and mounting into the top layer (`mount.ts`). It travelled
 * out of the `config` blob exactly as the REST body sent it — an arbitrary
 * string, from the request, onto every matching page — because
 * `OptinController::normalizeConfig()` validated `targeting`, `rules`,
 * `frequency`, `destinations` and `template` and never this.
 *
 * That is the same gap the pre-release audit closed on the projection one file
 * over, from the other end: the projection decides which keys leave, and this
 * decides what one of them may contain. Both are the closed-vocabulary
 * discipline the rest of the config already gets.
 *
 * **An enum, for {@see \WConvert\Goal\Goal}'s stated reason.** The set is
 * closed in PHP, where adding a case is a code change a reviewer reads — not a
 * `VARCHAR` validated by hand, and not an `ENUM` in the DDL, which would make
 * a new placement the more expensive half of the same edit. It is the sixth
 * closed set this project has refused to open.
 *
 * ============================================================================
 * TIER IS NOT DECLARED HERE, AND THAT IS DELIBERATE.
 * ============================================================================
 * Two of these four are [[Pro]]'s: a free install ships no floating-bar or
 * slide-in TREE, only the locked card that advertises one
 * ({@see \WConvert\Template\LockedTemplates}). Putting `tier` beside each case
 * would be a second entitlement list to keep in step with the library, and
 * ADR 0015 answers "can this install do it" by which code registered rather
 * than by a table anybody maintains. A free install cannot obtain a
 * floating-bar design to name here in the first place.
 *
 * So this enum answers one question only — *is this a placement WConvert has a
 * word for* — and the answer is the same on both tiers.
 *
 * @since 0.1.0
 */
enum DisplayType: string
{
    /** The default everywhere, and the one every install has. */
    case Popup = 'popup';

    /**
     * In the flow of the page, at a shortcode or block. The one placement that
     * is not an overlay, which is what `decide.ts` tests for by name and the
     * reason arbitration leaves it alone.
     */
    case Inline = 'inline';

    /** Pinned to the top or bottom edge. Pro supplies the designs. */
    case FloatingBar = 'floating_bar';

    /** Enters from a corner. Pro supplies the designs. */
    case SlideIn = 'slide_in';

    /**
     * The stored spelling of a Display Type, or null where the value is not
     * one this build has a word for.
     *
     * **Absent is `popup`, everywhere on both sides**, which is what makes
     * dropping an unrecognised value the right normalisation rather than a
     * lossy one: `mount.ts` treats `undefined` as a popup and `decide.ts`
     * reads anything that is not `inline` as an overlay. So a config that
     * arrives naming a placement nothing can render falls back to the
     * placement every install has, instead of reaching the page as a string
     * the renderer will compare against and never match.
     *
     * A **valid** value is never dropped, including `popup` itself. The
     * builder resolves the gallery's filter from `config.display_type` and
     * falls back to the first template in the index when the key is absent, so
     * eliding the default here would silently re-filter the design picker.
     * That is a different rule from `frequency` and `priority`, where absence
     * is genuinely free — and the difference is that those have one reader and
     * this has three.
     *
     * @param mixed $value
     */
    public static function of($value): ?self
    {
        return is_string($value) ? self::tryFrom($value) : null;
    }
}
