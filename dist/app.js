'use strict';
const model = PianoModel;
const $ = id => document.getElementById(id);
const keyWidth = 48;
const keys = new Map();
let clef = 'treble', current = model.note(60), points = 0, solved = false, revealed = false;
let context, soundOn = true, noteAnchor = null, drawnNote = null;
let demoRunning = false, demoTimer = null, dropTimers = new Set(), animationFrame = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function solfege(note) { return note.name === 'B' ? $('syllable').value : note.solfege; }
function description(note) { return note.id + (solfege(note) ? ' · ' + solfege(note) : '') + (note.midi === 60 ? ' · Middle C' : ''); }
function status(text) { $('status').textContent = text; }

async function readyAudio() {
  if (!soundOn) return false;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio unavailable');
    context ||= new Audio();
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio paused');
    $('soundStatus').textContent = '';
    return true;
  } catch (_) {
    $('soundStatus').textContent = 'Sound could not start. Try Sound on, or open this page in your browser.';
    return false;
  }
}
async function play(note) {
  if (!await readyAudio()) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator(), envelope = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(note.frequency, now);
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.12, now + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  oscillator.connect(envelope).connect(context.destination);
  oscillator.start(now); oscillator.stop(now + 0.9);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

function buildKeyboard() {
  const host = $('keyboard'); host.replaceChildren(); keys.clear();
  let whiteCount = 0;
  for (const note of model.notes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key ' + (note.black ? 'black' : 'white') + (note.midi === 60 ? ' middle' : '');
    button.dataset.midi = note.midi;
    button.setAttribute('aria-label', description(note));
    if (note.black) {
      button.style.left = (whiteCount * keyWidth - 15) + 'px';
      button.textContent = note.name;
    } else {
      button.innerHTML = '<span>' + note.id + '<small>' + solfege(note) + '</small></span>' +
        (note.midi === 60 ? '<span class="middle-label">Middle C</span>' : '');
      whiteCount++;
    }
    button.addEventListener('click', () => pressKey(note));
    host.appendChild(button); keys.set(note.midi, button);
  }
}

function centreMiddleC() {
  const key = keys.get(60), scroller = $('keyScroll');
  scroller.scrollLeft = key.offsetLeft + key.offsetWidth / 2 - scroller.clientWidth / 2;
  queueBeam();
}

function engrave() {
  const host = $('notation'); host.replaceChildren();
  const VF = Vex.Flow;
  const renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG);
  renderer.resize(360, 140);
  const drawing = renderer.getContext(); drawing.setFillStyle('#282536'); drawing.setStrokeStyle('#282536');
  const stave = new VF.Stave(20, 25, 320);
  stave.setBegBarType(VF.Barline.type.NONE); stave.setEndBarType(VF.Barline.type.NONE);
  stave.addClef(clef).setContext(drawing).draw();
  drawnNote = new VF.StaveNote({ clef, keys: [current.key], duration: 'q', auto_stem: true });
  const voice = new VF.Voice({ num_beats: 1, beat_value: 4 }).addTickables([drawnNote]);
  new VF.Formatter().joinVoices([voice]).format([voice], 130);
  drawnNote.setStave(stave);
  drawnNote.getTickContext().setX(185);
  drawnNote.setContext(drawing).draw();
  noteAnchor = { x: drawnNote.getNoteHeadBeginX() + drawnNote.getGlyphProps().getWidth() / 2, y: drawnNote.getYs()[0] };
  const svg = host.querySelector('svg');
  svg.setAttribute('viewBox', '0 0 360 140');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.style.width = '100%'; svg.style.height = 'auto';
  host.setAttribute('aria-label', clef + ' clef, one quarter note' + (revealed ? ': ' + description(current) : ''));
  queueBeam();
}

function queueBeam() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(drawBeam);
}
function drawBeam() {
  if (window.SongPlayer?.active) { window.SongPlayer.drawBeam(); return; }
  const beam = $('beam');
  if (!revealed || !noteAnchor) { beam.setAttribute('hidden', ''); return; }
  const svg = $('notation').querySelector('svg'), key = keys.get(current.midi);
  if (!svg || !key) return;
  const surface = $('surface').getBoundingClientRect(), viewport = $('keyScroll').getBoundingClientRect();
  const rect = key.getBoundingClientRect();
  const endX = rect.left + rect.width / 2;
  if (endX < viewport.left || endX > viewport.right) { beam.setAttribute('hidden', ''); return; }
  const transform = svg.getScreenCTM();
  const p = new DOMPoint(noteAnchor.x, noteAnchor.y).matrixTransform(transform);
  const x1 = p.x - surface.left, y1 = p.y - surface.top;
  const x2 = endX - surface.left, y2 = rect.top + 116 - surface.top;
  beam.setAttribute('viewBox', `0 0 ${surface.width} ${surface.height}`);
  const bend = y1 + (y2 - y1) * 0.55;
  const path = `M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`;
  $('beamGlow').setAttribute('d', path); $('beamCore').setAttribute('d', path);
  for (const [id, x, y] of [['beamStart', x1, y1], ['beamEnd', x2, y2]]) {
    $(id).setAttribute('cx', x); $(id).setAttribute('cy', y);
  }
  beam.removeAttribute('hidden');
}

