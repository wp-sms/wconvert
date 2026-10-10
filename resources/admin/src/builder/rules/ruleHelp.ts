import { __ } from '@wordpress/i18n';

/** The caveat a name cannot carry: ⓘ in the picker and on the rule's row. */
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

/**
 * A hint under a choice in the rule picker, **only where the name does not
 * already say it** (ADR 0139), and six words at most. "Device" needs no line
 * reading "Phone, tablet or computer"; "Content archive" does, because a
 * merchant cannot guess it means the blog and the shop. The longer caveat is
 * {@link ruleHelp}, in ⓘ.
 */
export function ruleHint(type: string): string | null {
  switch (type) {
    case 'archive': return __('Blog, shop and other listings', 'wconvert');
    case 'url': return __('An address, with * wildcards', 'wconvert');
    case 'time_of_day': return __('Hours on your site’s clock', 'wconvert');
    case 'referrer': return __('Search, social or direct', 'wconvert');
    case 'query_param': return __('A tag like utm_source', 'wconvert');
    case 'exit_intent': return __('Pointer leaves through the top', 'wconvert');
    default: return null;
  }
}

/**
 * The picker's sections, as an explicit map with **no fallback**. "Their
 * visit" used to catch whatever no branch named, so a new type landed there
 * silently; now it lands nowhere and `builder-rule-picker` fails until it is
 * placed.
 */
export function ruleCategory(type: string): string | null {
  switch (type) {
    case 'post': case 'singular': case 'archive': case 'term': case 'url':
      return __('Pages', 'wconvert');
    case 'logged_in': case 'role': case 'device': case 'time_of_day': case 'ad_blocking':
      return __('Visitor', 'wconvert');
    case 'referrer': case 'query_param':
      return __('Traffic source', 'wconvert');
    case 'cart_has_items': case 'cart_value_min': case 'cart_products': case 'cart_categories':
    case 'cart_quantity': case 'cart_amount': case 'products_ready':
      return __('Cart', 'wconvert');
    case 'page_load': case 'time_on_page': case 'scroll_depth': case 'inactivity':
      return __('Timing', 'wconvert');
    case 'exit_intent': case 'scroll_up': case 'click_element':
      return __('Actions', 'wconvert');
    default:
      return null;
  }
}
