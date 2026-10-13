/* Folio text editing — the pure half of the "Edit text" tool.
 *
 * The panel (app.html) renders the pages with PDF.js and turns every text item
 * into a clickable box. This module owns everything that does not need a
 * browser: choosing a font, working out what to cover, and writing the edits
 * into the document with pdf-lib.
 *
 * Keeping it here means the export path can be tested against real PDFs with
 * no canvas and no DOM:
 *
 *   folioTextEdit.standardFontKey({ family: 'serif', bold: true })  -> 'Times-Bold'
 *   folioTextEdit.applyEdits({ PDFLib, StandardFonts, rgb, doc, edits })
 *
 * The DOM side never draws: it only produces the `edits` array consumed here.
 */
(function (global) {
  'use strict';

  /* The 12 standard fonts pdf-lib can embed, keyed the way a PDF names them.
     "Keeping the original font" means exactly this set: anything else is an
     embedded face we cannot re-embed, and gets its closest equivalent. */
  var STANDARD_FONTS = {
    Helvetica: 'Helvetica',
    'Helvetica-Bold': 'HelveticaBold',
    'Helvetica-Oblique': 'HelveticaOblique',
    'Helvetica-BoldOblique': 'HelveticaBoldOblique',
    // pdf-lib spells the Times family "TimesRoman*", not "Times*".
    'Times-Roman': 'TimesRoman',
    'Times-Bold': 'TimesRomanBold',
    'Times-Italic': 'TimesRomanItalic',
    'Times-BoldItalic': 'TimesRomanBoldItalic',
    Courier: 'Courier',
    'Courier-Bold': 'CourierBold',
    'Courier-Oblique': 'CourierOblique',
    'Courier-BoldOblique': 'CourierBoldOblique',
  };

  /* BaseFont in a PDF is usually "ABCDEE+Helvetica-Bold": the six-letter tag is
     a subset prefix and must not take part in the comparison. */
  function stripSubset(name) {
    return String(name || '').replace(/^[A-Z]{6}\+/, '').trim();
  }

  /* Loose spelling normalisation: PDF producers write "Helvetica", "ArialMT",
     "TimesNewRomanPS-BoldMT", "LiberationMono"… all of which we can classify. */
  function classify(rawName) {
    var name = stripSubset(rawName);
    var lower = name.toLowerCase().replace(/[\s_,]/g, '');

    var bold = /bold|black|heavy|semibold|demi/.test(lower);
    var italic = /italic|oblique/.test(lower);

    // Order matters: "sans-serif" contains "serif", so the sans check has to
    // come first or every sans face would be classified as a serif one.
    var family = 'sans';
    if (/mono|courier|consol/.test(lower)) family = 'mono';
    else if (/sans|arial|helvetic|roboto|inter|noto|verdana|tahoma|calibri|segoe/.test(lower)) family = 'sans';
    else if (/times|serif|georgia|garamond|book/.test(lower)) family = 'serif';

    return { name: name, lower: lower, family: family, bold: bold, italic: italic };
  }

  /* A base font name that is already one of the standard 12 — the case where we
     can honour "keep the original font" instead of substituting. */
  function standardNameFor(rawName) {
    var name = stripSubset(rawName).toLowerCase().replace(/[\s_,]/g, '');
    var exact = {
      helvetica: 'Helvetica',
      helveticabold: 'Helvetica-Bold',
      helveticaoblique: 'Helvetica-Oblique',
      helveticaboldoblique: 'Helvetica-BoldOblique',
      timesroman: 'Times-Roman',
      timesnewroman: 'Times-Roman',
      timesbold: 'Times-Bold',
      timesitalic: 'Times-Italic',
      timesbolditalic: 'Times-BoldItalic',
      courier: 'Courier',
      courierbold: 'Courier-Bold',
      courieroblique: 'Courier-Oblique',
      courierboldoblique: 'Courier-BoldOblique',
    };
    return exact[name] || null;
  }

  /* Which standard font to draw with. `family` comes from PDF.js
     ('serif' | 'sans-serif' | 'monospace'); bold/italic from the page's font
     resources when they can be attributed, otherwise false. */
  function standardFontKey(opts) {
    opts = opts || {};
    var family = String(opts.family || '').toLowerCase();
    var bold = !!opts.bold;
    var italic = !!opts.italic;

    if (opts.original) {
      // A name that already is one of the standard 12 is kept as-is; anything
      // else ("TimesNewRomanPS-BoldMT", "RobotoCondensed-Regular") is
      // classified so at least the family and the weight survive.
      var exact = standardNameFor(opts.original);
      if (exact) return exact;
      var cls = classify(opts.original);
      family = cls.family;
      bold = cls.bold;
      italic = cls.italic;
    }

    if (/mono|courier/.test(family)) {
      if (bold && italic) return 'Courier-BoldOblique';
      if (bold) return 'Courier-Bold';
      if (italic) return 'Courier-Oblique';
      return 'Courier';
    }
    // "sans-serif" contains "serif": never treat a sans family as a serif one.
    if (!/sans/.test(family) && /serif|times/.test(family)) {
      if (bold && italic) return 'Times-BoldItalic';
      if (bold) return 'Times-Bold';
      if (italic) return 'Times-Italic';
      return 'Times-Roman';
    }
    if (bold && italic) return 'Helvetica-BoldOblique';
    if (bold) return 'Helvetica-Bold';
    if (italic) return 'Helvetica-Oblique';
    return 'Helvetica';
  }

  /* The page's font resources, read straight from the PDF. PDF.js only exposes
     a generic family per text item, so this is how the style (bold / italic)
     gets recovered. With several faces on one page we cannot attribute a given
     item to a face, so only an unambiguous page (one face, or all faces sharing
     a style) contributes; otherwise the text stays regular. */
  function styleFromBaseFonts(baseFontNames) {
    var names = (baseFontNames || []).filter(Boolean);
    if (!names.length) return { bold: false, italic: false, known: false };
    var styles = names.map(classify);
    var allBold = styles.every(function (s) { return s.bold; });
    var allItalic = styles.every(function (s) { return s.italic; });
    var anyBold = styles.some(function (s) { return s.bold; });
    var anyItalic = styles.some(function (s) { return s.italic; });
    return {
      bold: allBold && anyBold,
      italic: allItalic && anyItalic,
      known: true,
      // A page with exactly one face lets the original name decide everything.
      sole: names.length === 1 ? stripSubset(names[0]) : null,
    };
  }

  /* What has to be painted over before the new text goes down. PDF.js gives the
     item's transform and advance width in user space; the baseline sits at
     transform[5] and the glyph box extends roughly one ascender above it. */
  function coverRect(item) {
    var size = item.size || 10;
    var ascent = size * (item.ascent || 0.78);
    var descent = size * (item.descent || 0.22);
    return {
      x: item.x,
      y: item.y - descent,
      width: Math.max(item.width || 0, size * 0.5),
      height: ascent + descent,
    };
  }

  /* Average a handful of pixels sampled just outside the glyphs, so the patch
     matches coloured or textured backgrounds instead of assuming white. */
  function averageColor(samples) {
    if (!samples || !samples.length) return { r: 1, g: 1, b: 1 };
    var r = 0;
    var g = 0;
    var b = 0;
    for (var i = 0; i < samples.length; i++) {
      r += samples[i][0];
      g += samples[i][1];
      b += samples[i][2];
    }
    var n = samples.length;
    return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
  }

  /* Write every edit into the document. Fonts are embedded once each, because
     embedding the same standard font twice bloats the file for no reason. */
  async function applyEdits(opts) {
    var PDFLib = opts.PDFLib;
    var StandardFonts = opts.StandardFonts;
    var rgb = opts.rgb;
    var doc = opts.doc;
    var edits = opts.edits || [];
    if (!PDFLib || !StandardFonts || !rgb || !doc) {
      throw new Error('applyEdits needs PDFLib, StandardFonts, rgb and doc.');
    }

    var pages = doc.getPages();
    var embedded = {};
    var applied = 0;

    for (var i = 0; i < edits.length; i++) {
      var edit = edits[i];
      if (!edit || !edit.text) continue;
      var page = pages[edit.page];
      if (!page) continue;

      var key = edit.font && STANDARD_FONTS[edit.font] ? edit.font : 'Helvetica';
      if (!embedded[key]) {
        embedded[key] = await doc.embedFont(StandardFonts[STANDARD_FONTS[key]]);
      }
      var font = embedded[key];

      var cover = coverRect(edit);
      var background = edit.background || { r: 1, g: 1, b: 1 };
      page.drawRectangle({
        x: cover.x,
        y: cover.y,
        width: cover.width,
        height: cover.height,
        color: rgb(background.r, background.g, background.b),
      });

      var color = edit.color || { r: 0, g: 0, b: 0 };
      page.drawText(String(edit.text), {
        x: edit.x,
        y: edit.y,
        size: edit.size || 10,
        font: font,
        color: rgb(color.r, color.g, color.b),
      });
      applied++;
    }

    return applied;
  }

  global.FolioTextEdit = {
    STANDARD_FONTS: STANDARD_FONTS,
    stripSubset: stripSubset,
    classify: classify,
    standardNameFor: standardNameFor,
    standardFontKey: standardFontKey,
    styleFromBaseFonts: styleFromBaseFonts,
    coverRect: coverRect,
    averageColor: averageColor,
    applyEdits: applyEdits,
  };
})(typeof window !== 'undefined' ? window : globalThis);
