/* Folio — UI for the server-side tools.
   Loaded by app.html after i18n.js. Uses the helpers defined in app.html
   (fileUploadHTML, setupUpload, showStatus, clearStatus, CATEGORIES) and calls
   the Folio server API at /api/tools. If the page is opened without a server,
   the tools explain that instead of failing silently. */
(function (global) {
  'use strict';

  // Per-tool upload configuration and option fields.
  var TOOLS = {
    'pdf-to-jpg': { accept: '.pdf', options: [{ key: 'scale', label: 'Quality (1-4)', type: 'number', value: '2' }] },
    'pdf-to-ppt': { accept: '.pdf' },
    'ocr': { accept: '.pdf', options: [{ key: 'lang', label: 'Language', type: 'select', value: 'eng', choices: [['eng', 'English'], ['ita', 'Italiano'], ['spa', 'Español'], ['deu', 'Deutsch'], ['fra', 'Français']] }] },
    'scan': { accept: '.pdf,.png,.jpg,.jpeg', multi: true, options: [{ key: 'lang', label: 'Language', type: 'select', value: 'eng', choices: [['eng', 'English'], ['ita', 'Italiano'], ['spa', 'Español'], ['deu', 'Deutsch'], ['fra', 'Français']] }] },
    'pdf-to-word': { accept: '.pdf' },
    'pdf-to-excel': { accept: '.pdf' },
    'compare': { accept: '.pdf', multi: true },
    'compress': { accept: '.pdf' },
    'repair': { accept: '.pdf' },
    'sign': {
      accept: '.pdf,.png,.jpg,.jpeg', multi: true,
      options: [
        { key: 'page', label: 'Page', type: 'number', value: '1' },
        { key: 'widthMm', label: 'Signature width (mm)', type: 'number', value: '50' },
      ],
    },
    'redact': { accept: '.pdf', options: [{ key: 'rects', label: 'Rectangles (JSON)', type: 'textarea', value: '[{"page":1,"x":50,"y":60,"w":200,"h":40}]' }] },
    'forms': { accept: '.pdf', options: [{ key: 'fields', label: 'Fields (JSON; empty = list them)', type: 'textarea', value: '' }] },
    'word-to-pdf': { accept: '.doc,.docx' },
    'ppt-to-pdf': { accept: '.ppt,.pptx' },
    'excel-to-pdf': { accept: '.xls,.xlsx' },
    'pdf-to-pdfa': { accept: '.pdf' },
    'protect': {
      accept: '.pdf',
      options: [
        { key: 'userPassword', label: 'Open password', type: 'password' },
        { key: 'ownerPassword', label: 'Edit password', type: 'password' },
      ],
    },
    'unlock': { accept: '.pdf', options: [{ key: 'password', label: 'PDF password', type: 'password' }] },
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
    return '<div class="control-group"><label>' + o.label + '</label>' + inner + '</div>';
  }

  function ui(tool) {
    var cfg = TOOLS[tool.id] || { accept: '.pdf' };
    var opts = (cfg.options || []).map(optionHTML).join('');
    return fileUploadHTML({
      id: 'st-input-' + tool.id, label: tool.label, accept: cfg.accept, multi: !!cfg.multi, icon: tool.icon,
    }) +
      (opts ? '<div class="tool-controls" id="st-opts-' + tool.id + '">' + opts + '</div>' : '') +
      '<div class="tool-actions"><button class="btn-primary" id="st-btn-' + tool.id + '" disabled>' +
      '<span>\u25B6</span> ' + FolioI18N.t('ap.server.run') + '</button></div>' +
      '<div class="tool-status" id="st-status-' + tool.id + '"></div>';
  }

  function init(tool) {
    var btn = document.getElementById('st-btn-' + tool.id);
    if (!btn) return;
    var selected = [];
    setupUpload({
      inputId: 'st-input-' + tool.id,
      listId: 'file-list-st-input-' + tool.id,
      zoneId: 'upload-st-input-' + tool.id,
      onFiles: function (f) { selected = f; btn.disabled = selected.length === 0; },
    });
    btn.addEventListener('click', function () { run(tool, selected, btn); });
    loadAvailability().then(function (av) {
      if (av && av[tool.id] && av[tool.id].available === false) {
        btn.disabled = true;
        showStatus('st-status-' + tool.id, 'info', FolioI18N.t('ap.server.unavailable') + ' ' + (av[tool.id].reason || ''));
      }
    });
  }

  function safeName(n) { return String(n || 'result').replace(/[^\w.-]+/g, '_'); }

  function run(tool, files, btn) {
    var statusId = 'st-status-' + tool.id;
    if (!files || !files.length) { showStatus(statusId, 'error', FolioI18N.t('ap.server.needFile')); return; }
    if (typeof global.fetch !== 'function') { showStatus(statusId, 'error', FolioI18N.t('ap.server.offline')); return; }

    clearStatus(statusId);
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> ' + FolioI18N.t('ap.server.busy');

    var opts = {};
    var container = document.getElementById('st-opts-' + tool.id);
    if (container) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-opt]'), function (el) {
        if (el.value !== '') opts[el.getAttribute('data-opt')] = el.value;
      });
    }
    var fd = new FormData();
    Array.prototype.forEach.call(files, function (f) { fd.append('files', f, f.name); });
    fd.append('options', JSON.stringify(opts));

    global.fetch('api/tools/' + tool.id, { method: 'POST', body: fd })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            throw new Error((j && j.error) || (res.status + ' ' + res.statusText));
          });
        }
        var name = safeName(res.headers.get('X-Folio-Filename') || (tool.id + '.out'));
        return res.blob().then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          showStatus(statusId, 'success', FolioI18N.t('ap.server.ok') +
            ' <br/><a class="download-link" href="' + url + '" download="' + name + '">' + FolioI18N.t('ap.download') + '</a>');
        });
      })
      .catch(function (e) { showStatus(statusId, 'error', (e && e.message) || String(e)); })
      .then(function () { btn.disabled = false; btn.innerHTML = original; });
  }

  function initAll() {
    CATEGORIES().forEach(function (cat) {
      cat.tools.forEach(function (t) { if (t.type === 'server') init(t); });
    });
  }

  global.FolioServerTools = { ui: ui, initAll: initAll, tools: TOOLS, loadAvailability: loadAvailability };
})(window);
