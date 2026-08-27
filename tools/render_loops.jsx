/* =====================================================================
   LIVING GRADIENTS - RENDER LOOPS
   ---------------------------------------------------------------------
   Run on an empty project:  File > Scripts > Run Script File...

   Renders a short PNG sequence of every gradient actually moving. The
   sequence is raw material: tools/encode_loops.ps1 turns each one into a
   seamless css/previews/<id>.webm plus the css/previews/<id>.png poster
   the card shows at rest.

   WHY

   Every card in the panel is a canvas painter in js/preview.js imitating what
   the builder ought to produce, drawn by hand from a description. They drift
   every time a builder changes, and worse, several gradients share one
   imitation: Molten Copper, Molten Gold and Molten Silver all route through
   pvMetalCard, so the grid shows one wavy shape in three tints for three
   gradients that do not look remotely alike in a comp. A picker that confident
   and that wrong is the worst way for this to fail.

   A render cannot drift. It is the gradient.

   The painters stay as the last fallback - paintPreview() draws one
   immediately, the poster covers it when it loads, and the loop plays over
   both on hover. A gradient with nothing rendered keeps its painter forever
   and costs nothing.

   BUILT AT DELIVERY SIZE, SAVED SMALL

   Same rule as tools/render_cards.jsx and tools/contact_sheet.jsx, for the same
   reason: a good number of these builders carry hard-coded pixel values - a
   700px directional blur, a 4000px RepeTile expansion - with no relation to the
   comp they are handed. At card size a 700px blur is wider than the frame. So
   every gradient is built at 1920x1080 and scaled into the output comp.

   Scaled to COVER, not to fit. Cropping the sides of a background gradient
   loses nothing; letterboxing would put two black bars in every card.

   RESUMABLE, ON PURPOSE

   Forty-three gradients at 270 frames each is hours. A render that cannot be
   stopped and picked up again is a render nobody runs twice, so: ONLY scopes a
   run to a few ids, and anything that already has frames on disk or a finished
   .webm is skipped unless FORCE is set. Stop it whenever, run it again, it
   carries on.

   OUTPUT

     <temp>/lg_loops/<id>/f00000.png ...    the sequences
     <temp>/lg_loops/render.json            what was rendered, and at what fps
     tools/render_loops_report.txt          what worked, what failed

   Then: powershell -ExecutionPolicy Bypass -File tools/encode_loops.ps1
   ===================================================================== */

var LG_RL_ROOT = new File($.fileName).parent.parent;      // .../LivingGradients
var LG_RL_MAIN = new File(LG_RL_ROOT.fsName + '/jsx/main.jsx');

/* Evaluated at the top level with $.evalFile, not inside the closure with
   eval. ExtendScript's eval defines into the CALLING scope, so builders read
   in from inside a function land in that function and $.global keeps pointing
   at whatever a previous run left behind - which is how the second contact
   sheet came to render a stale main.jsx and report stale warnings. */
if (LG_RL_MAIN.exists) {
    try {
        $.evalFile(LG_RL_MAIN);
    } catch (LG_RL_ERR) {
        alert('jsx/main.jsx did not evaluate:\n' + LG_RL_ERR.toString() +
              (LG_RL_ERR.line ? '\nline ' + LG_RL_ERR.line : ''));
    }
}

