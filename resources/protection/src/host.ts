import type { Challenge } from '../../loader/src/protection';
/** Isolate provider overlays from the campaign's modal and closed shadow root. */
export function verify(challenge: Challenge): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(challenge.url, location.href);
    if (url.origin !== location.origin) { reject({ code: 'wconvert_verification_failed', message: challenge.failed }); return; }
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', challenge.title);
    dialog.style.cssText = 'display:block;box-sizing:border-box;position:fixed;inset:0;margin:auto;padding:16px;border:1px solid #d4d8dc;border-radius:12px;background:white;color:#17202a;width:420px;max-width:calc(100% - 24px);max-height:calc(100% - 24px);overflow:auto;';
    const heading = document.createElement('h2');
    heading.textContent = challenge.title;
    heading.style.cssText = 'font:600 18px/1.4 system-ui;margin:0 0 8px;';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = challenge.cancel;
    close.style.cssText = 'font:14px/1.5 system-ui;padding:8px 12px;cursor:pointer;border:1px solid #aab1b8;border-radius:6px;color:#17202a;background:white;';
    const status = document.createElement('p');
    status.setAttribute('role', 'status'); status.textContent = challenge.loading;
    status.style.cssText = 'font:14px/1.5 system-ui;margin:8px 0;';
    const frame = document.createElement('iframe');
    frame.title = challenge.title; frame.src = url.href; frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'display:block;width:100%;height:160px;max-height:65vh;border:0;background:white;';
    dialog.append(heading, status, frame, close);
    // The host sits outside our shadow root, so theme rules must not hide it.
    for (const element of [dialog, heading, status, frame, close]) {
      for (const property of Array.from(element.style)) element.style.setProperty(property, element.style.getPropertyValue(property), 'important');
    }
    const previous = document.activeElement as HTMLElement | null;
    let settled = false;
    const finish = (token?: string, message = challenge.failed) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); window.removeEventListener('message', receive);
      dialog.close(); dialog.remove(); previous?.focus();
      if (token) resolve(token); else reject({ code: 'wconvert_verification_failed', message });
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== url.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'wconvert:verification-ready') {
        status.remove();
        if ([160, 260, 560].includes(event.data.height)) frame.style.setProperty('height', `${event.data.height}px`, 'important');
      }
      if (event.data?.type === 'wconvert:verification') finish(typeof event.data.token === 'string' && event.data.token.length <= 4096 ? event.data.token : undefined);
    };
    const timeout = setTimeout(() => finish(), 180000);
    close.onclick = () => finish(undefined, challenge.cancelled);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(undefined, challenge.cancelled); });
    frame.onerror = () => finish();
    window.addEventListener('message', receive);
    document.body.append(dialog);
    try { dialog.showModal(); close.focus(); } catch { finish(); }
  });
}
