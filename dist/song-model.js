(function (root) {
  'use strict';
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const durations = { 1: 4, 2: 2, 4: 1, 8: 0.5, 16: 0.25 };
  function parseToken(token) {
    const match = /^([A-Ga-g])([#b]?)([0-8])(?:\/(1|2|4|8|16)(\.?)?)?$/.exec(token);
    const rest = /^R(?:\/(1|2|4|8|16)(\.?)?)?$/i.exec(token);
    if (!match && !rest) throw new Error('Use notes like C4, F#4/8, Bb3/2 or a rest R/4.');
    const denominator = Number(match ? match[4] || 4 : rest[1] || 4);
    const dotted = Boolean(match ? match[5] : rest[2]);
    const beats = durations[denominator] * (dotted ? 1.5 : 1);
    const vfDuration = ({ 1: 'w', 2: 'h', 4: 'q', 8: '8', 16: '16' })[denominator];
    if (rest) return { token, rest: true, beats, denominator, dotted, vfDuration };
    const letter = match[1].toUpperCase(), accidental = match[2], octave = Number(match[3]);
    const midi = (octave + 1) * 12 + semitones[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    if (midi < 21 || midi > 108) throw new Error('Choose a note within the piano range A0–C8.');
    return { token, rest: false, midi, letter, accidental, octave, key: letter.toLowerCase() + accidental + '/' + octave,
      beats, denominator, dotted, vfDuration };
  }
  function parseBars(texts, beatsPerBar = 4) {
    if (![2, 3, 4].includes(Number(beatsPerBar))) throw new Error('Choose 2/4, 3/4 or 4/4 time.');
    if (!Array.isArray(texts) || !texts.length) throw new Error('A song needs at least one bar.');
    let offset = 0, eventId = 0;
    const errors = [], bars = [];
    texts.forEach((text, i) => {
      const tokens = text.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) { errors.push('Bar ' + (i + 1) + ': enter the notes or rests.'); bars.push([]); return; }
      if (tokens.length > 64) { errors.push('Bar ' + (i + 1) + ': too many notes.'); bars.push([]); return; }
      const bar = [];
      try {
        for (const token of tokens) {
          const event = parseToken(token); event.id = eventId++; event.bar = i;
          event.start = offset; offset += event.beats; bar.push(event);
        }
        const count = bar.reduce((sum, e) => sum + e.beats, 0);
        if (Math.abs(count - beatsPerBar) > 0.0001)
          errors.push('Bar ' + (i + 1) + ': ' + count + ' of ' + beatsPerBar + ' beats. ' + (count < beatsPerBar ? 'Add notes or rests.' : 'Remove or shorten a note.'));
      } catch (e) { errors.push('Bar ' + (i + 1) + ': ' + e.message); }
      bars.push(bar);
    });
    return { bars, events: bars.flat(), errors, valid: errors.length === 0, totalBeats: offset, beatsPerBar };
  }
  const api = Object.freeze({ parseToken, parseBars });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SongModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
