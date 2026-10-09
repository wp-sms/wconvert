import { lazy, Suspense, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PreviewControls } from './PreviewControls';
import { PreviewFrame } from './PreviewFrame';
import { Button } from '../components/ui/button';
import { TryAgain } from '../shell/Region';
import type { PlaybookEntry } from '../goals/api';
import { startingPointDisplayType } from '../goals/StartingPointFacts';

const JourneyTest = lazy(() => import('../builder/JourneyTest').then(module => ({ default: module.JourneyTest })));

/** Production renderer, every screen, no provider submissions. */
export function SetupPreview({ entry, comparison = false, failed = false, onRetry }: { entry: PlaybookEntry; comparison?: boolean; failed?: boolean; onRetry?: () => void }) {
  const [fitHeight, setFitHeight] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < 640); const [step, setStep] = useState(0);
  const [journey, setJourney] = useState(false); const [resultId, setResultId] = useState('');
  const safeStep = Math.min(step, Math.max(0, (entry.template?.tree.steps.length ?? 1) - 1));
  const screen = entry.template?.tree.steps[safeStep];
  const result = screen?.results?.find(item => item.id === resultId) ?? screen?.results?.[0];
  return <section className="wconvert-setup-preview" aria-label={__('Design preview', 'wconvert')}>
    <div className="wconvert-setup-preview__tools wconvert-toolbar">
      <PreviewControls fitHeight={fitHeight} onFitHeight={comparison ? undefined : setFitHeight} mobile={mobile} onMobile={setMobile} template={entry.template} step={safeStep} journey={journey}
        onStep={value => { setJourney(false); setStep(value); setResultId(''); }} />
      {/* The label says which view the button leads to, so it is not also a pressed toggle. */}
      {!comparison && entry.template && <Button variant="outline" onClick={() => setJourney(!journey)}>{journey ? __('Back to screens', 'wconvert') : __('Try visitor journey', 'wconvert')}</Button>}
    </div>
    {!journey && screen?.results && screen.results.length > 0 && <label className="flex flex-col gap-2 text-note">{__('Result to inspect', 'wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event => setResultId(event.target.value)}>{screen.results.map((item, index) => <option key={item.id} value={item.id}>{item.heading || sprintf(/* translators: %d: the result's position. */ __('Result %d', 'wconvert'), index + 1)}</option>)}</select></label>}
    {journey && entry.template ? <div className="wconvert-setup-preview__journey"><Suspense fallback={<p role="status">{__('Loading journey test…', 'wconvert')}</p>}><JourneyTest key={entry.id} template={entry.template} onEdit={index => { setJourney(false); setStep(index); }} /></Suspense></div>
      : <PreviewFrame template={entry.template} displayType={startingPointDisplayType(entry)} mobile={mobile} step={safeStep} result={result} interactive={!comparison} fitHeight={comparison || fitHeight}>
        {failed ? <div className="wconvert-design-detail__error"><p role="alert">{__('This preview could not be loaded.', 'wconvert')}</p>{onRetry && <TryAgain onClick={onRetry} />}</div> : entry.availability && entry.availability !== 'ready' ? <p>{__('This design is not available on this site.', 'wconvert')}</p> : <p role="status">{__('Loading preview…', 'wconvert')}</p>}
      </PreviewFrame>}
    {journey && <p className="text-note text-muted-foreground">{__('Journey tests use sample answers and send nothing.', 'wconvert')}</p>}
  </section>;
}
