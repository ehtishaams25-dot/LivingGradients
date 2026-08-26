/* ============================================
   PRESETS.JSX — capture, thumbnail, apply
   ============================================

   The host half of the preset system.

   CAPTURE IS A READ, NOT A REVERSE-ENGINEER

   applyGlobalPolish() in main.jsx already stamps the entire build payload onto
   the generated layer:

       layer.comment = 'LIVING_GRADIENT_DATA:' + JSON.stringify(p)

   That payload is exactly what generateGradient() consumes. So capturing a
   gradient out of a comp is reading a string we were already writing — not
   inspecting an effect stack and guessing. It is exact by construction: what
   comes back builds the identical thing, because it *is* the instruction that
   built it.

   The limit that follows from this, and it is worth being straight about:
   capture only works on layers this panel made. A gradient somebody built by
   hand has no stamp and cannot be captured, because there is no general way to
   read an arbitrary stack of effects back into our parameters. Every layer we
   generate carries the stamp, including inside precomps, so in practice this
   only bites on hand-built work.

   WHY NOT .ffx
   After Effects can apply an animation preset from script but cannot save one
   — there is no scripting API for writing .ffx. And an .ffx is per-layer, while
   most of these gradients are a stack of five or six layers plus a precomp, a
   track matte and a set of expressions. So the preset format is ours. It is
   also better: it carries the palette, the control values and the intent, so
   it can be re-rendered at any comp size rather than pasted at a fixed one.

   LOADED BY: main.js, via $.evalFile alongside main.jsx */

/* ── DATES ───────────────────────────────────────────────────────────

   ExtendScript is ES3. Date.prototype.toISOString arrived in ES5, so calling
   it here throws "Function Date().toISOString is undefined" — which is exactly
   what capture was doing, and the reason a captured preset came back as an
   error toast instead of a card.

   This is the trap that catches every panel: the CEP half is modern Chromium
   where toISOString, forEach, map, filter, let and arrow functions all work,
   and the .jsx half is a 1999 JavaScript engine where none of them do. Code
   that looks identical behaves differently depending on which side of
   evalScript it lives on.

   Written by hand rather than polyfilled onto Date.prototype: patching a
   built-in from a script that other scripts share a global scope with is how
   you break somebody else's panel. */
function lgPad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
}

function lgIsoNow(date) {
    var d = date || new Date();
    return d.getUTCFullYear() + '-' +
        lgPad(d.getUTCMonth() + 1, 2) + '-' +
        lgPad(d.getUTCDate(), 2) + 'T' +
        lgPad(d.getUTCHours(), 2) + ':' +
        lgPad(d.getUTCMinutes(), 2) + ':' +
        lgPad(d.getUTCSeconds(), 2) + '.' +
        lgPad(d.getUTCMilliseconds(), 3) + 'Z';
}

/* ── PATHS AND PERMISSION ────────────────────────────────────────────

   Code Runner opens with a card at the top of the panel when After Effects
   cannot write a temp file, because every one of its script buttons depends on
   that, and the failure is otherwise silent and baffling. Ours depends on it
   for thumbnails. Same treatment: find out at startup and say so, rather than
   letting the thumbnail quietly never appear. */

function lgCanWriteFiles() {
    try {
        var probe = new File(Folder.temp.fsName + '/lg_write_probe.txt');
        if (!probe.open('w')) return 'false|Could not open a file for writing.';
        probe.write('ok');
        probe.close();
        var ok = probe.exists;
        try { probe.remove(); } catch (e) { }
        return ok ? 'true|' : 'false|The file was not created.';
    } catch (e) {
        return 'false|' + e.message;
    }
}

function lgHostInfo() {
    var info = {
        app: 'After Effects',
        version: '',
        build: '',
        language: '',
        os: '',
        project: '',
        canWrite: false
    };
    try { info.version = app.version; } catch (e) { }
    try { info.build = app.buildName; } catch (e) { }
    try { info.language = app.isoLanguage; } catch (e) { }
    try { info.os = ($.os || ''); } catch (e) { }
    try { info.project = app.project.file ? app.project.file.name : '(unsaved)'; } catch (e) { }
    try { info.canWrite = lgCanWriteFiles().indexOf('true') === 0; } catch (e) { }
    return JSON.stringify(info);
}

/* ── FINDING OUR OWN LAYERS ──────────────────────────────────────────

   A generated gradient is normally a precomp layer carrying the stamp. But
   people move things: the stamped layer can end up nested inside another
   precomp, and the selection can land on the wrapper instead of the stamp.
   So the search goes both ways — up from what is selected, and down through
   its source — rather than checking one layer and giving up. */

