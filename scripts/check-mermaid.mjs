// Parses every ```mermaid block in the repo's Markdown with the real mermaid parser,
// so a diagram that GitHub would render as "Unable to render" fails CI instead.
// Parsing (not rendering) needs only a DOM shim, so no headless browser is required.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false });

const root = process.cwd();
function* markdownFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* markdownFiles(path);
    else if (name.endsWith('.md')) yield path;
  }
}

let blocks = 0;
let failures = 0;
for (const file of markdownFiles(root)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '```mermaid') continue;
    const start = i + 1;
    const body = [];
    for (i = start; i < lines.length && lines[i].trim() !== '```'; i++) body.push(lines[i]);
    blocks++;
    try {
      await mermaid.parse(body.join('\n'));
    } catch (err) {
      failures++;
      const first = String(err?.message ?? err).split('\n').slice(0, 3).join(' | ');
      console.error(`${relative(root, file)}:${start}: ${first}`);
    }
  }
}
console.log(`mermaid: ${blocks} block(s) parsed, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
