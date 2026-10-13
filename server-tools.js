/* Folio — UI for the server-side tools.
   Loaded by app.html after icons.js and i18n.js. It uses the helpers app.html
   exposes on window (fileUploadHTML, setupUpload, showStatus, showFailure,
   FolioProgress, CATEGORIES, folioIcon) and calls the API at /api/tools. If the
   page is opened without a server, the panels say so instead of failing
   silently. */
(function (global) {
  'use strict';

  var t = function (key, vars) { return global.FolioI18N.t(key, vars); };
  var icon = function (name, opts) { return global.folioIcon(name, opts); };

  var YES_NO = [[['ap.opt.on'], 'on'], [['ap.opt.off'], 'off']];
  function onOff() {
    return YES_NO.map(function (pair) { return [pair[1], t(pair[0][0])]; });
  }
  function select(key, labelKey, choices) {
    return { key: key, labelKey: labelKey, type: 'select', value: choices[0][0], choices: choices };
  }

  // Per-tool upload configuration and option fields. Labels are i18n keys so
  // the whole panel follows the language switch.
  var TOOLS = {
    'pdf-to-jpg': {
      accept: '.pdf',
      options: [{ key: 'scale', labelKey: 'ap.opt.scale', type: 'number', value: '2' }],
    },
    'pdf-to-ppt': { accept: '.pdf' },
    'ocr': {
      accept: '.pdf',
      options: [
        select('lang', 'ap.opt.lang', [
          ['auto', t('ap.opt.auto')], ['eng', 'English'], ['ita', 'Italiano'],
          ['spa', 'Español'], ['deu', 'Deutsch'], ['fra', 'Français'],
        ]),
        select('quality', 'ap.opt.quality', [['300', '300'], ['150', '150'], ['200', '200'], ['400', '400']]),
        select('pageMode', 'ap.opt.pageMode', [
          ['auto', t('ap.opt.pageMode.auto')], ['block', t('ap.opt.pageMode.block')],
          ['column', t('ap.opt.pageMode.column')], ['sparse', t('ap.opt.pageMode.sparse')],
        ]),
        select('deskew', 'ap.opt.deskew', onOff()),
      ],
    },
    'scan': {
      accept: '.pdf,.png,.jpg,.jpeg', multi: true,
      options: [
        select('lang', 'ap.opt.lang', [
          ['auto', t('ap.opt.auto')], ['eng', 'English'], ['ita', 'Italiano'],
          ['spa', 'Español'], ['deu', 'Deutsch'], ['fra', 'Français'],
        ]),
        select('quality', 'ap.opt.quality', [['300', '300'], ['150', '150'], ['200', '200'], ['400', '400']]),
        select('deskew', 'ap.opt.deskew', onOff()),
      ],
    },
    'extract-text': {
      accept: '.pdf',
      options: [
        select('lang', 'ap.opt.lang', [
          ['auto', t('ap.opt.auto')], ['eng', 'English'], ['ita', 'Italiano'],
          ['spa', 'Español'], ['deu', 'Deutsch'], ['fra', 'Français'],
        ]),
        select('mode', 'ap.opt.mode', [['single', t('ap.opt.mode.single')], ['pages', t('ap.opt.mode.pages')]]),
      ],
    },
    'deskew': {
      accept: '.pdf',
      options: [
        select('dpi', 'ap.opt.dpi', [['200', '200'], ['150', '150'], ['300', '300']]),
        select('deskew', 'ap.opt.deskew', onOff()),
      ],
    },
    'pdf-to-html': { accept: '.pdf' },
    'pdf-to-markdown': { accept: '.pdf' },
    'pdf-to-word': { accept: '.pdf' },
    'pdf-to-excel': { accept: '.pdf' },
    'compare': { accept: '.pdf', multi: true },
    'compress': { accept: '.pdf' },
    'repair': { accept: '.pdf' },
    'sign': {
      accept: '.pdf,.png,.jpg,.jpeg', multi: true,
      options: [
        { key: 'page', labelKey: 'ap.opt.page', type: 'number', value: '1' },
        { key: 'widthMm', labelKey: 'ap.opt.sigWidth', type: 'number', value: '50' },
      ],
    },
    'redact': {
      accept: '.pdf',
      options: [{ key: 'rects', labelKey: 'ap.opt.rects', type: 'textarea', value: '[{"page":1,"x":50,"y":60,"w":200,"h":40}]' }],
    },
    'forms': {
      accept: '.pdf',
      options: [{ key: 'fields', labelKey: 'ap.opt.fields', type: 'textarea', value: '' }],
    },
    'word-to-pdf': { accept: '.doc,.docx' },
    'ppt-to-pdf': { accept: '.ppt,.pptx' },
    'excel-to-pdf': { accept: '.xls,.xlsx' },
    'pdf-to-pdfa': { accept: '.pdf' },
    'protect': {
      accept: '.pdf',
      options: [
        { key: 'userPassword', labelKey: 'ap.opt.openPassword', type: 'password' },
        { key: 'ownerPassword', labelKey: 'ap.opt.editPassword', type: 'password' },
      ],
    },
    'unlock': {
      accept: '.pdf',
      options: [{ key: 'password', labelKey: 'ap.opt.pdfPassword', type: 'password' }],
    },
  };

  var availability = null;
  var availabilityPromise = null;

  function loadAvailability() {
    if (availabilityPromise) return availabilityPromise;
    if (typeof global.fetch !== 'function') { availabilityPromise = Promise.resolve(null); return availabilityPromise; }
    availabilityPromise = global.fetch('api/tools')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { availability = (j && j.tools) ? j.tools : {}; return availability; })
      .catch(function () { availability = {}; return availability; });
    return availabilityPromise;
  }

  function statusId(tool) { return 'st-status-' + tool.id; }
  function cfgOf(tool) { return TOOLS[tool.id] || { accept: '.pdf' }; }

  function optionHTML(o) {
    var inner;
    if (o.type === 'select') {
      inner = '<select data-opt="' + o.key + '">' + o.choices.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === o.value ? ' selected' : '') + '>' + c[1] + '</option>';
      }).join('') + '</select>';
    } else if (o.type === 'textarea') {
      inner = '<textarea class="tool-textarea" rows="3" data-opt="' + o.key + '">' + (o.value || '') + '</textarea>';
    } else {
      inner = '<input type="' + (o.type || 'text') + '" data-opt="' + o.key + '" value="' + (o.value || '') + '" />';
    }
    var optionsLabel = o.id ? o.id : 'st-opt-' + o.key;
    return '<div class="control-group"><label for="' + optionsLabel + '">' + t(o.labelKey) + '</label>' + inner + '</div>';
  }

  /* The panel body and footer. app.html wraps them in the shared .tool-panel
     skeleton, so every server tool has the same structure as a browser tool. */
  function panel(tool) {
    var cfg = cfgOf(tool);
    var opts = (cfg.options || []).map(optionHTML).join('');
    return {
      statusId: statusId(tool),
      controls: global.fileUploadHTML({
        id: 'st-input-' + tool.id, label: t('ap.server.pick'), accept: cfg.accept,
        multi: !!cfg.multi, icon: tool.icon,
      }) + (opts ? '<div class="tool-controls" id="st-opts-' + tool.id + '">' + opts + '</div>' : ''),
      actions: '<button class="btn-primary" id="st-btn-' + tool.id + '" disabled>' +
        icon(tool.icon, { size: 16 }) + '<span>' + t('ap.server.run') + '</span></button>',
    };
  }

  function init(tool) {
    var btn = document.getElementById('st-btn-' + tool.id);
    if (!btn) return;
    var selected = [];
    global.setupUpload({
      inputId: 'st-input-' + tool.id,
      listId: 'file-list-st-input-' + tool.id,
      zoneId: 'upload-st-input-' + tool.id,
      onFiles: function (f) { selected = f; btn.disabled = selected.length === 0; },
    });
    var run = function () { start(tool, selected, btn); };
    btn.addEventListener('click', run);
    loadAvailability().then(function (av) {
      if (av && av[tool.id] && av[tool.id].available === false) {
        btn.disabled = true;
        global.showStatus(statusId(tool), 'info', t('ap.server.unavailable') + ' ' + (av[tool.id].reason || ''));
      }
    });
  }

  function safeName(n) { return String(n || 'result').replace(/[^\w.-]+/g, '_'); }

  function readOptions(tool) {
    var out = {};
    var container = document.getElementById('st-opts-' + tool.id);
    if (container) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-opt]'), function (el) {
        if (el.value !== '') out[el.getAttribute('data-opt')] = el.value;
      });
    }
    return out;
  }

  /* What the server said about the result, in the language of the page. */
  function reportHTML(tool, headers) {
    var raw = headers.get('X-Folio-Report');
    if (!raw) return '';
    var report;
    try { report = JSON.parse(raw); } catch (e) { return ''; }
    var lines = [];
    var languages = report.languages && report.languages.length ? report.languages : (report.language ? [report.language] : null);
    if (languages && tool.id === 'ocr' || (languages && tool.id === 'scan')) {
      lines.push(t('ap.report.language', { lang: languages.join(' + ') }));
    } else if (languages && tool.id === 'extract-text') {
      lines.push(t('ap.report.language', { lang: languages.join(' + ') }));
    }
    if (report.ocrPages && report.ocrPages.length) lines.push(t('ap.report.ocrPages', { n: report.ocrPages.length }));
    if (report.blankPages) lines.push(t('ap.report.blankPages', { n: report.blankPages }));
    if (report.pages) lines.push(t('ap.report.pages', { n: report.pages }));
    if (report.angles) {
      var rotated = Object.keys(report.angles).filter(function (k) { return report.angles[k] !== 0; }).length;
      lines.push(t('ap.report.rotated', { n: rotated }));
    }
    if (!lines.length) return '';
    return '<div class="report">' + lines.join(' &middot; ') + '</div>';
  }

  function start(tool, files, btn) {
    var sid = statusId(tool);
    if (!files || !files.length) { global.showStatus(sid, 'error', t('ap.server.needFile')); return; }
    if (typeof global.fetch !== 'function') { global.showStatus(sid, 'error', t('ap.server.offline')); return; }

    global.clearStatus(sid);
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span>' + t('ap.server.busy') + '</span>';

    // Server work happens remotely and reports nothing until it is done, so
    // the bar is indeterminate but the elapsed time and Cancel are real.
    var task = global.FolioProgress.create(sid, t('ap.server.busy'));
    var controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
    task.onCancel(function () { if (controller) controller.abort(); });

    var fd = new global.FormData();
    Array.prototype.forEach.call(files, function (f) { fd.append('files', f, f.name); });
    fd.append('options', JSON.stringify(readOptions(tool)));

    var opts = { method: 'POST', body: fd };
    if (controller) opts.signal = controller.signal;

    function restore() {
      task.finish();
      btn.disabled = false;
      btn.innerHTML = original;
    }

    global.fetch('api/tools/' + tool.id, opts)
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            throw new Error((j && j.error) || (res.status + ' ' + res.statusText));
          });
        }
        var name = safeName(res.headers.get('X-Folio-Filename') || (tool.id + '.out'));
        var report = reportHTML(tool, res.headers);
        return res.blob().then(function (blob) {
          var url = global.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 4000);
          global.showStatus(sid, 'success', t('ap.server.ok') +
            '<br/><a class="download-link" href="' + url + '" download="' + name + '">' +
            icon('download', { size: 15 }) + t('ap.download') + '</a>' + report);
        });
      })
      .catch(function (e) {
        if (task.cancelled || (e && e.name === 'AbortError')) {
          global.showStatus(sid, 'info', t('ap.progress.cancelled'));
          return;
        }
        global.showFailure(sid, (e && e.message) || String(e), function () { start(tool, files, btn); });
      })
      .then(restore);
  }

  function initAll() {
    global.CATEGORIES().forEach(function (cat) {
      cat.tools.forEach(function (tool) { if (tool.type === 'server') init(tool); });
    });
  }

  global.FolioServerTools = { panel: panel, initAll: initAll, tools: TOOLS, loadAvailability: loadAvailability };
})(window);
