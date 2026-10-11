import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('apps/executor/public');
const csp="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self'; frame-ancestors http://127.0.0.1:3000; base-uri 'none'; form-action 'none'";
createServer(async(req,res)=>{
 const compute=req.url==='/worker.js'||req.url==='/duckdb-worker.js';
 res.setHeader('Content-Security-Policy',req.url==='/duckdb-worker.js'?"default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'":compute?"default-src 'none'; script-src 'wasm-unsafe-eval'; worker-src http://127.0.0.1:3001/duckdb-worker.js; connect-src 'none'; base-uri 'none'":csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:3001');
 if(url.search || !/^\/(?:[a-z0-9_.-]+|assets\/[A-Za-z0-9_.-]+)?$/.test(url.pathname)){res.writeHead(404);res.end();return;}
 const file=resolve(root,url.pathname==='/'?'host.html':url.pathname.slice(1));
 if(!file.startsWith(root+'/')){res.writeHead(404);res.end();return;}
 try{
 const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'}[extname(file)]||'application/octet-stream'));res.end(bytes);
 }catch{res.writeHead(404);res.end();}
}).listen(3001,'127.0.0.1');
