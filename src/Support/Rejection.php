<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * One member a registry refused, and why.
 *
 * **Recorded rather than thrown.** One bad entry must not take the gallery
 * down with it — the other members are fine, and a registry that threw would
 * turn a third-party [[Playbook]]'s typo into a blank creation flow.
 *
 * **And not silent.** An entry that simply vanished looks exactly like a
 * registry that failed to load, which is the hardest failure to notice
 * ({@see JsonManifest} makes the same argument about an empty vocabulary).
 * {@see self::warn()} is where it stops being silent, and the audience decides
 * the channel: a rejection is an AUTHORING error, not a merchant's problem, so
 * it goes to `_doing_it_wrong()` — WordPress's own channel for "a plugin
 * called this wrong". That is loud under `WP_DEBUG`, where a Playbook author
 * is working, and costs a production site nothing.
 *
 * Deliberately **not** an admin notice. The merchant cannot act on
 * "welcome-discount fills a Slot Role its Template does not declare", and a
 * notice they cannot act on is one they learn to dismiss.
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
     * Tell whoever wrote the entry.
     *
     * @param string $registry What refused it, for the message.
     */
    public function warn(string $registry): void
    {
        _doing_it_wrong(
            $registry,
            sprintf(
                /* translators: 1: the registry entry's id, 2: why it was refused. */
                esc_html__('WConvert refused the entry “%1$s”: %2$s.', 'wconvert'),
                esc_html($this->id === '' ? '(no id)' : $this->id),
                esc_html($this->reason->value)
            ),
            WCONVERT_VERSION
        );
    }

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return ['id' => $this->id, 'reason' => $this->reason->value];
    }
}
