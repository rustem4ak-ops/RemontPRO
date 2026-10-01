import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runScheduled } = require('../shared/autosearch.cjs');
const DATA = new URL('../data/autosearch.json', import.meta.url);
const OUT = JSON.parse(await fs.readFile(DATA, 'utf8'));
const result = await runScheduled(OUT);
const NL = String.fromCharCode(10);
await fs.writeFile(DATA, JSON.stringify(result,null,2)+NL);
await fs.writeFile(new URL('../site/autosearch-data.json',import.meta.url), JSON.stringify(result,null,2)+NL);
console.log(JSON.stringify(result.stats));