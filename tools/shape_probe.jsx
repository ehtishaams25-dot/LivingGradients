/* =====================================================================
   LIVING GRADIENTS — SHAPE OPERATOR PROBE
   ---------------------------------------------------------------------
   Run once: File > Scripts > Run Script File… > this file.

   tools/effect_probe.jsx dumps LAYER EFFECTS. It cannot see shape layer
   operators, because those are not effects — they are properties added to
   a shape group's Contents, and they have their own matchNames and their
   own index order.

   That has never mattered, because until now the codebase used exactly
   two of them: Repeater and Round Corners. The Vector & Flat family needs
   Trim Paths, Offset Paths, Merge Paths, Wiggle Paths and Zig Zag, none
   of which has ever been written from this project, and one of which has
   a matchName that does not resemble its display name at all:

       Wiggle Paths      ADBE Vector Filter - Roughen
       Wiggle Transform  ADBE Vector Filter - Wiggler

   Those two are easy to swap and both apply cleanly, so a mix-up does not
   throw. It builds the wrong thing quietly, which is the failure mode
   this project has been bitten by most (see GRADIENT_QA_V23.md).

   OUTPUT: tools/shape_probe_report.txt — every operator, whether its
   matchName applies, and every property it exposes with index, display
   name, matchName and value type.

   IT CRASHED AFTER EFFECTS TWICE, AND THE SECOND TIME DISPROVED THE FIRST
   DIAGNOSIS. READ THIS BEFORE RUNNING IT AGAIN.

   Run 1 (2026-09-06 00:14) killed AE 26.0.0.67 outright. The stack said:

       extendscript -> Scripting -> AEGPDriver
         -> BEE_CmdAddToIndexedStreamGroup
           -> BEEp_CmdLayerLeaving
             -> TDB_StreamBase::GetDisplayName
       EXCEPTION_ACCESS_VIOLATION reading 0x1c0

   That version also pushed 100000 into every 1D property to find its clamp,
   the way tools/effect_probe.jsx does. Repeater > Copies at 100000 is an
   obviously terrible idea, so that was assumed to be the cause and the value
   probing was removed.

   Run 2, with every write gone, crashed the same way. So the writes were
   probably never the cause: BEE_CmdAddToIndexedStreamGroup is addProperty
   ITSELF, and GetDisplayName dereferencing null at offset 0x1c0 is a stream
   that has no name yet. Something in the OPERATORS list cannot be constructed
   by script in this context, and adding it takes the application down.

   WHICH ONE IS STILL UNKNOWN. Suspects, in order:

     ADBE Vector Shape - Group    "Path" — a bezier path with no path data
     ADBE Vector Filter - Merge   Merge Paths, which needs >1 path
     ADBE Vector Graphic - G-Fill Gradient Fill, whose Colors is NO_VALUE

   SO THIS FILE NOW REPORTS AS IT GOES.

   Every operator is written to the report and flushed to disk BEFORE the next
   one is attempted, and tools/shape_probe_progress.txt names the operator
   currently being tried. If After Effects dies, that file is the answer: it
   holds the name of the operator that killed it. One run, one fact, even when
   the run does not survive.

   Set $.global.LG_SHAPE_PROBE_SKIP to a comma-separated list of matchNames to
   exclude ones already known to be fatal, and run again to get past them.

   NO VALUE IS EVER WRITTEN, still — that part of the previous fix stands on
   its own merits. Shape operator parameters can generate geometry (Repeater >
   Copies), and everything this file is for is readable.

   Nothing here touches your comps. It makes one comp called LG SHAPE
   PROBE and deletes it again.
   ===================================================================== */

