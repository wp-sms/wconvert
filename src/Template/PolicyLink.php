<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The site's privacy policy, resolved into a template tree at render time.
 *
 * **The renderer, not the template, owns the link** (ADR 0032). A [[Playbook]]
 * can express nothing site-local — no post or term ids in its targeting, no
 * [[Destination]] ids, and no privacy-policy link — so the consent *wording*
 * is generic copy a Playbook carries like any other, and the URL is the site's
 * to supply. That is what makes one registry entry correct on every install
 * without any entry knowing which install it is on.
 *
 * **The rule is about the link, not about the node.** A link that declares a
 * label and names no destination is asking for the one destination only the
 * site can name; a link that names its own was written by the merchant and
 * scheme-validated at write (ADR 0013). So consent wording and fine print
 * resolve identically, with no table of roles to keep in step, and no node
 * type gets a special case.
 *
 * **Resolved per request, never frozen at publish.** The published set is
 * rebuilt on write (ADR 0003), so an href baked into it would still name last
 * month's policy page after the merchant moved it. `get_privacy_policy_url()`
 * is a site-wide setting and is identical for every visitor, so reading it
 * here is safe under the full-page cache the payload is baked into.
 *
 * The URL is passed in rather than read here. This is a pure function of
 * (payload, url), which is what lets it be tested without a WordPress install
 * — the same arrangement {@see \WConvert\Optin\PublishedProjection} has.
 *
 * @since 0.1.0
 */
final class PolicyLink
{

    /**
     * One payload entry with every site-resolved link filled in.
     *
     * With no policy configured the hrefs are left absent and the links render
     * NOTHING — never a dead `#`, because a site with no privacy policy has no
     * link to offer and offering a broken one is worse than offering none.
     *
     * @param array<string, mixed> $payload One entry, as it travels to the browser.
     * @param string|null $url `get_privacy_policy_url()`, which is `''` where none is set.
     * @return array<string, mixed>
     */
    public static function into(array $payload, ?string $url): array
    {
        if ($url === null || $url === '') {
            return $payload;
        }

        return TemplateTree::rewrittenIn($payload, static fn (array $node): array => self::resolve($node, $url));
    }

    /**
     * One node, with the site's link filled in where it was asked for.
     *
     * The walk is {@see TemplateTree::rewrittenIn()}'s, so what is left here
     * is the rule and nothing else — which is the point: the rule is the half
     * worth reading, and it used to sit under fifteen lines of recursion that
     * {@see CartLink} then copied.
     *
     * @param array<string, mixed> $node
     * @return array<string, mixed>
     */
    private static function resolve(array $node, string $url): array
    {
        $link = $node['link'] ?? null;

        // A label and no destination: the one shape only the site can
        // complete. No label means no anchor text, so there is nothing to
        // render whatever href it were handed.
        if (
            is_array($link)
            && is_string($link['label'] ?? null)
            && $link['label'] !== ''
            && !is_string($link['href'] ?? null)
        ) {
            $link['href'] = $url;
            $node['link'] = $link;
        }

        return $node;
    }
}
