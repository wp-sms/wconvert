<?php

namespace WConvert\Privacy;

use WConvert\Lead\Identifier;
use WConvert\Lead\Lead;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;

defined('ABSPATH') || exit;

/**
 * WordPress's personal-data exporter for [[Lead]]s.
 *
 * Cheap to write, and its absence is a live wp.org review flag for a plugin
 * that stores email addresses (ADR 0018) — but what makes it more than
 * paperwork is what it carries.
 *
 * **The export includes the [[Consent Record]]** — the consent wording exactly
 * as it was shown when the visitor submitted, snapshotted rather than looked
 * up. Consent evidence that does not travel with the data it justifies is
 * useless to the merchant at the moment they need it most, which is this one.
 *
 * **An absent Consent Record is not a refusal.** `consent_text` is missing
 * where there was no wording to snapshot — an Optin that declared no consent
 * node, or one whose `consent_text` Slot Role nobody had filled in yet, since
 * `CaptureForm` declines to store an empty sentence (ADR 0031). It is never
 * missing because consent was withheld: a submission whose Optin declares a
 * consent node and whose payload lacks one is rejected at the endpoint
 * (ADR 0032), so an un-consented Lead does not exist to export. Printing
 * "not given" here would report a state this system cannot produce.
 *
 * @since 0.1.0
 */
final class LeadExporter
{
    /** WordPress keys the exporter list by this, and reports progress under it. */
    public const ID = 'wconvert-leads';

    /**
     * Leads per call. WordPress calls back with an incrementing `$page` until
     * `done`, so this bounds the memory one request holds — the rows carry a
     * `fields` blob each, which is the read ADR 0001 warns about.
     */
    private const PER_PAGE = 50;

    public function __construct(
        private readonly LeadRepository $leads,
        private readonly OptinRepository $optins,
    ) {
    }

    public function hooks(): void
    {
        add_filter('wp_privacy_personal_data_exporters', [$this, 'register']);
    }

    /**
     * @param array<string, array{exporter_friendly_name: string, callback: callable}> $exporters
     * @return array<string, array{exporter_friendly_name: string, callback: callable}>
     */
    public function register(array $exporters): array
    {
        $exporters[self::ID] = [
            'exporter_friendly_name' => __('WConvert leads', 'wconvert'),
            'callback' => [$this, 'export'],
        ];

        return $exporters;
    }

    /**
     * @return array{data: list<array<string, mixed>>, done: bool}
     */
    public function export(string $email, int $page = 1): array
    {
        $page = max(1, $page);

        // Canonicalised for the reason {@see LeadEraser::erase()} gives at
        // length: stored addresses are lowercased at capture, and matching a
        // raw one against them rides on a collation rather than on a rule.
        $canonical = Identifier::email($email);
        $leads = $canonical === null
            ? []
            : $this->leads->forEmail($canonical, self::PER_PAGE, ($page - 1) * self::PER_PAGE);

        // Read once per page rather than once per Lead: an install has tens of
        // Optins and a person may have submitted to several of them.
        $names = $leads === [] ? [] : $this->optins->names();

        return [
            'data' => array_map(
                fn (Lead $lead): array => $this->itemFor($lead, $names),
                $leads
            ),
            'done' => count($leads) < self::PER_PAGE,
        ];
    }

    /**
     * @param array<string, string> $names
     * @return array<string, mixed>
     */
    private function itemFor(Lead $lead, array $names): array
    {
        return [
            'group_id' => self::ID,
            'group_label' => __('WConvert leads', 'wconvert'),
            'group_description' => __(
                'Form submissions captured by WConvert, with the consent wording shown at the time.',
                'wconvert'
            ),
            'item_id' => self::ID . '-' . $lead->id,
            'data' => self::pairsFor($lead, $names),
        ];
    }

    /**
     * @param array<string, string> $names
     * @return list<array{name: string, value: string}>
     */
    private static function pairsFor(Lead $lead, array $names): array
    {
        $pairs = [
            ['name' => __('Submitted', 'wconvert'), 'value' => $lead->createdAt],
            // The Optin's NAME. A merchant answering a request has to be able
            // to say which form this came from, and the id says nothing. It
            // survives the Optin being soft-deleted, which is what the soft
            // delete is for (ADR 0002).
            ['name' => __('Campaign', 'wconvert'), 'value' => $names[$lead->optinId] ?? $lead->optinId],
        ];

        if ($lead->email !== null) {
            $pairs[] = ['name' => __('Email', 'wconvert'), 'value' => $lead->email];
        }

        if ($lead->phone !== null) {
            $pairs[] = ['name' => __('Phone', 'wconvert'), 'value' => $lead->phone];
        }

        foreach ($lead->fields as $name => $value) {
            // The Consent Record is the one entry in `fields` with a name of
            // its own, because it is evidence rather than a captured value.
            // **Nothing is emitted where it is absent** — see the class
            // docblock: absent is "no wording to show", never "not given".
            $pairs[] = $name === 'consent_text'
                ? ['name' => __('Consent', 'wconvert'), 'value' => $value]
                : ['name' => $name, 'value' => $value];
        }

        return $pairs;
    }
}
