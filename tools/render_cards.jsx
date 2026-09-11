/* =====================================================================
   LIVING GRADIENTS — RENDER CARDS
   ---------------------------------------------------------------------
   Run once, on an empty project:  File > Scripts > Run Script File…

   Builds every gradient in the library and saves one still per gradient
   into css/previews/<id>.png, which is what the library cards then show.

   WHY

   Every card in the panel is a canvas painter in js/preview.js imitating what
   the builder ought to produce. They were a large improvement on the CSS
   gradients before them and they are still an imitation, drawn by hand from a
   description — so they drift, silently, every time a builder changes. Frosted
   Glass and Snakeskin both looked right in the panel and wrong in the comp for
   exactly that reason, which is the worst possible failure for a picker: the
   grid was confidently wrong.

   A render cannot drift. It is the gradient.

   The painters stay as the fallback — paintPreview() draws one immediately and
   swaps in the image when it loads, so a missing or not-yet-rendered PNG costs
   nothing and a fresh checkout still shows a full grid.

   BUILT AT DELIVERY SIZE, SAVED SMALL

   Same rule as tools/contact_sheet.jsx and for the same reason: a good number
   of these builders carry hard-coded pixel values — a 700px directional blur, a
   4000px RepeTile expansion — with no relation to the comp they are handed. At
   card size a 700px blur is four times the width of the frame. So every
   gradient is built at 1920x1080 and then scaled into the card comp.

   Scaled to COVER, not to fit. The card canvas is 168x120, which is not 16:9,
   so something has to give; cropping the sides of a background gradient loses
   nothing and letterboxing it would put two black bars in every card.

   OUTPUT

     css/previews/<id>.png          one per gradient, 336x240
     tools/render_cards_report.txt  what rendered, what failed, total size

   Everything it creates in the project is removed afterwards.
   ===================================================================== */

var LG_RC_ROOT = new File($.fileName).parent.parent;      // …/LivingGradients
var LG_RC_MAIN = new File(LG_RC_ROOT.fsName + '/jsx/main.jsx');

/* Evaluated at the top level with $.evalFile, not inside the closure with
   eval. ExtendScript's eval defines into the CALLING scope, so builders read
   in from inside a function land in that function and $.global keeps pointing
   at whatever a previous run left behind — which is how the second contact
   sheet came to render a stale main.jsx and report stale warnings. */
if (LG_RC_MAIN.exists) {
    try {
        $.evalFile(LG_RC_MAIN);
    } catch (LG_RC_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_RC_ERR.toString() +
              (LG_RC_ERR.line ? '\nline ' + LG_RC_ERR.line : ''));
    }
}

