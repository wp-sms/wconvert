<?php

namespace WConvert\Pro\Module\InlinePlacement;

defined('ABSPATH') || exit;

/** Byte-preserving insertion into rendered article content, never saved content. */
final class ContentInsertion
{
    /** @param array{position: string, paragraph?: int, fallback?: string} $placement */
    public static function insert(string $html, string $anchor, array $placement): string
    {
        if ($placement['position'] === 'before_content') {
            return $anchor . $html;
        }
        if ($placement['position'] === 'after_content') {
            return $html . $anchor;
        }
        $ends = self::paragraphEnds($html);
        if ($ends === null) {
            return $html; // Ambiguous/malformed markup: never guess a boundary.
        }
        $offset = $ends[($placement['paragraph'] ?? 1) - 1] ?? null;
        if ($offset === null) {
            return ($placement['fallback'] ?? 'after_content') === 'skip' ? $html : $html . $anchor;
        }
        return substr($html, 0, $offset) . $anchor . substr($html, $offset);
    }

    /**
     * A conservative HTML tokenizer, not a DOM serializer: retain every input
     * byte and only return explicit, balanced top-level paragraph boundaries.
     * Works on WP 6.2/PHP 8.1 without requiring the optional DOM extension.
     * Nested layouts are deliberately not paragraph insertion locations.
     * @return list<int>|null
     */
    private static function paragraphEnds(string $html): ?array
    {
        $stack = [];
        $ends = [];
        $paragraphText = null;
        $offset = 0;
        $length = strlen($html);
        if ($length > 2000000) {
            return null;
        }
        while (($start = strpos($html, '<', $offset)) !== false) {
            if ($paragraphText !== null) {
                $paragraphText .= substr($html, $offset, $start - $offset);
            }
            if (substr($html, $start, 4) === '<!--') {
                $end = strpos($html, '-->', $start + 4);
                if ($end === false) {
                    return null;
                }
                $offset = $end + 3;
                continue;
            }
            if (!preg_match('/\G<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b(?:[^<>"\']|"[^"]*"|\'[^\']*\')*>/i', $html, $match, 0, $start)) {
                return null;
            }
            $tag = strtolower($match[2]);
            $closing = $match[1] === '/';
            $offset = $start + strlen($match[0]);
            // These start tags implicitly close a paragraph in HTML. A
            // source-balanced stack is not a rendered boundary in that case.
            if (!$closing && in_array('p', $stack, true)
                && in_array($tag, ['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl',
                    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
                    'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'search',
                    'section', 'table', 'ul'], true)) {
                return null;
            }
            if (!$closing && in_array($tag, ['script', 'style', 'textarea', 'title'], true)) {
                if (!preg_match('~</' . $tag . '\s*>~i', $html, $rawEnd, PREG_OFFSET_CAPTURE, $offset)) {
                    return null;
                }
                $offset = $rawEnd[0][1] + strlen($rawEnd[0][0]);
                continue;
            }
            if ($closing) {
                if (array_pop($stack) !== $tag) {
                    return null;
                }
                if ($tag === 'p' && $stack === [] && $paragraphText !== null) {
                    $text = html_entity_decode($paragraphText, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    if (preg_match('/[^\s\p{Z}]/u', $text)) {
                        $ends[] = $offset;
                    }
                    $paragraphText = null;
                }
                continue;
            }
            if (in_array($tag, ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'], true)) {
                continue;
            }
            if ($tag === 'p' && $stack === []) {
                $paragraphText = '';
            }
            $stack[] = $tag;
        }
        return $stack === [] ? $ends : null;
    }
}