var LG_STAMP = 'LIVING_GRADIENT_DATA:';

function lgReadStamp(layer) {
    try {
        if (layer && layer.comment && layer.comment.indexOf(LG_STAMP) === 0) {
            return layer.comment.substring(LG_STAMP.length);
        }
    } catch (e) { }
    return null;
}

/* Depth-limited: a project with a circular precomp reference would otherwise
   walk forever, and nothing legitimate nests this deep. */
function lgFindStampedIn(comp, depth, out) {
    out = out || [];
    if (!comp || depth > 6) return out;
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        var stamp = lgReadStamp(layer);
        if (stamp) {
            out.push({ layer: layer, comp: comp, data: stamp });
        } else if (layer.source && layer.source instanceof CompItem) {
            lgFindStampedIn(layer.source, depth + 1, out);
        }
    }
    return out;
}

/* Every gradient in the active comp, as a list the panel can show. This is
   what makes "capture this comp" possible in one click — the user does not
   have to select anything, let alone the right thing. */
function lgListGradients() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: 'No active composition.' });
        }

        var found = lgFindStampedIn(comp, 0, []);
        var list = [];
        for (var i = 0; i < found.length; i++) {
            var payload = null;
            try { payload = JSON.parse(found[i].data); } catch (e) { continue; }
            list.push({
                index: found[i].layer.index,
                name: found[i].layer.name,
                comp: found[i].comp.name,
                nested: found[i].comp !== comp,
                type: payload.type || '',
                colors: payload.colors || [],
                selected: found[i].layer.selected === true
            });
        }

        return JSON.stringify({
            ok: true,
            comp: comp.name,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            count: list.length,
            gradients: list
        });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.message + ' line ' + e.line });
    }
}

/* One capture. `which` is either 'selection' or the index reported by
   lgListGradients. Returns the full build payload plus where it came from,
   so a preset can say "captured from Hero Comp, 25 Aug" a year later. */
function lgCapture(which) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: 'No active composition.' });
        }

        var found = lgFindStampedIn(comp, 0, []);
        if (!found.length) {
            return JSON.stringify({
                ok: false,
                error: 'No Living Gradients layer in this comp. Capture reads settings this panel wrote, so it only works on gradients it made.'
            });
        }

        var hit = null, i;

        if (which === 'selection' || which === undefined || which === null || which === '') {
            /* Prefer what is actually selected. Falling back to the first
               gradient when nothing is selected is the friendly behaviour —
               a one-gradient comp should not demand a click first. */
            for (i = 0; i < found.length; i++) {
                if (found[i].layer.selected) { hit = found[i]; break; }
            }
            if (!hit) hit = found[0];
        } else {
            var wanted = parseInt(which, 10);
            for (i = 0; i < found.length; i++) {
                if (found[i].layer.index === wanted) { hit = found[i]; break; }
            }
            if (!hit) hit = found[0];
        }

        var payload;
        try { payload = JSON.parse(hit.data); }
        catch (e) { return JSON.stringify({ ok: false, error: 'The settings on that layer are damaged and cannot be read.' }); }

        return JSON.stringify({
            ok: true,
            payload: payload,
            origin: {
                comp: hit.comp.name,
                layer: hit.layer.name,
                nested: hit.comp !== comp,
                width: hit.comp.width,
                height: hit.comp.height,
                host: 'After Effects ' + app.version,
                captured: lgIsoNow()
            }
        });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.message + ' line ' + e.line });
    }
}

/* Every gradient in the comp at once. The "drop a comp in and get presets
   out" case: one call, one list, the panel writes them all. */
function lgCaptureAll() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: 'No active composition.' });
        }

        var found = lgFindStampedIn(comp, 0, []);
        var out = [];
        for (var i = 0; i < found.length; i++) {
            var payload = null;
            try { payload = JSON.parse(found[i].data); } catch (e) { continue; }
            out.push({
                payload: payload,
                origin: {
                    comp: found[i].comp.name,
                    layer: found[i].layer.name,
                    index: found[i].layer.index,
                    nested: found[i].comp !== comp,
                    host: 'After Effects ' + app.version,
                    captured: lgIsoNow()
                }
            });
        }

        return JSON.stringify({ ok: true, comp: comp.name, count: out.length, captures: out });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.message + ' line ' + e.line });
    }
}

/* ── THUMBNAILS FROM THE REAL RENDER ─────────────────────────────────

   The canvas previews in preview.js are approximations — good ones, but they
   are a second implementation of each look and they drift from the builders.
   A captured preset deserves the truth, so this renders one frame of the
   actual comp.

   Renders at full comp resolution because saveFrameToPng has no size argument;
   the panel scales it down to a card, which is also where the aspect crop
   happens. One frame of 4K is a fraction of a second and only ever happens on
   an explicit capture.

   Time defaults to a third of the way in rather than frame zero: most of these
   gradients start from a resting state and only become themselves once the
   evolution expressions have had some time to run. A thumbnail of frame zero
   sells the preset short. */

