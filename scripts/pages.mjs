// GitHub Pages output: docs/index.html (the built page with a real title and share card) and the model beside it.
import fs from 'node:fs';

const dist = 'teardown-out/dist';
const title = 'BMW M4 (G82) · scroll teardown';
const desc = 'A black M4 Competition dissolves into x-ray; the S58 inside runs from its real dimensions, then lifts out and comes apart.';
const url = process.env.PAGES_URL || '';
const meta = [
  `<title>${title}</title>`,
  `<meta name="description" content="${desc}">`,
  `<meta property="og:title" content="${title}">`,
  `<meta property="og:description" content="${desc}">`,
  `<meta property="og:type" content="website">`,
  url && `<meta property="og:url" content="${url}">`,
  `<meta property="og:image" content="${url}poster.jpg">`,
  `<meta name="twitter:card" content="summary_large_image">`,
].filter(Boolean).join('\n');
fs.mkdirSync('docs', {recursive: true});
const html = fs.readFileSync(`${dist}/site.html`, 'utf8').replace('<title>site</title>', meta);
fs.writeFileSync('docs/index.html', html);
fs.copyFileSync(`${dist}/m4.glb`, 'docs/m4.glb');
fs.writeFileSync('docs/.nojekyll', '');
console.log(`docs/index.html ${(html.length / 1024).toFixed(0)} KB, docs/m4.glb`);
