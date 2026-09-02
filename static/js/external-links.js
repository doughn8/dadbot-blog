// Dadbot site-wide external-link behaviour (Sophie, 2026-09-02):
// External links inside article content open in a new browser tab with
// rel="noopener noreferrer". Internal Dadbot links stay in the same tab.
// Runs after the DOM is ready; safe on pages without article content.
(function () {
  'use strict';

  function enhance(root) {
    var links = root.querySelectorAll('.post-content a[href], article a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.host && a.host !== window.location.host) {
        a.setAttribute('target', '_blank');
        // Preserve any existing rel tokens (e.g. shortcodes) and guarantee
        // noopener + noreferrer for reverse-tabnabbing safety.
        var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        ['noopener', 'noreferrer'].forEach(function (token) {
          if (rel.indexOf(token) === -1) rel.push(token);
        });
        a.setAttribute('rel', rel.join(' '));
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enhance(document);
    });
  } else {
    enhance(document);
  }
})();