function lgRenderThumb(timeArg) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: 'No active composition.' });
        }

        var probe = lgCanWriteFiles();
        if (probe.indexOf('true') !== 0) {
            return JSON.stringify({
                ok: false,
                error: 'After Effects cannot write files. Turn on Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network, then restart After Effects.'
            });
        }

        var t;
        if (typeof timeArg === 'number' && timeArg >= 0) {
            t = timeArg;
        } else {
            t = comp.duration > 0 ? comp.duration / 3 : 0;
        }
        if (t > comp.duration) t = comp.duration / 2;

        var name = 'lg_thumb_' + (new Date()).getTime() + '.png';
        var file = new File(Folder.temp.fsName + '/' + name);

        comp.saveFrameToPng(t, file);

        if (!file.exists) {
            return JSON.stringify({ ok: false, error: 'After Effects did not write the frame.' });
        }

        return JSON.stringify({
            ok: true,
            path: file.fsName.replace(/\\/g, '/'),
            width: comp.width,
            height: comp.height,
            time: t
        });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.message + ' line ' + e.line });
    }
}

/* Temp thumbnails accumulate. Sweep anything of ours older than a day, so a
   heavy capture session does not quietly leave a hundred 4K PNGs behind. */
function lgSweepTempThumbs() {
    try {
        var dir = Folder.temp;
        var files = dir.getFiles('lg_thumb_*.png');
        var cutoff = (new Date()).getTime() - 24 * 60 * 60 * 1000;
        var removed = 0;
        for (var i = 0; i < files.length; i++) {
            try {
                if (files[i].modified && files[i].modified.getTime() < cutoff) {
                    files[i].remove();
                    removed++;
                }
            } catch (e) { }
        }
        return String(removed);
    } catch (e) { return '0'; }
}

/* ── APPLYING ────────────────────────────────────────────────────────

   Applying a preset is generateGradient() with the stored payload. The one
   thing worth handling here rather than in the panel is comp size: a preset
   captured in a 1080p comp and applied to a square one should still fill the
   frame, and every builder already takes w/h from the active comp, so this
   simply does not pass the old dimensions along.

   `replaceSelected` is the difference between "add another one" and "make
   the thing I have selected be this instead" — the second is what people
   actually want when they are auditioning presets, and without it the comp
   fills up with discarded attempts. */

function lgApplyPreset(payloadStr, replaceSelected) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return 'ERROR: No active composition.';

        var payload;
        try { payload = JSON.parse(payloadStr); }
        catch (e) { return 'ERROR: That preset could not be read.'; }

        /* Dimensions are never carried by a preset — the comp decides. Strip
           anything stale that a hand-edited file might carry in. */
        delete payload.width;
        delete payload.height;
        delete payload.duration;

        if (replaceSelected === true || replaceSelected === 'true') {
            app.beginUndoGroup('Replace Gradient');
            try {
                var found = lgFindStampedIn(comp, 0, []);
                for (var i = 0; i < found.length; i++) {
                    if (found[i].layer.selected && found[i].comp === comp) {
                        try { found[i].layer.remove(); } catch (e) { }
                        break;
                    }
                }
            } catch (e) { }
            app.endUndoGroup();
        }

        return generateGradient(JSON.stringify(payload));
    } catch (e) {
        return 'ERROR: ' + e.message + ' line ' + e.line;
    }
}

/* Apply a palette preset to whatever gradient is selected, without rebuilding
   it. This is the fast path — recolouring a built gradient is the single most
   common edit, and rebuilding for it throws away any hand-tweaking that has
   happened since. */
function lgApplyPalette(colorsStr) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return 'ERROR: No active composition.';
        if (typeof updateLiveColors !== 'function') return 'ERROR: The panel is out of date \u2014 reopen it.';
        updateLiveColors(colorsStr);
        return 'Recoloured.';
    } catch (e) {
        return 'ERROR: ' + e.message + ' line ' + e.line;
    }
}

/* Reveal the data folder in Explorer or Finder. Small thing; it is the
   difference between "your presets are on disk somewhere" and a user who can
   actually go and copy them to another machine. */
function lgRevealFolder(path) {
    try {
        var f = new Folder(path);
        if (!f.exists) return 'ERROR: That folder does not exist yet.';
        f.execute();
        return 'ok';
    } catch (e) {
        return 'ERROR: ' + e.message;
    }
}
