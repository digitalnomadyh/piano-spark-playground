# Piano Spark Playground 🎹✨

A playful, English-language piano learning app for young children and their teachers. The app currently displays the name **Note Explorer**.

## Explore

- An 88-key piano, from A0 to C8, with black keys and Middle C highlighted.
- Treble- and bass-clef note-reading practice with professionally engraved notation.
- Fixed-Do solfege, with a choice of Si or Ti for B.
- Synthesised tones, falling-note lights, and a beam connecting each playing note to its piano key.
- Photo and PDF score previews, with rotation and PDF page navigation.
- Playback of prepared melodies, four bars on one line, automatic page turns, adjustable tempo, and repeat.

## Important limitations

Uploading a photo or PDF **does not automatically recognise its music**. General optical music recognition is not implemented. The app includes one manually prepared 16-bar melody linked to its exact source photo by a SHA-256 fingerprint. The original photo is not included in this repository. Other uploaded scores are preview-only until a transcription is added.

Uploads stay in the current browser session and are not sent to a server. The upload limit is 10 MB, with a 40-megapixel photo limit; there is no four-bar upload restriction. Camera and microphone access are not required. Sound starts after a user interaction and is synthesised, not sampled from an acoustic piano.

## Run locally

The generated `dist/index.html` contains the app scripts, styles, and PDF worker. Serve `dist/` with a static web server. For example, with Python installed:

```sh
python -m http.server 8765 --directory dist
```

Then open http://localhost:8765/ in your browser. This local URL works only while the server is running; creating this GitHub repository does not deploy a public website.

## Edit and build

Edit `index.source.html` and the readable JavaScript/CSS files in `dist/`, then rebuild the self-contained page with Node.js:

```sh
node work/build.cjs
```

Run the pitch, notation, and song-model checks with:

```sh
node work/check-music.cjs
node work/check-song.cjs
```

No package installation is required for these scripts. Do not edit the generated `dist/index.html` directly. Google Fonts are requested for typography when available; local system fonts are the fallback.

## Third-party libraries

- VexFlow 4.2.5: notation engraving; license in `dist/vendor/VEXFLOW-LICENSE.txt`.
- PDF.js 3.11.174: PDF preview; license in `dist/vendor/PDFJS-LICENSE.txt`. PDF evaluation and XFA are disabled.

This is a teaching prototype. Check prepared transcriptions against the original score before using them in lessons.
