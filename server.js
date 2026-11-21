import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataPath = process.env.DATA_FILE ? join(root, process.env.DATA_FILE.replace(/^\.\//, '')) : join(root, 'data/store.json');
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 3020);
const adminKey = process.env.ADMIN_KEY || 'demo-admin-key';
const statuses = ['new', 'confirmed', 'delivering', 'done', 'cancelled'];
const json = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
const body = req => new Promise((resolve, reject) => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON xato')); } }); });
async function load() { return JSON.parse(await readFile(dataPath, 'utf8')); }
async function save(data) { await writeFile(dataPath, JSON.stringify(data, null, 2)); }
function totalFor(items, products) { return items.reduce((sum, line) => { const product = products.find(p => p.id === line.productId); return sum + (product ? product.price * line.quantity : 0); }, 0); }
async function api(req, res, url) {
  const data = await load();
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {ok:true, service:'bozorcha'});
  if (req.method === 'GET' && url.pathname === '/api/categories') return json(res, 200, [...new Set(data.products.map(p => p.category))]);
  if (req.method === 'GET' && url.pathname === '/api/products') {
    const q = (url.searchParams.get('q') || '').toLowerCase(); const category = url.searchParams.get('category') || '';
    return json(res, 200, data.products.filter(p => (!q || `${p.name} ${p.description} ${p.vendor}`.toLowerCase().includes(q)) && (!category || p.category === category)));
  }
  if (req.method === 'GET' && url.pathname === '/api/orders') {
    if (req.headers['x-admin-key'] !== adminKey) return json(res, 401, {error:'Admin kalit noto‘g‘ri'});
    return json(res, 200, data.orders.sort((a,b) => b.createdAt - a.createdAt));
  }
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    const input = await body(req); const lines = Array.isArray(input.items) ? input.items : [];
    if (!input.customer?.name?.trim() || !input.customer?.phone?.trim() || !input.customer?.address?.trim() || !lines.length) return json(res, 400, {error:'Mijoz ma’lumotlari va savatcha to‘ldirilishi kerak'});
    const clean = lines.map(x => ({productId:String(x.productId), quantity:Math.max(1, Math.floor(Number(x.quantity)))}));
    for (const line of clean) { const product = data.products.find(p => p.id === line.productId); if (!product || line.quantity > product.stock) return json(res, 400, {error:`Mahsulot mavjud emas yoki qoldiq yetarli emas`}); }
    const order = {id:`ord-${Date.now()}`, customer:{name:input.customer.name.trim(),phone:input.customer.phone.trim(),address:input.customer.address.trim()}, items:clean, total:totalFor(clean,data.products), status:'new', createdAt:Date.now()};
    clean.forEach(line => { const p=data.products.find(x=>x.id===line.productId); p.stock -= line.quantity; }); data.orders.push(order); await save(data); return json(res,201,order);
  }
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/orders/')) {
    if (req.headers['x-admin-key'] !== adminKey) return json(res, 401, {error:'Admin kalit noto‘g‘ri'});
    const id=url.pathname.split('/').pop(); const input=await body(req); const order=data.orders.find(x=>x.id===id); if(!order) return json(res,404,{error:'Buyurtma topilmadi'}); if(!statuses.includes(input.status)) return json(res,400,{error:'Status noto‘g‘ri'}); order.status=input.status; order.updatedAt=Date.now(); await save(data); return json(res,200,order);
  }
  return json(res,404,{error:'API route topilmadi'});
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);const path=normalize(join(publicDir,url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(publicDir)||!existsSync(path))return json(res,404,{error:'Sahifa topilmadi'});res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch(e){console.error(e);json(res,500,{error:'Server xatosi'});}});
server.listen(port,'0.0.0.0',()=>console.log(`Bozorcha ${port}-portda ishlayapti`));
