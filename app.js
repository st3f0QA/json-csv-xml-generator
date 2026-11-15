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
const defaultGenerateSchema = document.querySelector('#default-generate-schema');
const csvGeneratePattern = document.querySelector('#csv-generate-pattern');
const csvGenerateRules = document.querySelector('#csv-generate-rules');
const csvGeneratorQuestions = document.querySelector('#csv-generator-questions');
const csvGeneratorMessage = document.querySelector('#csv-generator-message');
const csvGeneratorRuleTemplate = generatorRuleTemplate;
const csvForm = document.querySelector('#csv-form');
const csvFileInput = document.querySelector('#csv-file');
const csvDropzone = document.querySelector('#csv-dropzone');
const csvNameInput = document.querySelector('#csv-name');
const csvMessage = document.querySelector('#csv-message');
const csvEditor = document.querySelector('#csv-editor');
const csvColumns = document.querySelector('#csv-columns');
const csvPreview = document.querySelector('#csv-preview');
const csvUploadTitle = document.querySelector('#csv-upload-title');
const csvUploadSubtitle = document.querySelector('#csv-upload-subtitle');
const csvColumnCount = document.querySelector('#csv-column-count');
const csvMeta = document.querySelector('#csv-meta');
const csvRowCount = document.querySelector('#csv-row-count');
const csvSavedGrid = document.querySelector('#csv-saved-grid');
const csvEmpty = document.querySelector('#csv-empty');
const csvSavedCount = document.querySelector('#csv-saved-count');
const csvDownload = document.querySelector('#csv-download');
const csvExtractVisible = document.querySelector('#csv-extract-visible');
const csvExtractAll = document.querySelector('#csv-extract-all');
const csvDraftName = document.querySelector('#csv-draft-name');
const csvSaveDraft = document.querySelector('#csv-save-draft');
const csvPreviewWrap = document.querySelector('.csv-preview-wrap');
const csvScrollTop = document.querySelector('#csv-scroll-top');
const csvScrollBottom = document.querySelector('#csv-scroll-bottom');
const csvSelectAll = document.querySelector('#csv-select-all');
const csvDeselectAll = document.querySelector('#csv-deselect-all');
const csvCollapseFields = document.querySelector('#csv-collapse-fields');
const csvFieldsPanel = document.querySelector('#csv-fields-panel');
let selectedFile = null;
let selectedCsvFile = null;
let currentCsv = null;
let editingRuleName = null;
let activeRuleType = 'local';

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
const rulePath = type => `/api/mapping-rules?type=${type}`;
const getRules = async type => type ? request(rulePath(type)) : (await Promise.all(['local', 'mandatory'].map(scope => request(rulePath(scope))))).flat();
const deleteRule = (name, type) => request(`/api/mapping-rules/${encodeURIComponent(name)}?type=${type}`, { method: 'DELETE' });
const getCsvFiles = () => request('/api/csv-files');
const deleteCsvFile = name => request(`/api/csv-files/${encodeURIComponent(name)}`, { method: 'DELETE' });

