import { createLoader } from '@loader/engine';
import { boot } from '@loader/boot';
import { FREE_MODULES } from '@loader/modules';
import { templatePresenter } from '@loader/present';
import { PRO_MODULES } from './modules';

/**
 * Pro's loader entry — free's modules plus Pro's (ADR 0028).
 *
 * Pro ships a COMPLETE replacement loader and dequeues free's in PHP, so the
 * page only ever carries one (ADR 0014). This is the same composition ADR 0014
 * already describes at the plugin level, applied one layer down.
 *
 * The import direction is the whole design: Pro reaches into free, free never
 * reaches into Pro — including `boot` and the presenter, which are shared
 * engine and not Pro's to fork. Composition is pure and touches no DOM, so it
 * happens at module scope; `boot` is the part that must survive being run at
 * the wrong moment, and it is written to (ADR 0004).
 */
const loader = createLoader([...FREE_MODULES, ...PRO_MODULES]);

boot(loader, templatePresenter);

export default loader;
