# Schema Vault

Local-only tools for working with JSON and CSV files. Each file format has its own workspace so new functionality can be added without changing the existing workflows.

## Version 1.0 · JSON

The original JSON workspace is available through the `JSON` tab.

### Included

- Import and save representative JSON schemas
- Browse saved schemas in the Schema Vault
- Create Local and Mandatory mapping rules
- Assign friendly names to mapped JSON fields
- Inspect field paths and mapped counterparts in the field library
- Transfer individual friendly fields between Local and Mandatory rules
- Edit or remove individual friendly fields
- Generate default or customized JSON files

### Storage

- JSON schemas: `Schema Vault/`
- Local mapping rules: `Local Rules/`
- Mandatory mapping rules: `Mandatory Mapping Rules/`
- Generated JSON files: `Generated Files/`

The Version 1.0 JSON functionality remains the stable foundation of the project.

## Version 2.0 · CSV

The CSV workspace is available through the `CSV` tab and is separate from the JSON workflow.

### Included

- Import a CSV file
- Detect headers, rows, and delimiters
- Handle quoted values and commas inside fields
- Preview the original CSV columns and first rows
- Hide or show CSV columns in the pattern view
- Select or deselect all CSV columns at once
- Collapse the Pattern Fields panel to focus on the data preview
- Browse all records in a fixed preview window showing 10 records at a time
- Jump directly to the top or bottom of the preview
- Save column visibility without deleting raw CSV fields
- Save CSV files as reusable patterns locally
- Reopen and delete saved CSV patterns
- Use saved CSV patterns in Mapping Rules
- Assign friendly names in Mapping Rules instead of changing the CSV pattern
- Download the original CSV values and headers
- Generate a CSV row from mapping rules in the `Generate` tab
- Edit CSV cells directly in the preview
- Extract only visible columns or the complete edited file
- Save edits as a new draft pattern without overwriting the source pattern

### Storage

CSV definitions are stored locally in `CSV Vault/`. This folder is excluded from Git because it contains user-specific data.

## Future Versions

### Version 3.0 · XML

Planned XML support will have its own workspace and XML-specific field paths, parsing, preview, and export behavior.

### Final cross-format mapping

The long-term goal is to connect fields across JSON, CSV, and XML. The format-specific workspaces will remain separate, while a shared field model can eventually support mappings such as:

```text
CSV machine_number
   -> JSON machineInWeek.machine.equipmentNr
   -> XML MachineEquipmentNumber
```

Cross-format mapping will be introduced after the individual JSON, CSV, and XML workflows are stable.

## Run in VS Code

1. Extract this project to a folder on your laptop.
2. Open that folder in VS Code.
3. Open the integrated terminal and run:

   ```powershell
   npm start
   ```

4. Open http://127.0.0.1:4173 in your browser.

The server listens only on your laptop. All application data is stored locally in the project folders described above.

Requires Node.js 18 or newer.
