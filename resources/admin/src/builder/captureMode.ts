/**
 * Where this campaign's leads go: kept in WConvert only, or forwarded to the
 * services it binds.
 *
 * **Local until a service is connected** (ADR 0133). An explicit choice wins;
 * with none stored, a config that binds a Destination anywhere is connected
 * and one that binds nothing is local. The one reading of `capture_mode` in
 * this bundle, and the same rule `OptinBinding::captureMode()` applies on the
 * server, so the review and the publish check cannot default it differently.
 * `tests/fixtures/link-and-capture-rules.json` holds both to the same cases.
 */
export type CaptureMode = 'local' | 'connected';

export function captureModeOf(config: Readonly<Record<string, unknown>> | null | undefined): CaptureMode {
  const mode = config?.capture_mode;
  return mode === 'local' || mode === 'connected' ? mode : routedMode(config);
}

/**
 * The mode a config's routes imply, ignoring any stored choice: what an edit
 * to the routes writes. Choosing a service connects, and removing the last one
 * from every form keeps leads here — never cutting another form's routes.
 */
export function routedMode(config: Readonly<Record<string, unknown>> | null | undefined): CaptureMode {
  const routes = [
    ...(Array.isArray(config?.destinations) ? config.destinations : []),
    ...Object.values((config?.submission_settings ?? {}) as Record<string, { destination_ids?: unknown }>)
      .flatMap(setting => Array.isArray(setting?.destination_ids) ? setting.destination_ids : []),
  ];
  return routes.some(id => typeof id === 'string' && id !== '') ? 'connected' : 'local';
}
