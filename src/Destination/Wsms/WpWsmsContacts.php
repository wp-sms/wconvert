<?php

namespace WConvert\Destination\Wsms;

defined('ABSPATH') || exit;

/**
 * {@see WsmsContacts} over the real WSMS — **the whole of the cross-plugin
 * coupling, in one file.**
 *
 * It reaches `WSms\Bootstrap::get('contact.repository')`, which is the same
 * shared-container route WSMS's own premium modules take. **Not REST**: WSMS's
 * contact controller is an admin console API whose permission callback fails
 * for an anonymous capture, and there is no HTTP hop worth paying for between
 * two plugins in one process (#5).
 *
 * Everything is reached by STRING — the class name, the service id, the method
 * names are all resolved at runtime rather than imported. That is not
 * squeamishness: `bin/verify-source-contract.sh` aside, WConvert must load and
 * run on a site with no WSMS at all ([[Standalone]]), and a `use
 * WSms\Contact\...` here would be a hard reference to a class that is usually
 * absent. The [[Availability]] check upstream is what stops this being
 * constructed on such a site; this file is written so that even reaching it is
 * survivable.
 *
 * WSMS's `ConflictException` is translated into {@see ContactConflict} on the
 * way out, so the adapter above can catch a conflict without naming a class it
 * cannot rely on.
 *
 * Named `WpWsmsContacts` rather than `WpSmsContacts` on the repo's own
 * convention — `WpOptionStore implements OptionStore`,
 * `WpSitePresence implements SitePresence` — and because the shorter name
 * differs from the interface it implements by a single letter, which is a
 * distinction nobody should have to make at a glance.
 *
 * @since 0.1.0
 */
final class WpWsmsContacts implements WsmsContacts
{
    private const BOOTSTRAP = 'WSms\\Bootstrap';

    private const REPOSITORY = 'contact.repository';

    /** WSMS's own conflict, by name — the one exception worth telling apart. */
    private const CONFLICT = 'WSms\\Exception\\ConflictException';

    /**
     * Whether this site can be pushed to at all.
     *
     * Asked before anything else touches WSMS, so a site that has it
     * deactivated gets a clean answer rather than a fatal.
     */
    public static function isAvailable(): bool
    {
        return class_exists(self::BOOTSTRAP, false);
    }

    public function findByEmail(string $email): ?array
    {
        $found = $this->call('findByEmail', [$email]);

        return is_array($found) ? $found : null;
    }

    public function findByPhone(string $phone): ?array
    {
        $found = $this->call('findByPhone', [$phone]);

        return is_array($found) ? $found : null;
    }

    /**
     * @param array<string, mixed> $contact
     */
    public function create(array $contact): string
    {
        // `$suppressEvents` is left at its default of false, deliberately and
        // permanently: `wsms_contact_created` is a Flow trigger, an outbound
        // webhook and WSMS's own ESP forwarder, and firing it is most of the
        // value of integrating at all. Suppressing would make WConvert the one
        // Contact producer on the site that does not announce itself
        // (ADR 0023).
        return (string) $this->call('create', [$contact]);
    }

    /**
     * @param array<string, mixed> $contact
     */
    public function update(string $contactId, array $contact): void
    {
        $this->call('update', [$contactId, $contact]);
    }

    public function addTag(string $contactId, string $tagId): void
    {
        $this->call('addTag', [$contactId, $tagId]);
    }

    /**
     * One call into WSMS, with its conflict translated.
     *
     * @param list<mixed> $arguments
     * @return mixed
     * @throws ContactConflict
     */
    private function call(string $method, array $arguments)
    {
        try {
            return $this->repository()->{$method}(...$arguments);
        } catch (\Throwable $failure) {
            // An ordinary outcome, not an error: the Contact this write
            // collided with is the Contact this Lead was going to become
            // (ADR 0022). Matched by NAME, because WConvert runs Standalone
            // and cannot `catch` a class that is usually absent.
            if ($failure instanceof \RuntimeException && is_a($failure, self::CONFLICT)) {
                // NOT escaped, and that is the whole argument for this pair.
                // Every path through this class runs inside
                // {@see WsmsDestinationType::push()}'s `catch (\Throwable)`, so
                // neither this nor {@see UnresolvableConflict} can reach a
                // page — what the message becomes is
                // `PushResult::retryable($failure->getMessage())`, which
                // {@see \WConvert\Destination\PushWorker} hands to the failure
                // ring and to health as OPERATOR-FACING TEXT.
                //
                // esc_html() there is corruption rather than safety three ways
                // over: an apostrophe in WSMS's message is stored as `&#039;`,
                // `DeliveryFailures::record()` truncates with mb_substr() and
                // can cut an entity in half, and the admin renders the string
                // through React, which escapes it again on the way to the DOM.
                // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- never reaches a page: push() catches every path, and the message is stored operator text (see above).
                throw new ContactConflict($failure->getMessage(), 0, $failure);
            }

            throw $failure;
        }
    }

    /**
     * @return object WSMS's `ContactRepositoryInterface`.
     */
    private function repository(): object
    {
        if (!self::isAvailable()) {
            throw new \RuntimeException('WP SMS is not loaded on this site.');
        }

        // By name, not by import. The guard above is what makes this safe to
        // reach at all — on a Standalone site the class is simply not there,
        // and a `use WSms\Bootstrap` at the top of this file would be a hard
        // reference to it either way.
        $accessor = [self::BOOTSTRAP, 'get'];
        $repository = $accessor(self::REPOSITORY);

        if (!is_object($repository)) {
            throw new \RuntimeException('WP SMS did not supply a contact repository.');
        }

        return $repository;
    }
}
