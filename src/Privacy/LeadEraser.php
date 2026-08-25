<?php

namespace WConvert\Privacy;

use WConvert\Lead\LeadRepository;

defined('ABSPATH') || exit;

/**
 * WordPress's personal-data eraser for [[Lead]]s.
 *
 * **It issues a `DELETE`. It never anonymises** (ADR 0018), which is what the
 * WordPress eraser convention usually means by erasure.
 *
 * Anonymising is an update, and ADR 0002 has no update path: `wconvert_leads`
 * has no `status` and no `updated_at` precisely so that a row cannot acquire
 * mutable state without a migration a reviewer will see. An eraser that
 * rewrote Lead rows to blank the identifying columns would re-open that door
 * for the one caller nobody would think to check. A `DELETE` is not an update,
 * so the ADR survives with no carve-out.
 *
 * And it buys almost nothing. With the email and phone gone, what remains is a
 * `created_at`, an `optin_id` and a `fields` blob emptied of anything
 * identifying — which is a conversion count, and `wconvert_stats` already owns
 * those from its own daily counters (ADR 0019).
 *
 * **Client-side visitor state is untouched, and correctly so.** After ADR 0017
 * removed the visitor identifier, what a browser holds is the record itself —
 * which Optins this device saw and dismissed — and it contains no personal
 * data. An eraser that could reach a visitor's device would be a worse plugin.
 *
 * @since 0.1.0
 */
final class LeadEraser
{
    /** WordPress keys the eraser list by this, and reports progress under it. */
    public const ID = 'wconvert-leads';

    public function __construct(
        private readonly LeadRepository $leads,
    ) {
    }

    public function hooks(): void
    {
        // Default priority, deliberately. WSMS registers its contact eraser at
        // 99 because several of its erasers resolve an email to a phone number
        // through the contact row first, and WordPress runs each eraser to
        // completion before starting the next. WConvert has one eraser over
        // one table and no such dependency (ADR 0018). Copy the caveat only if
        // a second eraser ever appears.
        add_filter('wp_privacy_personal_data_erasers', [$this, 'register']);
    }

    /**
     * @param array<string, array{eraser_friendly_name: string, callback: callable}> $erasers
     * @return array<string, array{eraser_friendly_name: string, callback: callable}>
     */
    public function register(array $erasers): array
    {
        $erasers[self::ID] = [
            'eraser_friendly_name' => __('WConvert leads', 'wconvert'),
            'callback' => [$this, 'erase'],
        ];

        return $erasers;
    }

    /**
     * Remove every [[Lead]] captured under one email address.
     *
     * `done` is true on the first call, and the `$page` argument goes unused:
     * a `DELETE` removes the whole set in one statement, so there is no second
     * page for WordPress to come back for. Erasers that paginate do so because
     * they walk rows; this one does not.
     *
     * `items_retained` is false always — **there is no residue row**. That is
     * the same fact as "it deletes rather than anonymises", said from the
     * caller's side.
     *
     * @return array{items_removed: bool, items_retained: bool, messages: list<string>, done: bool}
     */
    public function erase(string $email, int $page = 1): array
    {
        $removed = $this->leads->eraseByEmail(sanitize_email($email));

        return [
            'items_removed' => $removed > 0,
            'items_retained' => false,
            'messages' => [],
            'done' => true,
        ];
    }
}