(function () {

    /* AN alert() AT THE END OF A SCRIPT IS FATAL UNATTENDED.

       A run driven through the CEP bridge cannot dismiss a modal, and After
       Effects will sit behind it until somebody clicks. tools/render_loops.jsx
       carries the same flag for the same reason. Hand-run from the Scripts
       menu this stays false and behaves normally; a driver sets

           $.global.LG_SHAPE_PROBE_QUIET = true;

       before evaluating the file, and reads the returned summary instead.

       $.fileName is empty when the source is evaluated as a string rather than
       as a file, so the output directory can be handed in the same way. */
    var QUIET = ($.global.LG_SHAPE_PROBE_QUIET === true);
    var ROOT  = $.global.LG_SHAPE_PROBE_ROOT || null;

    /* Display name, matchName. Ordered as the Add menu orders them, so the
       report can be read next to After Effects itself. */
    var OPERATORS = [
        /* paths */
        ['Rectangle',        'ADBE Vector Shape - Rect'],
        ['Ellipse',          'ADBE Vector Shape - Ellipse'],
        ['Polystar',         'ADBE Vector Shape - Star'],
        ['Path (bezier)',    'ADBE Vector Shape - Group'],

        /* paint */
        ['Fill',             'ADBE Vector Graphic - Fill'],
        ['Stroke',           'ADBE Vector Graphic - Stroke'],

        /* THE TWO THAT CANNOT BE SET FROM SCRIPT.

           Both apply. Neither's Colors property can be read or written:
           ADBE Vector Grad Colors is propertyValueType NO_VALUE. They are
           probed anyway so the report says so in this project's own words
           rather than leaving the next person to rediscover it — see
           VECTOR_GRADIENT_RESEARCH.md §2. */
        ['Gradient Fill',    'ADBE Vector Graphic - G-Fill'],
        ['Gradient Stroke',  'ADBE Vector Graphic - G-Stroke'],

        /* operators — the ones this family needs */
        ['Trim Paths',       'ADBE Vector Filter - Trim'],
        ['Offset Paths',     'ADBE Vector Filter - Offset'],
        ['Merge Paths',      'ADBE Vector Filter - Merge'],
        ['Wiggle Paths',     'ADBE Vector Filter - Roughen'],
        ['Zig Zag',          'ADBE Vector Filter - Zigzag'],
        ['Pucker & Bloat',   'ADBE Vector Filter - PuckerBloat'],
        ['Twist',            'ADBE Vector Filter - Twist'],
        ['Wiggle Transform', 'ADBE Vector Filter - Wiggler'],

        /* operators already in use, for a baseline */
        ['Repeater',         'ADBE Vector Filter - Repeater'],
        ['Round Corners',    'ADBE Vector Filter - RC']
    ];

    var REPORT = null;      /* set once the output directory is known */
    var PROGRESS = null;
    var pending = [];       /* buffered until the path is known, then flushed */

    /* Append and CLOSE, every time. ExtendScript's File has no flush, and a
       handle left open loses its buffer when the application dies — which is
       the exact case this is written for. */
    function emit(s) {
        pending.push(s === undefined ? '' : s);
        if (!REPORT) return;
        try {
            var f = new File(REPORT);
            f.encoding = 'UTF-8';
            f.open('a');
            for (var i = 0; i < pending.length; i++) f.writeln(pending[i]);
            f.close();
        } catch (e) { }
        pending = [];
    }

    /* The name of the operator about to be tried, overwritten each time. If
       After Effects does not come back, this file names what killed it. */
    function progress(s) {
        if (!PROGRESS) return;
        try {
            var f = new File(PROGRESS);
            f.encoding = 'UTF-8';
            f.open('w');
            f.write(s);
            f.close();
        } catch (e) { }
    }

    var lines = { push: function (s) { emit(s); } };

    function pad(s, n) {
        s = String(s);
        while (s.length < n) s += ' ';
        return s;
    }

    /* The CURRENT value, read and never written. On a freshly added operator
       this is its default, which is the more useful number anyway: it is what
       a builder inherits when it does not set the property at all. */
    function valueOf(p) {
        var v = null;
        try { v = p.value; } catch (e) { return '(unreadable)'; }
        if (v === null || v === undefined) return '';
        try {
            if (v.length !== undefined && typeof v !== 'string') {
                var parts = [], i;
                for (i = 0; i < v.length; i++) parts.push(Math.round(v[i] * 1000) / 1000);
                return '[' + parts.join(', ') + ']';
            }
            if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
            return String(v);
        } catch (e2) { return '(unreadable)'; }
    }

    function typeOf(p) {
        try {
            switch (p.propertyValueType) {
                case PropertyValueType.OneD:            return '1D';
                case PropertyValueType.TwoD:            return '2D';
                case PropertyValueType.TwoD_SPATIAL:    return '2D spatial';
                case PropertyValueType.ThreeD:          return '3D';
                case PropertyValueType.ThreeD_SPATIAL:  return '3D spatial';
                case PropertyValueType.COLOR:           return 'colour';
                case PropertyValueType.SHAPE:           return 'shape';
                case PropertyValueType.NO_VALUE:        return 'NO_VALUE  <-- not readable or writable from script';
                case PropertyValueType.CUSTOM_VALUE:    return 'CUSTOM    <-- not readable or writable from script';
                default:                                return 'group/none';
            }
        } catch (e) { return '?'; }
    }

    function dump(label, matchName, contents) {
        lines.push('');
        lines.push('### ' + label + '  {' + matchName + '}');

        var op = null;
        try { op = contents.addProperty(matchName); } catch (e) { op = null; }

        if (!op) {
            lines.push('    DOES NOT APPLY — addProperty threw. The matchName is wrong,');
            lines.push('    or this build of After Effects does not have it.');
            return false;
        }

        lines.push('    applies as: "' + op.name + '"');
        lines.push('    ' + pad('idx', 5) + pad('name', 26) + pad('matchName', 34) +
                   pad('type', 14) + 'default');
        lines.push('    ' + pad('', 5) + pad('', 26) + pad('', 34) + pad('', 14) + '---------');

        var n = 0;
        try { n = op.numProperties; } catch (e) { n = 0; }

        for (var i = 1; i <= n; i++) {
            var p = null;
            try { p = op.property(i); } catch (e) { continue; }
            if (!p) continue;

            var t = typeOf(p);
            var c = '';
            c = valueOf(p);

            lines.push('    ' + pad(i, 5) + pad(p.name, 26) +
                       pad(p.matchName || '', 34) + pad(t, 14) + c);

            /* Repeater's and Wiggle Transform's numbers live one level down,
               inside a Transform group, and that is where every value a
               builder actually wants to set lives. */
            if (t === 'group/none') {
                var m = 0;
                try { m = p.numProperties; } catch (e2) { m = 0; }
                for (var j = 1; j <= m; j++) {
                    var q = null;
                    try { q = p.property(j); } catch (e3) { continue; }
                    if (!q) continue;
                    var qt = typeOf(q);
                    lines.push('    ' + pad('  ' + i + '.' + j, 5) + pad('  ' + q.name, 26) +
                               pad(q.matchName || '', 34) + pad(qt, 14) +
                               valueOf(q));
                }
            }
        }

        try { op.remove(); } catch (e) { }
        return true;
    }

    app.beginUndoGroup('LG Shape Probe');
    var probeComp = null;

    try {
        /* THE OUTPUT PATH IS RESOLVED FIRST, NOT LAST.

           It used to be worked out just before the single write at the end,
           which meant a run that did not reach the end produced nothing at
           all. Two crashes, no report, no evidence. Resolve it now and every
           line lands on disk as it is produced. */
        var dir = ROOT;
        if (!dir) {
            try { dir = new File($.fileName).parent.fsName; } catch (e) { dir = null; }
        }
        if (!dir) throw new Error('no output directory: pass $.global.LG_SHAPE_PROBE_ROOT');

        REPORT   = dir + '/shape_probe_report.txt';
        PROGRESS = dir + '/shape_probe_progress.txt';
        try { var old = new File(REPORT); if (old.exists) old.remove(); } catch (e) { }
        progress('starting');

        lines.push('Living Gradients — shape operator probe');
        lines.push('AE version : ' + app.version);
        lines.push('Language   : ' + (app.isoLanguage || '?'));
        lines.push('Date       : ' + new Date().toString());
        lines.push('');
        lines.push('"default" is the value the property already had. NOTHING IS WRITTEN,');
        lines.push('deliberately — see the header. Shape operator parameters can build');
        lines.push('geometry, and probing one by setting it crashed After Effects once.');
        lines.push('');
        lines.push('An operator marked DOES NOT APPLY has a wrong matchName in this');
        lines.push('file, and probably in jsx/main.jsx too.');

        probeComp = app.project.items.addComp('LG SHAPE PROBE', 64, 64, 1, 1, 24);
        var shape = probeComp.layers.addShape();
        var group = shape.property('Contents').addProperty('ADBE Vector Group');
        var contents = group.property('Contents');

        /* A PATH FIRST, AND A SMALL ONE.

           Trim Paths and Merge Paths operate on the paths above them in the
           group. Added to an empty group they have nothing to act on, which is
           the other well-known way to take After Effects down from a script.
           One 8px rectangle costs nothing and means every operator below is
           applied to a group that makes sense. */
        try {
            var seedPath = contents.addProperty('ADBE Vector Shape - Rect');
            seedPath.property('Size').setValue([8, 8]);
            contents.addProperty('ADBE Vector Graphic - Fill');
        } catch (e) {
            lines.push('');
            lines.push('WARNING: could not seed a path into the probe group (' + e.toString() + ').');
            lines.push('Operators that need geometry may misreport below.');
        }

        /* Known-fatal operators, handed in from outside so this file does not
           have to be edited between runs:
               $.global.LG_SHAPE_PROBE_SKIP = 'ADBE Vector Filter - Merge,...' */
        var SKIP = {}, sk;
        if ($.global.LG_SHAPE_PROBE_SKIP) {
            sk = String($.global.LG_SHAPE_PROBE_SKIP).split(',');
            for (var s0 = 0; s0 < sk.length; s0++) {
                SKIP[sk[s0].replace(/^\s+|\s+$/g, '')] = true;
            }
        }

        var failed = [], skipped = [];
        for (var i = 0; i < OPERATORS.length; i++) {
            if (SKIP[OPERATORS[i][1]]) {
                skipped.push(OPERATORS[i][0]);
                lines.push('');
                lines.push('### ' + OPERATORS[i][0] + '  {' + OPERATORS[i][1] + '}');
                lines.push('    SKIPPED by LG_SHAPE_PROBE_SKIP — known to be fatal.');
                continue;
            }
            /* Named BEFORE the attempt. If After Effects does not survive the
               next line, this file is the whole finding. */
            progress('CRASHED WHILE ADDING: ' + OPERATORS[i][0] + '  (' + OPERATORS[i][1] + ')');
            if (!dump(OPERATORS[i][0], OPERATORS[i][1], contents)) {
                failed.push(OPERATORS[i][0] + '  (' + OPERATORS[i][1] + ')');
            }
            progress('survived ' + (i + 1) + '/' + OPERATORS.length + ': ' + OPERATORS[i][0]);
        }
        progress('COMPLETED all ' + OPERATORS.length);

        lines.push('');
        lines.push('');
        lines.push('=== SUMMARY ===');
        if (skipped.length) lines.push('skipped as known-fatal: ' + skipped.join(', '));
        if (failed.length) {
            lines.push(failed.length + ' operator(s) did not apply:');
            for (var f = 0; f < failed.length; f++) lines.push('  ' + failed[f]);
        } else {
            lines.push('All ' + OPERATORS.length + ' operators applied.');
        }

        try { probeComp.remove(); } catch (e) { }

        app.endUndoGroup();

        var summary = 'Shape probe done. ' +
                      (OPERATORS.length - failed.length - skipped.length) + '/' +
                      (OPERATORS.length - skipped.length) +
                      ' applied. Report: ' + REPORT +
                      (failed.length ? ' | DID NOT APPLY: ' + failed.join('; ') : '');

        if (!QUIET) alert(summary.replace(/ \| /g, '\n\n'));
        return summary;

    } catch (err) {
        try { if (probeComp) probeComp.remove(); } catch (e) { }
        try { app.endUndoGroup(); } catch (e) { }
        var msg = 'Shape probe FAILED: ' + err.toString() + (err.line ? ' (line ' + err.line + ')' : '');
        try { emit(''); emit('=== THREW ==='); emit(msg); } catch (e2) { }
        progress(msg);
        if (!QUIET) alert(msg);
        return msg;
    }
})();
