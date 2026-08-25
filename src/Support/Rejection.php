<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * One member a registry refused, and why.
 *
 * **Recorded rather than thrown.** One bad entry must not take the gallery
 * down with it — the other members are fine, and a registry that threw would
 * turn a third-party [[Playbook]]'s typo into a blank creation flow. It is
 * also not silent: an entry that simply vanished looks exactly like a registry
 * that failed to load, which is the hardest failure to notice
 * ({@see JsonManifest} makes the same argument about an empty vocabulary).
 *
 * @since 0.1.0
 */
final class Rejection
{
    public function __construct(
        public readonly string $id,
        public readonly RejectionReason $reason,
    ) {
    }

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return ['id' => $this->id, 'reason' => $this->reason->value];
    }
}
