import { createServer } from 'node:http';
import { mkdir, readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const vault = join(root, 'Schema Vault');
const localRulesVault = join(root, 'Local Rules');
const mandatoryRulesVault = join(root, 'Mandatory Mapping Rules');
const generatedVault = join(root, 'Generated Files');
const host = '127.0.0.1';
const port = 4173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const safeName = name => typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,49}$/.test(name) ? name : null;
const fileFor = name => join(vault, `${name}.json`);
const ruleTypeFor = url => url.searchParams.get('type');
const rulesVaultFor = type => type === 'local' ? localRulesVault : type === 'mandatory' ? mandatoryRulesVault : null;
const ruleFileFor = (name, type) => join(rulesVaultFor(type), `${name}.json`);

async function listSchemas() {
  const entries = await readdir(vault, { withFileTypes: true });
  const schemas = await Promise.all(entries.filter(entry => entry.isFile() && extname(entry.name) === '.json').map(async entry => {
    const name = entry.name.slice(0, -5);
    const path = join(vault, entry.name);
    const [json, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
    return { name, json, savedAt: info.mtimeMs };
  }));
  return schemas.sort((a, b) => b.savedAt - a.savedAt);
}
async function listRules(type) {
  const rulesVault = rulesVaultFor(type);
  const entries = await readdir(rulesVault, { withFileTypes: true });
  const rules = await Promise.all(entries.filter(entry => entry.isFile() && extname(entry.name) === '.json').map(async entry => JSON.parse(await readFile(join(rulesVault, entry.name), 'utf8'))));
  return rules.sort((a, b) => b.savedAt - a.savedAt);
}

await mkdir(vault, { recursive: true });
await mkdir(localRulesVault, { recursive: true });
await mkdir(mandatoryRulesVault, { recursive: true });
await mkdir(generatedVault, { recursive: true });
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (url.pathname === '/api/schemas' && req.method === 'GET') return send(res, 200, await listSchemas());
    if (url.pathname === '/api/schemas' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10 * 1024 * 1024) return send(res, 413, { error: 'File is too large.' }); }
      const { name, json } = JSON.parse(body);
      const validName = safeName(name);
      if (!validName || typeof json !== 'string') return send(res, 400, { error: 'Invalid pattern name or JSON.' });
      JSON.parse(json);
      const target = fileFor(validName);
      try { await stat(target); return send(res, 409, { error: 'A pattern with this name already exists.' }); } catch { /* File does not exist. */ }
      await writeFile(target, json, 'utf8');
      return send(res, 201, { name: validName });
    }
    if (url.pathname === '/api/mapping-rules' && req.method === 'GET') {
      const type = ruleTypeFor(url);
      if (!rulesVaultFor(type)) return send(res, 400, { error: 'Choose a valid rule type.' });
      return send(res, 200, await listRules(type));
    }
    if (url.pathname === '/api/mapping-rules' && req.method === 'POST') {
      const type = ruleTypeFor(url);
      if (!rulesVaultFor(type)) return send(res, 400, { error: 'Choose a valid rule type.' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 2 * 1024 * 1024) return send(res, 413, { error: 'Rule is too large.' }); }
      const rule = JSON.parse(body);
      const validName = safeName(rule.name);
      if (!validName || !safeName(rule.sourceSchema) || !safeName(rule.targetSchema) || !Array.isArray(rule.mappings) || !rule.mappings.length) return send(res, 400, { error: 'Complete the rule name, schemas, and at least one field mapping.' });
      if (rule.mappings.some(mapping => typeof mapping.source !== 'string' || typeof mapping.target !== 'string' || (mapping.sourceLabel !== undefined && typeof mapping.sourceLabel !== 'string') || (mapping.targetLabel !== undefined && typeof mapping.targetLabel !== 'string'))) return send(res, 400, { error: 'Invalid field mapping.' });
      try { await stat(ruleFileFor(validName, type)); return send(res, 409, { error: 'A mapping rule with this name already exists.' }); } catch { /* File does not exist. */ }
      const savedRule = { name: validName, sourceSchema: rule.sourceSchema, targetSchema: rule.targetSchema, mappings: rule.mappings, savedAt: Date.now() };
      await writeFile(ruleFileFor(validName, type), JSON.stringify(savedRule, null, 2), 'utf8');
      return send(res, 201, savedRule);
    }
    if (url.pathname === '/api/generated-files' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10 * 1024 * 1024) return send(res, 413, { error: 'Generated file is too large.' }); }
      const { entity, json } = JSON.parse(body);
      const validEntity = safeName(entity);
      if (!validEntity || typeof json !== 'string') return send(res, 400, { error: 'Invalid generated file.' });
      JSON.parse(json);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${validEntity} - ${stamp}.json`;
      await writeFile(join(generatedVault, filename), json, 'utf8');
      return send(res, 201, { filename });
    }
    const deleteMatch = url.pathname.match(/^\/api\/schemas\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      const name = safeName(decodeURIComponent(deleteMatch[1]));
      if (!name) return send(res, 400, { error: 'Invalid pattern name.' });
      await unlink(fileFor(name));
      return send(res, 204, '');
    }
    const deleteRuleMatch = url.pathname.match(/^\/api\/mapping-rules\/([^/]+)$/);
    const updateRuleMatch = url.pathname.match(/^\/api\/mapping-rules\/([^/]+)$/);
    if (updateRuleMatch && req.method === 'PUT') {
      const type = ruleTypeFor(url);
      if (!rulesVaultFor(type)) return send(res, 400, { error: 'Choose a valid rule type.' });
      const name = safeName(decodeURIComponent(updateRuleMatch[1]));
      if (!name) return send(res, 400, { error: 'Invalid mapping rule name.' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 2 * 1024 * 1024) return send(res, 413, { error: 'Rule is too large.' }); }
      const rule = JSON.parse(body);
      if (!safeName(rule.sourceSchema) || !safeName(rule.targetSchema) || !Array.isArray(rule.mappings) || !rule.mappings.length) return send(res, 400, { error: 'Complete the schemas and at least one field mapping.' });
      if (rule.mappings.some(mapping => typeof mapping.source !== 'string' || typeof mapping.target !== 'string' || (mapping.sourceLabel !== undefined && typeof mapping.sourceLabel !== 'string') || (mapping.targetLabel !== undefined && typeof mapping.targetLabel !== 'string'))) return send(res, 400, { error: 'Invalid field mapping.' });
      const savedRule = { name, sourceSchema: rule.sourceSchema, targetSchema: rule.targetSchema, mappings: rule.mappings, savedAt: Date.now() };
      await writeFile(ruleFileFor(name, type), JSON.stringify(savedRule, null, 2), 'utf8');
      return send(res, 200, savedRule);
    }
    if (deleteRuleMatch && req.method === 'DELETE') {
      const type = ruleTypeFor(url);
      if (!rulesVaultFor(type)) return send(res, 400, { error: 'Choose a valid rule type.' });
      const name = safeName(decodeURIComponent(deleteRuleMatch[1]));
      if (!name) return send(res, 400, { error: 'Invalid mapping rule name.' });
      await unlink(ruleFileFor(name, type));
      return send(res, 204, '');
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = resolve(root, relative);
    if (!path.startsWith(root) || ['Schema Vault', 'Local Rules', 'Mandatory Mapping Rules', 'Generated Files'].some(folder => relative.includes(folder))) return send(res, 403, 'Forbidden', 'text/plain');
    try {
      const info = await stat(path);
      if (!info.isFile()) return send(res, 404, 'Not found', 'text/plain');
    } catch {
      return send(res, 404, 'Not found', 'text/plain');
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    const stream = createReadStream(path);
    stream.on('error', () => res.destroy());
    return stream.pipe(res);
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : 'Unexpected local server error.' });
  }
}).listen(port, host, () => console.log(`Schema Vault is running locally at http://${host}:${port}`));
