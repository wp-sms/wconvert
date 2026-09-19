import { useState } from 'react';
import type { CSSProperties } from 'react';

/** Both choices use the same picture and frame so the crop is easy to compare. */
export function ImageFitPreview({ fit, src }: { fit: string; src: unknown }) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = typeof src === 'string' && src !== '' && src !== failed ? src : null;
  return <span className="wconvert-fit-preview" aria-hidden="true">
    {image ? <img src={image} alt="" loading="lazy" onError={() => setFailed(image)} style={{ objectFit: fit as CSSProperties['objectFit'] }} />
      : <svg viewBox="0 0 120 90" preserveAspectRatio={fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}>
        <rect width="120" height="90" fill="var(--muted)" />
        <circle cx="87" cy="23" r="9" fill="var(--muted-foreground)" />
        <path d="M0 90V73L38 25L83 90ZM49 90L89 48L120 78V90Z" fill="currentColor" />
      </svg>}
  </span>;
}

/** Flex order follows the document direction, just like the rendered split. */
export function SplitRatioPreview({ ratio }: { ratio: string }) {
  const first = Number(ratio);
  return <span className="wconvert-split-preview" aria-hidden="true">
    <span style={{ flex: first }}>1</span><span style={{ flex: 1 - first }}>2</span>
  </span>;
}
