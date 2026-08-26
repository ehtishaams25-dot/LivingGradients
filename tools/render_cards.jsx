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

    var root = LG_RC_ROOT;
    var log = [];

    function note(s) { log.push(s); }
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
    var defaults = controlsSrc ? parseControls(controlsSrc) : {};
    if (!library.length) { alert('Could not parse any gradients out of js/presets.js.'); return; }

    var G = $.global;
    if (typeof G.dispatchBuild !== 'function') {
        alert('main.jsx loaded but dispatchBuild is missing.');
        return;
    }

    var outDir = new Folder(root.fsName + '/css/previews');
    if (!outDir.exists) outDir.create();

    // ── Render ───────────────────────────────────────────────────────

    app.beginUndoGroup('Living Gradients — Render Cards');

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
        var beforeItems = app.project.numItems;

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

            var png = new File(outDir.fsName + '/' + g.id + '.png');
            card.saveFrameToPng(SAMPLE_TIME, png);

            if (!png.exists) throw new Error('saveFrameToPng wrote nothing');
            kb = Math.round(png.length / 1024);
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
        for (var pi = app.project.numItems; pi > beforeItems; pi--) {
            try {
                var item = app.project.item(pi);
                if (item !== folder && item !== card &&
                    item.parentFolder === app.project.rootFolder) {
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
    index.encoding = 'UTF-8';
    index.open('w');
    index.write('{\n  "rendered": "' + new Date().toString() + '",\n  "cards": [\n');
    for (var wi = 0; wi < written.length; wi++) {
        index.write('    "' + written[wi] + '"' + (wi < written.length - 1 ? ',' : '') + '\n');
    }
    index.write('  ]\n}\n');
    index.close();

    var report = new File(root.fsName + '/tools/render_cards_report.txt');
    report.encoding = 'UTF-8';
    report.open('w');
    report.write(log.join('\n') + '\n');
    report.close();

    alert('Cards rendered.\n\n' + wrote + ' written, ' + failed + ' failed, ' +
          totalKb + ' KB total.\n\n' + outDir.fsName +
          '\n\nReport: tools/render_cards_report.txt');
    report.execute();

})();
