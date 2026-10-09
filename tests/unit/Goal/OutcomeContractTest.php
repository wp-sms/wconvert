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
    public function testListCollectionDefaultsToAConnectedServiceButAllowsExplicitLocalCollection(): void
    {
        $email = Goal::GrowEmailList->outcome();
        self::assertNotNull($email->handoffIssue([]));
        self::assertNull($email->handoffIssue([], 'local'));
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
}