(function () {

    var BUILD_W = 1920, BUILD_H = 1080;
    /* Twice the 168x120 the card canvas is, so it is still crisp on a HiDPI
       display without the package carrying full-size stills. */
    var CARD_W = 336, CARD_H = 240;
    var DUR = 6, FPS = 30;
    var SAMPLE_TIME = 2.0;      // far enough in that the evolutions have moved

    /* -- Knobs, matching tools/queue_loops.jsx --------------------------

       ONLY: ids to render. Empty renders the whole library, which is the
       right thing from File > Scripts and the wrong thing over the scripting
       bridge, where a run of forty-seven outlasts the bridge's timeout. Four
       or five at a time comes back inside it.

       When ONLY is set, index.json is MERGED rather than replaced. It is the
       list of gradients that have a rendered card, and rewriting it from a
       five-gradient run would tell the panel the other forty-two had none. */
    var ONLY = ($.global.LG_RC_ONLY instanceof Array) ? $.global.LG_RC_ONLY : [];

    /* SILENT: no alert, and do not open the report. The alert is a modal, and
       a modal raised by a script the bridge is waiting on blocks both of
       them until somebody clicks it by hand. */
    var SILENT = ($.global.LG_RC_SILENT === true);

    /* Both are overridable from $.global so a caller driving this over the
       scripting bridge can batch it without editing the file between runs.
       Set nothing and it behaves exactly as it always did from
       File > Scripts > Run Script File. */

    var root = LG_RC_ROOT;
    var log = [];

    function note(s) { log.push(s); }

    /* HOW LONG SAVING A FRAME ACTUALLY TAKES.

       saveFrameToPng returns before the bytes are on disk, and `File.exists`
       answers as of when the File object was constructed — which necessarily
       predates the save. Checking either one immediately reports a perfectly
       good render as having written nothing, and it does it ONLY for files
       that are not already there: re-rendering a gradient that already had a
       poster passed, and the four new ones all failed, which is a failure
       mode that hides itself until the day you add something.

       tools/qa_sweep.jsx solved this and this script did not. Same solution:
       poll, and treat two consecutive reads at the same non-zero size as
       finished — a non-zero length is not a finished file, it is a partial
       PNG, and a partial PNG measures as a frame full of holes. */
    function wroteFile(path) {
        var tries = 0, lastSize = -1;
        while (tries < 200) {
            var probe = new File(path);
            if (probe.exists && probe.length > 0) {
                if (probe.length === lastSize) return probe.length;
                lastSize = probe.length;
            }
            $.sleep(100);
            tries++;
        }
        return 0;
    }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

    function readFile(rel) {
        var f = new File(root.fsName + '/' + rel);
        if (!f.exists) return null;
        f.encoding = 'UTF-8';
        f.open('r');
        var txt = f.read();
        f.close();
        return txt;
    }

    /* Regex over the source rather than a copy of the list, exactly as
       contact_sheet.jsx does it. A second copy of the library is a second
       thing to forget to update. */
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

    // ── Load ─────────────────────────────────────────────────────────

    var presetsSrc  = readFile('js/presets.js');
    var controlsSrc = readFile('js/controls.js');
    var mainSrc     = readFile('jsx/main.jsx');

    if (!presetsSrc) { alert('Could not read js/presets.js — is this script still in tools/?'); return; }
    if (!mainSrc)    { alert('Could not read jsx/main.jsx.'); return; }

    var library  = parseLibrary(presetsSrc);

    /* ---- variant tables --------------------------------------------------

       Some gradients' sliders are DERIVED at run time rather than written out:
       js/controls.js builds the SaaS family's control sets from SAAS_VARIANTS
       in js/presets.js. parseControls() above reads literal text, so it cannot
       see them, and every one of them would be built with the base SaaS
       defaults instead.

       That is not a hypothetical. Four SaaS presets were rendered, looked at
       and rejected on what turned out to be four renders of a fifth, because
       this gap was on the tooling side and nothing reported it.

       The table is literal text where it lives, so read it there. */
    function parseVariantTable(src, name) {
        var out = {};
        if (!src) return out;
        var block = new RegExp('var ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\};').exec(src);
        if (!block) return out;
        var re = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{([^{}]*)\}/g, m;
        while ((m = re.exec(block[1])) !== null) {
            var vals = {}, kv = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(-?[0-9.]+)/g, k;
            while ((k = kv.exec(m[2])) !== null) vals[k[1]] = parseFloat(k[2]);
            out[m[1]] = vals;
        }
        return out;
    }

    function mergeVariantDefaults(defaults, presetsSrc) {
        var v = parseVariantTable(presetsSrc, 'SAAS_VARIANTS'), id, k;
        for (id in v) {
            if (!v.hasOwnProperty(id)) continue;
            if (!defaults[id]) defaults[id] = {};
            /* The variant's own numbers win over anything inherited. */
            for (k in v[id]) if (v[id].hasOwnProperty(k)) defaults[id][k] = v[id][k];
        }
        return defaults;
    }
    var defaults = controlsSrc ? parseControls(controlsSrc) : {};
    defaults = mergeVariantDefaults(defaults, presetsSrc);
    if (!library.length) { alert('Could not parse any gradients out of js/presets.js.'); return; }

    var G = $.global;
    if (typeof G.dispatchBuild !== 'function') {
        alert('main.jsx loaded but dispatchBuild is missing.');
        return;
    }

    var outDir = new Folder(root.fsName + '/css/previews');
    if (!outDir.exists) outDir.create();

    if (ONLY.length) {
        var want = {}, wi2, filtered = [], fi2;
        for (wi2 = 0; wi2 < ONLY.length; wi2++) want[ONLY[wi2]] = true;
        for (fi2 = 0; fi2 < library.length; fi2++) {
            if (want[library[fi2].id]) filtered.push(library[fi2]);
        }
        library = filtered;
    }

    // ── Render ───────────────────────────────────────────────────────


    /* ---- WHAT WAS HERE BEFORE THIS SCRIPT RAN ------------------------------

       THIS REPLACES A SWEEP THAT COULD MOVE THE USER'S OWN WORK INTO THIS
       TOOL'S FOLDER, and in tools/render_loops.jsx that folder is deleted at
       the end of the run.

       The pattern all five render tools shared was: record
       `beforeItems = app.project.numItems`, then walk
       `for (pi = numItems; pi > beforeItems; pi--)` and treat everything above
       that index as this run's own. That test is not valid.
       `app.project.item(i)` enumerates in the Project panel's own order, which
       is not insertion order, and every removal shifts every index after it -
       so across a long run the count falls below the indices of items that
       were already in the project, and the loop reaches them.

       Identity is the test that means what it says. */
    function lgSnapshotItems() {
        var seen = [], i;
        for (i = 1; i <= app.project.numItems; i++) seen.push(app.project.item(i));
        return seen;
    }

    function lgWasHereBefore(seen, item) {
        var i;
        for (i = 0; i < seen.length; i++) if (seen[i] === item) return true;
        return false;
    }

    app.beginUndoGroup('Living Gradients — Render Cards');

    var PRE_EXISTING = lgSnapshotItems();

    var folder = app.project.items.addFolder('LG RENDER CARDS');
    var card = app.project.items.addComp('LG CARD', CARD_W, CARD_H, 1, DUR, FPS);
    card.parentFolder = folder;
    card.bgColor = [0, 0, 0];

    if (G.LG && G.LG.reset) G.LG.reset();
    /* false on purpose: High Colour Fidelity is opt-in and off by default in
       the panel, so rendering the cards in 16-bit would show a quality the
       user does not get. */
    try { G.applyColorQuality(false); } catch (e) { }

    note('Living Gradients — card renders');
    note('AE ' + app.version + '   ' + new Date().toString());
    note('built at ' + BUILD_W + 'x' + BUILD_H + ', saved at ' + CARD_W + 'x' + CARD_H +
         ' (scaled to cover), still at ' + SAMPLE_TIME + 's');
    note('ran from : ' + root.fsName);
    note('builders : jsx/main.jsx, ' + mainSrc.length + ' chars, modified ' +
         String(LG_RC_MAIN.modified));
    note('out      : css/previews/');
    note('');
    note(pad('STATUS', 8) + pad('GRADIENT', 20) + pad('KB', 7) + 'NOTES');
    note(new Array(96).join('-'));

    var wrote = 0, failed = 0, totalKb = 0;
    var written = [];      // the ids that produced a file, for index.json

    for (var i = 0; i < library.length; i++) {
        var g = library[i];
        var status = 'OK', detail = '', kb = 0;
        var cell = null;

        try {
            cell = app.project.items.addComp(g.label, BUILD_W, BUILD_H, 1, DUR, FPS);
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
                detail = G.LG.report().replace(/^\s*\|\s*/, '');
            }

            /* One layer in the card comp at a time. Emptying it rather than
               making 48 card comps keeps the project small enough to stay
               responsive to the end of the run. */
            while (card.numLayers > 0) card.layer(1).remove();

            var tile = card.layers.add(cell);
            /* COVER: the larger of the two ratios, so the frame is filled and
               the overflow is cropped. 1920x1080 into 336x240 is 22.2%, which
               crops the sides. */
            var scale = Math.max(CARD_W / BUILD_W, CARD_H / BUILD_H) * 100;
            tile.property('Transform').property('Scale').setValue([scale, scale]);
            tile.property('Transform').property('Position').setValue([CARD_W / 2, CARD_H / 2]);

            var pngPath = outDir.fsName + '/' + g.id + '.png';
            var png = new File(pngPath);
            /* Removed first, so the poll below cannot mistake last run's file
               for this run's. */
            if (png.exists) { try { png.remove(); } catch (e) { } }
            card.saveFrameToPng(SAMPLE_TIME, new File(pngPath));

            var bytes = wroteFile(pngPath);
            if (bytes === 0) throw new Error('saveFrameToPng wrote nothing');
            kb = Math.round(bytes / 1024);
            totalKb += kb;
            written.push(g.id);
            wrote++;

        } catch (err) {
            status = 'FAILED';
            failed++;
            detail = err.toString() + (err.line ? '  (line ' + err.line + ')' : '');
        }

        note(pad('  ' + status, 8) + pad(g.label, 20) + pad(kb || '-', 7) + detail);

        /* Sweep up whatever the builder left in the project root — Halftone
           alone makes four precomps — then drop the whole lot. Cards are the
           output; the comps are scaffolding. */
        for (var pi = app.project.numItems; pi >= 1; pi--) {
            try {
                var item = app.project.item(pi);
                if (item !== folder && item !== card &&
                    item.parentFolder === app.project.rootFolder &&
                    !lgWasHereBefore(PRE_EXISTING, item)) {
                    item.parentFolder = folder;
                }
            } catch (e) { }
        }
        if (cell) { try { cell.remove(); } catch (e) { } }
    }

    /* Nothing this script made stays in the project. A render tool that leaves
       fifty comps behind is a tool people stop running. */
    try {
        while (card.numLayers > 0) card.layer(1).remove();
        card.remove();
    } catch (e) { }
    try { folder.remove(); } catch (e) { }

    app.endUndoGroup();

    note(new Array(96).join('-'));
    note('wrote ' + wrote + '   failed ' + failed + '   total ' + totalKb + ' KB');
    note('');
    if (failed) {
        note('The cards that failed keep the canvas painter in js/preview.js,');
        note('so the grid still shows something for them. They are the ones to');
        note('look at: a builder that cannot render a still here is a builder');
        note('that cannot render in the panel either.');
    } else {
        note('Every card is now a render of what that gradient actually builds.');
    }
    note('');
    note('tools/build.ps1 ships css/previews and reports its size. If the total');
    note('above is larger than the budget there, lower CARD_W/CARD_H and rerun.');

    /* THE INDEX. js/preview.js asks for this one file and then requests only
       the images it names. Without it the panel would fire a request per card
       and let the missing ones 404, which on a checkout that has never run this
       script is forty-eight red lines in the console every time the panel
       opens — and a real error hiding among them.

       Written last, so it can only ever list images that exist. */
    var index = new File(outDir.fsName + '/index.json');

    /* THE INDEX HAS TWO LISTS AND THIS SCRIPT OWNS ONE OF THEM.

       `cards` is the posters, which is what this writes. `loops` is the
       hover videos, which tools/queue_loops.jsx and tools/encode_loops.ps1
       produce and this script knows nothing about — so it has to be carried
       through untouched. Rewriting the file without it told js/preview.js
       that no gradient had a loop, and every hover in the panel went dead.

       And a partial run ADDS to `cards` rather than defining it: a
       five-gradient batch that replaced the list would leave the panel
       believing the other forty-two had no render, silently falling back to
       canvas painters. */
    function readArray(src, key) {
        var out = [];
        var m = new RegExp('"' + key + '"\\s*:\\s*\\[([^\\]]*)\\]').exec(src);
        if (!m) return out;
        var im, ire = /"([^"]+)"/g;
        while ((im = ire.exec(m[1])) !== null) out.push(im[1]);
        return out;
    }

    var prevSrc = '';
    if (index.exists) {
        try {
            index.encoding = 'UTF-8';
            index.open('r');
            prevSrc = index.read();
            index.close();
        } catch (e) { prevSrc = ''; }
    }

    var loops = readArray(prevSrc, 'loops');

    var cards = written;
    if (ONLY.length) {
        var merged = [], mi, mseen = {}, prev = readArray(prevSrc, 'cards');
        for (mi = 0; mi < prev.length; mi++) {
            if (!mseen[prev[mi]]) { mseen[prev[mi]] = true; merged.push(prev[mi]); }
        }
        for (mi = 0; mi < written.length; mi++) {
            if (!mseen[written[mi]]) { mseen[written[mi]] = true; merged.push(written[mi]); }
        }
        merged.sort();
        cards = merged;
    }

    function writeArray(f, key, arr, last) {
        f.write('  "' + key + '": [\n');
        for (var ai = 0; ai < arr.length; ai++) {
            f.write('    "' + arr[ai] + '"' + (ai < arr.length - 1 ? ',' : '') + '\n');
        }
        f.write('  ]' + (last ? '' : ',') + '\n');
    }

    index.encoding = 'UTF-8';
    index.open('w');
    index.write('{\n  "rendered": "' + new Date().toString() + '",\n');
    writeArray(index, 'cards', cards, false);
    writeArray(index, 'loops', loops, true);
    index.write('}\n');
    index.close();

    var report = new File(root.fsName + '/tools/render_cards_report.txt');
    report.encoding = 'UTF-8';
    report.open('w');
    report.write(log.join('\n') + '\n');
    report.close();

    if (!SILENT) {
        alert('Cards rendered.\n\n' + wrote + ' written, ' + failed + ' failed, ' +
              totalKb + ' KB total.\n\n' + outDir.fsName +
              '\n\nReport: tools/render_cards_report.txt');
        report.execute();
    }
    return wrote + ' written, ' + failed + ' failed, ' + totalKb + ' KB';

})();
