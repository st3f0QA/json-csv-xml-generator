const form = document.querySelector('#schema-form');
const fileInput = document.querySelector('#json-file');
const nameInput = document.querySelector('#schema-name');
const dropzone = document.querySelector('#dropzone');
const title = document.querySelector('#upload-title');
const subtitle = document.querySelector('#upload-subtitle');
const message = document.querySelector('#form-message');
const grid = document.querySelector('#schema-grid');
const empty = document.querySelector('#empty-state');
const count = document.querySelector('#schema-count');
const clearButton = document.querySelector('#clear-button');
const template = document.querySelector('#schema-template');
const dialog = document.querySelector('#source-dialog');
const serverNotice = document.querySelector('#server-notice');
const sourceSchema = document.querySelector('#source-schema');
const targetSchema = document.querySelector('#target-schema');
const mappingEmpty = document.querySelector('#mapping-empty');
const mappingTable = document.querySelector('#mapping-table');
const mappingRows = document.querySelector('#mapping-rows');
const ruleMessage = document.querySelector('#rule-message');
const ruleTemplate = document.querySelector('#rule-template');
const rowTemplate = document.querySelector('#mapping-row-template');
const generateSchema = document.querySelector('#generate-schema');
const generateRules = document.querySelector('#generate-rules');
const generatorQuestions = document.querySelector('#generator-questions');
const generatorMessage = document.querySelector('#generator-message');
const generatorRuleTemplate = document.querySelector('#generator-rule-template');
let selectedFile = null;

