import { PhoneInput } from 'lite-phone-input/vanilla';
import styles from 'lite-phone-input/styles?inline';

const drafts = new WeakMap<ShadowRoot, Map<string, { value: string; country: string }>>();
const word = (key: string, fallback: string) =>
  (window as Window & { __wcPhoneLabels?: Record<string, string> }).__wcPhoneLabels?.[key] || fallback;

/** One optional enhancement per rendered screen; the plain tel input remains the fallback. */
export function enhancePhones(root: HTMLElement, shadow: ShadowRoot, defaultCountry?: string): (() => void) | undefined {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[name="phone"][data-capture-id]');
  if (inputs.length === 0) return undefined;
  const portal = document.createElement('div');
  portal.className = 'wc-phone-portal';
  shadow.appendChild(portal);
  const originals: Array<{ input: HTMLInputElement; mount: HTMLElement; phone: PhoneInput; observer: MutationObserver; disconnectLive: () => void; hint: HTMLElement | null }> = [];
  for (const input of inputs) {
    const country = input.dataset.pc && input.dataset.pc !== 'site' ? input.dataset.pc : defaultCountry;
    if (!country || !/^[A-Z]{2}$/.test(country)) continue;
    const mount = document.createElement('div');
    mount.className = 'wc-phone';
    input.replaceWith(mount);
    const hint = mount.parentElement?.querySelector<HTMLElement>('.wc-phone-fallback') ?? null;
    try {
      const phone = PhoneInput.mount(mount, {
        defaultCountry: country,
        locale: document.documentElement.lang || 'en',
        separateDialCode: true,
        strict: false,
        allowDropdown: input.dataset.pd !== '0',
        dropdownContainer: portal,
        placeholder: input.placeholder || 'auto',
        inputAttributes: { autocomplete: 'tel', inputmode: 'tel' },
      });
      const visible = phone.getInput() as HTMLInputElement & { __p?: (value: string) => void; __r?: () => void };
      const remembered = drafts.get(shadow)?.get(input.dataset.captureId || '');
      if (remembered) {
        phone.setValue(remembered.value);
        phone.setCountry(remembered.country);
      }
      visible.id = input.id;
      visible.classList.add('wc-input');
      visible.name = input.name;
      visible.required = input.required;
      visible.dataset.captureId = input.dataset.captureId;
      if (hint) hint.hidden = true;
      visible.__p = value => { if (value !== phone.getValue()) phone.setValue(value); visible.dataset.e164 = phone.getValue(); };
      visible.__r = () => { phone.setValue(''); phone.setCountry(country); visible.dataset.e164 = ''; };
      const observer = new MutationObserver(() => phone.setOptions({ disabled: visible.readOnly }));
      observer.observe(visible, { attributes: true, attributeFilter: ['readonly'] });
      const triggerLabel = () => {
        const selected = phone.getCountry();
        const localName = typeof Intl.DisplayNames === 'function'
          ? new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' }).of(selected.code) || selected.name
          : selected.name;
        mount.querySelector('.lpi__trigger')?.setAttribute('aria-label', word('trigger', 'Select country: %1$s (+%2$s)').replace('%1$s', localName).replace('%2$s', selected.dialCode));
      };
      let liveObserver: MutationObserver | undefined;
      const opened = () => {
        const dialog = portal.querySelector<HTMLElement>('.lpi__dropdown');
        if (!dialog) return;
        const computed = getComputedStyle(mount);
        portal.style.font = computed.font;
        for (const key of ['--wc-fg', '--wc-border', '--wc-bg', '--wc-input-bg', '--wc-radius']) portal.style.setProperty(key, computed.getPropertyValue(key));
        dialog.setAttribute('aria-label', word('select', 'Select country'));
        const close = dialog.querySelector<HTMLButtonElement>('.lpi__close');
        if (close) { close.textContent = word('close', 'Close'); close.setAttribute('aria-label', word('closeSelector', 'Close country selector')); }
        const search = dialog.querySelector<HTMLInputElement>('.lpi__search');
        if (search) { search.placeholder = word('search', 'Search…'); search.setAttribute('aria-label', word('searchCountries', 'Search countries')); }
        dialog.querySelector('.lpi__list')?.setAttribute('aria-label', word('countries', 'Countries'));
        const live = dialog.querySelector<HTMLElement>('.lpi__sr-only');
        if (live) {
          const translate = () => {
            const count = live.textContent?.match(/^\d+/)?.[0];
            if (!count) return;
            const phrase = word(Number(count) === 1 ? 'oneResult' : 'manyResults', Number(count) === 1 ? '%s result' : '%s results').replace('%s', count);
            if (live.textContent !== phrase) live.textContent = phrase;
          };
          liveObserver?.disconnect();
          liveObserver = new MutationObserver(translate);
          liveObserver.observe(live, { childList: true, characterData: true, subtree: true });
          translate();
        }
      };
      const validity = () => {
        const value = phone.getValue();
        visible.dataset.e164 = value;
        const result = phone.validate();
        visible.setCustomValidity(!value || result.valid ? '' : word(result.reason || 'invalid_length', 'Enter a valid phone number for the selected country.'));
      };
      visible.addEventListener('input', validity);
      visible.addEventListener('change', validity);
      phone.setOptions({ onChange: validity, onCountryChange: () => { validity(); triggerLabel(); }, onValidationChange: validity,
        onDropdownOpen: opened, onDropdownClose: () => liveObserver?.disconnect() });
      triggerLabel();
      validity();
      originals.push({ input, mount, phone, observer, disconnectLive: () => liveObserver?.disconnect(), hint });
    } catch {
      if (hint) hint.hidden = false;
      mount.replaceWith(input);
    }
  }
  if (originals.length === 0) { portal.remove(); return undefined; }
  const style = document.createElement('style');
  style.textContent = `${styles}\n.wc-phone .lpi{--lpi-bg:var(--wc-input-bg,var(--wc-bg,#fff));--lpi-text-color:var(--wc-fg,#111827);--lpi-border-color:var(--wc-border,#e5e7eb);--lpi-border-radius:var(--wc-radius,.5rem);--lpi-input-height:2.9rem;font:inherit}.wc-phone .lpi__input.wc-input{inline-size:0;box-shadow:none;border:0;border-radius:0;background:transparent;padding:0 var(--lpi-spacing,8px);font:inherit;direction:ltr}.wc-phone-portal .lpi__dropdown{min-width:min(280px,calc(100vw - 2rem));--lpi-text-color:var(--wc-fg,#111827);--lpi-border-color:var(--wc-border,#e5e7eb)}.wc-phone .lpi__input[aria-invalid]{outline:2px solid #b91c1c}`;
  shadow.appendChild(style);
  const cleanup = () => {
    for (const { input, mount, phone, observer, disconnectLive, hint } of originals) {
      input.value = phone.getValue();
      const remembered = drafts.get(shadow) ?? new Map<string, { value: string; country: string }>();
      remembered.set(input.dataset.captureId || '', { value: phone.getValue(), country: phone.getCountry().code });
      drafts.set(shadow, remembered);
      if (hint) hint.hidden = false;
      observer.disconnect();
      disconnectLive();
      phone.destroy();
      mount.replaceWith(input);
    }
    style.remove();
    portal.remove();
    root.addEventListener('wconvert:shown', () => enhancePhones(root, shadow, defaultCountry), { once: true });
  };
  root.addEventListener('wconvert:closed', cleanup, { once: true });
  return cleanup;
}
