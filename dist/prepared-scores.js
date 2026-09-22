(function(root) {
  'use strict';
  // Manually transcribed from the exact photograph shared by the teacher.
  // This is NOT optical music recognition. A byte hash prevents attaching
  // these notes to another upload (even one with the same filename).
  const score = Object.freeze({
    sha256: '571e642b0d45a1d87e0794e6dda16d8f30991e6030a20a66f4f94e86bb6597d5',
    title: 'Your telephone melody', clef: 'treble', beatsPerBar: 4,
    bars: Object.freeze([
      'E4 E4 G4/2', 'C4 E4 G4/2', 'F4/2 E4/2', 'D4/1',
      'D4 D4 F4/2', 'D4 D4 F4/2', 'E4/2 F4/2', 'G4/1',
      'E4 E4 G4/2', 'C4 E4 G4/2', 'F4/2 E4/2', 'D4/1',
      'D4 D4 F4/2', 'D4 D4 F4/2', 'E4/2 D4/2', 'C4/1'
    ])
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = [score];
  else root.PreparedScores = [score];
})(typeof window !== 'undefined' ? window : globalThis);
