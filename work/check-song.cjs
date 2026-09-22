const assert=require('node:assert/strict');
const song=require('../dist/song-model.js');
const VF=require('../dist/vendor/vexflow.js').Flow;
assert.equal(song.parseToken('F#4/8').midi,66);
assert.equal(song.parseToken('Bb3/2').midi,58);
assert.equal(song.parseToken('C4/4.').beats,1.5);
assert.equal(song.parseToken('R/2').rest,true);
assert.equal(song.parseToken('R/2').beats,2);
assert.throws(()=>song.parseToken('C4<script>'));
assert.throws(()=>song.parseToken('H4'));
assert.throws(()=>song.parseToken('C0'));
assert.throws(()=>song.parseToken('C#8'));
assert.throws(()=>song.parseToken('C4/3'));
const example=song.parseBars(['C4 D4 E4 C4','C4 D4 E4 C4','E4 F4 G4/2','E4 F4 G4/2']);
assert.equal(example.valid,true);assert.equal(example.totalBeats,16);
assert.equal(example.events[8].start,8);assert.equal(example.events[10].beats,2);
assert.equal(song.parseBars(['C4','C4','C4','C4']).valid,false);
assert.equal(song.parseBars(['R/1','R/1','R/1','R/1']).valid,true);
assert.equal(song.parseBars(['C4/2.','D4/2.','E4/2.','F4/2.'],3).valid,true);
const mixed=song.parseBars(['C4/4. D4/8 E4/4 R/4','F#4/8 F4/8 Bb4/2 R/4','C4/16 D4/16 E4/16 F4/16 G4/2.','R/1']);
assert.equal(mixed.valid,true);
for(const bar of mixed.bars){
  const notes=bar.map(e=>{const n=new VF.StaveNote({keys:[e.rest?'b/4':e.key],duration:e.vfDuration+(e.dotted?'d':'')+(e.rest?'r':''),auto_stem:true});if(e.dotted)VF.Dot.buildAndAttach([n],{all:true});return n;});
  const v=new VF.Voice({num_beats:4,beat_value:4}).addTickables(notes);
  assert.ok(v.isComplete(),'VexFlow bar duration must match the parser');
}
assert.equal(song.parseBars(['C4/1']).valid,true);
assert.equal(song.parseBars(Array(17).fill('R/1')).totalBeats,68);
assert.throws(()=>song.parseBars([]));
const prepared=require('../dist/prepared-scores.js')[0];
const telephone=song.parseBars(prepared.bars,prepared.beatsPerBar);
assert.equal(telephone.valid,true);assert.equal(telephone.bars.length,16);
assert.equal(telephone.events.length,36);assert.equal(telephone.totalBeats,64);
assert.equal(telephone.events[0].midi,64);assert.equal(telephone.events.at(-1).midi,60);
assert.equal(telephone.events.at(-1).start,60);assert.equal(telephone.events.at(-1).beats,4);
for(const bar of telephone.bars){
  const notes=bar.map(e=>new VF.StaveNote({clef:prepared.clef,keys:[e.key],duration:e.vfDuration}));
  assert.ok(new VF.Voice({num_beats:4,beat_value:4}).addTickables(notes).isComplete());
}
console.log('PASS: variable-length songs, 16-bar photo transcription (36 notes / 64 beats), accidentals, rests, dotted notes, timing offsets, invalid inputs, and VexFlow rhythm totals.');
