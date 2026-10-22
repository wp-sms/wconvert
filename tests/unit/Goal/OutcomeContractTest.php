<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;

final class OutcomeContractTest extends TestCase
{
    public function testBasketAdditionGoalRequiresAnAdditionDesignAndDoesNotReuseClickMeaning(): void
    {
        $config = ['template' => ['tree' => ['steps' => [['content' => ['type' => 'products', 'action' => 'add_to_cart']]]]]];
        self::assertNull(Goal::IncreaseBasketValue->outcome()->designIssue($config));
        self::assertNotNull(Goal::PromoteOffer->outcome()->designIssue($config));
        self::assertSame('Basket additions', Goal::IncreaseBasketValue->headlineLabel());
        unset($config['template']['tree']['steps'][0]['content']['action']);
        self::assertNotNull(Goal::IncreaseBasketValue->outcome()->designIssue($config));
    }
    public function testListCollectionKeepsLeadsLocallyUntilAServiceIsConnected(): void
    {
        $email = Goal::GrowEmailList->outcome();
        self::assertNull($email->handoffIssue([], 'local'));
        self::assertNotNull($email->handoffIssue([], 'connected'));
        self::assertNull($email->handoffIssue(['mailpoet'], 'connected', ['email']));
        self::assertNotNull(Goal::GrowSmsList->outcome()->handoffIssue(['mailpoet'], 'connected', ['email']));
        self::assertNotNull($email->handoffIssue(['lead_magnet_email'], 'connected', []));
    }

    public function testAnSmsGoalNeedsARequiredPhoneOnTheSubmittingScreen(): void
    {
        $contract = Goal::GrowSmsList->outcome();
        $form = static fn (array $fields): array => ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [
            ['type' => 'stack', 'children' => [...$fields, ['type' => 'button', 'action' => 'submit']]],
            ['type' => 'stack', 'children' => []],
        ]])]];

        self::assertNotNull($contract->designIssue($form([['type' => 'field', 'name' => 'email', 'required' => true]])));
        self::assertNotNull($contract->designIssue($form([['type' => 'field', 'name' => 'phone', 'required' => false]])));
        self::assertNull($contract->designIssue($form([['type' => 'field', 'name' => 'phone', 'required' => true]])));
        self::assertNotNull($contract->designIssue($form([['type' => 'stack', 'hidden' => true, 'children' => [
            ['type' => 'field', 'name' => 'phone', 'required' => true],
        ]]])));
    }

    /**
     * A lead magnet kept in WConvert only still publishes (ADR 0133): the lead
     * is saved, and the review warns that no file goes out until the delivery
     * email is set up. Choosing to connect and then not finishing still blocks.
     */
    public function testALeadMagnetKeptLocallyPublishes(): void
    {
        $magnet = Goal::DeliverLeadMagnet->outcome();
        self::assertNull($magnet->handoffIssue([], 'local'));
        self::assertNotNull($magnet->handoffIssue([], 'connected'));
        self::assertNull($magnet->handoffIssue(['lead_magnet_email'], 'connected'));
    }
    /** A message accepts one content screen with nothing to count, and nothing else (ADR 0163). */
    public function testAMessageAcceptsOnlyAScreenWithNothingToCount(): void
    {
        $contract = Goal::ShowMessage->outcome();
        $tree = static fn (array ...$screens): array => ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => $screens])]];
        $words = ['type' => 'heading', 'text' => 'Free shipping all weekend'];
        $link = ['type' => 'button', 'action' => 'link', 'href' => 'https://example.test/shop', 'label' => 'Shop now'];

        self::assertSame('none', $contract->action);
        self::assertNull($contract->designIssue($tree(['type' => 'stack', 'children' => [$words]])));
        self::assertNotNull($contract->designIssue($tree(['type' => 'stack', 'children' => [$words, $link]])));
        self::assertNotNull($contract->designIssue($tree(
            ['type' => 'stack', 'children' => [['type' => 'field', 'name' => 'email', 'required' => true], ['type' => 'button', 'action' => 'submit']]],
            ['type' => 'stack', 'children' => [$words]],
        )));
        self::assertNotNull($contract->designIssue(['template' => ['tree' => ['steps' => []]]]));
        // Every other Goal still wants its one act.
        self::assertNotNull(Goal::PromoteOffer->outcome()->designIssue($tree(['type' => 'stack', 'children' => [$words]])));
        self::assertNotNull(Goal::GrowEmailList->outcome()->designIssue($tree(['type' => 'stack', 'children' => [$words]])));
    }

    /** Fitting a design to a message takes its counted links out and leaves everything else. */
    public function testFittingADesignToAMessageDropsOnlyItsCountedLinks(): void
    {
        $tree = ['v' => 2, 'steps' => [['id' => 's1', 'name' => 'Offer', 'kind' => 'content', 'content' => ['type' => 'split', 'start' => [
            ['type' => 'heading', 'id' => 'n1', 'text' => 'Free shipping'],
        ], 'end' => [['type' => 'stack', 'children' => [
            ['type' => 'button', 'id' => 'n2', 'action' => 'link', 'label' => 'Shop'],
            ['type' => 'text', 'id' => 'n3', 'text' => 'Ends Sunday'],
        ]]]]]], 'submissions' => []];

        $fitted = Goal::ShowMessage->outcome()->fitted($tree);
        self::assertSame([['type' => 'text', 'id' => 'n3', 'text' => 'Ends Sunday']], $fitted['steps'][0]['content']['end'][0]['children']);
        self::assertSame($tree['steps'][0]['content']['start'], $fitted['steps'][0]['content']['start']);
        self::assertNull(Goal::ShowMessage->outcome()->designIssue(['template' => ['tree' => $fitted]]));
        self::assertSame($tree, Goal::PromoteOffer->outcome()->fitted($tree));
    }

    public function testAMessageReportsAppearancesAndNoRate(): void
    {
        self::assertSame(\WConvert\Stats\StatKind::Impression, Goal::ShowMessage->headlineKind());
        self::assertSame('Appearances', Goal::ShowMessage->headlineLabel());
        self::assertSame('Show a message', Goal::ShowMessage->label());
        self::assertSame(\WConvert\Support\Tier::Free, Goal::ShowMessage->tier());
    }
}
