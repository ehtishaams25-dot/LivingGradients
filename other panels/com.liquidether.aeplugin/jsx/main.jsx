/**
 * Liquid Ether — ExtendScript Bridge
 * Runs inside After Effects. Called from the CEP panel via evalScript().
 */

/**
 * Returns the selected layer's position normalised to -1..1 range,
 * plus raw pixel coords so the panel can display them.
 */
function getLayerInfo() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No active composition" });
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            return JSON.stringify({ error: "No layer selected" });
        }

        var layer = sel[0];
        var time  = comp.time;
        var pos;

        // Try unified position property first
        try {
            var tg  = layer.property("ADBE Transform Group");
            var pp  = tg.property("ADBE Position");
            pos = pp.valueAtTime(time, false);
        } catch (e1) {
            // Separated-dimension fallback
            try {
                var tg2 = layer.property("ADBE Transform Group");
                var px  = tg2.property("ADBE Position_0").valueAtTime(time, false);
                var py  = tg2.property("ADBE Position_1").valueAtTime(time, false);
                pos = [px, py];
            } catch (e2) {
                return JSON.stringify({ error: "Cannot read position: " + e2.toString() });
            }
        }

        // Normalise: AE origin is top-left; map to -1..1 NDC (flip Y)
        var nx =  (pos[0] / comp.width)  * 2.0 - 1.0;
        var ny = -((pos[1] / comp.height) * 2.0 - 1.0);

        return JSON.stringify({
            x:          pos[0],
            y:          pos[1],
            nx:         nx,
            ny:         ny,
            compWidth:  comp.width,
            compHeight: comp.height,
            layerName:  layer.name,
            time:       time
        });

    } catch (e) {
        return JSON.stringify({ error: e.toString() });
    }
}

/**
 * Returns basic info about the active comp (used for status display).
 */
function getCompInfo() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ error: "No active composition" });
        }
        return JSON.stringify({
            name:      comp.name,
            width:     comp.width,
            height:    comp.height,
            frameRate: comp.frameRate,
            duration:  comp.duration
        });
    } catch (e) {
        return JSON.stringify({ error: e.toString() });
    }
}
