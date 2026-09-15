/**
 * Shared jsdom shims.
 *
 * jsdom implements no layout, so a handful of perfectly ordinary DOM methods
 * are simply absent. When one is called from inside a requestAnimationFrame
 * — as the set-row focus handler does — the throw surfaces as an unhandled
 * rejection that vitest reports separately from any test, so a suite can go
 * green while quietly erroring. Stub them once here rather than guarding
 * product code against a limitation only the test environment has.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
