<?php

namespace WConvert\Onboarding;

defined('ABSPATH') || exit;

/**
 * Whether one user has put the getting-started checklist away (ADR 0176).
 *
 * **Per user, in user meta.** Two people sharing a site each get their own
 * checklist, and hiding it is not a site setting.
 *
 * Two things write it: the × on the card, and the card's "You're all set"
 * state, which shows once and writes this so the next visit skips it. The
 * milestones alone can't tell that visit from the next one.
 */
final class ChecklistDismissal
{
    /** Suffixed with the blog id: one user spans every site of a network. */
    public const META = 'wconvert_checklist_hidden_';

    public function hidden(int $userId): bool
    {
        return $userId > 0 && (bool) get_user_meta($userId, self::key(), true);
    }

    public function hide(int $userId): void
    {
        if ($userId > 0) {
            update_user_meta($userId, self::key(), 1);
        }
    }

    public static function key(): string
    {
        return self::META . get_current_blog_id();
    }
}
