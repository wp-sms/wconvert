export { verify } from './host';
interface WidgetAPI { render(target: HTMLElement, options: Record<string, unknown>): string | number; }
interface ProviderWindow extends Window { turnstile?: WidgetAPI; grecaptcha?: WidgetAPI; hcaptcha?: WidgetAPI; wconvertChallengeReady?: () => void; }
const element = document.getElementById('wconvert-verification-config');
if (element) initialize(element);
function initialize(element: HTMLElement) {
  const config = JSON.parse(element.textContent!) as {
    provider: 'turnstile' | 'recaptcha' | 'hcaptcha' | 'none'; siteKey: string; origin: string; failed: string;
  };
  const providers = {
    turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    recaptcha: 'https://www.google.com/recaptcha/api.js',
    hcaptcha: 'https://js.hcaptcha.com/1/api.js',
  };
  const host = window as ProviderWindow;
  const status = document.getElementById('status')!;
  const ready = (height: number) => parent.postMessage({ type: 'wconvert:verification-ready', height }, config.origin);
  const notify = (token?: string) => {
    parent.postMessage({ type: 'wconvert:verification', token }, config.origin);
  };
  const fail = () => { status.textContent = config.failed; notify(); };
  const timeout = setTimeout(fail, 20000);
  host.wconvertChallengeReady = () => {
    clearTimeout(timeout);
    if (config.provider === 'none') { fail(); return; }
    const api = config.provider === 'recaptcha' ? host.grecaptcha : host[config.provider];
    if (!api) { fail(); return; }
    try {
      ready(config.provider === 'recaptcha' ? 560 : config.provider === 'hcaptcha' ? 260 : 160);
      api.render(document.getElementById('widget')!, {
        sitekey: config.siteKey, ...(config.provider === 'turnstile' ? { action: 'wconvert_capture', size: 'flexible' } : { size: 'compact' }),
        ...(config.provider === 'hcaptcha' ? { 'open-callback': () => ready(560), 'close-callback': () => ready(260) } : {}),
        callback: (token: string) => notify(token), 'error-callback': fail, 'expired-callback': fail,
      });
    } catch { fail(); }
  };
  if (config.provider === 'none' || !config.siteKey) { clearTimeout(timeout); fail(); }
  else {
    const script = document.createElement('script');
    script.src = `${providers[config.provider]}?render=explicit&onload=wconvertChallengeReady${config.provider === 'hcaptcha' ? '&recaptchacompat=off' : ''}`;
    script.async = true; script.onerror = () => { clearTimeout(timeout); fail(); };
    document.head.append(script);
  }

}
