<?php

namespace WConvert\Frontend;

use WConvert\Rules\RuleLabels;
use WConvert\Targeting\TargetingExplainer;

defined('ABSPATH') || exit;

/**
 * Every word the eligibility inspector puts on screen.
 *
 * ============================================================================
 * MINTED IN PHP BECAUSE `wp i18n make-pot` CANNOT SEE A STRING IN A TS BUNDLE.
 * ============================================================================
 * The inspector's panel is TypeScript — it has to be, because half of what it
 * reports is browser state PHP cannot reach — but a translated string has to
 * be somewhere the POT scanner walks. So the panel is handed a dictionary and
 * spells no merchant-facing word of its own, which is the same split
 * {@see RuleLabels} already carries for the rule vocabulary (ADR 0013, read
 * from the other end).
 *
 * **The templates carry one `%s` and never two.** The panel substitutes with a
 * single `String.replace`, because the inspector bundle takes no
 * `@wordpress/i18n` — it is composed from the loader's own module set, which
 * has no dependencies at all (ADR 0004). One placeholder is what that
 * substitution can do honestly; a second would need a formatter, and a
 * formatter in this bundle is a dependency in the loader's graph.
 *
 * @since 0.1.0
 */
final class InspectorLabels
{
    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        return [
            'title' => __('Why each popup did or did not show', 'wconvert'),
            'intro' => __(
                'Published rules on this page, with browser allowances as the page began. Unsaved draft changes are not included. Only you can see this report.',
                'wconvert'
            ),
            'close' => __('Close', 'wconvert'),
            'collapse' => __('Collapse', 'wconvert'),
            'expand' => __('Expand', 'wconvert'),
            'nothing' => __('This site has no Campaigns yet.', 'wconvert'),
            'fullscreen' => __('Format: Fullscreen — covers the viewport until dismissed.', 'wconvert'),
            'placement' => [
                /* translators: %s: a logical overlay position, such as “Top” or “Bottom end”. */
                'position' => __('Position: %s', 'wconvert'),
                'block_start' => __('Top', 'wconvert'),
                'block_end' => __('Bottom', 'wconvert'),
                'block_start_inline_start' => __('Top start', 'wconvert'),
                'block_start_inline_end' => __('Top end', 'wconvert'),
                'block_end_inline_start' => __('Bottom start', 'wconvert'),
                'block_end_inline_end' => __('Bottom end', 'wconvert'),
            ],

            // ================================================================
            // THE FUNNEL. THE FIRST GATE THAT CLOSES IS THE ANSWER.
            // ================================================================
            'gates' => [
                'published' => __('Published', 'wconvert'),
                'suspended' => __('Not suspended', 'wconvert'),
                'targeting' => __('Allowed on this page', 'wconvert'),
                'payload' => __('Reached the browser', 'wconvert'),
                // AFTER "reached the browser", and the order is the whole
                // scheduling decision written down: a not-yet-started Optin is
                // published, is in the projection, and does reach the page —
                // it has to, because the set is rebuilt on write and a
                // full-page cache can serve the same HTML for days (ADR 0003).
                'schedule' => __('Inside its schedule', 'wconvert'),
                'frequency' => __('Allowance not spent', 'wconvert'),
                'consent' => __('Consent given', 'wconvert'),
                'trigger' => __('Has a trigger this site can fire', 'wconvert'),
                'conditions' => __('Conditions hold', 'wconvert'),
                'fired' => __('A trigger fired', 'wconvert'),
                'won' => __('Won the page view', 'wconvert'),
            ],

            /**
             * Why it stopped, one per gate.
             *
             * **A draft is the commonest confusion of all**, which is why the
             * funnel starts before publication rather than at the published
             * set: a merchant asking "why doesn't my popup show" has very
             * often not published it, and a screen that silently omitted their
             * draft would leave the likeliest cause unsaid.
             */
            'stopped' => [
                'audience_server' => __('The published audience groups do not match the signed-in status or roles of this request.', 'wconvert'),
                'automatic_missing' => __('No automatic placement location was generated on this page. Check supported post/page content, paragraph fallback, and page-builder compatibility; use a manual block or shortcode if needed.', 'wconvert'),
                'automatic_lost' => __('Another eligible automatic Campaign won this page’s inline placement. Check automatic placement priority.', 'wconvert'),
                'draft' => __('Not published yet, so it shows nowhere.', 'wconvert'),
                'deleted' => __('Deleted.', 'wconvert'),
                TargetingExplainer::EXCLUDED => __('This page is in its exclusion list.', 'wconvert'),
                TargetingExplainer::NOT_INCLUDED => __('This page is not in the pages it shows on.', 'wconvert'),
                // ============================================================
                // THE ONE QUESTION THIS SCREEN CANNOT ANSWER, SAID OUT LOUD.
                // ============================================================
                // The merchant is signed in — that is what let them open this
                // panel — so "what does a signed-out visitor see" is
                // unanswerable here and is never simulated. It is reported as
                // a fact about THIS request instead.
                'wants_signed_out' => __(
                    'It shows only to signed-out visitors. You are signed in, so it is not showing to you.',
                    'wconvert'
                ),
                'wants_signed_in' => __(
                    'It shows only to signed-in visitors, and you are signed out.',
                    'wconvert'
                ),
                // The same limit one predicate along, and sharper: the panel
                // opens because this merchant is an administrator, so the
                // roles they hold are not the roles the Optin is aimed at and
                // cannot be made to be. Reported as a fact about THIS request.
                //
                // One `%s`, filled with the role SLUGS the Optin wants. Not
                // their display names: those are a fact about the install —
                // whatever registered them — so naming them would mean
                // shipping the whole offered map into a bundle for a sentence
                // one Optin in a hundred prints. The slug is what is stored
                // and what an administrator recognises.
                /* translators: %s: one or more role slugs, already joined, e.g. “subscriber, customer”. */
                'wants_role' => __(
                    'It shows only to visitors holding one of these roles: %s. You are signed in as somebody else.',
                    'wconvert'
                ),
                'not_in_payload' => __('It did not reach this page.', 'wconvert'),
                'capped' => __('This browser has already had its allowance.', 'wconvert'),
                // ============================================================
                // THE SAME WORD AT A SECOND SCOPE, AND THE SAME REASONING.
                // ============================================================
                // The engine says `capped` for an Optin the SITE-wide
                // allowance vetoed too, because that is the same fact read
                // more broadly (ADR 0047). The sentence is what tells the
                // two apart, and it has to, because they send a merchant to
                // different screens: one is a setting on the Optin in front
                // of them, this one is stopping every Optin on the page.
                'site_capped' => __(
                    'This browser has already had the allowance you set for the whole site, so nothing shows here.',
                    'wconvert'
                ),
                // ============================================================
                // THE SENTENCE BESIDE THE WORD, WHICH IS WHY THERE IS NO
                // SEVENTH `Standing`.
                // ============================================================
                // The engine says `capped` for an Optin outside its window and
                // for one whose allowance is spent, because both mean *the
                // allowance is spent and this cannot change on this page view*
                // (ADR 0047). A merchant told "this browser has already had
                // its allowance" about a sale that starts on Friday goes
                // looking for a cookie, so these two are what they read
                // instead.
                //
                // One `%s` each, filled with a duration `human_time_diff()`
                // minted — the panel substitutes with a single
                // `String.replace` and has no formatter for a second.
                /* translators: %s: how long until it starts, e.g. “3 days”. */
                'before_window' => __('Scheduled. It starts in %s.', 'wconvert'),
                /* translators: %s: how long ago it finished, e.g. “4 hours”. */
                'after_window' => __('Its schedule ended %s ago.', 'wconvert'),
                'blocked' => __(
                    'One of its rules needs storage consent this visit has not given. Not evaluated, not failed.',
                    'wconvert'
                ),
                'inert' => __('It has no trigger this site can fire, so it can never show.', 'wconvert'),
                'ineligible' => __('A condition does not hold right now.', 'wconvert'),
                'waiting' => __('Waiting for a trigger to fire.', 'wconvert'),
                'shown' => __('Already shown on this page view.', 'wconvert'),
                /* translators: %s: the name of the Optin that took the page view. */
                'lost' => __('Ready, but “%s” took the page view.', 'wconvert'),
                'showing' => __('Showing now.', 'wconvert'),
            ],

            // ================================================================
            // THREE ANSWERS PER RULE, NEVER TWO.
            // ================================================================
            // `null` is NOT EVALUATED and is not a failure. A red cross beside
            // a rule a consent plugin withheld teaches a merchant to go and
            // fix a rule that is perfectly fine.
            'answer' => [
                'yes' => __('Holds', 'wconvert'),
                'no' => __('Does not hold', 'wconvert'),
                'unknown' => __('Not evaluated', 'wconvert'),
                'unsupported' => __('No module on this site evaluates this rule', 'wconvert'),
            ],

            'display' => [
                'group' => __('Audience group', 'wconvert'),
                'opening' => __('Opening moment', 'wconvert'),
                'all' => __('ALL', 'wconvert'), 'any' => __('ANY', 'wconvert'),
                'true' => __('Matches', 'wconvert'), 'false' => __('Does not match', 'wconvert'), 'blocked' => __('Waiting for consent', 'wconvert'),
                'immediate' => __('Immediately', 'wconvert'), 'automatic' => __('Automatic', 'wconvert'), 'click' => __('Explicit click', 'wconvert'),
                'minimum' => __('Minimum seconds on page', 'wconvert'),
            ],
            'sections' => [
                'request' => __('This page, as the server sees it', 'wconvert'),
                'targeting' => __('Where it is allowed', 'wconvert'),
                'triggers' => __('When it fires', 'wconvert'),
                'conditions' => __('Who sees it', 'wconvert'),
                'include' => __('Shows on', 'wconvert'),
                'exclude' => __('But never on', 'wconvert'),
                'server_only' => __('It never reached the browser, so there is nothing more to report.', 'wconvert'),
            ],

            'request' => [
                'path' => __('Path', 'wconvert'),
                'isSingular' => __('A single item', 'wconvert'),
                'postId' => __('Post ID', 'wconvert'),
                'postType' => __('Post type', 'wconvert'),
                'archivePostType' => __('Archive of', 'wconvert'),
                'termIds' => __('Terms', 'wconvert'),
                'isLoggedIn' => __('You are signed in', 'wconvert'),
                'yes' => __('Yes', 'wconvert'),
                'no' => __('No', 'wconvert'),
                'none' => __('None', 'wconvert'),
            ],

            /**
             * ================================================================
             * ADR 0004's THREE FAILURE MODES, NAMED ON SCREEN.
             * ================================================================
             * A JS optimiser that aggregates, relocates or strips `defer` from
             * the loader is the failure ADR 0004 calls *silent, total, and
             * with nothing in any log*. The loader survives all three — that
             * is what `boot.ts`'s retry is for — so none of these is an error.
             * They are the observations a merchant has no other way to make.
             */
            'arrival' => [
                'aggregated' => __(
                    'The loader’s own script tag is not on this page, so something has combined it into a bundle. WConvert copes with that.',
                    'wconvert'
                ),
                'defer' => __(
                    'Something removed the loader’s “defer”. WConvert copes with that, but a script optimiser is rewriting its tags.',
                    'wconvert'
                ),
                'order' => __(
                    'The loader is above the data it reads, which is what “force JavaScript in head” does. WConvert copes with that.',
                    'wconvert'
                ),
            ],

            /**
             * The panel is missing, and the likeliest cause is the cache.
             *
             * `DONOTCACHEPAGE` is set at enqueue, which is **too late if a
             * cached file already exists** — the cache layer answers before
             * PHP runs at all. In practice the `wordpress_logged_in` cookie
             * bypasses full-page cache in every mainstream plugin, which is
             * why the admin bar works on the front end; where a host caches
             * for signed-in users too, the symptom is no panel AND no admin
             * bar. This is the sentence that names it, and it is shown where
             * the merchant asks for the inspector rather than in the panel
             * that would not be there.
             */
            'cache_warning' => __(
                'If neither this panel nor the admin bar appears, a cache is serving this page before WordPress runs. Clear it, or check that it is set to skip signed-in visitors.',
                'wconvert'
            ),

            // The rule vocabulary's own names, so the panel spells no rule
            // type of its own. Shipped whole rather than per-rule: it is the
            // same table for every Optin on the page.
            'rules' => RuleLabels::types(),
        ];
    }
}
