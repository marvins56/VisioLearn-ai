// Renders docs/diagrams/architecture.html (two SVGs) to PNG for the report.
//   NPM_ROOT=$(npm root -g) node scripts/render-diagrams.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.NPM_ROOT || '', 'playwright'));
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/diagrams');
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 2 });
await p.goto('file://' + path.join(dir, 'architecture.html'));
for (const id of ['architecture', 'sequence']) {
  await p.locator('#' + id).screenshot({ path: path.join(dir, `${id}.png`) });
  console.log('rendered', id);
}
await b.close();
