<?php

namespace WConvert\Tests\Unit\Pro\Frontend;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\InlinePlacement\ContentInsertion;
use WConvert\Pro\Module\InlinePlacement\AutomaticInline;

final class ContentInsertionTest extends TestCase
{
    public function test_candidates_keep_original_boundaries_and_are_idempotent(): void
    {
        $a = '01J00000000000000000000001';
        $b = '01J00000000000000000000002';
        $entries = [
            ['id' => $a, 'display_type' => 'inline', 'inline_placement' => ['position' => 'before_content']],
            ['id' => $b, 'anchor' => $a, 'display_type' => 'inline', 'inline_placement' => ['position' => 'after_paragraph', 'paragraph' => 1]],
        ];
        $html = '<p>One</p><p>Two</p>';
        $result = AutomaticInline::insertCandidates($html, $entries);
        self::assertStringStartsWith('<div hidden data-wconvert-auto="' . $a . '"', $result);
        self::assertStringContainsString('<p>One</p><div hidden data-wconvert-auto="' . $b . '" data-wconvert-owner="' . $a . '"></div><p>Two</p>', $result);
        self::assertSame($result, AutomaticInline::insertCandidates($result, $entries));
    }

    public function test_unsafe_markup_is_unchanged_and_nested_raw_text_does_not_count(): void
    {
        $placement = ['position' => 'after_paragraph', 'paragraph' => 1];
        foreach (['<p>Unclosed', '<div><p>Broken</div>', '<!-- broken', '<script>unclosed',
            '<p>One<div>Group</div></p><p>Two</p>', '<p><p>Nested</p></p><p>Two</p>'] as $html) {
            self::assertSame($html, ContentInsertion::insert($html, 'ANCHOR', $placement));
        }
        $html = '<script>const fake="<p>Fake</p>";</script><div><p>Nested</p></div><p> </p><p>Real<br>paragraph</p><p>Next</p>';
        self::assertSame(str_replace('<p>Next', 'ANCHOR<p>Next', $html), ContentInsertion::insert($html, 'ANCHOR', $placement));
        $raw = '<p><script>console.log(1)</script><style>.x{color:red}</style><!-- comment --></p><p>Real</p><p>Next</p>';
        self::assertSame(str_replace('<p>Next', 'ANCHOR<p>Next', $raw), ContentInsertion::insert($raw, 'ANCHOR', $placement));
    }

    public function test_before_and_after_preserve_the_original_article_bytes(): void
    {
        $html = '<!-- wp:paragraph --><p class="intro">Hello &amp; welcome.</p><!-- /wp:paragraph -->';
        self::assertSame('ANCHOR' . $html, ContentInsertion::insert($html, 'ANCHOR', ['position' => 'before_content']));
        self::assertSame($html . 'ANCHOR', ContentInsertion::insert($html, 'ANCHOR', ['position' => 'after_content']));
    }

    public function test_paragraph_insertion_counts_only_nonempty_top_level_paragraphs(): void
    {
        $html = '<p>One <em>word</em></p><blockquote><p>Not counted</p></blockquote><p>&nbsp;</p><p title="a > b">Two</p><p>Three</p>';
        self::assertSame(str_replace('<p>Three', 'ANCHOR<p>Three', $html), ContentInsertion::insert($html, 'ANCHOR',
            ['position' => 'after_paragraph', 'paragraph' => 2, 'fallback' => 'after_content']));
        self::assertSame($html, ContentInsertion::insert($html, 'ANCHOR',
            ['position' => 'after_paragraph', 'paragraph' => 10, 'fallback' => 'skip']));
        self::assertSame($html . 'ANCHOR', ContentInsertion::insert($html, 'ANCHOR',
            ['position' => 'after_paragraph', 'paragraph' => 10, 'fallback' => 'after_content']));
    }
}
