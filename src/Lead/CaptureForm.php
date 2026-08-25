<?php

namespace WConvert\Lead;

use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * What one Optin's published template DECLARES it captures, and whether a
 * submission satisfies it.
 *
 * **This is the only place the guarantee lives.** The capture endpoint is
 * public, so client-side validation is decoration: a `required` attribute and
 * a checked checkbox are what an honest browser does, and the endpoint has no
 * way to tell an honest browser from `curl` (ADR 0032). Everything the form
 * declares is therefore re-read from the server's own copy of the Optin and
 * enforced here.
 *
 * Read from the PUBLISHED config rather than from the draft, because the
 * published config is what the payload was projected from — it is, definitionally,
 * what the visitor was shown.
 *
 * @since 0.1.0
 */
final class CaptureForm
{
    /** What a `field` may capture. Closed, because the capture path canonicalises per kind. */
    private const IDENTITY_KEYS = ['email', 'phone'];

    /**
     * @param array<string, bool> $fields Field name => whether it is required.
     * @param array<string, mixed>|null $consent The `consent` node, or null where the Optin declares none.
     * @param list<string> $schemes The schemes an `<a>` may carry, for composing the Consent Record.
     */
    private function __construct(
        private readonly array $fields,
        private readonly ?array $consent,
        private readonly array $schemes,
    ) {
    }

    /**
     * The form step of a template, read.
     *
     * **The form is the step that SUBMITS**, which follows from the tree
     * rather than from anything the caller declares — a submit button outside
     * a form submits nothing, so the step holding one IS the form. That is the
     * same derivation `resources/renderer/src/render.ts` makes when it decides
     * whether to render a `<form>` or a `<div>`, and reading a different step
     * here than the browser rendered would enforce a form nobody saw.
     *
     * A template with no such step captures nothing — which is not a defect
     * but the shape of a click-metered Optin, whose whole product is a message
     * and a link (ADR 0025).
     *
     * The vocabulary is passed in rather than read here, the same arrangement
     * {@see \WConvert\Optin\PublishedProjection} has: it is the manifest, and
     * a class that reads a file off disk is no longer a pure function of its
     * arguments.
     *
     * @param mixed $template
     */
    public static function fromTemplate($template, TemplateVocabulary $vocabulary): self
    {
        $template = is_array($template) ? $template : [];
        $tree = is_array($template['tree'] ?? null) ? $template['tree'] : [];
        $steps = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];

        foreach ($steps as $step) {
            if (is_array($step) && self::submits($step)) {
                $fields = [];
                $consent = null;

                self::read($step, $fields, $consent, $vocabulary->fields());

                return new self($fields, $consent, $vocabulary->schemes());
            }
        }

