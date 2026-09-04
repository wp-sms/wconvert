<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * WordPress's own roles, which is the source every install has.
 *
 * The only implementation that ships, and the reason the seam is worth having
 * anyway: a membership plugin's levels are the same question asked of another
 * system, and this is what it registers beside rather than replaces
 * ({@see RoleSource}).
 *
 * **A visitor holds a role only while signed in**, so this answers nothing at
 * all for the anonymous visitor most page views are — which is what makes it
 * cheap enough to ask on the front end. It is also why a role rule lives on
 * the server axis in the first place: the client cannot read WordPress's
 * HttpOnly auth cookie, so the browser cannot know who this is.
 *
 * @since 0.1.0
 */
final class WpRoleSource implements RoleSource
{
    /**
     * Every role registered on this site, by its own display name.
     *
     * `wp_roles()` rather than the `$wp_roles` global, and `role_names`
     * rather than walking `roles`: the names it holds are the ones a merchant
     * reads in Users, translated by whatever registered them.
     *
     * @return array<string, string>
     */
    public function offered(): array
    {
        $names = wp_roles()->role_names;
        $offered = [];

        foreach ($names as $slug => $name) {
            $offered[(string) $slug] = (string) $name;
        }

        return $offered;
    }

    /**
     * @return list<string>
     */
    public function held(): array
    {
        // Asked before `wp_get_current_user()`, because it is the cheap
        // question and the answer for most page views: a signed-out visitor
        // holds no role, and there is nothing here to build a user object for.
        if (!is_user_logged_in()) {
            return [];
        }

        return array_values(array_map('strval', (array) wp_get_current_user()->roles));
    }
}
