import { describe, expect, it } from 'vitest';
import { createLoader } from '@loader/engine';
import type { LoaderModule } from '@loader/types';

const moduleWithId = (id: string): LoaderModule => ({ id });

describe('createLoader', () => {
  it('composes the module set it is given', () => {
    const loader = createLoader([moduleWithId('page_load'), moduleWithId('time_on_page')]);

    expect(loader.modules.map((m) => m.id)).toEqual(['page_load', 'time_on_page']);
  });

  it('refuses a module set with a duplicate id', () => {
    // Pro's entry is free's modules PLUS its own, so a Pro module reusing a
    // free id would shadow it or be shadowed by it depending on array order —
    // making which one ran a property of a spread expression.
    expect(() => createLoader([moduleWithId('page_load'), moduleWithId('page_load')])).toThrow(
      /duplicate module id "page_load"/,
    );
  });
});