function clearEffects() {
  dropTimers.forEach(clearTimeout); dropTimers.clear();
  $('fallLane').replaceChildren();
  keys.forEach(key => key.classList.remove('answer', 'wrong', 'playing'));
  revealed = false; $('beam').setAttribute('hidden', '');
}
function keyCentre(note) { const key = keys.get(note.midi); return key.offsetLeft + key.offsetWidth / 2; }
function impact(note) {
  const lane = $('fallLane'), x = keyCentre(note);
  const key = keys.get(note.midi); key.classList.add('playing');
  const flash = document.createElement('span'); flash.className = 'impact'; flash.style.left = (x - 30) + 'px'; lane.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });
  if (!reducedMotion.matches) for (let i = 0; i < 12; i++) {
    const spark = document.createElement('span'); spark.className = 'spark'; spark.style.left = x + 'px';
    spark.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
    spark.style.setProperty('--dy', -(20 + Math.random() * 70) + 'px');
    lane.appendChild(spark); spark.addEventListener('animationend', () => spark.remove(), { once: true });
  }
  const timer = setTimeout(() => { key.classList.remove('playing'); dropTimers.delete(timer); }, 550); dropTimers.add(timer);
}
function drop(note) {
  readyAudio();
  if (reducedMotion.matches) { play(note); impact(note); return; }
  const block = document.createElement('span'); block.className = 'falling-note';
  block.style.left = (keyCentre(note) - 18) + 'px'; block.style.width = '36px';
  block.textContent = solfege(note) || note.name; $('fallLane').appendChild(block);
  block.addEventListener('animationend', () => { block.remove(); play(note); impact(note); }, { once: true });
}
function showAnswer() {
  revealed = true; keys.get(current.midi).classList.add('answer');
  $('notation').setAttribute('aria-label', clef + ' clef: ' + description(current));
  status('Follow the light: ' + description(current));
  // Scroll horizontally only when the answer is outside the visible piano.
  const key = keys.get(current.midi), scroller = $('keyScroll');
  if (key.offsetLeft < scroller.scrollLeft || key.offsetLeft + keyWidth > scroller.scrollLeft + scroller.clientWidth)
    scroller.scrollLeft = key.offsetLeft - scroller.clientWidth / 2 + keyWidth / 2;
  queueBeam(); drop(current);
}
function chooseNote(note = null) {
  clearEffects(); solved = false;
  const range = model.ranges[clef], options = range.filter(n => n.midi !== current.midi);
  current = note || options[Math.floor(Math.random() * options.length)];
  engrave(); status('Read the note, then tap its piano key.');
}
function pressKey(note) {
  if (window.SongPlayer?.active) { window.SongPlayer.pressKey(note); return; }
  play(note); impact(note);
  if (demoRunning) return;
  if (note.midi === current.midi) {
    if (!solved) { points++; $('points').textContent = points; solved = true; }
    revealed = true; keys.get(note.midi).classList.add('answer'); queueBeam();
    status('You found it! ' + description(note) + ' — try the next note.');
  } else {
    const key = keys.get(note.midi); key.classList.add('wrong');
    status('You played ' + description(note) + '. Try another key.');
    const timer = setTimeout(() => { key.classList.remove('wrong'); dropTimers.delete(timer); }, 450); dropTimers.add(timer);
  }
}
function stopDemo() {
  demoRunning = false; clearTimeout(demoTimer); clearEffects();
  $('demo').textContent = '▶ Watch Do–Do'; $('question').textContent = 'Find this note on the piano';
  for (const id of ['hint', 'next', 'hear']) $(id).disabled = false;
}
function startDemo() {
  if (demoRunning) { stopDemo(); chooseNote(model.note(60)); return; }
  demoRunning = true; readyAudio(); centreMiddleC();
  $('demo').textContent = '■ Stop'; $('question').textContent = 'Watch, listen, and sing';
  for (const id of ['hint', 'next', 'hear']) $(id).disabled = true;
  const sequence = clef === 'treble' ? [60,62,64,65,67,69,71,72] : [48,50,52,53,55,57,59,60];
  let index = 0;
  function tick() {
    if (!demoRunning) return;
    if (index === sequence.length) { stopDemo(); chooseNote(model.note(60)); status('Your turn! Find Middle C.'); return; }
    chooseNote(model.note(sequence[index++])); showAnswer();
    demoTimer = setTimeout(tick, 1500);
  }
  tick();
}

function initialise() {
  buildKeyboard();
  document.querySelectorAll('[data-clef]').forEach(button => button.addEventListener('click', () => {
    stopDemo(); clef = button.dataset.clef;
    document.querySelectorAll('[data-clef]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    chooseNote(model.note(60)); centreMiddleC();
  }));
  $('next').addEventListener('click', () => chooseNote());
  $('hint').addEventListener('click', showAnswer);
  $('hear').addEventListener('click', () => { play(current); status(soundOn ? 'Listen, then find the matching key.' : 'Sound is off. Turn it on to listen.'); });
  $('demo').addEventListener('click', startDemo);
  $('centre').addEventListener('click', centreMiddleC);
  $('sound').addEventListener('click', () => {
    window.SongPlayer?.stop();
    soundOn = !soundOn; $('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(soundOn));
    if (soundOn) play(model.note(60)); else if (context) context.suspend();
  });
  $('syllable').addEventListener('change', () => { buildKeyboard(); if (revealed) keys.get(current.midi).classList.add('answer'); queueBeam(); });
  $('keyScroll').addEventListener('scroll', queueBeam, { passive: true });
  window.addEventListener('resize', () => { centreMiddleC(); queueBeam(); });
  new ResizeObserver(queueBeam).observe($('surface'));
  chooseNote(model.note(60)); centreMiddleC();
}
try { initialise(); } catch (error) {
  console.error(error);
  status('The score could not load. Please refresh the page.');
}
window.PianoUI = { model, keys, readyAudio, play, impact, clearEffects, centreMiddleC, stopDemo, queueBeam,
  getContext: () => context, soundEnabled: () => soundOn, solfege, description };
