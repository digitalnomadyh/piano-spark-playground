(function (root) {
  'use strict';
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const syllables = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  function note(midi) {
    if (!Number.isInteger(midi) || midi < 21 || midi > 108) throw new RangeError('Outside piano range');
    const name = names[midi % 12], octave = Math.floor(midi / 12) - 1;
    return Object.freeze({ midi, name, octave, id: name + octave,
      key: name.toLowerCase().replace('♯', '#') + '/' + octave,
      frequency: 440 * 2 ** ((midi - 69) / 12), black: name.includes('♯'),
      solfege: syllables[name] || '' });
  }
  const notes = Object.freeze(Array.from({ length: 88 }, (_, i) => note(i + 21)));
  const ranges = Object.freeze({
    treble: Object.freeze(notes.filter(n => !n.black && n.midi >= 60 && n.midi <= 77)),
    bass: Object.freeze(notes.filter(n => !n.black && n.midi >= 48 && n.midi <= 60))
  });
  const model = Object.freeze({ note, notes, ranges });
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.PianoModel = model;
})(typeof window !== 'undefined' ? window : globalThis);
