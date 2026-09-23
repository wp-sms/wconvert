import { enhancePhones } from './enhance';

(window as Window & { __wcPhone?: (root: HTMLElement) => void }).__wcPhone =
  root => { enhancePhones(root, root.getRootNode() as ShadowRoot); };
window.dispatchEvent(new Event('wconvert:phone-ready'));
