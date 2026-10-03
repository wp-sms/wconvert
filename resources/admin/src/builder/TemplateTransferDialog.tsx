import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { PickerDialogContent, PickerDialogHeader, PickerDialogBody, PickerDialogFooter } from '../discovery/PickerDialog';
import { PreviewControls } from '../discovery/PreviewControls';
import { PreviewFrame } from '../discovery/PreviewFrame';
import { OptionStrip } from '../shell/OptionStrip';
import { messageOf } from '../shell/loadable';
import {
  transferStatus, uploadDesign, prepareImport, applyImport, cancelImport, downloadDesign, importImage, withPreviewImages,
  type TransferDesign, type TransferStatus, type TransferPreview, type Config,
} from '../templates/transfer';

export default function TemplateTransferDialog({ action, design, config, optin, onClose, onApply }: {
  action: 'import' | 'export'; design: TransferDesign; config: Config; optin: string;
  onClose: () => void; onApply: (patch: Config) => void;
}) {
  const [status, setStatus] = useState<TransferStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [mode, setMode] = useState<'file' | 'keep'>('file');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [fitHeight, setFitHeight] = useState(false);
  const session = useRef<string | null>(null);
  const committedLinks = useRef<Record<string, string>>({});
  const urls = useRef<Record<string, string>>({});
  const alive = useRef(true);
  const title = action === 'export' ? __('Export design', 'wconvert') : __('Import design', 'wconvert');
  useEffect(() => {
    alive.current = true;
    transferStatus().then(value => { if (alive.current) setStatus(value); }).catch(reason => { if (alive.current) setError(messageOf(reason)); });
    return () => {
      alive.current = false;
      if (session.current) void cancelImport(session.current).catch(() => undefined);
      Object.values(urls.current).forEach(URL.revokeObjectURL);
    };
  }, []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await work(); }
    catch (reason) {
      if (!alive.current) return;
      setError(messageOf(reason));
      const detail = reason as { data?: { problems?: Record<string, string> } };
      if (detail.data?.problems) setProblems(detail.data.problems);
    } finally { if (alive.current) setBusy(false); }
  };
  const prepare = async (id: string, nextMode = mode, resetLinks = false) => {
    setPreview(null); setReviewed(false);
    const replacements: Record<string, string> = {};
    if (!resetLinks) {
      Object.entries(committedLinks.current).forEach(([source, value]) => { replacements[source] = links[value] ?? value; });
      Object.entries(links).forEach(([source, value]) => { if (!Object.values(committedLinks.current).includes(source)) replacements[source] = value; });
    }
    const next = await prepareImport(id, optin, config, nextMode, replacements);
    const loaded: Record<string, string> = {};
    try {
      const outcomes = await Promise.allSettled(next.assets.map(async asset => {
        loaded[asset.id] = urls.current[asset.id] ?? await importImage(id, asset.id);
      }));
      const failed = outcomes.find(outcome => outcome.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    } catch (reason) {
      Object.entries(loaded).forEach(([id, url]) => { if (!urls.current[id]) URL.revokeObjectURL(url); });
      throw reason;
    }
    if (!alive.current) { Object.values(loaded).forEach(URL.revokeObjectURL); return; }
    Object.entries(urls.current).forEach(([id, url]) => { if (!(id in loaded)) URL.revokeObjectURL(url); });
    urls.current = loaded; setImages(loaded);
    committedLinks.current = replacements;
    setPreview(next); setLinks({}); setStep(0); setResult(0);
  };
  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      if (status && file.size > status.max_bytes) throw new Error(__('This file exceeds your site’s upload limit.', 'wconvert'));
      if (session.current) await cancelImport(session.current);
      Object.values(urls.current).forEach(URL.revokeObjectURL); urls.current = {}; setImages({}); setPreview(null);
      const uploaded = await uploadDesign(file);
      session.current = uploaded.id;
      if (!alive.current) { await cancelImport(uploaded.id); return; }
      await prepare(uploaded.id, mode, true);
    });
  };
  const changingLinks = Object.keys(links).length > 0;
  const rendered = preview ? withPreviewImages(preview.patch.template, images) : undefined;
  const results = rendered?.tree.steps[step]?.results ?? [];
  const notices = preview ? [...new Set(preview.notes)] : [];
  const close = () => { if (!busy) onClose(); };

  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <PickerDialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <PickerDialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{action === 'export'
          ? __('Exports the design currently shown, including unsaved changes and supported images. Campaign settings and connections are not included.', 'wconvert')
          : __('Preview a WConvert design file, then apply it to this draft. Your live campaign stays unchanged until you publish.', 'wconvert')}</DialogDescription>
      </PickerDialogHeader>
      <PickerDialogBody className="wconvert-transfer">
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {!status && !error && <p role="status">{__('Checking file support…', 'wconvert')}</p>}
        {status && !status.zip && <p>{__('This feature needs PHP ZIP support. Ask your host to enable it.', 'wconvert')}</p>}
        {action === 'export' && <>
          <p>{design.name}</p>
          {Object.keys(problems).length > 0 && <ul>{Object.entries(problems).map(([slot, message]) => <li key={slot}>{message}</li>)}</ul>}
        </>}
        {action === 'import' && status?.zip && <>
          <label className="wconvert-transfer__file">{__('Choose a WConvert design file', 'wconvert')}
            <input type="file" accept=".zip,application/zip" disabled={busy} onClick={event => { event.currentTarget.value = ''; }} onChange={event => upload(event.target.files?.[0])} />
          </label>
          <p>{sprintf(__('Maximum file size: %s MB. Starting another import replaces your previous preview.', 'wconvert'), String(Math.floor(status.max_bytes / 1048576)))}</p>
          {!status.upload_images && <p>{__('Your account can import text-only designs. Image files require upload permission.', 'wconvert')}</p>}
          {session.current && <OptionStrip label={__('Content to use', 'wconvert')} value={mode} disabled={busy}
            options={[{ value: 'file', label: __('Use file content', 'wconvert') }, { value: 'keep', label: __('Keep my current content', 'wconvert') }]}
            onChange={value => { const next = value as 'file' | 'keep'; setMode(next); if (session.current) void run(() => prepare(session.current!, next, true)); }} />}
          {preview && <>
            <PreviewControls mobile={mobile} onMobile={setMobile} template={rendered} step={step} onStep={value => { setStep(value); setResult(0); }} fitHeight={fitHeight} onFitHeight={setFitHeight} />
            {results.length > 0 && <label>{__('Result to preview', 'wconvert')}<select value={result} onChange={event => setResult(Number(event.target.value))}>{results.map((item, index) => <option key={item.id} value={index}>{item.heading || item.id}</option>)}</select></label>}
            <PreviewFrame template={rendered} displayType={preview.patch.display_type} mobile={mobile} step={step} result={results[result]} fitHeight={fitHeight} />
            {notices.length > 0 && <section><h3>{__('Needs review', 'wconvert')}</h3><ul>{notices.map(note => <li key={note}>{note}</li>)}</ul></section>}
            {preview.links.length > 0 && <section><h3>{__('Review links', 'wconvert')}</h3><p>{__('Keep these addresses or change them for this site. Linked files are not included in the import.', 'wconvert')}</p>
              {preview.links.map(link => <label className="wconvert-transfer__link" key={link.url}>{sprintf(__('Used in %s place(s)', 'wconvert'), String(link.uses))}
                <input type="text" value={links[link.url] ?? link.url} disabled={busy} aria-label={sprintf(__('Link: %s', 'wconvert'), link.url)} onChange={event => { setLinks(current => ({ ...current, [link.url]: event.target.value })); setReviewed(false); }} />
              </label>)}
            </section>}
            {changingLinks ? <Button variant="outline" disabled={busy} onClick={() => { if (session.current) void run(() => prepare(session.current!)); }}>{__('Update preview', 'wconvert')}</Button>
              : (preview.links.length > 0 || notices.length > 0) && <label className="wconvert-transfer__review"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} />{preview.links.length > 0 ? __('Keep these links and apply the reviewed changes', 'wconvert') : __('Apply the reviewed changes', 'wconvert')}</label>}
            <p>{__('Included images are added to Media Library when you apply. Undo restores the draft and keeps those images available.', 'wconvert')}</p>
          </>}
          {!preview && session.current && !busy && <Button variant="outline" onClick={() => void run(() => prepare(session.current!))}>{__('Retry preview', 'wconvert')}</Button>}
        </>}
        {busy && <p role="status">{__('Preparing design…', 'wconvert')}</p>}
      </PickerDialogBody>
      <PickerDialogFooter>
        <Button variant="outline" disabled={busy} onClick={close}>{__('Cancel', 'wconvert')}</Button>
        {action === 'export' ? <Button disabled={busy || !status?.zip} onClick={() => void run(async () => { await downloadDesign(design, Object.keys(problems)); if (alive.current) onClose(); })}>
          {Object.keys(problems).length ? __('Export without these images', 'wconvert') : __('Download design', 'wconvert')}
        </Button> : <Button disabled={busy || !preview || ((preview.links.length > 0 || notices.length > 0) && !reviewed) || changingLinks} onClick={() => void run(async () => {
          if (!preview || !session.current) return;
          const result = await applyImport(session.current, preview.digest);
          if (alive.current) onApply(result.patch);
        })}>{__('Apply to draft', 'wconvert')}</Button>}
      </PickerDialogFooter>
    </PickerDialogContent>
  </Dialog>;
}
