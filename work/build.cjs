const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.source.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="\/styles.css[^\"]*">/, () => '<style>' + fs.readFileSync(path.join(root, 'dist/styles.css'), 'utf8') + '</style>');
html = html.replace(/<script src="\/([^"?]+)(?:\?[^\"]*)?" defer><\/script>/g, (_, asset) => '<script>' + fs.readFileSync(path.join(root, 'dist', asset), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
// Inline bundles are placed after the page's elements so they need no network fetch.
const scripts = [];
html = html.replace(/<script>[\s\S]*?<\/script>/g, script => { scripts.push(script); return ''; });
const workerSource = fs.readFileSync(path.join(root, 'dist/vendor/pdf.worker.min.js'), 'utf8');
scripts.unshift('<script>window.scorePdfWorkerSource = ' + JSON.stringify(workerSource).replace(/</g, '\\u003c') + ';</script>');
html = html.replace('</body>', () => scripts.join('\n') + '\n</body>');
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('Built self-contained preview: ' + Buffer.byteLength(html) + ' bytes');