function parseCsvFile(file) {
  return new Promise((resolve, reject) => Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    complete: result => {
      if (result.errors.length) { reject(new Error(`CSV could not be read: ${result.errors[0].message}`)); return; }
      const fields = result.meta.fields || [];
      if (!fields.length) { reject(new Error('The CSV needs a header row with at least one column.')); return; }
      resolve({ fileName: file.name, delimiter: result.meta.delimiter || ',', fields, rows: result.data });
    },
    error: error => reject(error instanceof Error ? error : new Error('The CSV could not be read.'))
  }));
}
function renderCsvEditor() {
  if (!currentCsv) { csvEditor.hidden = true; return; }
  const columns = currentCsv.columns;
  const visibleColumns = columns.filter(column => column.visible !== false);
  csvEditor.hidden = false;
  csvColumnCount.textContent = `(${visibleColumns.length}/${columns.length} visible)`;
  if (csvRowCount) csvRowCount.textContent = `${currentCsv.rows.length} ${currentCsv.rows.length === 1 ? 'row' : 'rows'}`;
  const delimiterName = currentCsv.delimiter === '\t' ? 'TAB' : currentCsv.delimiter;
  if (csvMeta) csvMeta.textContent = `${currentCsv.fileName} · delimiter ${delimiterName}`;
  csvColumns.innerHTML = '';
  columns.forEach((column, index) => {
    const card = document.createElement('label'); card.className = 'csv-column';
    card.innerHTML = `<span class="csv-column-number">${String(index + 1).padStart(2, '0')}</span><span class="csv-column-original">${column.name}</span><code class="csv-column-path">${column.name}</code><span class="csv-column-toggle"><input type="checkbox" ${column.visible !== false ? 'checked' : ''} aria-label="Show ${column.name}" /><span>Show column</span></span>`;
    card.querySelector('input').onchange = event => { column.visible = event.target.checked; renderCsvEditor(); };
    csvColumns.append(card);
  });
  renderCsvPreview();
}
function renderCsvPreview() {
  if (!currentCsv) return;
  const columns = currentCsv.columns.filter(column => column.visible !== false);
  csvPreview.innerHTML = `<thead><tr>${columns.map(column => `<th>${column.name}</th>`).join('')}</tr></thead><tbody>${currentCsv.rows.map((row, rowIndex) => `<tr>${columns.map(column => `<td><input class="csv-cell-input" value="${String(row[column.name] ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" aria-label="${column.name}, row ${rowIndex + 1}" /></td>`).join('')}</tr>`).join('')}</tbody>`;
  csvPreview.querySelectorAll('.csv-cell-input').forEach(input => {
    const rowIndex = Number(input.getAttribute('aria-label').match(/row (\d+)$/)[1]) - 1;
    const column = columns.find(item => item.name === input.getAttribute('aria-label').replace(/, row \d+$/, ''));
    input.oninput = event => { currentCsv.rows[rowIndex][column.name] = event.target.value; };
  });
}
function csvForDownload(includeHidden = false) {
  const columns = includeHidden ? currentCsv.columns : currentCsv.columns.filter(column => column.visible !== false);
  const fields = columns.map(column => column.name);
  const data = currentCsv.rows.map(row => columns.map(column => row[column.name] ?? ''));
  return Papa.unparse({ fields, data }, { delimiter: currentCsv.delimiter });
}
async function loadCsv(file) {
  try {
    currentCsv = await parseCsvFile(file);
    selectedCsvFile = file;
    currentCsv.columns = currentCsv.fields.map(name => ({ name, visible: true }));
    csvUploadTitle.textContent = file.name;
    csvUploadSubtitle.textContent = `${currentCsv.rows.length} ${currentCsv.rows.length === 1 ? 'row' : 'rows'} ready to review`;
    csvMessage.textContent = '';
    renderCsvEditor();
  } catch (error) { csvMessage.textContent = error.message; }
}
function renderSavedCsvFiles(files) {
  csvSavedGrid.innerHTML = '';
  csvSavedCount.textContent = `(${files.length})`;
  csvEmpty.hidden = files.length > 0;
  files.forEach(file => {
    const card = document.createElement('article'); card.className = 'csv-saved-card';
    card.innerHTML = `<div class="schema-card-top"><span class="file-type">CSV</span><button class="delete-button" type="button" aria-label="Delete CSV">×</button></div><h3>${file.name}</h3><p class="schema-meta">${file.columns.length} columns · ${file.rows.length} rows</p><button class="view-button csv-open" type="button">Open fields <span>→</span></button>`;
    card.querySelector('.csv-open').onclick = () => { currentCsv = { name: file.name, fileName: file.fileName, delimiter: file.delimiter, columns: file.columns.map(column => ({ name: column.name, visible: column.visible !== false })), rows: file.rows }; csvNameInput.value = file.name; renderCsvEditor(); document.querySelector('#csv-editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    card.querySelector('.delete-button').onclick = async () => { await deleteCsvFile(file.name); renderSavedCsvLibrary(); };
    csvSavedGrid.append(card);
  });
}
async function renderSavedCsvLibrary() { renderSavedCsvFiles(await getCsvFiles()); }

function flattenFields(value, path = '') {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).flatMap(([key, child]) => flattenFields(child, path ? `${path}.${key}` : key));
  if (Array.isArray(value)) return value.length ? flattenFields(value[0], `${path}[]`) : [path ? `${path}[]` : '[]'];
  return [path || '(root)'];
}
async function schemaOptions() {
  const [schemas, csvFiles] = await Promise.all([getPatterns(), getCsvFiles()]);
  const options = [...schemas.map(schema => ({ name: schema.name })), ...csvFiles.map(file => ({ name: `CSV - ${file.name}` }))];
  [sourceSchema, targetSchema].forEach(select => {
    const previous = select.value;
    select.innerHTML = '<option value="">Choose a schema…</option>';
    options.forEach(option => select.add(new Option(option.name, option.name)));
    select.value = previous;
  });
}
async function fieldsFor(schemaName) {
  if (schemaName.startsWith('CSV - ')) {
    const csvFiles = await getCsvFiles();
    const csv = csvFiles.find(file => `CSV - ${file.name}` === schemaName);
    return csv ? csv.columns.map(column => column.name) : [];
  }
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
async function addMappingRow(sourceValue = '', targetValue = '', sourceLabel = '', targetLabel = '') {
  const [sourceFields, targetFields] = await Promise.all([fieldsFor(sourceSchema.value), fieldsFor(targetSchema.value)]);
  const row = rowTemplate.content.cloneNode(true);
  const source = makeFieldSelect(sourceFields, 'Choose source field…'); source.className = 'source-field';
  const target = makeFieldSelect(targetFields, 'Choose target field…'); target.className = 'target-field';
  row.querySelector('.source-field').replaceWith(source); row.querySelector('.target-field').replaceWith(target);
  source.value = sourceValue; target.value = targetValue;
  row.querySelector('.source-label').value = sourceLabel; row.querySelector('.target-label').value = targetLabel;
  row.querySelector('.remove-row').onclick = event => { event.currentTarget.closest('.mapping-row').remove(); };
  mappingRows.append(row);
}
async function updateMappingBuilder() {
  const ready = sourceSchema.value && targetSchema.value;
  mappingEmpty.hidden = Boolean(ready); mappingTable.hidden = !ready;
  mappingRows.innerHTML = '';
  if (ready) await addMappingRow();
}
function resetRuleBuilder() {
  editingRuleName = null;
  document.querySelector('#rule-name').value = '';
  document.querySelector('#rule-name').readOnly = false;
  document.querySelector('#save-rule').innerHTML = 'Save mapping rule <span>→</span>';
  sourceSchema.value = ''; targetSchema.value = ''; mappingRows.innerHTML = '';
  mappingTable.hidden = true; mappingEmpty.hidden = false; ruleMessage.textContent = '';
}
function updateRuleTypeLabels() {
  const local = activeRuleType === 'local';
  const typeName = local ? 'Local' : 'Mandatory';
  document.querySelector('#rule-builder-title').textContent = `Create a ${typeName.toLowerCase()} mapping rule`;
  document.querySelector('#rule-builder-text').textContent = local ? 'Local mapping rules are saved only on this computer and are not committed to Git.' : 'Mandatory mapping rules are saved locally and can be shared with the project through Git.';
  document.querySelector('#rule-library-eyebrow').textContent = `SAVED ${typeName.toUpperCase()} RULES`;
  document.querySelector('#rule-library-title').innerHTML = `${typeName} Mapping Rules <span id="rule-count">(0)</span>`;
  document.querySelector('#rules-empty-text').textContent = `Your saved ${typeName.toLowerCase()} mapping rules will appear here.`;
}
function renderFieldLibrary(rules, mandatoryRules = []) {
  const list = document.querySelector('#field-library-list');
  const empty = document.querySelector('#field-library-empty');
  const detail = document.querySelector('#field-library-detail');
  const search = document.querySelector('#field-library-search');
  const transfer = document.querySelector('#field-transfer');
  const edit = document.querySelector('#field-edit');
  const remove = document.querySelector('#field-remove');
  const detailMessage = document.querySelector('#field-library-message');
  const targetType = activeRuleType === 'local' ? 'mandatory' : 'local';
  const targetTypeName = targetType === 'mandatory' ? 'Mandatory' : 'Local';
  const fields = rules.flatMap(rule => rule.mappings.flatMap((mapping, mappingIndex) => {
    const entries = [];
    const oppositeRule = mandatoryRules.find(otherRule => otherRule.name === rule.name);
    const oppositeMapping = oppositeRule?.mappings.find(otherMapping => otherMapping.source === mapping.source && otherMapping.target === mapping.target);
    const sameMapping = Boolean(oppositeMapping);
    if (mapping.sourceLabel?.trim()) entries.push({ name: mapping.sourceLabel.trim(), rule: rule.name, ruleData: rule, mappingIndex, labelKey: 'sourceLabel', transferred: Boolean(sameMapping && oppositeMapping.sourceLabel?.trim() === mapping.sourceLabel.trim()), schema: rule.sourceSchema, path: mapping.source, counterpart: mapping.targetLabel?.trim() || mapping.target });
    if (mapping.targetLabel?.trim()) entries.push({ name: mapping.targetLabel.trim(), rule: rule.name, ruleData: rule, mappingIndex, labelKey: 'targetLabel', transferred: Boolean(sameMapping && oppositeMapping.targetLabel?.trim() === mapping.targetLabel.trim()), schema: rule.targetSchema, path: mapping.target, counterpart: mapping.sourceLabel?.trim() || mapping.source });
    return entries;
  }));
  list.innerHTML = ''; detail.hidden = true; empty.hidden = fields.length > 0; detailMessage.textContent = '';
  fields.forEach(field => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = field.name;
    button.onclick = () => {
      list.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      document.querySelector('#field-detail-name').textContent = field.name;
      document.querySelector('#field-detail-rule').textContent = field.rule;
      document.querySelector('#field-detail-schema').textContent = field.schema;
      document.querySelector('#field-detail-path').textContent = field.path;
      document.querySelector('#field-detail-counterpart').textContent = field.counterpart;
      transfer.hidden = false;
      transfer.disabled = field.transferred;
      transfer.innerHTML = field.transferred ? `Already in ${targetTypeName} Rules` : `Transfer field to ${targetTypeName} <span>→</span>`;
      detailMessage.textContent = field.transferred ? `This rule is already available in ${targetTypeName} Rules.` : '';
      transfer.onclick = async () => {
        transfer.disabled = true; detailMessage.textContent = 'Transferring rule…';
        try {
          const targetRule = mandatoryRules.find(otherRule => otherRule.name === field.rule);
          const sourceMapping = field.ruleData.mappings[field.mappingIndex];
          const transferredMapping = { ...sourceMapping, sourceLabel: '', targetLabel: '', [field.labelKey]: field.name };
          const method = targetRule ? 'PUT' : 'POST';
          const path = targetRule ? `/api/mapping-rules/${encodeURIComponent(field.rule)}?type=${targetType}` : rulePath(targetType);
          const targetMappings = targetRule
            ? targetRule.mappings.some(mapping => mapping.source === sourceMapping.source && mapping.target === sourceMapping.target)
              ? targetRule.mappings.map(mapping => mapping.source === sourceMapping.source && mapping.target === sourceMapping.target ? { ...mapping, [field.labelKey]: field.name } : mapping)
              : [...targetRule.mappings, transferredMapping]
            : [transferredMapping];
          const transferredRule = { ...field.ruleData, mappings: targetMappings };
          await request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transferredRule) });
          field.transferred = true;
          transfer.innerHTML = `Already in ${targetTypeName} Rules`;
          detailMessage.textContent = `Field transferred to ${targetTypeName} Rules.`;
        } catch (error) {
          detailMessage.textContent = error.message;
          transfer.disabled = false;
        }
      };
      edit.onclick = () => editRule(field.ruleData);
      remove.onclick = async () => {
        if (!confirm(`Remove “${field.name}” and its field mapping?`)) return;
        const updatedMappings = field.ruleData.mappings.map((mapping, index) => index === field.mappingIndex ? { ...mapping, [field.labelKey]: '' } : mapping);
        const updatedRule = { ...field.ruleData, mappings: updatedMappings };
        await request(`/api/mapping-rules/${encodeURIComponent(field.rule)}?type=${activeRuleType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedRule) });
        await renderRules();
      };
      detail.hidden = false;
    };
    list.append(button);
  });
  const filterFields = () => {
    const query = search.value.trim().toLowerCase();
    let matches = 0;
    list.querySelectorAll('button').forEach(button => {
      const match = button.textContent.toLowerCase().includes(query);
      button.hidden = !match;
      if (match) matches += 1;
    });
    empty.hidden = fields.length > 0 && matches > 0;
    if (fields.length > 0 && matches === 0) empty.textContent = 'No friendly fields match your search.';
    else empty.textContent = 'No friendly fields saved yet.';
  };
  search.oninput = filterFields;
  filterFields();
}
async function editRule(rule) {
  editingRuleName = rule.name;
  document.querySelector('#rule-name').value = rule.name;
  document.querySelector('#rule-name').readOnly = true;
  sourceSchema.value = rule.sourceSchema; targetSchema.value = rule.targetSchema;
  mappingEmpty.hidden = true; mappingTable.hidden = false; mappingRows.innerHTML = '';
  for (const mapping of rule.mappings) await addMappingRow(mapping.source, mapping.target, mapping.sourceLabel, mapping.targetLabel);
  document.querySelector('#save-rule').innerHTML = 'Update mapping rule <span>→</span>';
  ruleMessage.textContent = `Editing “${rule.name}”.`;
  document.querySelector('.mapping-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function renderRules() {
  const rules = await getRules(activeRuleType);
  const otherRules = await getRules(activeRuleType === 'local' ? 'mandatory' : 'local');
  renderFieldLibrary(rules, otherRules);
  const rulesGrid = document.querySelector('#rules-grid');
  rulesGrid.innerHTML = '';
  document.querySelector('#rule-count').textContent = `(${rules.length})`;
  document.querySelector('#rules-empty').hidden = rules.length > 0;
  rules.forEach(rule => {
    const card = ruleTemplate.content.cloneNode(true);
    card.querySelector('h3').textContent = rule.name;
    card.querySelector('.rule-meta').textContent = `${rule.mappings.length} field ${rule.mappings.length === 1 ? 'mapping' : 'mappings'}`;
    card.querySelector('.edit-rule').onclick = () => editRule(rule);
    card.querySelector('.rule-connection').innerHTML = `${rule.sourceSchema} <span>→</span> ${rule.targetSchema}`;
    card.querySelector('.delete-rule').onclick = async () => { await deleteRule(rule.name, activeRuleType); renderRules(); };
    rulesGrid.append(card);
  });
}
async function generatorSchemaOptions() {
  const schemas = await getPatterns();
  const current = new Set([...generateSchema.selectedOptions].map(option => option.value));
  const defaultCurrent = new Set([...defaultGenerateSchema.selectedOptions].map(option => option.value));
  generateSchema.innerHTML = '<option value="">Choose an imported schema…</option>';
  schemas.forEach(schema => generateSchema.add(new Option(schema.name, schema.name)));
  defaultGenerateSchema.innerHTML = '<option value="">Choose an imported schema</option>';
  schemas.forEach(schema => defaultGenerateSchema.add(new Option(schema.name, schema.name)));
  [...generateSchema.options].forEach(option => { option.selected = current.has(option.value); });
  [...defaultGenerateSchema.options].forEach(option => { option.selected = defaultCurrent.has(option.value); });
  renderEntityPicker(generateSchema); renderEntityPicker(defaultGenerateSchema);
}
async function csvGeneratorOptions() {
  const csvFiles = await getCsvFiles();
  const previous = csvGeneratePattern.value;
  csvGeneratePattern.innerHTML = '<option value="">Choose a CSV pattern…</option>';
  csvFiles.forEach(file => csvGeneratePattern.add(new Option(file.name, file.name)));
  csvGeneratePattern.value = previous;
  updateCsvGenerator();
}
async function updateCsvGenerator() {
  const patternName = csvGeneratePattern.value;
  const rulesSection = document.querySelector('#csv-generate-rules-section');
  const questionsSection = document.querySelector('#csv-generator-questions-section');
  const emptyState = document.querySelector('#csv-generator-empty');
  csvGenerateRules.innerHTML = ''; csvGeneratorQuestions.innerHTML = ''; csvGeneratorMessage.textContent = '';
  if (!patternName) { rulesSection.hidden = true; questionsSection.hidden = true; emptyState.hidden = false; return; }
  const rules = (await getRules()).filter(rule => rule.targetSchema === `CSV - ${patternName}`);
  emptyState.hidden = rules.length > 0; rulesSection.hidden = rules.length === 0; questionsSection.hidden = rules.length === 0;
  if (!rules.length) { emptyState.textContent = 'No mapping rules target this CSV pattern.'; return; }
  rules.forEach(rule => {
    const node = csvGeneratorRuleTemplate.content.cloneNode(true);
    const checkbox = node.querySelector('input'); checkbox.value = rule.name; checkbox.dataset.rule = JSON.stringify(rule); checkbox.onchange = refreshCsvGeneratorQuestions;
    node.querySelector('.generator-rule-name').textContent = rule.name;
    node.querySelector('small').textContent = `${rule.sourceSchema} → ${rule.targetSchema}`;
    csvGenerateRules.append(node);
  });
}
async function csvSourceValue(rule, field) {
  if (rule.sourceSchema.startsWith('CSV - ')) {
    const csv = (await getCsvFiles()).find(file => `CSV - ${file.name}` === rule.sourceSchema);
    return csv?.rows[0]?.[field] ?? '';
  }
  const schema = (await getPatterns()).find(item => item.name === rule.sourceSchema);
  return schema ? valueAtPath(JSON.parse(schema.json), field) ?? '' : '';
}
async function refreshCsvGeneratorQuestions() {
  const fields = new Map();
  [...csvGenerateRules.querySelectorAll('input:checked')].forEach(input => {
    const rule = JSON.parse(input.dataset.rule);
    rule.mappings.forEach(mapping => fields.set(`${rule.sourceSchema}:${mapping.source}`, { rule, mapping, field: mapping.source, friendlyName: mapping.sourceLabel }));
  });
  csvGeneratorQuestions.innerHTML = '';
  for (const { rule, mapping, field, friendlyName } of fields.values()) {
    const input = inputForField(field, await csvSourceValue(rule, field), rule.sourceSchema, friendlyName);
    input.querySelector('input').dataset.targetField = mapping.target;
    csvGeneratorQuestions.append(input);
  }
}
async function generateCsvFile() {
  try {
    const csv = (await getCsvFiles()).find(file => file.name === csvGeneratePattern.value);
    if (!csv) throw new Error('Choose a CSV pattern.');
    const row = { ...(csv.rows[0] || {}) };
    [...csvGeneratorQuestions.querySelectorAll('input')].forEach(input => { if (input.value.trim()) input.dataset.targetField && (row[input.dataset.targetField] = input.value.trim()); });
    const columns = csv.columns.filter(column => column.visible !== false);
    const output = Papa.unparse({ fields: columns.map(column => column.name), data: [columns.map(column => row[column.name] ?? '')] }, { delimiter: csv.delimiter });
    const result = await request('/api/generated-csv-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: csv.name, csv: output }) });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([output], { type: 'text/csv;charset=utf-8' })), download: result.filename });
    link.click(); URL.revokeObjectURL(link.href); csvGeneratorMessage.textContent = `Generated and saved ${result.filename}.`;
  } catch (error) { csvGeneratorMessage.textContent = error.message; }
}
const selectedEntities = select => [...select.selectedOptions].map(option => option.value).filter(Boolean);
function entityPickerFor(select) {
  return document.querySelector(`.entity-picker[data-select="${select.id}"]`);
}
function renderEntityPicker(select) {
  const picker = entityPickerFor(select);
  const toggle = picker.querySelector('.entity-picker-toggle');
  const options = picker.querySelector('.entity-picker-options');
  const selected = selectedEntities(select);
  toggle.textContent = selected.length ? `${selected.length} ${selected.length === 1 ? 'entity' : 'entities'} selected` : 'Select entities';
  options.innerHTML = '';
  [...select.options].filter(option => option.value).forEach(option => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = option.selected;
    checkbox.onchange = () => { option.selected = checkbox.checked; renderEntityPicker(select); select.dispatchEvent(new Event('change')); };
    label.append(checkbox, document.createTextNode(option.text)); options.append(label);
  });
}
function setupEntityPicker(select) {
  const picker = entityPickerFor(select);
  const toggle = picker.querySelector('.entity-picker-toggle');
  const panel = picker.querySelector('.entity-picker-panel');
  const search = picker.querySelector('.entity-picker-search');
  toggle.onclick = () => { const opening = panel.hidden; document.querySelectorAll('.entity-picker-panel').forEach(item => { item.hidden = true; }); panel.hidden = !opening; toggle.setAttribute('aria-expanded', String(opening)); if (opening) search.focus(); };
  search.oninput = () => {
    const query = search.value.trim().toLowerCase();
    picker.querySelectorAll('.entity-picker-options label').forEach(label => {
      label.hidden = query.length >= 3 && !label.textContent.toLowerCase().includes(query);
    });
  };
  document.addEventListener('click', event => { if (!picker.contains(event.target)) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } });
}
setupEntityPicker(generateSchema);
setupEntityPicker(defaultGenerateSchema);
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
function inputForField(field, example, entity = '', friendlyName = '') {
  const label = document.createElement('label');
  const isDate = isDateLike(field, example);
  label.innerHTML = `<span>Value for <code>${field}</code>${isDate ? ' · Date: YYYY-MM-DD HH:mm:ss' : ''}</span>`;
  if (entity) label.querySelector('span').prepend(`${entity} — ${friendlyName || field} `);
  const input = document.createElement('input'); input.dataset.field = field; input.dataset.entity = entity; input.placeholder = isDate ? 'e.g. 2026-08-02 14:30:00' : 'Keep example value if blank';
  if (isDate) { input.dataset.date = 'true'; input.dataset.example = example; input.inputMode = 'numeric'; }
  label.append(input); return label;
}
async function updateGenerator() {
  const entities = selectedEntities(generateSchema);
  const emptyGenerator = document.querySelector('#generator-empty');
  const section = document.querySelector('#generate-rules-section');
  const questionsSection = document.querySelector('#generator-questions-section');
  generateRules.innerHTML = ''; generatorQuestions.innerHTML = ''; generatorMessage.textContent = '';
  if (!entities.length) { emptyGenerator.hidden = false; section.hidden = true; questionsSection.hidden = true; return; }
  const rules = (await getRules()).filter(rule => entities.includes(rule.sourceSchema) || entities.includes(rule.targetSchema));
  emptyGenerator.hidden = rules.length > 0; section.hidden = rules.length === 0; questionsSection.hidden = false;
  if (!rules.length) { emptyGenerator.textContent = 'No saved mapping rules are connected to the selected entities. They can still be generated with their default values.'; return; }
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
  const entities = selectedEntities(generateSchema);
  const fields = new Map();
  [...generateRules.querySelectorAll('input:checked')].forEach(input => {
    const rule = JSON.parse(input.dataset.rule);
    entities.forEach(entity => {
      if (rule.sourceSchema === entity) rule.mappings.forEach(mapping => fields.set(`${entity}:${mapping.source}`, { entity, field: mapping.source, friendlyName: mapping.sourceLabel }));
      if (rule.targetSchema === entity) rule.mappings.forEach(mapping => fields.set(`${entity}:${mapping.target}`, { entity, field: mapping.target, friendlyName: mapping.targetLabel }));
    });
  });
  const schemas = await getPatterns();
  generatorQuestions.innerHTML = '';
  fields.forEach(({ entity, field, friendlyName }) => {
    const schema = schemas.find(item => item.name === entity);
    generatorQuestions.append(inputForField(field, valueAtPath(schema ? JSON.parse(schema.json) : {}, field), entity, friendlyName));
  });
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
    const entities = selectedEntities(generateSchema);
    if (!entities.length) throw new Error('Choose at least one entity.');
    const schemas = await getPatterns(); const results = [];
    for (const entity of entities) {
      const schema = schemas.find(item => item.name === entity);
      if (!schema) throw new Error(`The selected schema “${entity}” could not be found.`);
      const generated = JSON.parse(schema.json);
      [...generatorQuestions.querySelectorAll('input')].filter(input => input.dataset.entity === entity).forEach(input => {
        if (!input.value.trim()) return;
        const value = input.dataset.date ? formatDateForExample(input.value, input.dataset.example) : input.value.trim();
        setValueAtPath(generated, input.dataset.field, value);
      });
      results.push(await saveGeneratedFile(entity, generated));
    }
    generatorMessage.textContent = `Generated and saved ${results.length} ${results.length === 1 ? 'file' : 'files'} locally.`;
  } catch (error) { generatorMessage.textContent = error.message; }
}
async function saveGeneratedFile(entity, generated) {
  const json = JSON.stringify(generated, null, 2);
  const result = await request('/api/generated-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity, json }) });
  const blob = new Blob([json], { type: 'application/json' }); const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: result.filename }); link.click(); URL.revokeObjectURL(link.href);
  return result;
}
async function generateDefaultFile() {
  const defaultMessage = document.querySelector('#default-generator-message');
  try {
    const entities = selectedEntities(defaultGenerateSchema);
    if (!entities.length) throw new Error('Choose at least one entity.');
    const schemas = await getPatterns(); const results = [];
    for (const entity of entities) {
      const schema = schemas.find(item => item.name === entity);
      if (!schema) throw new Error(`The selected schema “${entity}” could not be found.`);
      results.push(await saveGeneratedFile(entity, JSON.parse(schema.json)));
    }
    defaultMessage.textContent = `Generated and saved ${results.length} ${results.length === 1 ? 'file' : 'files'} locally.`;
  } catch (error) { defaultMessage.textContent = error.message; }
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
csvFileInput.onchange = e => loadCsv(e.target.files[0]);
['dragenter','dragover'].forEach(event => csvDropzone.addEventListener(event, e => { e.preventDefault(); csvDropzone.classList.add('dragging'); }));
['dragleave','drop'].forEach(event => csvDropzone.addEventListener(event, e => { e.preventDefault(); csvDropzone.classList.remove('dragging'); }));
csvDropzone.addEventListener('drop', e => loadCsv(e.dataTransfer.files[0]));
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
csvForm.onsubmit = async event => {
  event.preventDefault();
  if (!currentCsv) { csvMessage.textContent = 'Import a CSV file first.'; return; }
  try {
    const name = csvNameInput.value.trim();
    const saved = await saveCsvPattern(name);
    csvMessage.textContent = `Saved ${saved.name} to the CSV library.`;
    await renderSavedCsvLibrary();
  } catch (error) { csvMessage.textContent = error.message; }
};
async function saveCsvPattern(name) {
  const existingName = currentCsv.name;
  const method = existingName ? 'PUT' : 'POST';
  const path = existingName ? `/api/csv-files/${encodeURIComponent(existingName)}` : '/api/csv-files';
  const saved = await request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, fileName: currentCsv.fileName, delimiter: currentCsv.delimiter, columns: currentCsv.columns, rows: currentCsv.rows }) });
  currentCsv.name = saved.name;
  return saved;
}
csvSelectAll.onclick = () => { if (!currentCsv) return; currentCsv.columns.forEach(column => { column.visible = true; }); renderCsvEditor(); };
csvDeselectAll.onclick = () => { if (!currentCsv) return; currentCsv.columns.forEach(column => { column.visible = false; }); renderCsvEditor(); };
csvCollapseFields.onclick = () => {
  const collapsed = csvFieldsPanel.classList.toggle('collapsed');
  csvCollapseFields.innerHTML = collapsed ? 'Show fields <span>⌄</span>' : 'Hide fields <span>⌃</span>';
  csvCollapseFields.setAttribute('aria-expanded', String(!collapsed));
};
function downloadCsv(includeHidden) {
  if (!currentCsv) return;
  const csv = csvForDownload(includeHidden);
  const downloadName = `${csvNameInput.value.trim() || currentCsv.fileName.replace(/\.csv$/i, '')}-edited.csv`;
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: downloadName });
  link.click(); URL.revokeObjectURL(link.href);
}
csvExtractVisible.onclick = () => downloadCsv(false);
csvExtractAll.onclick = () => downloadCsv(true);
csvSaveDraft.onclick = async () => {
  const draftName = csvDraftName.value.trim();
  if (!draftName) { csvMessage.textContent = 'Enter a new draft pattern name.'; return; }
  try {
    const saved = await request('/api/csv-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draftName, fileName: currentCsv.fileName, delimiter: currentCsv.delimiter, columns: currentCsv.columns, rows: currentCsv.rows }) });
    csvMessage.textContent = `Saved ${saved.name} as a new draft pattern.`;
    csvDraftName.value = '';
    await renderSavedCsvLibrary();
  } catch (error) { csvMessage.textContent = error.message; }
};
csvScrollTop.onclick = () => csvPreviewWrap.scrollTo({ top: 0, behavior: 'auto' });
csvScrollBottom.onclick = () => csvPreviewWrap.scrollTo({ top: csvPreviewWrap.scrollHeight, behavior: 'auto' });
sourceSchema.onchange = updateMappingBuilder; targetSchema.onchange = updateMappingBuilder;
document.querySelector('#add-mapping').onclick = addMappingRow;
document.querySelectorAll('.rule-type-tab').forEach(tab => tab.onclick = async () => {
  activeRuleType = tab.dataset.ruleType;
  document.querySelectorAll('.rule-type-tab').forEach(item => item.classList.toggle('active', item === tab));
  resetRuleBuilder(); updateRuleTypeLabels(); await renderRules();
});
document.querySelector('#save-rule').onclick = async () => {
  const mappings = [...mappingRows.querySelectorAll('.mapping-row')].map(row => ({ source: row.querySelector('.source-field').value, sourceLabel: row.querySelector('.source-label').value.trim(), target: row.querySelector('.target-field').value, targetLabel: row.querySelector('.target-label').value.trim() })).filter(mapping => mapping.source && mapping.target);
  try {
    const rule = { name: document.querySelector('#rule-name').value.trim(), sourceSchema: sourceSchema.value, targetSchema: targetSchema.value, mappings };
    await request(editingRuleName ? `/api/mapping-rules/${encodeURIComponent(editingRuleName)}?type=${activeRuleType}` : rulePath(activeRuleType), { method: editingRuleName ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) });
    resetRuleBuilder(); renderRules();
  } catch (error) { ruleMessage.textContent = error.message; }
};
generateSchema.onchange = updateGenerator;
document.querySelector('#generate-file').onclick = generateFile;
document.querySelector('#generate-default-file').onclick = generateDefaultFile;
csvGeneratePattern.onchange = updateCsvGenerator;
document.querySelector('#generate-csv-file').onclick = generateCsvFile;
document.querySelectorAll('.generator-tab').forEach(tab => tab.onclick = () => {
  const isDefault = tab.dataset.generatorView === 'default';
  const isCsv = tab.dataset.generatorView === 'csv';
  document.querySelectorAll('.generator-tab').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelector('#default-creation').hidden = !isDefault;
  document.querySelector('#custom-creation').hidden = isDefault || isCsv;
  document.querySelector('#csv-creation').hidden = !isCsv;
  if (isCsv) csvGeneratorOptions();
});
document.querySelectorAll('.tab').forEach(tab => tab.onclick = async () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelector('#schemas-page').hidden = tab.dataset.view !== 'schemas';
  document.querySelector('#csv-page').hidden = tab.dataset.view !== 'csv';
  document.querySelector('#mappings-page').hidden = tab.dataset.view !== 'mappings';
  document.querySelector('#generate-page').hidden = tab.dataset.view !== 'generate';
  if (tab.dataset.view === 'csv') await renderSavedCsvLibrary();
  if (tab.dataset.view === 'mappings') { updateRuleTypeLabels(); await schemaOptions(); await renderRules(); }
  if (tab.dataset.view === 'generate') { await generatorSchemaOptions(); await csvGeneratorOptions(); await updateGenerator(); }
});
document.querySelector('#close-dialog').onclick = () => dialog.close();
if (location.protocol === 'file:') {
  serverNotice.hidden = false;
  serverNotice.textContent = 'This page was opened directly from a file. To save schemas, run “npm start” in this project folder and open http://127.0.0.1:4173.';
}
Promise.all([render(), renderSavedCsvLibrary(), schemaOptions(), renderRules(), generatorSchemaOptions(), csvGeneratorOptions()]).catch(error => { message.textContent = error.message; });
