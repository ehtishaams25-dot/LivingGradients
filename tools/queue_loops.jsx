/* =====================================================================
   LIVING GRADIENTS - QUEUE LOOPS
   ---------------------------------------------------------------------
   Run on an empty project:  File > Scripts > Run Script File...

   Builds every gradient and puts it in the After Effects render queue as a
   PNG sequence. You then press Render. tools/encode_loops.ps1 turns the
   sequences into css/previews/<id>.webm plus the poster stills.

   WHY THIS RATHER THAN render_loops.jsx

   render_loops.jsx calls saveFrameToPng once per frame - 270 calls per
   gradient, each one a separate round trip through ExtendScript, with the
   application frozen for the whole run. It works, but 43 gradients is
   11,610 of those.

   The render queue is what After Effects is actually built to do. It renders
   the same frames with a progress bar, a time estimate, a Pause button, and
   multi-frame rendering if the machine has it. Same output, considerably
   faster, and you can stop it without losing what has finished.

   The trade: the comps have to STAY in the project, because the queue renders
   them after this script has exited. So this leaves an 'LG LOOP QUEUE' folder
   behind on purpose. Set CLEANUP below to true and run it again to remove the
   folder and clear the queue once the render is done.

   BUILT AT DELIVERY SIZE, SAVED SMALL

   Unchanged, and non-negotiable: many builders carry hard-coded pixel values -
   a 700px directional blur, a 4000px RepeTile expansion - with no relation to
   the comp they are handed. So every gradient is built at 1920x1080 and nested
   into a 640x360 comp scaled to COVER. The queue renders the small comp.

   OUTPUT

     <temp>/lg_loops/<id>/f[#####].png     queued, rendered when you press Render
     <temp>/lg_loops/render.json           what was queued, and at what fps
     tools/queue_loops_report.txt          what queued, what failed

   Then: powershell -ExecutionPolicy Bypass -File tools/encode_loops.ps1
   ===================================================================== */

var LG_QL_ROOT = new File($.fileName).parent.parent;      // .../LivingGradients
var LG_QL_MAIN = new File(LG_QL_ROOT.fsName + '/jsx/main.jsx');

/* Top level with $.evalFile, not eval inside the closure. ExtendScript's eval
   defines into the CALLING scope, so builders read in from inside a function
   land in that function and $.global keeps pointing at whatever a previous run
   left behind. */
if (LG_QL_MAIN.exists) {
    try {
        $.evalFile(LG_QL_MAIN);
    } catch (LG_QL_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_QL_ERR.toString() +
              (LG_QL_ERR.line ? '\nline ' + LG_QL_ERR.line : ''));
    }
}

