/** A trap outside the field vocabulary: never saved, autofilled, or keyboard-focusable. */
export function protectionField(root: HTMLElement): () => string {
  const input = document.createElement('input');
  input.hidden = true; input.name = 'website'; input.tabIndex = -1; input.autocomplete = 'off';
  root.append(input);
  return () => input.value;
}

export interface Challenge { url: string; asset: string; title: string; cancel: string; }
/** Native module loading deduplicates parallel requests; failures can be retried. */
export async function verify(challenge: Challenge): Promise<string> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const module = await Promise.race([
      import(/* @vite-ignore */ challenge.asset) as Promise<{ verify(challenge: Challenge): Promise<string> }>,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject({}), 15000); }),
    ]);
    return module.verify(challenge);
  } finally { clearTimeout(timer!); }
}