        return new self([], null, $vocabulary->schemes());
    }

    /**
     * One submission, checked against what this form declares.
     *
     * Returns a {@see Submission} or a {@see Refusal} rather than throwing,
     * because a refusal is an ordinary outcome the caller must render on
     * screen — the visitor is still on the page, and the form is the only
     * place they can fix it (ADR 0021).
     *
     * @param array<string, mixed> $submitted The posted body, whole.
     */
    public function validate(array $submitted): Submission|Refusal
    {
        if ($this->fields === []) {
            return new Refusal(RefusalCode::NothingToCapture);
        }

        $consent = $this->consented($submitted);

        if ($consent instanceof Refusal) {
            return $consent;
        }

        $posted = is_array($submitted['fields'] ?? null) ? $submitted['fields'] : [];
        $identifiers = ['email' => null, 'phone' => null];
        $rest = $consent;

        // Only what this form DECLARED, in the order it declared it. A value
        // for a field the form never offered is a mistake rather than an
        // extension — the same posture the template vocabulary takes on the
        // way in (ADR 0010).
        foreach ($this->fields as $name => $required) {
            $raw = is_scalar($posted[$name] ?? null) ? trim((string) $posted[$name]) : '';

            if ($raw === '') {
                if ($required) {
                    return new Refusal(RefusalCode::FieldRequired, $name);
                }

                continue;
            }

            if (!in_array($name, self::IDENTITY_KEYS, true)) {
                $rest[$name] = $raw;

                continue;
            }

            $canonical = $name === 'email' ? Identifier::email($raw) : Identifier::phone($raw);

            // Refused synchronously, against the input that caused it. The
            // alternative is a row WSMS's `assertE164()` throws on inside a
            // queued job minutes later, with nothing on screen having failed
            // (ADR 0021).
            if ($canonical === null) {
                return new Refusal(RefusalCode::NotCanonical, $name);
            }

            $identifiers[$name] = $canonical;
        }

        // WSMS's `ContactRepository::create()` hard-requires one of the two,
        // and a Lead carrying neither can never be grouped by identifier,
        // which is the only identity this system has (ADR 0002, ADR 0021).
        if ($identifiers['email'] === null && $identifiers['phone'] === null) {
            return new Refusal(RefusalCode::NoIdentifier);
        }

        return new Submission($identifiers['email'], $identifiers['phone'], $rest);
    }

    /**
     * The consent gate, and the [[Consent Record]] it produces.
     *
     * **Keyed off the node's PRESENCE, never its wording.** A snapshot carries
     * Slot Roles and no words, so an Optin can hold a `consent` node whose
     * `consent_text` nobody has filled in yet; keying enforcement off the text
     * would make that Optin render a required checkbox the browser enforces
     * and the server does not. Declaring the node is the declaration. The
     * wording is the evidence, and missing evidence is a copy gap for the
     * merchant to close rather than a licence to stop asking.
     *
     * Consent must be the JSON boolean `true` and nothing else. Reading a
     * string for truth is what lets `"false"` assert consent, and an OPTIONAL
     * consent checkbox — which is what a lenient read amounts to — captures
     * Leads whose consent was explicitly refused (ADR 0032).
     *
     * @param array<string, mixed> $submitted
     * @return array<string, string>|Refusal The `fields` entries consent contributes, or the refusal.
     */
    private function consented(array $submitted): array|Refusal
    {
        if ($this->consent === null) {
            // Nothing was shown, so there is nothing to record. A submission
            // that carries consent anyway is carrying evidence of a checkbox
            // that does not exist, and it is dropped rather than stored.
            return [];
        }

        if (($submitted['consent'] ?? null) !== true) {
            return new Refusal(RefusalCode::ConsentRequired, 'consent');
        }

        $shown = ConsentRecord::asShown($this->consent, $this->schemes);

        // **An empty sentence is not evidence, so it is not written.** ADR 0031
        // names the failure exactly: "a Lead the schema says was consented,
        // with nothing behind it". The consent still held — the node was
        // declared and the box was ticked — but a `consent_text` of `''` in
        // the export the merchant hands a regulator asserts an artefact that
        // does not exist. Absent says the same thing honestly.
        return $shown === '' ? [] : ['consent_text' => $shown];
    }

    /**
     * Does this subtree hold the converting act that is a submission?
     *
     * The PHP spelling of `submits()` in `resources/renderer/src/render.ts`.
     * Both answer the same question about the same tree, and they have to
     * agree: this one decides what is enforced, that one decides what is
     * rendered.
     *
     * @param array<string, mixed> $node
     */
    private static function submits(array $node): bool
    {
        if (($node['type'] ?? null) === 'button') {
            return ($node['action'] ?? null) !== 'link';
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child) && self::submits($child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Collect what the form step declares: its fields, and its consent node.
     *
     * @param array<string, mixed> $node
     * @param array<string, bool> $fields
     * @param array<string, mixed>|null $consent
     * @param list<string> $known What a `field` may capture, from the manifest.
     */
    private static function read(array $node, array &$fields, ?array &$consent, array $known): void
    {
        // A slot the merchant switched off. The renderer skips it, so the
        // browser never drew it — and a server enforcing a consent checkbox no
        // visitor was shown refuses every submission of a form that could not
        // contain one. The vocabulary is what keeps this from reaching a
        // `field` or a `button`: neither declares `hidden`, so neither can
        // carry it (ADR 0010).
        if (($node['hidden'] ?? null) === true) {
            return;
        }

        $type = $node['type'] ?? null;
        $name = $node['name'] ?? null;

        // A field naming something the manifest does not declare is skipped,
        // exactly as the renderer skips it — so the server never requires an
        // input the browser never drew. The list comes FROM the manifest
        // rather than from a copy here, which is what stops the two answering
        // differently; `tests/js/renderer-manifest-parity.test.ts` holds the
        // renderer to the same file from its side (ADR 0010).
        if ($type === 'field' && is_string($name) && in_array($name, $known, true)) {
            $fields[$name] = ($node['required'] ?? null) === true;
        }

        // The FIRST consent node wins. A Slot Role is unique across a
        // Template's whole tree, so a second one is malformed rather than
        // meaningful, and picking one is the only reading that produces a
        // single Consent Record.
        if ($type === 'consent' && $consent === null) {
            $consent = $node;
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child)) {
                self::read($child, $fields, $consent, $known);
            }
        }
    }
}
