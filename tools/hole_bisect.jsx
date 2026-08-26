/* ============================================================
   HOLE_BISECT.JSX — which effect punches the hole?

   hole_probe.jsx dumped every parameter and every displacement came in under
   its overhang budget, so on paper nothing should tear. It tears anyway. The
   probe cannot see alpha, and alpha is the whole question.

   So this stops reasoning about it and renders it.

   Pick the layer that shows the hole (Foil Metal, Liquid Chrome Metal, and so
   on) and run this. It walks the effect stack from the top: first frame with
   only effect 1 live, then 1-2, then 1-3, all the way down, saving a PNG at
   every step. The first image with a hole in it names the effect that made it,
   with no deduction involved.

   Frames land in tools/bisect/ as 01_<effect name>.png, 02_..., in order.

   Everything is restored afterwards — the enabled state of every effect is
   recorded up front and put back in a finally block, so a cancelled or failed
   run does not leave the layer half switched off.

   File > Scripts > Run Script File... > tools/hole_bisect.jsx
   ============================================================ */

(function () {

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert('Open the composition that shows the hole, then run this again.');
        return;
    }

    var layer = null;
    if (comp.selectedLayers.length === 1) {
        layer = comp.selectedLayers[0];
    } else {
        /* Nothing selected is the ordinary state, so fall back to the first
           layer that is actually visible rather than giving up. */
        for (var i = 1; i <= comp.numLayers; i++) {
            try {
                if (comp.layer(i).enabled) { layer = comp.layer(i); break; }
            } catch (e) { }
        }
    }
    if (!layer) {
        alert('Select the layer that shows the hole, then run this again.');
        return;
    }

    var fx = null;
    try { fx = layer.property('Effects'); } catch (e) { }
    if (!fx || fx.numProperties === 0) {
        alert('"' + layer.name + '" has no effects on it.\n\n' +
              'If the hole is on this layer it is coming from the layer\'s own ' +
              'source — most likely a precomp. Open that precomp, select the ' +
              'layer inside it, and run this again.');
        return;
    }

    var n = fx.numProperties;

    /* Record before touching anything. */
    var was = [], names = [];
    for (var k = 1; k <= n; k++) {
        var e = fx.property(k);
        names.push(e.name);
        try { was.push(e.enabled); } catch (err) { was.push(true); }
    }

    var dir = new Folder(File($.fileName).parent.fsName + '/bisect');
    if (!dir.exists) dir.create();

    /* Mid-timeline rather than frame zero: the evolution expressions have had
       time to run, and the holes were never visible on the first frame. */
    var t = comp.duration / 2;

    var written = [];
    var failed = null;

    try {
        for (var step = 0; step <= n; step++) {
            /* `&& was[j - 1]` matters. Some effects are switched off by the
               build on purpose — Metal Flow is legacy cleanup that a current
               layer must never render — and switching them on to bisect
               changes the picture being diagnosed. An effect that started
               disabled stays disabled at every step. */
            for (var j = 1; j <= n; j++) {
                try { fx.property(j).enabled = (j <= step) && was[j - 1]; } catch (err) { }
            }

            var label = (step === 0)
                ? '00_no_effects'
                : (step < 10 ? '0' + step : String(step)) + '_' + safeName(names[step - 1]);

            var file = new File(dir.fsName + '/' + label + '.png');
            try {
                comp.saveFrameToPng(t, file);
                written.push(label + '.png');
            } catch (err) {
                failed = 'Could not save ' + label + ': ' + err.toString();
                break;
            }
        }
    } finally {
        /* Put every switch back exactly as it was, whatever happened above. */
        for (var r = 1; r <= n; r++) {
            try { fx.property(r).enabled = was[r - 1]; } catch (err) { }
        }
    }

    function safeName(s) {
        return String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    var msg = 'Layer: ' + layer.name + '  (' + n + ' effects)\n' +
              'Rendered at ' + Math.round(t * 100) / 100 + 's\n\n' +
              written.length + ' frames written to:\n' + dir.fsName + '\n\n' +
              'Open them in order. The first one with a hole in it is the ' +
              'effect named in that filename.';
    if (failed) msg += '\n\nStopped early: ' + failed;

    alert(msg);
    dir.execute();

})();
