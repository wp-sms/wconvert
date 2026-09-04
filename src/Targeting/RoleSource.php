<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * One place a visitor's **roles or memberships** come from.
 *
 * ============================================================================
 * THE SEAM, AND WHY IT IS A SEAM RATHER THAN A WIDER PREDICATE.
 * ============================================================================
 * WordPress roles are one answer to *"what is this visitor"*, and a
 * membership or LMS plugin is another — a level, a plan, an enrolment. Those
 * are the same question asked of a different system, and the wrong way to
 * serve them is to widen the core predicate: a `membership_level` beside
 * `role` beside `course_enrolment` is three rule types, three controls and
 * three evaluators, all saying "is this visitor one of these".
 *
 * So there is one rule type and this interface underneath it. An adapter
 * implements two methods and registers itself with {@see RoleRegistry}; no
 * core file changes, no manifest entry is added, and the merchant sees one
 * control listing everything their site can tell them apart by.
 *
 * ============================================================================
 * THE WHOLE OF WHAT AN ADAPTER IS, SPELLED OUT — BECAUSE A SEAM NOBODY CAN
 * FIND IS NOT ONE.
 * ============================================================================
 * `wconvert_loaded` fires once, after the container is built
 * ({@see \WConvert\Bootstrap}), which is where [[Pro]] hooks and where a
 * third party does:
 *
 * ```php
 * add_action('wconvert_loaded', function (): void {
 *     WConvert\Bootstrap::container()
 *         ->resolve(WConvert\Targeting\RoleRegistry::class)
 *         ->add(new MyMembershipRoles());
 * });
 * ```
 *
 * That is the entire integration. The registry is resolved once and held, so
 * a source added there is asked on every request that needs one — and
 * `bin/verify-role-sources.php` runs exactly this against a real WordPress,
 * because a seam proven only against a fake registry is a seam that has never
 * met the container.
 *
 * ============================================================================
 * TWO METHODS, BECAUSE TWO DIFFERENT SURFACES ASK.
 * ============================================================================
 * {@see self::offered()} is the ADMIN's question — what may a merchant choose
 * — and it is asked once, while a rules panel renders. {@see self::held()} is
 * the FRONT END's, asked on every uncached page view of a page whose published
 * set actually names this predicate, so an implementation should treat it as a
 * hot path.
 *
 * An adapter's slugs share one namespace with WordPress's roles, which costs
 * nothing to say and would cost a lot to discover: `subscriber` means
 * WordPress's role, so an adapter naming its own level `subscriber` is
 * claiming that one. Prefix them.
 *
 * @since 0.1.0
 */
interface RoleSource
{
    /**
     * Everything this source can tell visitors apart by, as slug => the
     * merchant's own word for it.
     *
     * The words are the SITE's rather than ours: a role's display name is
     * whatever registered it, and a membership level's is whatever the
     * merchant typed. That is the same reason
     * {@see \WConvert\Rules\RuleCatalogue} takes post-type labels from
     * WordPress rather than from {@see \WConvert\Rules\RuleLabels}.
     *
     * @return array<string, string>
     */
    public function offered(): array;

    /**
     * The ones the CURRENT visitor holds — empty for a signed-out visitor, and
     * empty for a source that has nothing to say about this one.
     *
     * @return list<string>
     */
    public function held(): array;
}
