// localStorage wrapper with error handling
// Separated from store.js to break circular dependency with training.js
export const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch {} },
};
