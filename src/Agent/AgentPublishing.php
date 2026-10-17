<?php

namespace WConvert\Agent;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * "Let AI agents publish" — the one setting that lets an [[Agent ability]]
 * publish or pause a campaign (ADR 0154 §7, ADR 0149 §7).
 *
 * Off until a site administrator turns it on. Agents can always read and make
 * drafts; this is what makes "drafts only" true by default rather than by an
 * agent's good manners.
 */
final class AgentPublishing
{
    public const OPTION = 'wconvert_agents_publish';

    public function __construct(private readonly OptionStore $options)
    {
    }

    public function enabled(): bool
    {
        return in_array($this->options->get(self::OPTION, 0), [1, '1', true], true);
    }

    public function set(bool $enabled): void
    {
        // Integers, as PrivacyGuidance stores them: WordPress keeps boolean false as ''.
        $this->options->set(self::OPTION, $enabled ? 1 : 0);
    }
}
