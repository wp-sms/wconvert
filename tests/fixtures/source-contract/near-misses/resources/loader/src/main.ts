import { createLoader } from './engine';
import { replay } from './repro/harness';
import { tidy } from '../improved/tidy';
import { promote } from './promotions';
import { pro } from './pro';

export default createLoader([replay, tidy, promote, pro]);
