<?php

namespace WConvert\Playbook;

use WConvert\Goal\Goal;

defined('ABSPATH') || exit;

/**
 * A ready-to-run bundle serving one [[Goal]] — a [[Template]], copy, a
 * [[Display Type]], display rules and destination hints, packaged with notes
 * on why it works.
 *
 * **This is the one in-memory shape.** Bundled entries ship as PHP files
 * returning arrays and remote ones as JSON, and both arrive here through
 * {@see self::fromEntry()} (ADR 0013). Two normalisers would be two chances
 * for a bundled entry to mean something a remote one could not express.
 *
 * **A Playbook is data, not code.** It carries no behaviour of its own: what a
 * Playbook does to an Optin is {@see Prefill}'s, and what a Playbook may say
 * is {@see PlaybookLibrary}'s, checked once at registration.
 *
 * **The Display Type is derived rather than declared.** One Template serves
 * exactly one Display Type (CONTEXT.md, Template), so an entry declaring its
 * own would be a second spelling that can disagree with the design it names —
 * and the disagreement would surface as a gallery filter showing a popup under
 * "floating bar". It is still "prefilled by the Playbook" in the sense that
 * matters: the merchant never picks it.
 *
 * @since 0.1.0
 */
final class Playbook
{
    /**
     * @param array<string, mixed> $copy Slot Role => the words, as ADR 0013 shapes them.
     * @param list<array<string, mixed>> $rules The flat Trigger/Condition list, in the author's order.
     * @param array<string, mixed> $targeting
     * @param array<string, mixed> $destinationHint Destination TYPES and the Lead fields wanted — never ids.
     */
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly Goal $goal,
        public readonly string $templateId,
        public readonly string $displayType,
        public readonly array $copy = [],
        public readonly array $rules = [],
        public readonly array $targeting = [],
        public readonly array $destinationHint = [],
        public readonly string $notes = '',
    ) {
    }

    /**
     * The gallery's view of one entry.
     *
     * `copy` travels because the gallery card renders the REAL Template with
     * the REAL words through the same dependency-free renderer the loader
     * imports — there are no static thumbnails to produce or to let go stale
     * (ADR 0010).
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'goal' => $this->goal->value,
            'template_id' => $this->templateId,
            'display_type' => $this->displayType,
            'copy' => $this->copy,
            'rules' => $this->rules,
            'targeting' => $this->targeting,
            'destination_hint' => $this->destinationHint,
            'notes' => $this->notes,
        ];
    }
}
