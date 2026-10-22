import type { Mounted, MountOptions } from '@renderer/mount';

/** Live offers expire with their schedule; editor previews have no such lifecycle. */
export function scheduledMount(create: (options: MountOptions) => Mounted, options: MountOptions): Mounted {
  // Preserve an in-progress capture, including its confirmation (ADR 0104).
  if (options.template.tree.steps.some(step => step.kind === 'input')) return create(options);
  const deadline = options.endsAt;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  const mounted = create({ ...options, onClosed: () => { cancel(); options.onClosed?.(); } });
  if (!mounted.mounted || typeof deadline !== 'number' || !Number.isFinite(deadline)) return mounted;
  const check = () => {
    cancel();
    const remaining = deadline - Date.now();
    if (remaining <= 0) mounted.close();
    // Browser timers use a signed 32-bit delay; recheck long schedules in chunks.
    else timer = setTimeout(check, Math.min(remaining, 2147483647));
  };
  return {
    ...mounted,
    get root() { return mounted.root; },
    show() { if (Date.now() >= deadline) return; mounted.show(); check(); },
    close() { cancel(); mounted.close(); },
  };
}
