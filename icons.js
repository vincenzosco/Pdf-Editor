/* Folio icon set — one family, one source.
   24x24 viewBox, stroke 1.5, `currentColor`, no fill. Every icon is inline
   SVG so it inherits the theme, scales with font size and renders identically
   on every platform (the emoji they replace did not).

   folioIcon('merge')                       -> <svg …>
   folioIcon('merge', { class: 'x' })       -> adds a class
   folioIcon('merge', { size: 32 })         -> overrides the size
   folioIcon('merge', { title: 'Merge' })   -> standalone: role="img" + <title>
   Without `title` the icon is decorative (aria-hidden), which is what you want
   whenever a visible label sits next to it. */
(function (global) {
  'use strict';

  var ICONS = {
    /* documents & files */
    'file-pdf': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3z"/><path d="M9 16v3"/>',
    'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    'file-plus': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>',

    /* side badge glyphs */
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
    presentation: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>',
    archive: '<rect x="4" y="4" width="16" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',

    /* organise */
    merge: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><path d="M12 15v6"/><path d="M9 18l3 3 3-3"/>',
    split: '<rect x="3" y="3" width="18" height="8" rx="1.5"/><path d="M12 11v4"/><path d="M9 18l3 3 3-3"/><path d="M10 15h4"/>',
    'pages-remove': '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 12h6"/><path d="M9 7h6"/>',
    'pages-extract': '<rect x="4" y="3" width="10" height="14" rx="2"/><path d="M14 10h6"/><path d="M17 7l3 3-3 3"/>',
    reorder: '<path d="M8 4v16"/><path d="M5 7l3-3 3 3"/><path d="M5 17l3 3 3-3"/><path d="M14 4h6M14 12h6M14 20h6"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',

    /* optimize & fix */
    compress: '<path d="M12 3v6"/><path d="M9 6l3-3 3 3"/><path d="M12 21v-6"/><path d="M9 18l3 3 3-3"/><path d="M4 12h16"/>',
    repair: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13v5a2 2 0 0 1-2 2h-5l-1.5-1.5a4 4 0 0 1-5-5z"/><path d="M6 6l4 4"/>',
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M20 8V6a2 2 0 0 0-2-2h-2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M7 12h10"/>',
    'text-recognize': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h7"/><path d="M7 12h10"/><path d="M7 16h5"/><path d="M18 15l3 3-3 3"/>',
    deskew: '<path d="M4 18h9"/><path d="M14 18l5-5"/><path d="M16 9a6 6 0 0 0-9-3"/><path d="M5 4v3h3"/>',

    /* edit */
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>',
    hash: '<path d="M9 4L7 20M17 4l-2 16"/><path d="M5 9h14M4 15h14"/>',
    droplet: '<path d="M12 3s6 6.3 6 10.4A6 6 0 0 1 6 13.4C6 9.3 12 3 12 3z"/>',
    crop: '<path d="M6 3v13a2 2 0 0 0 2 2h13"/><path d="M3 6h13a2 2 0 0 1 2 2v13"/>',
    pen: '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 6l3 3"/>',
    'header-footer': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M3 16h18"/><path d="M7 12h6"/>',
    forms: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    watermark: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 15l6-6"/><path d="M8 11h.01M16 15h.01"/>',

    /* protect */
    lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/>',
    signature: '<path d="M3 17c3 0 4-9 7-9s2 7 4.5 7c1.6 0 2.4-2 3.5-2 1 0 1.6.8 3 1"/><path d="M3 21h18"/>',
    redact: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 12h10"/>',
    compare: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><path d="M11 12h2"/>',
    shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    sanitize: '<path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 9l6 6M15 9l-6 6"/>',

    /* chrome */
    search: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/>',
    star: '<path d="M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8z"/>',
    'star-filled': '<path d="M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8z" fill="currentColor"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    'arrow-up': '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    download: '<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/>',
    upload: '<path d="M12 20V10"/><path d="M8 13l4-4 4 4"/><path d="M5 4h14"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-1.6 5.5"/><path d="M20 4v7h-7"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>',
    zap: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    'arrow-right': '<path d="M4 12h16"/><path d="M14 6l6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>',
  };

  function folioIcon(name, opts) {
    var paths = ICONS[name] || ICONS.file;
    opts = opts || {};
    var size = opts.size || 18;
    var cls = opts.class ? ' class="' + opts.class + '"' : '';
    var a11y = opts.title
      ? ' role="img" aria-label="' + String(opts.title).replace(/"/g, '&quot;') + '"'
      : ' aria-hidden="true" focusable="false"';
    var title = opts.title ? '<title>' + opts.title + '</title>' : '';
    return '<svg' + cls + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24"' +
      ' fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"' +
      ' stroke-linejoin="round"' + a11y + '>' + title + paths + '</svg>';
  }

  /* Icon + label, the shape almost every button and sidebar row wants. */
  function folioIconLabel(name, label, opts) {
    return folioIcon(name, opts) + '<span>' + label + '</span>';
  }

  /* Replaces any emoji left in static markup: <span data-icon="merge"></span> */
  function paintIcons(root, opts) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-icon-done') === '1') continue;
      var size = parseInt(el.getAttribute('data-icon-size') || '', 10) || undefined;
      el.innerHTML = folioIcon(el.getAttribute('data-icon'), { size: size, title: el.getAttribute('data-icon-title') || undefined });
      el.setAttribute('data-icon-done', '1');
    }
  }

  global.FOLIO_ICONS = ICONS;
  global.folioIcon = folioIcon;
  global.folioIconLabel = folioIconLabel;
  global.folioPaintIcons = paintIcons;
})(window);
