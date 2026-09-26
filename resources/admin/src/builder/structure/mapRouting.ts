// Keep card clearance and rounded corners identical in the worker and geometry checks.
export const mapEdgeOptions = { nodePadding: 14, gridRatio: 12, borderRadius: 6 };
// A clear straight line does not imply a clear smooth-step elbow. Continue routing
// while dragging instead of switching every connection to an animated fallback.
export const mapRoutingOptions = { routeOnlyWhenBlocked: false, routeWhileDragging: true, debounceMs: 16 };
