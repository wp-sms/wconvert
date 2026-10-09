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

/**
 * One short line under each choice in the rule picker — what the rule looks
 * at, in the merchant's words. Shorter than {@link ruleHelp}, which is the
 * caveat a rule's own row keeps once it is added.
 */
export function ruleHint(type: string): string | null {
  switch (type) {
    case 'post': return __('Choose pages or posts by name.', 'wconvert');
    case 'singular': return __('Every post, page or product of one type.', 'wconvert');
    case 'archive': return __('Listing pages, such as the blog or the shop.', 'wconvert');
    case 'term': return __('Content in a category or tag, and its archive.', 'wconvert');
    case 'url': return __('An address on your site, with * as a wildcard.', 'wconvert');
    case 'logged_in': return __('Whether they are signed in to this site.', 'wconvert');
    case 'role': return __('Their user role or membership level.', 'wconvert');
    case 'device': return __('Phone, tablet or computer.', 'wconvert');
    case 'time_of_day': return __('Hours on your site’s clock.', 'wconvert');
    case 'referrer': return __('A search engine, social media, or a direct visit.', 'wconvert');
    case 'query_param': return __('A tag in the page address, such as utm_source.', 'wconvert');
    case 'ad_blocking': return __('Whether an ad blocker is detected.', 'wconvert');
    case 'cart_has_items': return __('Anything in their WooCommerce cart.', 'wconvert');
    case 'cart_value_min': return __('Their cart total reaches an amount.', 'wconvert');
    case 'cart_products': return __('Particular products in their cart.', 'wconvert');
    case 'cart_categories': return __('Products from particular categories in their cart.', 'wconvert');
    case 'cart_quantity': return __('How many items are in their cart.', 'wconvert');
    case 'cart_amount': return __('What their products cost after discounts.', 'wconvert');
    case 'time_on_page': return __('Seconds after the page opens.', 'wconvert');
    case 'scroll_depth': return __('How far down the page they scroll.', 'wconvert');
    case 'inactivity': return __('Seconds without scrolling, typing or tapping.', 'wconvert');
    case 'exit_intent': return __('The pointer leaves through the top of the page.', 'wconvert');
    case 'scroll_up': return __('They scroll down, then back up.', 'wconvert');
    case 'click_element': return __('A button or link you choose.', 'wconvert');
    default: return ruleHelp(type);
  }
}

/** The picker's sections, in the order a section first appears. */
export function ruleCategory(type: string): string {
  if (['post', 'singular', 'archive', 'term'].includes(type)) return __('Content', 'wconvert');
  if (type === 'url') return __('Address', 'wconvert');
  if (['logged_in', 'role'].includes(type)) return __('Account', 'wconvert');
  if (type.startsWith('cart_') || type === 'products_ready') return __('Cart', 'wconvert');
  if (['time_on_page', 'scroll_depth', 'inactivity', 'page_load'].includes(type)) return __('Time and scrolling', 'wconvert');
  if (['exit_intent', 'scroll_up', 'click_element'].includes(type)) return __('What they do', 'wconvert');
  return __('Their visit', 'wconvert');
}
