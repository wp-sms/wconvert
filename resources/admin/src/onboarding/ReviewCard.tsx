import { useState } from 'react';
import { __, _x } from '@wordpress/i18n';
import { ArrowUpRight, Heart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { adminSettings } from '../settings';
import { recordReviewChoice, type ReviewChoice } from './reviewAskApi';
import './review-card.css';

/** No UTMs: ADR 0189's scheme covers our own sites only. */
export const REVIEW_URL = 'https://wordpress.org/support/plugin/wconvert/reviews/#new-post';

/**
 * Answered during this page load. The boot flag is read once per load and
 * each screen unmounts when the hash moves, so an answer on Campaigns has to
 * keep the card off Analytics without a reload.
 */
let answeredThisLoad = false;

/** For tests: forget an answer from an earlier render. */
export function resetReviewCardForTests(): void {
  answeredThisLoad = false;
}

/**
 * The review card: a thank-you note that asks for a wordpress.org review once
 * someone's first conversion lands (ADR 0191; approved mockup
 * claude.ai/artifact/MY4VZ6U5niMSoPjk5vTopT, Note style, copy A).
 *
 * Its first look offers Maybe later; its last look, 30 days on, does not.
 * The server decides which look shows, or none ({@see ReviewAsk}).
 */
export function ReviewCard() {
  const look = adminSettings()?.reviewAsk ?? null;
  const [answered, setAnswered] = useState(answeredThisLoad);

  if (look === null || answered) return null;

  const answer = (choice: ReviewChoice) => {
    answeredThisLoad = true;
    // If this fails the card comes back next visit, which is the safe way round.
    void recordReviewChoice(choice).catch(() => undefined);
    // After the click finishes: a link removed while its click is still being
    // dispatched can no longer open its tab.
    window.setTimeout(() => {
      setAnswered(true);
      const title = document.querySelector<HTMLElement>('#wconvert-admin .wconvert-page-title');
      if (title) {
        title.tabIndex = -1;
        title.focus();
      }
    }, 0);
  };

  const first = look === 'first';

  return (
    <section className="wconvert-review" aria-labelledby="wconvert-review-title" data-look={look}>
      <div className="wconvert-review__body">
        <span className="wconvert-review__seal" aria-hidden="true"><Heart /></span>
        <div className="wconvert-review__text">
          <h2 id="wconvert-review-title" className="wconvert-review__title">
            {first ? __('Thank you for using WConvert.', 'wconvert') : __('Thanks for sticking with WConvert.', 'wconvert')}
          </h2>
          <p className="wconvert-review__lede">
            {first
              ? __('If it helps, a short review on WordPress.org means a lot.', 'wconvert')
              : __('If you have a minute, a review would mean a lot. We won’t ask again.', 'wconvert')}
          </p>
          <p className="wconvert-review__sign">{__('— the WConvert team', 'wconvert')}</p>
        </div>
        <div className="wconvert-review__actions">
          <Button asChild className="wconvert-review__rate">
            <a href={REVIEW_URL} target="_blank" rel="noreferrer" onClick={() => answer('rated')}
              // A middle-click opens the tab without a click event.
              onAuxClick={(event) => { if (event.button === 1) answer('rated'); }}>
              {__('Rate WConvert', 'wconvert')}
              <ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" />
              <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
            </a>
          </Button>
          {first && (
            <Button type="button" variant="outline" onClick={() => answer('later')}>
              {/* Its own context: a playbook's visitor-facing “Maybe later” stays untranslated (ADR 0191). */}
              {_x('Maybe later', 'review card button', 'wconvert')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => answer('declined')}>
            {__('No thanks', 'wconvert')}
          </Button>
        </div>
      </div>
    </section>
  );
}
