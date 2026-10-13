import { __ } from '@wordpress/i18n';

/** An answer type in the words the Answer type menu uses. */
export function answerTypeName(type: string): string {
  return type === 'multi' ? __('Choose several', 'wconvert') : type === 'text' ? __('Short answer', 'wconvert') : __('Choose one', 'wconvert');
}
