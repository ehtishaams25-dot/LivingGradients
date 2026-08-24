/* ANIMAL PRINTS — does the threshold land where the slider says?
 *
 * Fractal Noise's output is exactly
 *     out = clip(0.5 + (v - 0.5) * contrast/100 + brightness/100)
 * and CC Toner in Pentone mode switches from the coat stop to the marking
 * stop at a known point in that output range. So "what fraction of the frame
 * is marking" is arithmetic over the distribution of v, and the only unknown
 * is the distribution itself.
 *
 * That unknown is the whole point. Fractal Type 1 (Basic) is symmetric about
 * mid-grey by construction. The turbulent family is not — it is built on
 * folded noise and its mean sits above the middle, by an amount this file
 * cannot know exactly. So the test is not "what is the mean" but "how much
 * does the answer move when the mean moves":
 *
 *   a build that is correct only at one particular mean is a build that will
 *   come out one flat colour on any field whose mean is elsewhere,
 *
 * which is what the old settings were, and what "they all render black" is.
 * The sweep below shows how each configuration behaves across the whole
 * plausible range instead of at one guessed value.
 */

function field(mean, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < 8; k++) s += Math.random();
    out.push(mean + (s / 8 - 0.5) * 1.0);     // ~N(mean, 0.10)
  }
  return out;
}

/* Share of the frame that lands past the coat/marking switch. */
function coverage(v, contrast, brightness, mid) {
  let hit = 0;
  for (const x of v) {
    let o = 0.5 + (x - 0.5) * contrast / 100 + brightness / 100;
    if (o > 1) o = 1; else if (o < 0) o = 0;
    if (o > mid) hit++;
  }
  return 100 * hit / v.length;
}

function bias(cov, contrast, mid) {
  return (mid - 0.5) * 100 - (0.5 - cov / 100) * 0.55 * contrast;
}

const MEANS = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75];
const N = 120000;
const fields = MEANS.map(mu => field(mu, N));

function row(label, contrast, brightness, mid, want) {
  const cells = fields.map(v => coverage(v, contrast, brightness, mid).toFixed(0).padStart(6));
  const got = cells.map(c => parseFloat(c));
  const spread = Math.max.apply(null, got) - Math.min.apply(null, got);
  console.log(label.padEnd(30) + cells.join('') +
              '   want ' + String(want).padStart(3) + '%' +
              '   spread ' + spread.toFixed(0).padStart(3) + '%');
}

console.log('Marking coverage (% of frame), for a field whose mean is:');
console.log(' '.repeat(30) + MEANS.map(m => m.toFixed(2).padStart(6)).join(''));

console.log('\nBEFORE — contrast pinned at 400, brightness picked by hand:');
row('  Tiger    c=400 b=-15', 400, -15, 0.625, '?');
row('  Zebra    c=400 b=0',   400,   0, 0.625, '?');
row('  Cow      c=400 b=0',   400,   0, 0.625, '?');

console.log('\nAFTER — Basic noise, brightness from lgPrintBias:');
row('  Tiger    coverage 34', 340, bias(34, 340, 0.625), 0.625, 34);
row('  Zebra    coverage 45', 400, bias(45, 400, 0.625), 0.625, 45);
row('  Cow      coverage 42', 400, bias(42, 400, 0.625), 0.625, 42);
row('  Leopard  coverage 30', 200, bias(30, 200, 0.375), 0.375, 30);

console.log('\nThe left-hand column is the only one the new numbers are aimed at,');
console.log('because Basic noise is symmetric and its mean IS 0.50. The row is');
console.log('printed across the sweep to show the cost of being wrong about it.');
