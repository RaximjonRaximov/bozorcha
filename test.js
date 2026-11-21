import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('./data/store.json', import.meta.url)));
assert.match(server, /api\/products/); assert.match(server, /api\/orders/); assert.match(server, /totalFor/); assert.match(html, /orderForm/); assert.equal(data.products.length, 6); console.log('5 ta Bozorcha smoke test muvaffaqiyatli');