(function () {

    /* -- Knobs --------------------------------------------------------

       ONLY: ids to render this run. Empty array means the whole library.
       The first pass is the metals, because Copper, Gold and Silver are the
       three that are indistinguishable in the panel today - if they come back
       looking like three different gradients, the pipeline is proven, and
       nothing else tests it as sharply. */
    var ONLY = ['Copper', 'Gold', 'Silver', 'Metallic'];

    /* Re-render ids that already have frames or a finished .webm. */
    var FORCE = false;

    var BUILD_W = 1920, BUILD_H = 1080;
    var OUT_W = 640, OUT_H = 360;
    var FPS = 30;
    var LOOP_SEC = 8;       // the loop the panel plays
    var TAIL_SEC = 1;       // extra footage, crossfaded over the head by the encoder
    var DUR = LOOP_SEC + TAIL_SEC;

    var TOTAL_FRAMES = Math.round(DUR * FPS);

    var root = LG_RL_ROOT;
    var log = [];

    function note(s) { log.push(s); }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
    function pad0(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

    /* DID THAT FILE ACTUALLY GET WRITTEN.

       Not `png.exists`. A File object caches what it knew at construction, and
       the object is necessarily built before the frame is saved into it - so
       asking the same object afterwards answers the question as it stood
       before the write, which is "no", for every frame, forever. The first run
       of this failed all four gradients at frame 0 with 300KB of perfectly good
       PNG sitting on disk.

       A fresh File each time defeats the cache. The retry defeats the other
       half of it: saveFrameToPng can return before the bytes have landed, so a
       single fresh stat is still occasionally early. Twenty attempts at 25ms is
       half a second in the worst case and is only ever paid when something is
       actually wrong.

       length > 0 as well as exists, because a half-written frame is not a
       frame - and a gap in the middle of a sequence is worse than a failure,
       since ffmpeg reads f%05d.png in order and simply stops at the hole.

       tools/render_cards.jsx has the same bug at its own `!png.exists` check
       and has never been run, so it has never had the chance to show it. */
    function wroteFile(path) {
        for (var a = 0; a < 20; a++) {
            var probe = new File(path);
            if (probe.exists && probe.length > 0) return true;
            $.sleep(25);
        }
        return false;
    }

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
       render_cards.jsx and contact_sheet.jsx do it. A second copy of the
       library is a second thing to forget to update. */
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

    // -- Load ---------------------------------------------------------

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

    /* Scope the run. An id in ONLY that is not in the library is a typo worth
       hearing about rather than silently rendering nothing. */
    var queue = [], qi, li;
    if (ONLY.length) {
        for (qi = 0; qi < ONLY.length; qi++) {
            var found = null;
            for (li = 0; li < library.length; li++) {
                if (library[li].id === ONLY[qi]) { found = library[li]; break; }
            }
            if (found) queue.push(found);
            else {
                alert('ONLY names "' + ONLY[qi] + '", which is not an id in js/presets.js.');
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

    // -- Progress -----------------------------------------------------

    /* Hours of rendering with a frozen application and no indication of
       progress is indistinguishable from a hang, and a hang is something you
       force-quit. Guarded: a palette that will not open must not stop a
       render that is otherwise fine. */
    var win = null, bar = null, txt = null;
    try {
        win = new Window('palette', 'Living Gradients - rendering loops');
        win.orientation = 'column';
        win.alignChildren = 'left';
        txt = win.add('statictext', undefined, 'Starting...');
        txt.preferredSize.width = 360;
        bar = win.add('progressbar', undefined, 0, queue.length * TOTAL_FRAMES);
        bar.preferredSize.width = 360;
        win.show();
    } catch (e) { win = null; }

    function progress(done, label, frame) {
        if (!win) return;
        try {
            bar.value = done;
            txt.text = label + '  -  frame ' + frame + ' / ' + TOTAL_FRAMES;
            win.update();
        } catch (e) { }
    }

    // -- Render -------------------------------------------------------

    app.beginUndoGroup('Living Gradients - Render Loops');

    var folder = app.project.items.addFolder('LG RENDER LOOPS');
    var card = app.project.items.addComp('LG LOOP OUT', OUT_W, OUT_H, 1, DUR, FPS);
    card.parentFolder = folder;
    card.bgColor = [0, 0, 0];

    if (G.LG && G.LG.reset) G.LG.reset();
    /* false on purpose: High Colour Fidelity is opt-in and off by default in
       the panel, so rendering in 16-bit would show a quality the user does not
       get. Same call render_cards.jsx makes. */
    try { G.applyColorQuality(false); } catch (e) { }

    note('Living Gradients - loop renders');
    note('AE ' + app.version + '   ' + new Date().toString());
    note('built at ' + BUILD_W + 'x' + BUILD_H + ', saved at ' + OUT_W + 'x' + OUT_H +
         ' (scaled to cover)');
    note('loop ' + LOOP_SEC + 's + ' + TAIL_SEC + 's tail at ' + FPS + 'fps = ' +
         TOTAL_FRAMES + ' frames each');
    note('ran from : ' + root.fsName);
    note('builders : jsx/main.jsx, ' + mainSrc.length + ' chars, modified ' +
         String(LG_RL_MAIN.modified));
    note('frames   : ' + work.fsName);
    note('scope    : ' + (ONLY.length ? ONLY.join(', ') : 'whole library') +
         (FORCE ? '   (FORCE)' : ''));
    note('');
    note(pad('STATUS', 9) + pad('GRADIENT', 20) + pad('FRAMES', 8) + 'NOTES');
    note(new Array(96).join('-'));

    var wrote = 0, failed = 0, skipped = 0;
    var rendered = [];     // ids with a complete sequence on disk, for render.json
    var doneFrames = 0;

    for (var i = 0; i < queue.length; i++) {
        var g = queue[i];
        var status = 'OK', detail = '', frames = 0;
        var cell = null;
        var beforeItems = app.project.numItems;

        var seqDir = new Folder(work.fsName + '/' + g.id);
        var lastFrame = new File(seqDir.fsName + '/f' + pad0(TOTAL_FRAMES - 1, 5) + '.png');
        var finished = new File(previewsDir.fsName + '/' + g.id + '.webm');

        /* Already done. The LAST frame is the marker rather than the folder,
           because a run stopped halfway leaves a folder full of frames that is
           not a sequence, and encoding that would produce a loop with a jump
           in it. */
        if (!FORCE && (lastFrame.exists || finished.exists)) {
            skipped++;
            rendered.push(g.id);
            doneFrames += TOTAL_FRAMES;
            note(pad('  SKIP', 9) + pad(g.label, 20) + pad('-', 8) +
                 (finished.exists ? 'already encoded' : 'frames already on disk'));
            progress(doneFrames, g.label, TOTAL_FRAMES);
            continue;
        }

        try {
            if (!seqDir.exists) seqDir.create();

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

            /* One layer in the output comp at a time. Emptying it rather than
               making 43 output comps keeps the project small enough to stay
               responsive to the end of a run that takes hours. */
            while (card.numLayers > 0) card.layer(1).remove();

            var tile = card.layers.add(cell);
            /* COVER: the larger of the two ratios, so the frame is filled and
               the overflow cropped. 1920x1080 into 640x360 is exactly 33.33%
               and crops nothing, 16:9 into 16:9 - which is also why the poster
               is 16:9. Poster and video have to crop identically or hovering
               a card makes the picture jump. */
            var scale = Math.max(OUT_W / BUILD_W, OUT_H / BUILD_H) * 100;
            tile.property('Transform').property('Scale').setValue([scale, scale]);
            tile.property('Transform').property('Position').setValue([OUT_W / 2, OUT_H / 2]);

            for (var f = 0; f < TOTAL_FRAMES; f++) {
                var png = new File(seqDir.fsName + '/f' + pad0(f, 5) + '.png');
                /* frameDuration rather than f/FPS: the comp's own frame step,
                   so nothing lands between two frames and gets rounded to a
                   neighbour, which would show up as a stutter in the loop. */
                card.saveFrameToPng(f * card.frameDuration, png);
                if (!wroteFile(png.fsName)) {
                    throw new Error('saveFrameToPng wrote nothing at frame ' + f);
                }
                frames++;
                doneFrames++;
                if (f % 5 === 0) progress(doneFrames, g.label, f);
            }

            rendered.push(g.id);
            wrote++;

        } catch (err) {
            status = 'FAILED';
            failed++;
            detail = err.toString() + (err.line ? '  (line ' + err.line + ')' : '');
            /* A partial sequence would be read as finished by the resume check
               on the next run. Take the marker frame away so the check sees the
               truth. Fresh File for the same reason as wroteFile(): the one
               built at the top of this iteration still believes whatever was
               true before any frames were written. */
            try {
                var stale = new File(lastFrame.fsName);
                if (stale.exists) stale.remove();
            } catch (e) { }
            doneFrames = (i + 1) * TOTAL_FRAMES;
        }

        note(pad('  ' + status, 9) + pad(g.label, 20) + pad(frames || '-', 8) + detail);

        /* Sweep up whatever the builder left in the project root - Halftone
           alone makes four precomps - then drop the whole lot. */
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

        /* Forty-three nine-second comps at 1920x1080 will fill the disk cache
           long before the run ends, and a full cache is where AE starts
           crawling. Cheaper to drop it between gradients than to have the last
           ten take four times as long as the first ten. */
        try { app.purge(PurgeTarget.ALL_CACHES); } catch (e) { }
    }

    /* Nothing this script made stays in the project. A render tool that leaves
       fifty comps behind is a tool people stop running. */
    try {
        while (card.numLayers > 0) card.layer(1).remove();
        card.remove();
    } catch (e) { }
    try { folder.remove(); } catch (e) { }

    app.endUndoGroup();
    if (win) { try { win.close(); } catch (e) { } }

    // -- Hand off to the encoder --------------------------------------

    /* The encoder needs the numbers this ran at, not the numbers it happens to
       have hard-coded. Change FPS or LOOP_SEC up top and the encoder follows,
       which is the whole point of writing them down here. */
    var man = new File(work.fsName + '/render.json');
    man.encoding = 'UTF-8';
    man.open('w');
    man.write('{\n');
    man.write('  "rendered": "' + new Date().toString() + '",\n');
    man.write('  "fps": ' + FPS + ',\n');
    man.write('  "loopSeconds": ' + LOOP_SEC + ',\n');
    man.write('  "tailSeconds": ' + TAIL_SEC + ',\n');
    man.write('  "totalFrames": ' + TOTAL_FRAMES + ',\n');
    man.write('  "width": ' + OUT_W + ',\n');
    man.write('  "height": ' + OUT_H + ',\n');
    man.write('  "ids": [\n');
    for (var ri = 0; ri < rendered.length; ri++) {
        man.write('    "' + rendered[ri] + '"' + (ri < rendered.length - 1 ? ',' : '') + '\n');
    }
    man.write('  ]\n}\n');
    man.close();

    note(new Array(96).join('-'));
    note('rendered ' + wrote + '   skipped ' + skipped + '   failed ' + failed);
    note('');
    if (failed) {
        note('The ones that failed keep the canvas painter in js/preview.js, so');
        note('the grid still shows something for them. They are the ones to look');
        note('at: a builder that cannot render here cannot render in the panel');
        note('either.');
        note('');
    }
    note('Next:');
    note('  powershell -ExecutionPolicy Bypass -File tools/encode_loops.ps1');
    note('');
    note('That crossfades the ' + TAIL_SEC + 's tail over the head of each sequence to');
    note('close the loop, encodes css/previews/<id>.webm, pulls the poster still');
    note('out of frame 0 of the result, and writes css/previews/index.json.');

    var report = new File(root.fsName + '/tools/render_loops_report.txt');
    report.encoding = 'UTF-8';
    report.open('w');
    report.write(log.join('\n') + '\n');
    report.close();

    alert('Loops rendered.\n\n' + wrote + ' rendered, ' + skipped + ' skipped, ' +
          failed + ' failed.\n\nFrames: ' + work.fsName +
          '\n\nNow run:\ntools/encode_loops.ps1\n\nReport: tools/render_loops_report.txt');
    report.execute();

})();
