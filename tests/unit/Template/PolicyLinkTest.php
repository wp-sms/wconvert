<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\PolicyLink;

/**
 * The privacy-policy link is **renderer-resolved**, from the site's own
 * configured policy, at the moment the page is drawn (ADR 0032).
 *
 * A [[Playbook]] can express nothing site-local — no post ids, no
 * [[Destination]] ids, and no privacy-policy link — so the wording is generic
 * copy a Playbook carries like any other and the URL is the site's to supply.
 * That makes one Playbook correct on every install without any entry knowing
 * which install it is on.
 *
 * **No policy set renders nothing, never a dead `#`.**
 */
#[CoversClass(PolicyLink::class)]
final class PolicyLinkTest extends TestCase
{
    private const POLICY = 'https://example.test/privacy-policy/';

    /**
     * @param array<string, mixed> $link
     * @return array<string, mixed>
     */
    private static function payload(array $link, string $type = 'consent', ?string $role = 'consent_text'): array
    {
        $node = ['type' => $type, 'text' => 'I accept the %s.', 'link' => $link];

        if ($role !== null) {
            $node['role'] = $role;
        }

        return ['template' => ['tree' => ['steps' => [['type' => 'stack', 'children' => [$node]]]], 'tokens' => []]];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function firstLink(array $payload): array
    {
        /** @var array<string, mixed> $link */
        $link = $payload['template']['tree']['steps'][0]['children'][0]['link'];

        return $link;
    }

    public function testAnHreflessLinkTakesTheSitesConfiguredPolicy(): void
    {
        $resolved = PolicyLink::into(self::payload(['label' => 'privacy policy']), self::POLICY);

        $this->assertSame(['label' => 'privacy policy', 'href' => self::POLICY], self::firstLink($resolved));
    }

    /**
     * With nothing configured the link renders NOTHING — and the placeholder
     * goes with it, along with the space in front of it. A dead `#` is worse
     * than no link at all (ADR 0032).
     */
    public function testWithNoPolicyConfiguredTheLinkStaysHrefless(): void
    {
        foreach ([null, ''] as $none) {
            $resolved = PolicyLink::into(self::payload(['label' => 'privacy policy']), $none);

            $this->assertArrayNotHasKey('href', self::firstLink($resolved));
        }
    }

    /**
     * An href that is already there was written by the merchant and
     * scheme-validated in PHP at write (ADR 0013). It is not a placeholder
     * waiting to be filled, so it is left exactly as it is.
     */
    public function testALinkThatAlreadyNamesItsOwnDestinationIsUntouched(): void
    {
        $own = ['label' => 'our terms', 'href' => 'https://example.test/terms/'];

        $this->assertSame($own, self::firstLink(PolicyLink::into(self::payload($own), self::POLICY)));
    }

    /**
     * The fine print is the other sentence that reaches for the policy, and
     * ADR 0013's structured link is the one shape both express it in. The rule
     * is about the LINK, not about which node holds it: a link with a label
     * and no destination is the one thing only the site can supply.
     */
    public function testFinePrintResolvesTheSameWay(): void
    {
        $resolved = PolicyLink::into(
            self::payload(['label' => 'privacy policy'], 'text', 'fine_print'),
            self::POLICY
        );

        $this->assertSame(self::POLICY, self::firstLink($resolved)['href']);
    }

    /**
     * A link with no label has no anchor text, so there is nothing to render
     * whatever href it were given.
     */
    public function testALinkWithNoLabelIsLeftAlone(): void
    {
        $resolved = PolicyLink::into(self::payload([]), self::POLICY);

        $this->assertSame([], self::firstLink($resolved));
    }

    public function testItReachesEveryStepAndBothPanesOfASplit(): void
    {
        $node = static fn (string $id): array => [
            'type' => 'consent',
            'text' => $id . ' %s',
            'link' => ['label' => 'privacy policy'],
        ];

        $payload = ['template' => ['tree' => ['steps' => [
            ['type' => 'split', 'start' => [$node('a')], 'end' => [['type' => 'row', 'children' => [$node('b')]]]],
            ['type' => 'stack', 'children' => [$node('c')]],
        ]], 'tokens' => []]];

        $resolved = PolicyLink::into($payload, self::POLICY);
        $found = [];
        $walk = static function (array $node) use (&$walk, &$found): void {
            if (isset($node['link']['href'])) {
                $found[] = $node['link']['href'];
            }

            foreach (['children', 'start', 'end'] as $key) {
                foreach ($node[$key] ?? [] as $child) {
                    $walk($child);
                }
            }
        };

        foreach ($resolved['template']['tree']['steps'] as $step) {
            $walk($step);
        }

        $this->assertSame([self::POLICY, self::POLICY, self::POLICY], $found);
    }

    public function testAPayloadCarryingNoTemplateIsHandedBackUnchanged(): void
    {
        $entry = ['id' => '01JQ0000000000000000000001', 'display_type' => 'popup'];

        $this->assertSame($entry, PolicyLink::into($entry, self::POLICY));
    }
}
