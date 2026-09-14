export interface GradientStop { color: string; at: number }
export interface Gradient { angle: number; stops: GradientStop[] }

/** Split only top-level commas, keeping rgb()/hsl() color channels intact. */
function partsOf(value: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  return [...parts, value.slice(start).trim()];
}

/** Only the subset the visual controls can faithfully round-trip. Everything else stays custom. */
export function gradientOf(value: string): Gradient | null {
  const match = /^linear-gradient\((.*)\)$/is.exec(value.trim());
  if (!match) return null;
  const parts = partsOf(match[1]);
  const directions: Record<string, number> = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
  let angle = 180;
  if (/^-?(?:\d*\.)?\d+deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);
  else if (parts[0] in directions) angle = directions[parts.shift()!];
  if (parts.length < 2 || parts.length > 6) return null;
  const stops: GradientStop[] = [];
  for (const [index, part] of parts.entries()) {
    const stop = /^(#[a-f\d]{3,8}|(?:rgb|hsl)a?\([^()]+\)|[a-z]+)(?:\s+(\d+(?:\.\d+)?)%)?$/i.exec(part);
    if (!stop) return null;
    // CSS interpolates unpositioned interior stops between explicit neighbors;
    // don't guess that interpolation when positions are mixed.
    if (stop[2] === undefined && index !== 0 && index !== parts.length - 1 && parts.some(p => /%$/.test(p))) return null;
    const at = stop[2] === undefined ? index * 100 / (parts.length - 1) : Number(stop[2]);
    if (at > 100 || (stops.length > 0 && at < stops[stops.length - 1].at)) return null;
    stops.push({ color: stop[1], at });
  }
  return { angle, stops };
}

export const gradientCss = ({ angle, stops }: Gradient): string =>
  `linear-gradient(${angle}deg, ${stops.map(stop => `${stop.color} ${Math.round(stop.at * 100) / 100}%`).join(', ')})`;
