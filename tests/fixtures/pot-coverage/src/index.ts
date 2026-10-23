// The "entry": imports app.tsx, so app.tsx is shipped and a string missing from it
// is a real loss. dead.tsx is imported by nothing.
export { Bundled, Dropped } from './app';