(function () {

    /* -- Knobs -------------------------------------------------------- */

    /* Remove the 'LG LOOP QUEUE' folder and everything this script queued,
       then stop. For after the render has finished and been encoded. */
    var CLEANUP = false;

    /* ids to queue. Empty means the whole library. */
    var ONLY = [];

    /* Queue ids that already have a finished .webm. */
    var FORCE = true;

    /* Start rendering as soon as everything is queued. Off by default: the
       point of using the queue is that you decide when it runs, and can add
       your own output modules or send it to Media Encoder first. */
    var RENDER_NOW = false;

    var BUILD_W = 1920, BUILD_H = 1080;
    var OUT_W = 640, OUT_H = 360;
    var FPS = 30;
    var LOOP_SEC = 8;
    var TAIL_SEC = 1;               // crossfaded over the head by the encoder
    var DUR = LOOP_SEC + TAIL_SEC;

    var TOTAL_FRAMES = Math.round(DUR * FPS);
    var FOLDER_NAME = 'LG LOOP QUEUE';

    var root = LG_QL_ROOT;
    var log = [];

    function note(s) { log.push(s); }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

    function writeReport(alertMsg) {
        var report = new File(root.fsName + '/tools/queue_loops_report.txt');
        report.encoding = 'UTF-8';
        report.open('w');
        report.write(log.join('\n') + '\n');
        report.close();
        if (alertMsg) alert(alertMsg);
        report.execute();
    }

    // -- Cleanup mode -------------------------------------------------

    if (CLEANUP) {
        var rq = app.project.renderQueue;
        var removedItems = 0;
        for (var qi = rq.numItems; qi >= 1; qi--) {
            try {
                var it = rq.item(qi);
                /* Only ours. Someone else's queue items are not this script's
                   to throw away. */
                if (it.comp && it.comp.parentFolder &&
                    it.comp.parentFolder.name === FOLDER_NAME) {
                    it.remove();
                    removedItems++;
                }
            } catch (e) { }
        }
        var removedFolder = false;
        for (var fi = app.project.numItems; fi >= 1; fi--) {
            try {
                var itm = app.project.item(fi);
                if (itm instanceof FolderItem && itm.name === FOLDER_NAME) {
                    itm.remove();
                    removedFolder = true;
                }
            } catch (e) { }
        }
        alert('Cleanup done.\n\n' + removedItems + ' queue item(s) removed.\n' +
              (removedFolder ? "'" + FOLDER_NAME + "' folder removed."
                             : "No '" + FOLDER_NAME + "' folder found."));
        return;
    }

    // -- Library ------------------------------------------------------

    function readFile(rel) {
        var f = new File(root.fsName + '/' + rel);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var txt = f.read();
        f.close();
        return txt;
    }

    /* Regex over the source rather than a copy of the list, as every other
       tool here does it. A second copy is a second thing to forget. */
    function parseLibrary(src) {
        var out = [], re = /\{\s*id:\s*'([^']+)'[^}]*?defaultColors:\s*\[([^\]]*)\]/g, m;
        while ((m = re.exec(src)) !== null) {
            var cols = [], cm, cre = /'(#[0-9a-fA-F]{3,8})'/g;
            while ((cm = cre.exec(m[2])) !== null) cols.push(cm[1]);
            var lm = /label:\s*'([^']+)'/.exec(src.substring(m.index, m.index + 400));
            out.push({
                id: m[1],
                label: lm ? lm[1] : m[1],
                colors: cols.length ? cols : ['#FFFFFF', '#888888', '#222222', '#000000']
            });
        }
        return out;
    }

    function parseControls(src) {
        var byType = {};
        var re = /\n  ([A-Za-z_]+):\s*\[/g, m;
        while ((m = re.exec(src)) !== null) {
            var name = m[1];
            var from = m.index + m[0].length;
            var depth = 1, i = from;
            while (i < src.length && depth > 0) {
                var ch = src.charAt(i);
                if (ch === '[') depth++;
                else if (ch === ']') depth--;
                i++;
            }
            var block = src.substring(from, i - 1);
            var vals = {}, em, ere = /\{([^{}]*)\}/g;
            while ((em = ere.exec(block)) !== null) {
                var entry = em[1];
                var idm = /id:\s*'([^']+)'/.exec(entry);
                var dfm = /default:\s*('([^']*)'|\[[^\]]*\]|[-0-9.]+)/.exec(entry);
                if (idm && dfm) {
                    vals[idm[1]] = (dfm[2] !== undefined) ? dfm[2] : parseFloat(dfm[1]);
                }
            }
            byType[name] = vals;
        }
        return byType;
    }

    var presetsSrc  = readFile('js/presets.js');
    var controlsSrc = readFile('js/controls.js');
    var mainSrc     = readFile('jsx/main.jsx');

    if (!presetsSrc) { alert('Could not read js/presets.js - is this script still in tools/?'); return; }
    if (!mainSrc)    { alert('Could not read jsx/main.jsx.'); return; }

    var library  = parseLibrary(presetsSrc);
    var defaults = controlsSrc ? parseControls(controlsSrc) : {};
    if (!library.length) { alert('Could not parse any gradients out of js/presets.js.'); return; }

    var G = $.global;
    if (typeof G.dispatchBuild !== 'function') {
        alert('main.jsx loaded but dispatchBuild is missing.');
        return;
    }

    var queue = [], qj, lj;
    if (ONLY.length) {
        for (qj = 0; qj < ONLY.length; qj++) {
            var found = null;
            for (lj = 0; lj < library.length; lj++) {
                if (library[lj].id === ONLY[qj]) { found = library[lj]; break; }
            }
            if (found) queue.push(found);
            else {
                alert('ONLY names "' + ONLY[qj] + '", which is not an id in js/presets.js.');
                return;
            }
        }
    } else {
        queue = library;
    }

    var previewsDir = new Folder(root.fsName + '/css/previews');
    if (!previewsDir.exists) previewsDir.create();

    var work = new Folder(Folder.temp.fsName + '/lg_loops');
    if (!work.exists) work.create();

    // -- Output module -------------------------------------------------

    /* SETTING THE FORMAT IS THE PART THAT BREAKS.

       applyTemplate() takes the template's DISPLAY name, which is localised -
       'Best Settings' does not exist in a French or Japanese install, and this
       project has already been bitten once by a locale-dependent lookup (see
       the effect resolver). setSettings() takes English keys on every locale,
       so it is tried first.

       It does not always take. On AE 2026 the default output module is H.264,
       and asking for a PNG sequence and a file path in ONE setSettings call
       left the format at H.264 - changing the format resets the output path,
       so the two have to be set in that order, separately. That is attempt one
       below. Everything after it is there because the next install will fail
       in some way this one did not.

       LAST RESORT: KEEP WHATEVER FORMAT AE INSISTS ON.

       A PNG sequence is preferable - lossless, and no generation loss before
       the VP9 encode - but it is not worth a failed run. If none of the
       attempts land, this stops trying to change the format and only sets the
       path, keeping AE's own extension. ffmpeg reads whatever comes out, and
       tools/encode_loops.ps1 handles a movie exactly as it handles a sequence.
       At 640x360 the difference is not visible anyway.

       Every attempt is recorded, so a report from a machine this fails on says
       what was tried and what came back rather than just "it did not work". */
    function setOutput(om, dir, diag) {
        var seqPath = dir.fsName + '/f[#####].png';

        function fmt() {
            try { return String(om.getSettings()['Format'] || ''); }
            catch (e) { return ''; }
        }
        function setPath(p) {
            try { om.setSettings({ 'Output File Info': { 'Full Flat Path': p } }); return true; }
            catch (e) {
                try { om.file = new File(p); return true; } catch (e2) { return false; }
            }
        }

        /* 1. Format on its own, then the path. Order matters - see above. */
        var names = ['PNG Sequence', 'PNG', 'PNG sequence'];
        for (var i = 0; i < names.length; i++) {
            try {
                om.setSettings({ 'Format': names[i] });
                var got = fmt();
                if (got.toUpperCase().indexOf('PNG') !== -1) {
                    setPath(seqPath);
                    return { ok: true, seq: true, how: 'setSettings Format="' + names[i] + '"',
                             format: got, path: seqPath };
                }
                diag.push('  Format="' + names[i] + '" -> came back as "' + got + '"');
            } catch (e) {
                diag.push('  Format="' + names[i] + '" threw ' + e.toString());
            }
        }

        /* 2. Templates. Searched for one that MENTIONS png rather than asked
              for by a name invented here, because the names are localised. */
        try {
            var tpls = om.templates;
            diag.push('  output module templates: ' + tpls.join(' | '));
            for (var t = 0; t < tpls.length; t++) {
                if (String(tpls[t]).toLowerCase().indexOf('png') !== -1) {
                    om.applyTemplate(tpls[t]);
                    if (fmt().toUpperCase().indexOf('PNG') !== -1) {
                        setPath(seqPath);
                        return { ok: true, seq: true, how: 'template "' + tpls[t] + '"',
                                 format: fmt(), path: seqPath };
                    }
                }
            }
        } catch (e) {
            diag.push('  templates unavailable: ' + e.toString());
        }

        /* 3. Keep AE's format. Read the extension back off the output module
              rather than guessing at it - .mp4 for H.264, .mov for QuickTime,
              and no assumption needed either way. */
        var ext = 'mp4';
        try {
            var cur = om.file;
            if (cur && cur.name) {
                var dot = cur.name.lastIndexOf('.');
                if (dot > -1 && dot < cur.name.length - 1) ext = cur.name.substring(dot + 1);
            }
        } catch (e) { }

        var moviePath = dir.fsName + '/source.' + ext;
        if (!setPath(moviePath)) {
            throw new Error('could not set an output path at all');
        }
        return { ok: true, seq: false, how: 'kept AE format', format: fmt(), path: moviePath };
    }

    // -- Queue --------------------------------------------------------

    app.beginUndoGroup('Living Gradients - Queue Loops');

    var folder = app.project.items.addFolder(FOLDER_NAME);

    if (G.LG && G.LG.reset) G.LG.reset();
    /* false on purpose: High Colour Fidelity is opt-in and off by default in
       the panel, so queueing in 16-bit would render a quality the user does
       not get. */
    try { G.applyColorQuality(false); } catch (e) { }

    note('Living Gradients - queued loop renders');
    note('AE ' + app.version + '   ' + new Date().toString());
    note('built at ' + BUILD_W + 'x' + BUILD_H + ', rendered at ' + OUT_W + 'x' + OUT_H +
         ' (scaled to cover)');
    note('loop ' + LOOP_SEC + 's + ' + TAIL_SEC + 's tail at ' + FPS + 'fps = ' +
         TOTAL_FRAMES + ' frames each');
    note('ran from : ' + root.fsName);
    note('builders : jsx/main.jsx, ' + mainSrc.length + ' chars, modified ' +
         String(LG_QL_MAIN.modified));
    note('frames   : ' + work.fsName);
    note('scope    : ' + (ONLY.length ? ONLY.join(', ') : 'whole library') +
         (FORCE ? '   (FORCE)' : ''));
    note('');
    note(pad('STATUS', 9) + pad('GRADIENT', 20) + 'NOTES');
    note(new Array(96).join('-'));

    var queued = 0, failed = 0, skipped = 0;
    var ids = [];
    var verified = false;
    /* 'sequence' or 'movie' - decided by what the output module would accept on
       the first gradient, and written into render.json so the encoder does not
       have to work out what it is looking at. */
    var outputMode = 'sequence';

    for (var i = 0; i < queue.length; i++) {
        var g = queue[i];
        var status = 'QUEUED', detail = '';
        var beforeItems = app.project.numItems;
        var cell = null, out = null;

        var finished = new File(previewsDir.fsName + '/' + g.id + '.webm');
        if (!FORCE && finished.exists) {
            skipped++;
            ids.push(g.id);
            note(pad('  SKIP', 9) + pad(g.label, 20) + 'already encoded');
            continue;
        }

        try {
            var seqDir = new Folder(work.fsName + '/' + g.id);
            if (!seqDir.exists) seqDir.create();

            /* A stale sequence from an earlier run would leave frames the new
               render does not overwrite, and the encoder reads whatever is
               there in order. */
            var old = seqDir.getFiles('*.png');
            for (var oi = 0; oi < old.length; oi++) { try { old[oi].remove(); } catch (e) { } }

            cell = app.project.items.addComp(g.label + ' SRC', BUILD_W, BUILD_H, 1, DUR, FPS);
            cell.parentFolder = folder;
            cell.bgColor = [0, 0, 0];

            var c = [], ci;
            for (ci = 0; ci < g.colors.length; ci++) c.push(G.hexRgb(g.colors[ci]));

            var ctrl = {}, k;
            var srcCtrl = defaults[g.id] || {};
            for (k in srcCtrl) if (srcCtrl.hasOwnProperty(k)) ctrl[k] = srcCtrl[k];

            var p = {
                type: g.id, colors: g.colors, controls: ctrl,
                grain: 0, glow: 0, colorQuality: true,
                posterize: false, posterizeFps: 12, bpmSync: false
            };

            if (G.LG && G.LG.reset) G.LG.reset();

            var unknown = G.dispatchBuild(cell, g.id, c, ctrl, BUILD_W, BUILD_H, DUR);
            if (unknown) throw new Error(String(unknown));
            if (cell.numLayers === 0) throw new Error('builder ran and added no layers');

            var wrapper = G.groupGeneratedLayers(cell, p, cell.numLayers);
            G.applyGlobalPolish(cell, p, wrapper);

            if (G.LG && G.LG.count && G.LG.count() > 0) {
                status = 'WARN';
                detail = G.LG.report().replace(/^\s*\|\s*/, '') + '  |  ';
            }

            /* One output comp per gradient, because the queue renders these
               after this script has exited - the single reusable comp that
               render_loops.jsx empties between gradients cannot work here. */
            out = app.project.items.addComp(g.id, OUT_W, OUT_H, 1, DUR, FPS);
            out.parentFolder = folder;
            out.bgColor = [0, 0, 0];

            var tile = out.layers.add(cell);
            /* COVER: 1920x1080 into 640x360 is exactly 33.33% and crops
               nothing. 16:9 into 16:9 - which is also why the poster is 16:9.
               Poster and video must crop identically or the card jumps the
               moment it is hovered. */
            var scale = Math.max(OUT_W / BUILD_W, OUT_H / BUILD_H) * 100;
            tile.property('Transform').property('Scale').setValue([scale, scale]);
            tile.property('Transform').property('Position').setValue([OUT_W / 2, OUT_H / 2]);

            var rqItem = app.project.renderQueue.items.add(out);
            /* No applyTemplate for the render settings either: new queue items
               already get the default, and the template name is localised. */
            var diag = [];
            var res = setOutput(rqItem.outputModule(1), seqDir, diag);
            rqItem.render = true;

            detail += res.how;

            /* Worked out once, on the first one through, and reported rather
               than repeated - whatever the output module does for the first
               gradient it will do for the other forty-two. */
            if (!verified) {
                verified = true;
                outputMode = res.seq ? 'sequence' : 'movie';
                note('');
                note('  output: ' + res.format + '   via ' + res.how);
                note('  writing: ' + res.path);
                if (!res.seq) {
                    note('');
                    note('  Not a PNG sequence. After Effects would not change format, so');
                    note('  this keeps its own and lets ffmpeg read the result instead. That');
                    note('  is fine - one lossy step at 640x360 before the VP9 encode is not');
                    note('  visible. What was tried:');
                    for (var di = 0; di < diag.length; di++) note('  ' + diag[di]);
                }
                note('');
            }

            ids.push(g.id);
            queued++;

        } catch (err) {
            status = 'FAILED';
            failed++;
            detail += err.toString() + (err.line ? '  (line ' + err.line + ')' : '');
            /* Half-built scaffolding for a gradient that is not going to
               render is just noise in the project. */
            try { if (out) out.remove(); } catch (e) { }
            try { if (cell) cell.remove(); } catch (e) { }
            cell = null;
        }

        note(pad('  ' + status, 9) + pad(g.label, 20) + detail);

        /* Sweep whatever the builder left in the project root into our folder -
           Halftone alone makes four precomps. These CANNOT be deleted the way
           render_loops.jsx deletes them: the queue has not rendered yet and
           they are what it will render from. */
        for (var pi = app.project.numItems; pi > beforeItems; pi--) {
            try {
                var item = app.project.item(pi);
                if (item !== folder && item.parentFolder === app.project.rootFolder) {
                    item.parentFolder = folder;
                }
            } catch (e) { }
        }
    }

    app.endUndoGroup();

    // -- Hand off to the encoder --------------------------------------

    /* The encoder takes its numbers from here rather than repeating them.
       Change FPS or LOOP_SEC above and it follows. */
    var man = new File(work.fsName + '/render.json');
    man.encoding = 'UTF-8';
    man.open('w');
    man.write('{\n');
    man.write('  "rendered": "' + new Date().toString() + '",\n');
    man.write('  "fps": ' + FPS + ',\n');
    man.write('  "loopSeconds": ' + LOOP_SEC + ',\n');
    man.write('  "tailSeconds": ' + TAIL_SEC + ',\n');
    man.write('  "totalFrames": ' + TOTAL_FRAMES + ',\n');
    man.write('  "mode": "' + outputMode + '",\n');
    man.write('  "width": ' + OUT_W + ',\n');
    man.write('  "height": ' + OUT_H + ',\n');
    man.write('  "ids": [\n');
    for (var ri = 0; ri < ids.length; ri++) {
        man.write('    "' + ids[ri] + '"' + (ri < ids.length - 1 ? ',' : '') + '\n');
    }
    man.write('  ]\n}\n');
    man.close();

    note(new Array(96).join('-'));
    note('queued ' + queued + '   skipped ' + skipped + '   failed ' + failed);
    note('');
    if (failed) {
        note('The ones that failed keep the canvas painter in js/preview.js, so');
        note('the grid still shows something for them. A builder that cannot');
        note('build here cannot build in the panel either.');
        note('');
    }
    note('Next:');
    note('  1. Press Render in the Render Queue (or let RENDER_NOW do it).');
    note('  2. powershell -ExecutionPolicy Bypass -File tools/encode_loops.ps1');
    note('  3. Set CLEANUP = true at the top of this script and run it again to');
    note("     drop the '" + FOLDER_NAME + "' folder and clear the queue.");

    if (RENDER_NOW && queued > 0) {
        writeReport(null);
        try {
            app.project.renderQueue.render();
        } catch (e) {
            alert('Queued ' + queued + ', but the render stopped:\n' + e.toString());
        }
        return;
    }

    writeReport(
        queued + ' gradient(s) queued as ' +
        (outputMode === 'sequence' ? 'PNG sequences' : 'movies') + '.\n\n' +
        'Press Render in the Render Queue.\n\n' +
        'Frames go to:\n' + work.fsName +
        '\n\nThen run:\ntools/encode_loops.ps1' +
        '\n\nReport: tools/queue_loops_report.txt'
    );

})();
