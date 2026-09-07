<?php

/**
 * The site the `full` column of ADR 0060's matrix is captured against.
 *
 * The inventory is BRIEF.md's, unchanged, because the point of re-capturing is
 * that the cards differ only where the CODE differs: four Optins across all
 * three states an Optin can be in, thirty days of counters on two of them,
 * eight Leads with and without a phone and with and without extra captured
 * fields, and two Destinations.
 *
 * It runs through the container rather than against `$wpdb`, so every row is
 * one the product itself would have written — a seed reaching past the
 * repositories can produce a screen the product cannot.
 */

declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Goal\Goal;
use WConvert\Lead\LeadRepository;
use WConvert\Lead\Submission;
use WConvert\Optin\OptinRepository;
use WConvert\Playbook\Prefill;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;

function wconvert_ds_seed(): string
{
    $container = Bootstrap::container();

    /** @var OptinRepository $optins */
    $optins = $container->get(OptinRepository::class);
    /** @var Prefill $prefill */
    $prefill = $container->get(Prefill::class);
    /** @var LeadRepository $leads */
    $leads = $container->get(LeadRepository::class);
    /** @var StatsRepository $stats */
    $stats = $container->get(StatsRepository::class);
    /** @var DestinationStore $destinations */
    $destinations = $container->get(DestinationStore::class);

    $log = [];

    /*
     * Four Optins, and the three states are published, draft and soft-deleted.
     * An Optin is never hard-deleted (CONTEXT, *Optin*), so the third state is
     * a row the list can still be asked to show rather than an absence.
     */
    $made = [];

    foreach ([
        ['Grow the list', Goal::GrowEmailList, true],
        ['Cart recovery', Goal::RecoverCart, true],
        ['Spring offer', Goal::PromoteOffer, false],
        ['Old welcome mat', Goal::GrowEmailList, false],
    ] as [$name, $goal, $publish]) {
        $draft = $prefill->fromScratch($goal);
        $optin = $optins->create($name, $draft['goal'], $draft['config']);

        if ($publish) {
            $optins->publish($optin->id);
        }

        $made[] = $optin->id;
        $log[] = ($publish ? 'published' : 'draft') . " optin {$optin->id} — {$name}";
    }

    // The fourth is the soft-deleted one, which is the third state.
    $optins->delete($made[3]);
    $log[] = "soft-deleted optin {$made[3]}";

    /*
     * Thirty days of counters on the two published Optins.
     *
     * Impressions every day, conversions on most of them and dismissals on
     * some — so the Analytics cards have a rate that is neither 0% nor 100%
     * and the sparkline has a shape rather than a flat line. The numbers are
     * deterministic (a fixed seed) because a card that redraws differently on
     * every build is a card nobody can diff.
     */
    mt_srand(20600);

    foreach ([$made[0], $made[1]] as $index => $optinId) {
        for ($ago = 29; $ago >= 0; $ago--) {
            $day = gmdate('Y-m-d', strtotime("-{$ago} days"));
            $impressions = 40 + mt_rand(0, 60) + ($index * 20);

            for ($i = 0; $i < $impressions; $i++) {
                $stats->increment($optinId, StatKind::Impression, $day);
            }

            for ($i = 0; $i < (int) round($impressions * 0.04) + mt_rand(0, 2); $i++) {
                $stats->increment($optinId, StatKind::Conversion, $day);
            }

            for ($i = 0; $i < mt_rand(0, 6); $i++) {
                $stats->increment($optinId, StatKind::Dismiss, $day);
            }
        }
    }

    $log[] = '30 days of counters on 2 optins';

    /*
     * Eight Leads. The four shapes the log has to render are an email only, an
     * email and a phone, a phone only, and a capture carrying extra fields —
     * plus one address long enough to exercise ADR 0060 §5's
     * `overflow-wrap: anywhere`, which is the rule a 60-character email is what
     * proved.
     */
    $captures = [
        ['sarah@example.com', null, ['name' => 'Sarah Whitfield']],
        ['bob@example.com', '+442071234567', []],
        [null, '+12025551234', ['consent_text' => 'Email me offers.']],
        ['priya.raghunathan@a-very-long-company-domain-name.example.com', null, ['name' => 'Priya Raghunathan', 'company' => 'Raghunathan & Associates']],
        ['tom@example.org', '+61412345678', ['name' => 'Tom Alvarez', 'source' => 'checkout']],
        ['jen@example.net', null, []],
        [null, '+819012345678', ['name' => 'Kenji Watanabe']],
        ['lars@example.se', '+46701234567', ['name' => 'Lars Öberg', 'consent_text' => 'I agree to the privacy policy.']],
    ];

    foreach ($captures as $index => [$email, $phone, $fields]) {
        $leads->record($made[$index % 2], new Submission($email, $phone, $fields));
    }

    $log[] = count($captures) . ' leads';

    /*
     * Two Destinations. The lead-magnet one is free's own and needs no
     * connection, so it is `ready` on any install — which is what makes the
     * Destinations card show a configured route rather than an empty list on a
     * site with no ESP plugin.
     */
    $destinations->save(null, LeadMagnetDestinationType::ID, 'Lead magnet email', null, [
        'subject' => 'Your guide is here',
        'body' => "Thanks for signing up — here is the guide.\n\nhttps://example.com/guide.pdf",
    ]);

    $destinations->save(null, LeadMagnetDestinationType::ID, 'Welcome email', null, [
        'subject' => 'Welcome aboard',
        'body' => 'Glad to have you.',
    ]);

    $log[] = '2 destinations';

    return "seeded\n" . implode("\n", $log) . "\n";
}
