(function () {
  'use strict';
  const ui = window.PianoUI, byId = id => document.getElementById(id);
  const previewCanvas = byId('sourceCanvas');
  let active = false, score = null, scorePage = 0, parsed = null, engraving = new Map();
  let playing = false, frameId = 0, clockStart = 0, audioClock = false, secondsPerBeat = 0.75, highlighted = -1;
  let audioNodes = [], blocks = new Map(), sourcePdf = null, sourceImage = null, pageNumber = 1, rotation = 0;
  let uploadGeneration = 0, renderGeneration = 0, pdfRenderTask = null, workerUrl = null;
  let currentBeam = null, playbackGeneration = 0;

  function mode(song) {
    stop(); ui.stopDemo(); active = song;
    byId('practiceCard').hidden = song; byId('songCard').hidden = !song;
    byId('practiceMode').setAttribute('aria-pressed', String(!song));
    byId('songMode').setAttribute('aria-pressed', String(song));
    byId('demo').hidden = song;
    ui.centreMiddleC();
    if (song && parsed?.valid) renderSong();
  }
  function pressKey(note) {
    ui.play(note); ui.impact(note);
  }
  function loadScore(prepared) {
    stop(); score = prepared; scorePage = 0;
    parsed = score ? SongModel.parseBars(score.bars, score.beatsPerBar) : null;
    byId('playSong').disabled = !parsed?.valid;
    byId('scoreNavigation').hidden = !parsed?.valid;
    byId('songNotation').replaceChildren(); engraving.clear();
    byId('songValidation').textContent = score ?
      'Ready: ' + parsed.bars.length + ' bars. Manually transcribed from the exact photo you shared, not automatically recognised. Melody and rhythm only; please check against the original.' :
      'Preview only. This score needs transcription before it can play. Automatic photo/PDF music recognition is not connected yet.';
    if (parsed?.valid) {
      try { renderSong(); } catch (error) {
        console.error(error); parsed.valid = false; byId('playSong').disabled = true;
        byId('songValidation').textContent = 'The playable notation could not be displayed. You can still view the original score.';
      }
    }
  }

  function renderSong() {
    const VF = Vex.Flow, host = byId('songNotation'), songClef = score.clef;
    host.replaceChildren(); engraving.clear();
    const firstBar = scorePage * 4, visibleBars = parsed.bars.slice(firstBar, firstBar + 4);
    byId('barsLabel').textContent = 'Bars ' + (firstBar+1) + '–' + (firstBar+visibleBars.length) + ' of ' + parsed.bars.length;
    byId('previousBars').disabled = playing || scorePage === 0;
    byId('nextBars').disabled = playing || firstBar + visibleBars.length >= parsed.bars.length;
    const barWidth = 240, width = barWidth * 4 + 36;
    // One continuous four-bar system, with space for ledger lines.
    const diatonic = e => e.octave * 7 + 'CDEFGAB'.indexOf(e.letter);
    const bottom = songClef === 'treble' ? 4*7+2 : 2*7+4;
    const pitches = parsed.events.filter(e => !e.rest).map(diatonic);
    const high = Math.max(bottom + 8, ...pitches), low = Math.min(bottom, ...pitches);
    const above = Math.max(0, (high - bottom - 8) * 5), below = Math.max(0, (bottom - low) * 5);
    const height = 145 + above + below;
    const renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG); renderer.resize(width, height);
    const ctx = renderer.getContext(); ctx.setFillStyle('#292536'); ctx.setStrokeStyle('#292536');
    visibleBars.forEach((bar,localIndex) => {
      const index = firstBar + localIndex;
      const x = 18 + localIndex * barWidth, y = 20 + above;
      const stave = new VF.Stave(x,y,barWidth);
      if (localIndex === 0) stave.addClef(songClef);
      if (index === 0) stave.addTimeSignature(parsed.beatsPerBar + '/4');
      if (index === parsed.bars.length-1) stave.setEndBarType(VF.Barline.type.END);
      stave.setContext(ctx).draw();
      ctx.setFont('Arial',11,''); ctx.fillText(String(index+1),x+3,y+17);
      const accidentalState = new Map();
      const tickables = bar.map(event => {
        const duration = event.vfDuration + (event.dotted ? 'd' : '') + (event.rest ? 'r' : '');
        const note = new VF.StaveNote({ clef:songClef, keys:[event.rest ? (songClef==='treble'?'b/4':'d/3') : event.key], duration, auto_stem:true });
        if (event.dotted) VF.Dot.buildAndAttach([note], { all:true });
        if (!event.rest) {
          const pitchName = event.letter+event.octave, old = accidentalState.get(pitchName) || '';
          if (old !== event.accidental) note.addModifier(new VF.Accidental(event.accidental || 'n'),0);
          accidentalState.set(pitchName,event.accidental);
        }
        note.setAttribute('id','song-note-' + event.id);
        return note;
      });
      const voice = new VF.Voice({num_beats:parsed.beatsPerBar,beat_value:4}).addTickables(tickables);
      const beams = VF.Beam.generateBeams(tickables,{groups:[new VF.Fraction(1,4)]});
      new VF.Formatter().joinVoices([voice]).format([voice],stave.getNoteEndX()-stave.getNoteStartX()-22);
      voice.draw(ctx,stave); beams.forEach(beam=>beam.setContext(ctx).draw());
      bar.forEach((event,i) => {
        const note = tickables[i];
        engraving.set(event.id,{event,note,x:note.getNoteHeadBeginX()+note.getGlyphProps().getWidth()/2,y:note.getYs()[0]});
      });
    });
    const svg = host.querySelector('svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.style.width='100%'; svg.style.height='auto'; svg.removeAttribute('width'); svg.removeAttribute('height');
    host.setAttribute('aria-label', byId('barsLabel').textContent + ' on one line, ' + songClef + ' melody in ' + parsed.beatsPerBar + '/4, manually transcribed from your photo');
  }

  function setHighlight(id) {
    if (highlighted === id) return;
    byId('songNotation').querySelectorAll('.current-song-note').forEach(n=>n.classList.remove('current-song-note'));
    ui.keys.forEach(k=>k.classList.remove('answer'));
    highlighted = id; currentBeam = null;
    const event = parsed?.events.find(e => e.id === id);
    if (event && Math.floor(event.bar/4) !== scorePage) {scorePage=Math.floor(event.bar/4);renderSong();}
    const entry = engraving.get(id);
    if (entry) {
      const element = byId('vf-song-note-'+id); if (element) element.classList.add('current-song-note');
      if (!entry.event.rest) {
        ui.keys.get(entry.event.midi).classList.add('answer'); currentBeam=entry;
        ui.impact(ui.model.note(entry.event.midi));
      }
      byId('songPosition').textContent = 'Bar ' + (entry.event.bar+1) + ' of ' + parsed.bars.length + (entry.event.rest ? ' · Rest' : ' · ' + ui.description(ui.model.note(entry.event.midi)));
    }
    ui.queueBeam();
  }
  function drawBeam() {
    const beam=byId('beam'), entry=currentBeam;
    if (!active || !entry) {beam.setAttribute('hidden','');return;}
    const key=ui.keys.get(entry.event.midi), svg=byId('songNotation').querySelector('svg');
    const rect=key.getBoundingClientRect(), viewport=byId('keyScroll').getBoundingClientRect(), box=byId('surface').getBoundingClientRect();
    const x=rect.left+rect.width/2;
    if (x<viewport.left || x>viewport.right) {beam.setAttribute('hidden','');return;}
    const p=new DOMPoint(entry.x,entry.y).matrixTransform(svg.getScreenCTM());
    const x1=p.x-box.left,y1=p.y-box.top,x2=x-box.left,y2=rect.top+116-box.top,bend=(y1+y2)/2;
    beam.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    const d=`M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`;
    byId('beamGlow').setAttribute('d',d);byId('beamCore').setAttribute('d',d);
    for(const [name,px,py] of [['beamStart',x1,y1],['beamEnd',x2,y2]]){byId(name).setAttribute('cx',px);byId(name).setAttribute('cy',py);}
    beam.removeAttribute('hidden');
  }
  function stop() {
    playing=false; playbackGeneration++; cancelAnimationFrame(frameId);
    for(const node of audioNodes){try{node.osc.stop();node.osc.disconnect();node.gain.disconnect();}catch(_){}}
    audioNodes=[];blocks.forEach(n=>n.remove());blocks.clear();
    ui.clearEffects();highlighted=-1;currentBeam=null;
    byId('songNotation').querySelectorAll('.current-song-note').forEach(n=>n.classList.remove('current-song-note'));
    byId('stopSong').disabled=true;byId('playSong').disabled=!parsed?.valid;
    byId('songPosition').textContent='';
    byId('previousBars').disabled = scorePage === 0;
    byId('nextBars').disabled = !parsed || (scorePage+1)*4 >= parsed.bars.length;
  }
  function scheduleAudio(start) {
    const ctx=ui.getContext();audioNodes=[];
    for(const event of parsed.events){
      if(event.rest)continue;
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=start+event.start*secondsPerBeat;
      const duration=event.beats*secondsPerBeat;
      oscillator.type='triangle';oscillator.frequency.setValueAtTime(ui.model.note(event.midi).frequency,t);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.1,t+.006);
      gain.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.03,duration*.94));
      oscillator.connect(gain).connect(ctx.destination);oscillator.start(t);oscillator.stop(t+duration);
      const record={osc:oscillator,gain};audioNodes.push(record);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
  }
  function nowSeconds(){return audioClock?ui.getContext().currentTime:performance.now()/1000;}
  async function start() {
    stop(); if(!parsed?.valid)return;
    const bpm=Number(byId('songTempo').value);
    if(!Number.isFinite(bpm)||bpm<30||bpm>180){byId('songPosition').textContent='Choose a tempo from 30 to 180.';return;}
    // Set the flag before awaiting audio so Stop or an edit cancels this request.
    const generation=playbackGeneration;
    playing=true;scorePage=0;renderSong();byId('playSong').disabled=true;byId('stopSong').disabled=false;
    byId('sourceDetails').open=false;
    audioClock=ui.soundEnabled()?await ui.readyAudio():false;
    if(!playing || generation!==playbackGeneration)return;
    secondsPerBeat=60/bpm;clockStart=nowSeconds()+.95;
    if(audioClock)scheduleAudio(clockStart);
    byId('songPosition').textContent='Get ready…';
    frameId=requestAnimationFrame(tick);
  }
  function tick(){
    if(!playing)return;
    const elapsed=nowSeconds()-clockStart,total=parsed.totalBeats*secondsPerBeat;
    if(elapsed>=total){const repeat=byId('songRepeat').checked;stop();if(repeat)start();else byId('songPosition').textContent='Finished · play again whenever you like.';return;}
    let currentEvent=-1;
    for(const event of parsed.events){
      const start=event.start*secondsPerBeat,end=(event.start+event.beats)*secondsPerBeat;
      if(elapsed>=start&&elapsed<end)currentEvent=event.id;
      if(event.rest)continue;
      const remaining=start-elapsed;
      if(remaining>0&&remaining<=.9&&!reducedMotion.matches){
        let block=blocks.get(event.id);
        if(!block){block=document.createElement('span');block.className='song-falling-note';block.textContent=ui.solfege(ui.model.note(event.midi))||ui.model.note(event.midi).name;byId('fallLane').appendChild(block);blocks.set(event.id,block);}
        const key=ui.keys.get(event.midi),height=Math.max(18,Math.min(60,event.beats*secondsPerBeat*45));
        block.style.left=(key.offsetLeft+key.offsetWidth/2-17)+'px';block.style.width='34px';block.style.height=height+'px';
        block.style.top=((1-remaining/.9)*byId('fallLane').clientHeight-height)+'px';
      }else if(blocks.has(event.id)){blocks.get(event.id).remove();blocks.delete(event.id);}
    }
    setHighlight(currentEvent);frameId=requestAnimationFrame(tick);
  }

  async function cleanSource(){
    renderGeneration++;if(pdfRenderTask){pdfRenderTask.cancel();pdfRenderTask=null;}
    if(sourcePdf){const p=sourcePdf;sourcePdf=null;await p.destroy();}
    sourceImage=null;
    byId('sourceViewport').hidden=true;byId('sourceControls').hidden=true;
    previewCanvas.width=1;previewCanvas.height=1;
  }
  async function renderSource(){
    const revision=++renderGeneration;
    if(pdfRenderTask){pdfRenderTask.cancel();pdfRenderTask=null;}
    byId('sourceViewport').hidden=false;byId('sourceControls').hidden=false;
    byId('previousPage').hidden=!sourcePdf;byId('nextPage').hidden=!sourcePdf;
    byId('previousPage').disabled=pageNumber<=1;byId('nextPage').disabled=!sourcePdf||pageNumber>=sourcePdf.numPages;
    byId('pageLabel').textContent=sourcePdf?'Page '+pageNumber+' of '+sourcePdf.numPages:'Photo';
    try{
      if(sourcePdf){
        const page=await sourcePdf.getPage(pageNumber);if(revision!==renderGeneration)return;
        const natural=page.getViewport({scale:1,rotation:(page.rotate+rotation)%360});
        const viewport=page.getViewport({scale:Math.min(2,1400/Math.max(natural.width,natural.height)),rotation:(page.rotate+rotation)%360});
        // Render off-screen to avoid concurrent page requests reusing a busy canvas.
        const buffer=document.createElement('canvas');buffer.width=Math.ceil(viewport.width);buffer.height=Math.ceil(viewport.height);
        pdfRenderTask=page.render({canvasContext:buffer.getContext('2d'),viewport});await pdfRenderTask.promise;
        if(revision!==renderGeneration)return;
        previewCanvas.width=buffer.width;previewCanvas.height=buffer.height;previewCanvas.getContext('2d').drawImage(buffer,0,0);pdfRenderTask=null;
      }else if(sourceImage){
        const swapped=rotation%180!==0,w=swapped?sourceImage.height:sourceImage.width,h=swapped?sourceImage.width:sourceImage.height;
        const scale=Math.min(1,1600/Math.max(w,h));previewCanvas.width=Math.round(w*scale);previewCanvas.height=Math.round(h*scale);
        const ctx=previewCanvas.getContext('2d');ctx.save();ctx.translate(previewCanvas.width/2,previewCanvas.height/2);ctx.rotate(rotation*Math.PI/180);
        ctx.drawImage(sourceImage,-sourceImage.width*scale/2,-sourceImage.height*scale/2,sourceImage.width*scale,sourceImage.height*scale);ctx.restore();
      }
    }catch(error){if(error.name!=='RenderingCancelledException'&&revision===renderGeneration)throw new Error('This page could not be displayed. Try another page or upload a photo.');}
  }
  async function upload(file){
    if(!file)return;
    loadScore(null);const version=++uploadGeneration;
    byId('sourceDetails').open=true;
    await cleanSource();byId('fileStatus').textContent='Opening '+file.name+'…';
    try{
      if(file.size>10*1024*1024)throw new Error('Please choose a file smaller than 10 MB.');
      const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const isPdf=String.fromCharCode(...signature.slice(0,5))==='%PDF-';
      const png=signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71;
      const jpeg=signature[0]===255&&signature[1]===216;
      const webp=String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP';
      if(isPdf){
        if(!workerUrl){workerUrl=URL.createObjectURL(new Blob([window.scorePdfWorkerSource],{type:'text/javascript'}));pdfjsLib.GlobalWorkerOptions.workerSrc=workerUrl;}
        const loading=pdfjsLib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,enableXfa:false});
        loading.onPassword=()=>{loading.destroy();};
        const pdf=await loading.promise;if(version!==uploadGeneration){await pdf.destroy();return;}sourcePdf=pdf;
      }else if(png||jpeg||webp){
        // Use the browser's normal photo decoder (also handles EXIF orientation).
        const image=new Image(), url=URL.createObjectURL(file);
        try {image.src=url;await image.decode();} catch(_) {throw new Error('This photo could not be opened. Try exporting it as a JPG or PNG.');}
        finally {URL.revokeObjectURL(url);}
        if(version!==uploadGeneration)return;
        if(image.naturalWidth*image.naturalHeight>40000000)throw new Error('This photo is too large. Please resize it below 40 megapixels.');
        sourceImage=image;
      }else throw new Error('Choose a PNG, JPG, WebP or PDF. HEIC photos need to be exported as JPG first.');
      if(version!==uploadGeneration)return;rotation=0;pageNumber=1;await renderSource();
      if(version!==uploadGeneration)return;
      byId('fileStatus').textContent=file.name+' · Preview loaded.';
      previewCanvas.setAttribute('aria-label','Score reference from '+file.name);
      // Only attach a prepared transcription to the exact file it came from.
      if(window.crypto?.subtle){
        const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
        if(version!==uploadGeneration)return;
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        const match=window.PreparedScores.find(s=>s.sha256===hash);
        if(match)loadScore(match);
      }
    }catch(error){if(version!==uploadGeneration)return;await cleanSource();byId('fileStatus').textContent=/password|destroyed/i.test(error.message)?'This PDF may need a password. Upload an unlocked copy or a photo.':error.message||'Could not open this score. Try another file.';}
    byId('scoreFile').value='';
  }

  byId('practiceMode').addEventListener('click',()=>mode(false));byId('songMode').addEventListener('click',()=>mode(true));
  byId('songTempo').addEventListener('input',()=>stop());
  byId('playSong').addEventListener('click',start);byId('stopSong').addEventListener('click',()=>{stop();byId('songPosition').textContent='Stopped.';});
  byId('previousBars').addEventListener('click',()=>{if(!playing&&scorePage>0){scorePage--;renderSong();}});
  byId('nextBars').addEventListener('click',()=>{if(!playing&&parsed&&(scorePage+1)*4<parsed.bars.length){scorePage++;renderSong();}});
  byId('scoreFile').addEventListener('change',event=>upload(event.target.files[0]));
  const zone=byId('uploadZone');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragging');});zone.addEventListener('dragleave',()=>zone.classList.remove('dragging'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragging');upload(e.dataTransfer.files[0]);});
  const redraw=()=>renderSource().catch(error=>{byId('fileStatus').textContent=error.message;});
  byId('rotateScore').addEventListener('click',()=>{rotation=(rotation+90)%360;redraw();});
  byId('previousPage').addEventListener('click',()=>{if(sourcePdf&&pageNumber>1){pageNumber--;redraw();}});
  byId('nextPage').addEventListener('click',()=>{if(sourcePdf&&pageNumber<sourcePdf.numPages){pageNumber++;redraw();}});
  byId('removeScore').addEventListener('click',async()=>{uploadGeneration++;loadScore(null);await cleanSource();byId('scoreFile').value='';byId('fileStatus').textContent='Score removed from this view. Your original file is unchanged.';byId('songValidation').textContent='Upload a score to see its preview.';});
  byId('sourceDetails').addEventListener('toggle',()=>ui.queueBeam());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();byId('songPosition').textContent='Stopped while the page was hidden.';}});
  window.SongPlayer={get active(){return active;},stop,drawBeam,pressKey};
})();
