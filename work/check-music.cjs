const assert = require('node:assert/strict');
const M = require('../dist/music-model.js');
const VF = require('../dist/vendor/vexflow.js').Flow;
assert.equal(M.notes.length, 88);
assert.equal(M.notes.filter(n => !n.black).length, 52);
assert.equal(M.notes.filter(n => n.black).length, 36);
assert.equal(M.notes[0].id, 'A0');
assert.equal(M.notes.at(-1).id, 'C8');
assert.equal(M.note(69).frequency, 440);
assert.ok(Math.abs(M.note(60).frequency - 261.6255653) < 0.00001);
assert.ok(Math.abs(M.note(68).frequency - 415.3046976) < 0.00001);
for (const n of M.notes) {
  assert.ok(Number.isFinite(n.frequency) && n.frequency > 0);
  if (n.midi < 108) assert.ok(M.note(n.midi + 1).frequency > n.frequency);
  if (n.midi <= 96) assert.ok(Math.abs(M.note(n.midi + 12).frequency / n.frequency - 2) < 1e-12);
}
// Expected staff positions: treble bottom line E4, bass bottom line G2.
// VexFlow's staff is at y=65..105 with 10 px line spacing in this viewBox.
const expected = {
  treble: [['C4',115,1],['D4',110,1],['E4',105,1],['F4',100,1],['G4',95,1],['A4',90,1],['B4',85,-1],['C5',80,-1],['D5',75,-1],['E5',70,-1],['F5',65,-1]],
  bass: [['C3',90,1],['D3',85,-1],['E3',80,-1],['F3',75,-1],['G3',70,-1],['A3',65,-1],['B3',60,-1],['C4',55,-1]]
};
for (const [clef, cases] of Object.entries(expected)) {
  const stave = new VF.Stave(20,25,320).addClef(clef);
  assert.equal(stave.getYForLine(0),65);
  assert.equal(stave.getYForLine(4),105);
  assert.equal(M.ranges[clef].length, cases.length);
  for (const [id,y,stem] of cases) {
    const n = M.ranges[clef].find(n => n.id === id); assert.ok(n, id);
    const rendered = new VF.StaveNote({clef,keys:[n.key],duration:'q',auto_stem:true}).setStave(stave);
    assert.equal(rendered.getYs()[0], y, clef + ' ' + id);
    assert.equal(rendered.getStemDirection(), stem, clef + ' ' + id + ' stem');
  }
}
console.log('PASS: all 88 pitches, 52/36 key split, G-sharp, octaves, and all 19 quiz-note positions and stem directions.');
