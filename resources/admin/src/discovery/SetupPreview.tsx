import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PreviewControls, usePreviewView } from './PreviewControls';
import { PreviewFrame } from './PreviewFrame';
import { TryAgain } from '../shell/Region';
import type { PlaybookEntry } from '../goals/api';
import { startingPointDisplayType } from '../goals/StartingPointFacts';

/**
 * Production renderer, every screen, no provider submissions. The preview is
 * clickable, but the journey test lives in the editor, not here (ADR 0137).
 */
export function SetupPreview({ entry, comparison = false, failed = false, onRetry }: { entry: PlaybookEntry; comparison?: boolean; failed?: boolean; onRetry?: () => void }) {
  const { mobile, setMobile, fitHeight, setFitHeight } = usePreviewView();
  const [step, setStep] = useState(0); const [resultId, setResultId] = useState('');
  const safeStep = Math.min(step, Math.max(0, (entry.template?.tree.steps.length ?? 1) - 1));
  const screen = entry.template?.tree.steps[safeStep];
  const result = screen?.results?.find(item => item.id === resultId) ?? screen?.results?.[0];
  return <section className="wconvert-setup-preview" aria-label={__('Design preview', 'wconvert')}>
    <div className="wconvert-setup-preview__tools wconvert-toolbar">
      <PreviewControls fitHeight={fitHeight} onFitHeight={comparison ? undefined : setFitHeight} mobile={mobile} onMobile={setMobile} template={entry.template} step={safeStep}
        onStep={value => { setStep(value); setResultId(''); }} />
    </div>
    {screen?.results && screen.results.length > 0 && <label className="flex flex-col gap-2 text-note">{__('Result to inspect', 'wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event => setResultId(event.target.value)}>{screen.results.map((item, index) => <option key={item.id} value={item.id}>{item.heading || sprintf(/* translators: %d: the result's position. */ __('Result %d', 'wconvert'), index + 1)}</option>)}</select></label>}
    <PreviewFrame template={entry.template} displayType={startingPointDisplayType(entry)} mobile={mobile} step={safeStep} result={result} interactive={!comparison} fitHeight={comparison || fitHeight}>
      {failed ? <div className="wconvert-design-detail__error"><p role="alert">{__('This preview could not be loaded.', 'wconvert')}</p>{onRetry && <TryAgain onClick={onRetry} />}</div> : entry.availability && entry.availability !== 'ready' ? <p>{__('This design is not available on this site.', 'wconvert')}</p> : <p role="status">{__('Loading preview…', 'wconvert')}</p>}
    </PreviewFrame>
  </section>;
}
