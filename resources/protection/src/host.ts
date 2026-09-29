import type { Challenge } from '../../loader/src/protection';
/** One isolated document lets provider challenge popups work inside our modal/shadow forms. */
export function verify(challenge: Challenge): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(challenge.url, location.href);
    if (url.origin !== location.origin) { reject({}); return; }
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', challenge.title);
    dialog.style.cssText = 'box-sizing:border-box;position:fixed;inset:0;margin:auto;padding:12px;border:1px solid #ccc;border-radius:8px;background:white;color:#17202a;width:420px;max-width:calc(100% - 32px);max-height:calc(100% - 32px);overflow:auto;';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = challenge.cancel;
    close.style.cssText = 'font:14px system-ui;padding:8px;cursor:pointer;';
    const frame = document.createElement('iframe');
    frame.title = challenge.title; frame.src = url.href; frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'display:block;width:100%;height:560px;max-height:70vh;border:0;background:white;';
    dialog.append(close, frame);
    const previous = document.activeElement as HTMLElement | null;
    let settled = false;
    const finish = (token?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); window.removeEventListener('message', receive);
      dialog.close(); dialog.remove(); previous?.focus();
      if (token) resolve(token); else reject({});
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== url.origin || event.source !== frame.contentWindow || event.data?.type !== 'wconvert:verification') return;
      finish(typeof event.data.token === 'string' && event.data.token.length <= 4096 ? event.data.token : undefined);
    };
    const timeout = setTimeout(() => finish(), 180000);
    close.onclick = () => finish();
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    window.addEventListener('message', receive);
    document.body.append(dialog);
    try { dialog.showModal(); } catch { finish(); }
  });
}
