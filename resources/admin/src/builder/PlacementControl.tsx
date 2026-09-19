import { __ } from '@wordpress/i18n';
import { useDirection } from '../hooks/useDirection';

const BAR_DEFAULT = 'block_end';
const SLIDE_IN_DEFAULT = 'block_end_inline_end';

export function resolvedPlacement(displayType: string, placement: unknown): string | null {
  if (displayType === 'floating_bar') {
    return placement === 'block_start' ? placement : BAR_DEFAULT;
  }

  if (displayType === 'slide_in') {
    return [
      'block_start_inline_start',
      'block_start_inline_end',
      'block_end_inline_start',
    ].includes(typeof placement === 'string' ? placement : '')
      ? (placement as string)
      : SLIDE_IN_DEFAULT;
  }

  return null;
}

export function physicalPlacementLabel(
  displayType: string,
  placement: unknown,
  direction: 'ltr' | 'rtl',
): string | null {
  const resolved = resolvedPlacement(displayType, placement);

  return ({
    block_start: __('Top', 'wconvert'),
    block_end: __('Bottom', 'wconvert'),
    block_start_inline_start: direction === 'rtl' ? __('Top right', 'wconvert') : __('Top left', 'wconvert'),
    block_start_inline_end: direction === 'rtl' ? __('Top left', 'wconvert') : __('Top right', 'wconvert'),
    block_end_inline_start: direction === 'rtl' ? __('Bottom right', 'wconvert') : __('Bottom left', 'wconvert'),
    block_end_inline_end: direction === 'rtl' ? __('Bottom left', 'wconvert') : __('Bottom right', 'wconvert'),
  } as Record<string, string>)[resolved ?? ''] ?? null;
}

export function PlacementControl({
  displayType,
  value,
  onChange,
}: {
  displayType: string;
  value: unknown;
  onChange: (placement: string | null) => void;
}) {
  const direction = useDirection();
  const selected = resolvedPlacement(displayType, value);

  if (selected === null) {
    return null;
  }

  const positions =
    displayType === 'floating_bar'
      ? [
          { value: 'block_start', label: __('Top', 'wconvert') },
          { value: BAR_DEFAULT, label: __('Bottom', 'wconvert') },
        ]
      : [
          {
            value: 'block_start_inline_start',
            label: physicalPlacementLabel(displayType, 'block_start_inline_start', direction) ?? '',
          },
          {
            value: 'block_start_inline_end',
            label: physicalPlacementLabel(displayType, 'block_start_inline_end', direction) ?? '',
          },
          {
            value: 'block_end_inline_start',
            label: physicalPlacementLabel(displayType, 'block_end_inline_start', direction) ?? '',
          },
          {
            value: SLIDE_IN_DEFAULT,
            label: physicalPlacementLabel(displayType, SLIDE_IN_DEFAULT, direction) ?? '',
          },
        ];

  return (
    <fieldset className="wconvert-overlay-placement">
      <legend>{__('Position', 'wconvert')}</legend>
      <div
        className="wconvert-overlay-placement__choices"
        data-display-type={displayType}
      >
        {positions.map((position) => (
          <label className="wconvert-overlay-placement__choice" key={position.value}>
            <input
              className="sr-only"
              type="radio"
              name="wconvert-overlay-placement"
              checked={selected === position.value}
              onChange={() =>
                onChange(
                  position.value === BAR_DEFAULT || position.value === SLIDE_IN_DEFAULT
                    ? null
                    : position.value,
                )
              }
            />
            <span className="wconvert-overlay-placement__label">
              <span className="wconvert-overlay-placement__picture" data-placement={position.value} aria-hidden="true">
                <span />
              </span>
              {position.label}
            </span>
          </label>
        ))}
      </div>
      {displayType === 'floating_bar' && selected === 'block_start' && (
        <p className="wconvert-overlay-placement__note">
          {__(
            'A top bar moves the page down when it appears. Check it with your site header before publishing.',
            'wconvert',
          )}
        </p>
      )}
    </fieldset>
  );
}
