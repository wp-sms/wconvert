/** A trap outside the field vocabulary: never saved, autofilled, or keyboard-focusable. */
export function protectionField(root: HTMLElement): () => string {
  const input = document.createElement('input');
  input.hidden = true; input.name = 'website'; input.tabIndex = -1; input.autocomplete = 'off';
  root.append(input);
  return () => input.value;
}

export interface Challenge { url: string; asset: string; title: string; cancel: string; }
type ProtectionWindow = Window & { WConvertProtection?: { verify(challenge: Challenge): Promise<string> } };
let loading: Promise<void> | undefined;
export async function verify(challenge: Challenge): Promise<string> {
  const host = window as ProtectionWindow;
  if (!host.WConvertProtection) {
    loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = challenge.asset;
      const timer = setTimeout(() => { script.remove(); reject({}); }, 15000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject({}); };
      document.head.append(script);
    }).catch(error => { loading = undefined; throw error; });
    await loading;
  }
  return host.WConvertProtection!.verify(challenge);
}
