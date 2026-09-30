import { lazy, Suspense, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { PreviewControls } from './PreviewControls';
import { PreviewFrame } from './PreviewFrame';
import { Button } from '../components/ui/button';
import type { PlaybookEntry } from '../goals/api';
import { startingPointDisplayType } from '../goals/StartingPointFacts';

const JourneyTest = lazy(() => import('../builder/JourneyTest').then(module => ({ default: module.JourneyTest })));

/** Production renderer, every screen, no provider submissions. */
export function SetupPreview({ entry }: { entry: PlaybookEntry }) {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640); const [step, setStep] = useState(0);
  const [journey, setJourney] = useState(false); const [resultId, setResultId] = useState('');
  const safeStep = Math.min(step, Math.max(0, (entry.template?.tree.steps.length ?? 1) - 1));
  const screen = entry.template?.tree.steps[safeStep];
  const result = screen?.results?.find(item => item.id === resultId) ?? screen?.results?.[0];
  return <section className="wconvert-setup-preview" aria-label={__('Design preview', 'wconvert')}>
    <div className="flex flex-wrap items-center gap-2">
      <PreviewControls mobile={mobile} onMobile={setMobile} template={entry.template} step={safeStep} journey={journey}
        onStep={value => { setJourney(false); setStep(value); setResultId(''); }} />
      {entry.template && <Button variant="outline" aria-pressed={journey} onClick={() => setJourney(!journey)}>{journey ? __('Return to screens', 'wconvert') : __('Try visitor journey', 'wconvert')}</Button>}
    </div>
    {!journey && screen?.results && screen.results.length > 0 && <label className="flex flex-col gap-2 text-note">{__('Result to inspect', 'wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event => setResultId(event.target.value)}>{screen.results.map(item => <option key={item.id} value={item.id}>{item.heading || item.id}</option>)}</select></label>}
    {journey && entry.template ? <div className="wconvert-setup-preview__journey"><Suspense fallback={<p role="status">{__('Loading journey test…', 'wconvert')}</p>}><JourneyTest key={entry.id} template={entry.template} onEdit={index => { setJourney(false); setStep(index); }} /></Suspense></div>
      : <PreviewFrame template={entry.template} displayType={startingPointDisplayType(entry)} mobile={mobile} step={safeStep} result={result} interactive>
        <p role="status">{__('Loading the actual setup preview…', 'wconvert')}</p>
      </PreviewFrame>}
    <p className="text-note text-muted-foreground">{__('Preview only. Journey tests use simulated answers and saves; no messages are sent. Review your copy, links and dates in the editor before publishing.', 'wconvert')}</p>
  </section>;
}
