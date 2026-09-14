<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;
use WConvert\Template\PictureTransfer;

final class PictureTransferTest extends TestCase
{
    /** @return array<string, mixed> */
    private function picture(string $src, string $id = 'photo'): array
    {
        return ['type' => 'image', 'id' => $id, 'src' => $src, 'alt' => ''];
    }

    /**
     * @param list<array<string, mixed>> $nodes
     * @param array<string, string> $tokens
     * @return array<string, mixed>
     */
    private function template(array $nodes, array $tokens = []): array
    {
        return ['tokens' => $tokens, 'tree' => ['steps' => [['type' => 'stack', 'children' => $nodes]]]];
    }

    public function testRootPhotoCanMoveToAnUnambiguousPhotoPanelWithoutCarryingTheOldPalette(): void
    {
        $old = $this->template([], ['bg-image' => 'none']);
        $mine = $this->template([], ['bg-image' => 'url("/shop.jpg")', 'bg' => '#123456']);
        $next = $this->template([['type' => 'media', 'tokens' => ['bg-image' => 'none'], 'children' => []]], ['bg' => '#ffffff']);
        $result = PictureTransfer::prepare($mine, $old, $next);
        $this->assertSame('url("/shop.jpg")', $result['template']['tree']['steps'][0]['children'][0]['tokens']['bg-image']);
        $this->assertSame('#ffffff', $result['template']['tokens']['bg']);
        $this->assertSame(0, $result['unplaced']);
    }

    public function testBackgroundPhotoAndCropSurviveIncludingIndependentMobilePhoto(): void
    {
        $old = $this->template([['type' => 'media', 'tokens' => ['bg-image' => 'none'], 'children' => []]]);
        $mine = $old;
        $mine['tree']['steps'][0]['children'][0] += ['narrow' => ['bg-image' => 'url("/phone.jpg")', 'image-position' => '30% 50%']];
        $mine['tree']['steps'][0]['children'][0]['tokens'] = ['bg-image' => 'url("/shop.jpg")', 'image-position' => 'right center'];
        $result = PictureTransfer::prepare($mine, $old, $old);
        $this->assertSame($mine, $result['template']);
    }

    public function testTargetSampleMobilePhotoCannotHideACarriedDesktopPhoto(): void
    {
        $old = $this->template([['type' => 'media', 'tokens' => ['bg-image' => 'none'], 'children' => []]]);
        $mine = $old;
        $mine['tree']['steps'][0]['children'][0]['tokens']['bg-image'] = 'url("/shop.jpg")';
        $next = $old;
        $next['tree']['steps'][0]['children'][0]['narrow'] = ['bg-image' => 'url("/sample.jpg")', 'pad' => '1rem'];
        $result = PictureTransfer::prepare($mine, $old, $next);
        $this->assertSame(['pad' => '1rem'], $result['template']['tree']['steps'][0]['children'][0]['narrow']);
    }

    public function testBackgroundCanBecomeAnImageAndKeepsItsDecorativeMeaning(): void
    {
        $result = PictureTransfer::prepare($this->template([], ['bg-image' => 'url("/shop.jpg")']), $this->template([]), $this->template([$this->picture('/sample.jpg')]));
        $this->assertSame('/shop.jpg', $result['template']['tree']['steps'][0]['children'][0]['src']);
        $this->assertSame('', $result['template']['tree']['steps'][0]['children'][0]['alt']);
    }

    public function testMeaningfulImageCannotBecomeADecorativeBackgroundSilently(): void
    {
        $old = $this->template([$this->picture('/sample.jpg')]);
        $mine = $this->template([array_replace($this->picture('/mine.jpg'), ['alt' => 'Our store opening hours'])]);
        $next = $this->template([], ['bg-image' => 'url("/new.jpg")']);
        $result = PictureTransfer::prepare($mine, $old, $next);
        $this->assertSame($next, $result['template']);
        $this->assertSame(1, $result['unplaced']);
    }

    public function testReorderingUneditedImagesDoesNotTurnThemIntoMerchantUploads(): void
    {
        $old = $this->template([$this->picture('/a.jpg', 'a'), $this->picture('/b.jpg', 'b')]);
        $mine = $this->template([$this->picture('/b.jpg', 'b'), $this->picture('/a.jpg', 'a')]);
        $next = $this->template([$this->picture('/c.jpg', 'c'), $this->picture('/d.jpg', 'd')]);
        $this->assertSame($next, PictureTransfer::prepare($mine, $old, $next)['template']);
    }

    public function testSeveralPicturesAreNotGuessedIntoOneSlotAndMissingOriginalIsExplained(): void
    {
        $old = $this->template([$this->picture('/a.jpg', 'a'), $this->picture('/b.jpg', 'b')]);
        $mine = $this->template([$this->picture('/mine.jpg', 'a'), $this->picture('/other.jpg', 'b')]);
        $next = $this->template([$this->picture('/c.jpg', 'c')]);
        $result = PictureTransfer::prepare($mine, $old, $next);
        $this->assertSame($next, $result['template']);
        $this->assertSame(2, $result['unplaced']);
        $this->assertSame(2, PictureTransfer::prepare($mine, null, $next)['unverified']);
    }

    public function testAFormPictureNeverMovesToSuccess(): void
    {
        $old = $this->template([$this->picture('/a.jpg')]);
        $mine = $this->template([$this->picture('/mine.jpg')]);
        $next = $this->template([]);
        $next['tree']['steps'][] = ['type' => 'stack', 'children' => [$this->picture('/success.jpg')]];
        $result = PictureTransfer::prepare($mine, $old, $next);
        $this->assertSame($next, $result['template']);
        $this->assertSame(1, $result['unplaced']);
    }
}
