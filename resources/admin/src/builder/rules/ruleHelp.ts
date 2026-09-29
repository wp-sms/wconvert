import { __ } from '@wordpress/i18n';

/** Explain distinctions that a name alone cannot convey, in the picker and row. */
export function ruleHelp(type: string): string | null {
  switch (type) {
    case 'ad_blocking': return __('Checks for signs of ad blocking on this page. Some blockers cannot be detected. If the check is inconclusive, this condition will not match.', 'wconvert');
    case 'exit_intent': return __('When the pointer leaves through the top of the page. For touch visits, use scroll-back-up or a delay.', 'wconvert');
    case 'scroll_up': return __('When someone scrolls down, then back up. Works on touch screens too.', 'wconvert');
    case 'inactivity': return __('Time without moving the pointer, scrolling, typing or tapping while the page is visible.', 'wconvert');
    case 'query_param': return __('Match tags in the current page URL, such as utm_source=newsletter.', 'wconvert');
    case 'archive': return __('Listing pages such as the blog or shop archive, rather than individual posts or products.', 'wconvert');
    case 'term': return __('Individual content assigned to a category or tag, plus that category or tag’s archive.', 'wconvert');
    default: return null;
  }
}
