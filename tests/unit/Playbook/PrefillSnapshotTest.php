<?php

namespace WConvert\Tests\Unit\Playbook;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Optin\Optin;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedProjection;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\InstalledRules;

/**
 * **Prefill is a snapshot** — and it is the snapshot boundary that already
 * exists, not a second one.
 *
 * An [[Optin]] takes a COPY of its [[Template]], taken when the Template was
 * picked, and the renderer stays a live reference (ADR 0010). Prefill from a
 * [[Playbook]] is that mechanism again with the words filled in: values are
 * copied into the Optin's `config` and the two never speak again. Improving a
 * Playbook never rewrites the words on a running Optin, and deleting one
 * leaves every Optin it started untouched — so `playbook_id` is *provenance*,
 * exactly as `template_id` is (CONTEXT.md, Playbook).
 *
 * This is the seam that cannot be proven by reading the code, because the
 * failure it guards against is the one where a later ticket adds a convenient
 * lookup by `playbook_id` on the render path.
 */
#[CoversClass(Prefill::class)]
final class PrefillSnapshotTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function entry(array $overrides = []): array
    {
        return array_merge([
            'id' => 'welcome-discount',
            'name' => 'Welcome discount',
            'goal' => 'grow_email_list',
            'template_id' => 'centred-card',
            'copy' => [
                'headline' => 'Ten percent off your first order',
                'body' => 'Join the list and we will send the code over.',
                'cta_label' => 'Send my code',
                'email_label' => 'Email address',
                'email_placeholder' => 'you@example.com',
                'success_headline' => 'You are on the list',
            ],
            'rules' => [['type' => 'page_load']],
            'destination_hint' => ['types' => ['wsms'], 'fields' => ['email']],
        ], $overrides);
    }

    /**
     * @param array<string, mixed> $entry
     */
    private function prefillFrom(array $entry): Prefill
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $templates = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);

        return new Prefill(
            PlaybookLibrary::fromEntries([$entry], $templates, $vocabulary, RuleVocabulary::fromManifest(self::PLUGIN_DIR)),
            $templates,
            $vocabulary,
            InstalledRules::free()
        );
    }

    /**
     * @return array{name: string, goal: string, config: array<string, mixed>}
     */
    private function draft(): array
    {
        $draft = $this->prefillFrom(self::entry())->fromPlaybook('welcome-discount');

        $this->assertIsArray($draft, 'the shipped entry prefills');

        return $draft;
    }

    /**
     * The Optin as the front end would receive it, so "still renders" is
     * asserted through the same projection a published Optin goes through
     * rather than by reading the config back.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function payloadOf(array $config): array
    {
        $set = PublishedProjection::build(
            [[
                'id' => '01JQ00000000000000000000AA',
                'published_config' => (string) json_encode($config),
                'published_at' => '2026-08-25 09:00:00',
                'deleted_at' => null,
            ]],
            RuleVocabulary::fromManifest(self::PLUGIN_DIR)
        );

        return PublishedOptin::fromSet($set)[0]->toPayloadEntry();
    }

    public function testPrefillWritesThePlaybooksWordsIntoTheOptinsOwnCopyOfTheTemplate(): void
    {
        $config = $this->draft()['config'];
        $children = $config['template']['tree']['steps'][0]['children'];

        $this->assertSame('Ten percent off your first order', $children[0]['text']);
        $this->assertSame('Email address', $children[2]['children'][0]['label']);
        $this->assertSame('you@example.com', $children[2]['children'][0]['placeholder']);
        $this->assertSame('Send my code', $children[2]['children'][1]['label']);
    }

    /**
     * `playbook_id` is provenance, exactly as `template_id` is. It is a
     * property of `config` rather than a column, for the same reason
     * `template_id` is one — nothing joins on it, and nothing ever will:
     * two Optins from one Playbook may have been edited into unrecognisably
     * different things, so the metric is "Optins started from this Playbook",
     * never "this Playbook's conversion rate".
     */
    public function testTheOptinRecordsWhichPlaybookItStartedFrom(): void
    {
        $config = $this->draft()['config'];

        $this->assertSame('welcome-discount', $config['playbook_id']);
        $this->assertSame('centred-card', $config['template_id']);
        $this->assertSame('grow_email_list', $this->draft()['goal']);
    }

    /**
     * **The first half of the boundary.** Improving a Playbook never rewrites
     * the words on a running Optin.
     *
     * Asserted through the render path rather than by reading the config
     * back, because the failure this guards against is a later ticket adding
     * a convenient lookup by `playbook_id` there.
     */
    public function testEditingThePlaybookAfterwardsChangesNothingOnTheOptin(): void
    {
        $optin = $this->draft()['config'];
        $before = $this->payloadOf($optin);

        // The merchant of this Optin is not consulted, and neither is their
        // Optin: the entry now says something else entirely.
        $improved = $this->prefillFrom(self::entry(['copy' => ['headline' => 'COMPLETELY DIFFERENT WORDS']]));
        $reprefilled = $improved->fromPlaybook('welcome-discount');

        $this->assertIsArray($reprefilled);
        $this->assertSame(
            'COMPLETELY DIFFERENT WORDS',
            $reprefilled['config']['template']['tree']['steps'][0]['children'][0]['text'],
            'a NEW Optin gets the improved words, which is what improving one is for'
        );
        $this->assertSame($before, $this->payloadOf($optin), 'and the running Optin is byte-identical');
        $this->assertSame(
            'Ten percent off your first order',
            $before['template']['tree']['steps'][0]['children'][0]['text']
        );
    }

    /**
     * **The second half.** Deleting a Playbook leaves every Optin it started
     * untouched — it still renders, because the design and the words are its
     * own copy, and it still reports, because its [[Goal]] is a column on
     * `wconvert_optins` and analytics joins that (ADR 0020).
     */
    public function testDeletingThePlaybookLeavesTheOptinRenderingAndReporting(): void
    {
        $draft = $this->draft();
        $before = $this->payloadOf($draft['config']);

        // The entry is gone: this install now has no Playbooks at all.
        $gone = $this->prefillFrom(self::entry(['id' => 'something-else', 'goal' => 'grow_sms_list']));

        $this->assertNull($gone->fromPlaybook('welcome-discount'));
        $this->assertSame($before, $this->payloadOf($draft['config']), 'the Optin renders exactly as before');
        $this->assertNotSame([], $before['template']['tree']['steps']);

        $optin = new Optin('01JQ00000000000000000000AA', 'Welcome', $draft['goal'], $draft['config']);

        $this->assertSame(Goal::GrowEmailList, Goal::from($optin->goal), 'and still reports under its own Goal');
    }

    /**
     * **The words survive the save.**
     *
     * Prefill hands back a config carrying the Template's design with the
     * Playbook's words already written into it, and the save path re-runs the
     * snapshot on the way in. A snapshot is of the DESIGN — a Template carries
     * no copy — so re-taking one against an Optin that already holds its copy
     * strips every word the Playbook supplied and leaves a blank popup.
     *
     * What stops it is `$pickedBefore`: the id the copy in the config was
     * taken FOR. On a create there is no stored row, so the config that
     * arrived is the prior state, and `WConvert\Rest\OptinController::store()`
     * passes the incoming `template_id`. This is the seam that says so.
     */
    public function testSavingAPrefilledDraftKeepsTheWordsRatherThanRetakingTheSnapshot(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $templates = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);
        $config = $this->draft()['config'];

        $saved = $templates->snapshotInto($config, (string) $config['template_id']);

        $this->assertSame(
            'Ten percent off your first order',
            $saved['template']['tree']['steps'][0]['children'][0]['text'] ?? null
        );

        // And the other half of the same rule still holds: naming a DIFFERENT
        // Template takes a fresh copy of the DESIGN, because otherwise the id
        // would say one design and the payload would render another — while
        // the WORDS come across, since copy is keyed to [[Slot Role]]s rather
        // than to one Template's structure precisely "so the words survive
        // switching Template" (CONTEXT.md, Playbook).
        $config['template_id'] = 'stacked-signup';
        $repicked = $templates->snapshotInto($config, 'centred-card');
        $children = $repicked['template']['tree']['steps'][0]['children'];

        $this->assertSame('Ten percent off your first order', $children[0]['text'], 'the headline came across');
        $this->assertSame($templates->find('stacked-signup')['tokens'], $repicked['template']['tokens']);

        // A Role the new design does not declare is dropped rather than
        // carried into a node that cannot hold it: `centred-card` captures an
        // email and `stacked-signup` a phone, so the email's label has nowhere
        // to go. A field's Roles are named for what it captures, which is what
        // makes the field kind part of the DESIGN (CONTEXT.md, Slot Role).
        $this->assertSame('phone', $children[2]['name']);
        $this->assertArrayNotHasKey('label', $children[2]);
    }

    /**
     * The payload the browser receives never mentions the Playbook at all.
     * Provenance is an admin fact; shipping it would put a byte on every page
     * view for a lookup nothing performs (ADR 0010's argument for
     * `template_id`, one layer up).
     */
    public function testProvenanceNeverReachesTheBrowser(): void
    {
        $payload = $this->payloadOf($this->draft()['config']);

        $this->assertArrayNotHasKey('playbook_id', $payload);
        $this->assertArrayNotHasKey('template_id', $payload);
    }

    /**
     * **Prefill never binds a [[Destination]] invisibly.** The hint names
     * Destination *types* and the [[Lead]] fields the Playbook needs; what an
     * Optin holds is Destination ids, and choosing one is a decision the
     * merchant makes with the list in front of them.
     */
    public function testPrefillCarriesTheHintAndBindsNoDestination(): void
    {
        $config = $this->draft()['config'];

        $this->assertSame(['types' => ['wsms'], 'fields' => ['email']], $config['destination_hint']);
        $this->assertArrayNotHasKey('destinations', $config);
    }

    /**
     * **"Start from scratch" skips the Playbook, never the Goal.**
     *
     * It still carries a Trigger: every Optin has at least one, and "shows
     * immediately" is the explicit `page_load` Trigger rather than an empty
     * list — an Optin with none can never fire, which is a silent total loss
     * of function (ADR 0012).
     */
    public function testStartingFromScratchKeepsTheGoalAndCarriesNoProvenance(): void
    {
        $draft = $this->prefillFrom(self::entry())->fromScratch(Goal::PromoteOffer);

        $this->assertSame('promote_offer', $draft['goal']);
        $this->assertArrayNotHasKey('playbook_id', $draft['config']);
        $this->assertArrayNotHasKey('template_id', $draft['config']);
        $this->assertSame([['type' => 'page_load']], $draft['config']['rules']);
    }
}
