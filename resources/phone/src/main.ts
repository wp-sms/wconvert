import { enhancePhones } from './enhance';

(window as Window & { wconvertPhone?: (root: HTMLElement) => void }).wconvertPhone =
  root => { enhancePhones(root, root.getRootNode() as ShadowRoot); };
window.dispatchEvent(new Event('wconvert:phone-ready'));
