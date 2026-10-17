<?php

namespace WConvert\Agent;

use WP_Error;

defined('ABSPATH') || exit;

/**
 * One thing an AI agent may do in WConvert, registered as a WordPress
 * [[Agent ability]] (ADR 0154).
 *
 * An ability reads, makes a draft, or — only when a site administrator has
 * turned on "Let AI agents publish" — publishes or pauses. Its writes go
 * through WConvert's own REST routes ({@see \WConvert\Rest\InternalRest}), so
 * an agent meets every refusal a person in the editor meets.
 */
interface Ability
{
    /** `wconvert/<verb>-<noun>`. */
    public function name(): string;

    /**
     * What WordPress and the agent are told about it.
     *
     * @return array{label: string, description: string, input_schema: array<string, mixed>, annotations: array{readonly: bool, destructive: bool, idempotent: bool}}
     */
    public function definition(): array;

    /**
     * @param array<string, mixed> $input Already checked against the input schema.
     * @return array<string, mixed>|WP_Error
     */
    public function execute(array $input): array|WP_Error;

    /** @param array<string, mixed> $input */
    public function permitted(array $input): bool|WP_Error;
}
