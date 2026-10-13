import { __, sprintf } from '@wordpress/i18n';

/** "+ Follow-up" beside an answer that opens none yet. */
export function AnswerFollowup({ question, option, onFollowup }: {
  question: string; option: { value: string; label: string }; onFollowup(question: string, value: string): void;
}) {
  return <button type="button" className="wconvert-panel-link" onClick={() => onFollowup(question, option.value)}
    aria-label={sprintf(/* translators: %s: an answer. */ __('Add a follow-up for “%s”', 'wconvert'), option.label)}>{__('+ Follow-up', 'wconvert')}</button>;
}