async function request(path, options) {
  let response;
  try { response = await fetch(path, options); }
  catch { throw new Error('The local server is not running. In this project folder, run “npm start” and open http://127.0.0.1:4173 — do not open index.html directly.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 && path.startsWith('/api/mapping-rules')) throw new Error('Mapping Rules needs the updated local server. Stop it with Ctrl+C, run “npm start” again, then refresh this page.');
    throw new Error(data.error || 'Local storage request failed.');
  }
  return response.status === 204 ? null : response.json();
}
const getPatterns = () => request('/api/schemas');
const deletePattern = name => request(`/api/schemas/${encodeURIComponent(name)}`, { method: 'DELETE' });
const getRules = () => request('/api/mapping-rules');
const deleteRule = name => request(`/api/mapping-rules/${encodeURIComponent(name)}`, { method: 'DELETE' });

function flattenFields(value, path = '') {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).flatMap(([key, child]) => flattenFields(child, path ? `${path}.${key}` : key));
  if (Array.isArray(value)) return value.length ? flattenFields(value[0], `${path}[]`) : [path ? `${path}[]` : '[]'];
  return [path || '(root)'];
}
async function schemaOptions() {
  const schemas = await getPatterns();
  [sourceSchema, targetSchema].forEach(select => {
    const previous = select.value;
    select.innerHTML = '<option value="">Choose a schema…</option>';
    schemas.forEach(schema => select.add(new Option(schema.name, schema.name)));
    select.value = previous;
  });
}
async function fieldsFor(schemaName) {
  const schemas = await getPatterns();
  const schema = schemas.find(item => item.name === schemaName);
  return schema ? flattenFields(JSON.parse(schema.json)) : [];
}
function makeFieldSelect(fields, placeholder) {
  const select = document.createElement('select');
  select.add(new Option(placeholder, ''));
  fields.forEach(field => select.add(new Option(field, field)));
  return select;
}
async function addMappingRow() {
  const [sourceFields, targetFields] = await Promise.all([fieldsFor(sourceSchema.value), fieldsFor(targetSchema.value)]);
  const row = rowTemplate.content.cloneNode(true);
  const source = makeFieldSelect(sourceFields, 'Choose source field…'); source.className = 'source-field';
  const target = makeFieldSelect(targetFields, 'Choose target field…'); target.className = 'target-field';
  row.querySelector('.source-field').replaceWith(source); row.querySelector('.target-field').replaceWith(target);
  row.querySelector('.remove-row').onclick = event => { event.currentTarget.closest('.mapping-row').remove(); };
  mappingRows.append(row);
}
async function updateMappingBuilder() {
  const ready = sourceSchema.value && targetSchema.value;
  mappingEmpty.hidden = Boolean(ready); mappingTable.hidden = !ready;
  mappingRows.innerHTML = '';
  if (ready) await addMappingRow();
}
async function renderRules() {
  const rules = await getRules();
  const rulesGrid = document.querySelector('#rules-grid');
  rulesGrid.innerHTML = '';
  document.querySelector('#rule-count').textContent = `(${rules.length})`;
  document.querySelector('#rules-empty').hidden = rules.length > 0;
  rules.forEach(rule => {
    const card = ruleTemplate.content.cloneNode(true);
    card.querySelector('h3').textContent = rule.name;
    card.querySelector('.rule-meta').textContent = `${rule.mappings.length} field ${rule.mappings.length === 1 ? 'mapping' : 'mappings'}`;
    card.querySelector('.rule-connection').innerHTML = `${rule.sourceSchema} <span>→</span> ${rule.targetSchema}`;
    card.querySelector('.delete-rule').onclick = async () => { await deleteRule(rule.name); renderRules(); };
    rulesGrid.append(card);
  });
}
async function generatorSchemaOptions() {
  const schemas = await getPatterns();
  const current = generateSchema.value;
  generateSchema.innerHTML = '<option value="">Choose an imported schema…</option>';
  schemas.forEach(schema => generateSchema.add(new Option(schema.name, schema.name)));
  generateSchema.value = current;
}
function valueAtPath(data, fieldPath) {
  let current = data;
  for (let part of fieldPath.split('.')) {
    if (part === '[]') { if (!Array.isArray(current) || !current.length) return undefined; current = current[0]; continue; }
    const arrayHere = part.endsWith('[]'); if (arrayHere) part = part.slice(0, -2);
    if (current === null || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part]; if (arrayHere) { if (!Array.isArray(current) || !current.length) return undefined; current = current[0]; }
  }
  return current;
}
function isDateLike(field, example) {
  return typeof example === 'string' && /(?:date|time|start|end)/i.test(field) && /\d{4}|\d{1,2}:\d{2}/.test(example);
}
function inputForField(field, example) {
  const label = document.createElement('label');
  const isDate = isDateLike(field, example);
  label.innerHTML = `<span>Value for <code>${field}</code>${isDate ? ' · Date: YYYY-MM-DD HH:mm:ss' : ''}</span>`;
  const input = document.createElement('input'); input.dataset.field = field; input.placeholder = isDate ? 'e.g. 2026-08-02 14:30:00' : 'Keep example value if blank';
  if (isDate) { input.dataset.date = 'true'; input.dataset.example = example; input.inputMode = 'numeric'; }
  label.append(input); return label;
}
async function updateGenerator() {
  const entity = generateSchema.value;
  const emptyGenerator = document.querySelector('#generator-empty');
  const section = document.querySelector('#generate-rules-section');
  const questionsSection = document.querySelector('#generator-questions-section');
  generateRules.innerHTML = ''; generatorQuestions.innerHTML = ''; generatorMessage.textContent = '';
  if (!entity) { emptyGenerator.hidden = false; section.hidden = true; questionsSection.hidden = true; return; }
  const rules = (await getRules()).filter(rule => rule.sourceSchema === entity || rule.targetSchema === entity);
  emptyGenerator.hidden = rules.length > 0; section.hidden = rules.length === 0; questionsSection.hidden = rules.length === 0;
  if (!rules.length) { emptyGenerator.textContent = 'No saved mapping rules are connected to this entity. Create one in Mapping Rules first.'; return; }
  rules.forEach(rule => {
    const node = generatorRuleTemplate.content.cloneNode(true);
    const checkbox = node.querySelector('input'); checkbox.value = rule.name; checkbox.dataset.rule = JSON.stringify(rule);
    node.querySelector('.generator-rule-name').textContent = rule.name;
    node.querySelector('small').textContent = `${rule.sourceSchema} → ${rule.targetSchema}`;
    checkbox.onchange = refreshGeneratorQuestions;
    generateRules.append(node);
  });
}
async function refreshGeneratorQuestions() {
  const entity = generateSchema.value;
  const fields = new Set();
  [...generateRules.querySelectorAll('input:checked')].forEach(input => {
    const rule = JSON.parse(input.dataset.rule);
    rule.mappings.forEach(mapping => fields.add(rule.sourceSchema === entity ? mapping.source : mapping.target));
  });
  const schemas = await getPatterns();
  const schema = schemas.find(item => item.name === entity);
  const exampleData = schema ? JSON.parse(schema.json) : {};
  generatorQuestions.innerHTML = '';
  [...fields].forEach(field => generatorQuestions.append(inputForField(field, valueAtPath(exampleData, field))));
}
function two(value) { return String(value).padStart(2, '0'); }
function formatDateForExample(value, example) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Enter dates as YYYY-MM-DD HH:mm:ss, for example 2026-08-02 14:30:00.');
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || date.getHours() !== Number(hour)) throw new Error('Enter a valid calendar date and time.');
  const isoDate = `${year}-${month}-${day}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(example)) return `${isoDate}T${hour}:${minute}${/T\d{2}:\d{2}:\d{2}/.test(example) ? `:${second}` : ''}`;
  if (/^\d{4}-\d{2}-\d{2}\s/.test(example)) return `${isoDate} ${hour}:${minute}:${second}`;
  if (/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/.test(example)) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const prefix = `${months[date.getMonth()]} ${date.getDate()}, ${year}`;
    if (/\b(?:AM|PM)\b/.test(example)) { const h12 = date.getHours() % 12 || 12; return `${prefix} ${two(h12)}:${minute}:${second} ${date.getHours() >= 12 ? 'PM' : 'AM'}`; }
    return `${prefix}, ${hour}:${minute}:${second}`;
  }
  return value.trim();
}
function setValueAtPath(data, fieldPath, value) {
  const parts = fieldPath.split('.');
  let current = data;
  for (let index = 0; index < parts.length; index += 1) {
    let part = parts[index];
    if (part === '[]') { if (!Array.isArray(current) || !current.length) return false; current = current[0]; continue; }
    const arrayHere = part.endsWith('[]'); if (arrayHere) part = part.slice(0, -2);
    if (index === parts.length - 1) { if (!(part in current)) return false; current[part] = value; return true; }
    if (!(part in current)) return false;
    current = current[part]; if (arrayHere) { if (!Array.isArray(current) || !current.length) return false; current = current[0]; }
  }
  return false;
}
async function generateFile() {
  try {
    const entity = generateSchema.value;
    if (!entity) throw new Error('Choose an entity first.');
    const schemas = await getPatterns(); const schema = schemas.find(item => item.name === entity);
    const generated = JSON.parse(schema.json);
    [...generatorQuestions.querySelectorAll('input')].forEach(input => {
      if (!input.value.trim()) return;
      const value = input.dataset.date ? formatDateForExample(input.value, input.dataset.example) : input.value.trim();
      setValueAtPath(generated, input.dataset.field, value);
    });
    const json = JSON.stringify(generated, null, 2);
    const result = await request('/api/generated-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity, json }) });
    const blob = new Blob([json], { type: 'application/json' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: result.filename }); link.click(); URL.revokeObjectURL(link.href);
    generatorMessage.textContent = `Generated and saved locally as ${result.filename}.`;
  } catch (error) { generatorMessage.textContent = error.message; }
}

async function render() {
  const patterns = await getPatterns();
  grid.innerHTML = '';
  count.textContent = `(${patterns.length})`;
  empty.hidden = patterns.length > 0;
  clearButton.hidden = patterns.length === 0;
  patterns.forEach(pattern => {
    const card = template.content.cloneNode(true);
    card.querySelector('h3').textContent = pattern.name;
    card.querySelector('.schema-meta').textContent = `Saved ${new Date(pattern.savedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}`;
    card.querySelector('pre').textContent = pattern.json;
    card.querySelector('.delete-button').onclick = async () => { await deletePattern(pattern.name); render(); };
    card.querySelector('.view-button').onclick = () => { document.querySelector('#dialog-title').textContent = pattern.name; document.querySelector('#dialog-source').textContent = pattern.json; dialog.showModal(); };
    grid.append(card);
  });
}
function setFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') { message.textContent = 'Please choose a .json file.'; return; }
  selectedFile = file; title.textContent = file.name; subtitle.textContent = `${(file.size / 1024).toFixed(1)} KB ready to save`; message.textContent = '';
}
fileInput.onchange = e => setFile(e.target.files[0]);
['dragenter','dragover'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); }));
['dragleave','drop'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragging'); }));
dropzone.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));
form.onsubmit = async e => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!selectedFile) { message.textContent = 'Upload a JSON file first.'; return; }
  try {
    const raw = await selectedFile.text();
    const parsed = JSON.parse(raw);
    await request('/api/schemas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, json: JSON.stringify(parsed, null, 2) }) });
    form.reset(); selectedFile = null; title.textContent = 'Drop your JSON here'; subtitle.textContent = 'or choose a file from your computer'; message.textContent = ''; render();
  } catch (error) { message.textContent = error instanceof SyntaxError ? 'That file is not valid JSON. Please check it and try again.' : error.message; }
};
clearButton.onclick = async () => { if (confirm('Remove all saved patterns from the Schema Vault folder?')) { const patterns = await getPatterns(); await Promise.all(patterns.map(pattern => deletePattern(pattern.name))); render(); } };
sourceSchema.onchange = updateMappingBuilder; targetSchema.onchange = updateMappingBuilder;
document.querySelector('#add-mapping').onclick = addMappingRow;
document.querySelector('#save-rule').onclick = async () => {
  const mappings = [...mappingRows.querySelectorAll('.mapping-row')].map(row => ({ source: row.querySelector('.source-field').value, target: row.querySelector('.target-field').value })).filter(mapping => mapping.source && mapping.target);
  try {
    await request('/api/mapping-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.querySelector('#rule-name').value.trim(), sourceSchema: sourceSchema.value, targetSchema: targetSchema.value, mappings }) });
    document.querySelector('#rule-name').value = ''; sourceSchema.value = ''; targetSchema.value = ''; mappingRows.innerHTML = ''; mappingTable.hidden = true; mappingEmpty.hidden = false; ruleMessage.textContent = ''; renderRules();
  } catch (error) { ruleMessage.textContent = error.message; }
};
generateSchema.onchange = updateGenerator;
document.querySelector('#generate-file').onclick = generateFile;
document.querySelectorAll('.tab').forEach(tab => tab.onclick = async () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelector('#schemas-page').hidden = tab.dataset.view !== 'schemas';
  document.querySelector('#mappings-page').hidden = tab.dataset.view !== 'mappings';
  document.querySelector('#generate-page').hidden = tab.dataset.view !== 'generate';
  if (tab.dataset.view === 'mappings') { await schemaOptions(); await renderRules(); }
  if (tab.dataset.view === 'generate') { await generatorSchemaOptions(); await updateGenerator(); }
});
document.querySelector('#close-dialog').onclick = () => dialog.close();
if (location.protocol === 'file:') {
  serverNotice.hidden = false;
  serverNotice.textContent = 'This page was opened directly from a file. To save schemas, run “npm start” in this project folder and open http://127.0.0.1:4173.';
}
Promise.all([render(), schemaOptions(), renderRules(), generatorSchemaOptions()]).catch(error => { message.textContent = error.message; });
