/**
 * GUARDIAN AI — UNIVERSAL NAVIGATION DOCK (DISABLED PER USER REQUEST)
 * Removes the bottom-right floating assistant/switcher widget.
 */

(function () {
  'use strict';
  // Remove any existing dock
  function removeDock() {
    const existing = document.getElementById('gdn-universal-dock');
    if (existing) existing.remove();
    const css = document.getElementById('gdn-universal-css');
    if (css) css.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeDock);
  } else {
    removeDock();
  }
})();
