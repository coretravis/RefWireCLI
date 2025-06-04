import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer'; 
import Table from 'cli-table3';
import fs from 'fs/promises';
import path from 'path';

import * as api from '../lib/apiClient.js';
import * as listStorApi from '../lib/listStorClient.js';
import * as jsonProcessor from '../utils/jsonProcessor.js';
import { handleError } from '../utils/errorHandler.js';
import { printSuccess, printJson, printDatasetMetadata, printDatasetApi, printInfo, printError } from '../utils/outputFormatter.js';
import { readJsonFile } from '../utils/fileReader.js';

export default function registerDatasetCommands(program) {
    const datasetCommand = program.command('dataset')
        .description(`${chalk.yellow('[Admin]')} Manage Datasets`);

    datasetCommand
        .command('list-ids')
        .description('List the IDs of all available datasets')
        .action(async () => {
            try {
                const ids = await api.listDatasetIds();
                if (ids && ids.length > 0) {
                    printInfo('Available Dataset IDs:');
                    ids.forEach(id => console.log(`- ${id}`));
                } else {
                    printInfo('No datasets found.');
                }
            } catch (error) {
                handleError(error, 'dataset list-ids');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('get-meta')
        .description('Get the metadata (schema, description) for a specific dataset')
        .argument('<id>', 'The ID of the dataset')
        .action(async (id) => {
            try {
                const meta = await api.getDatasetMeta(id);
                printDatasetMetadata(meta);
            } catch (error) {
                handleError(error, 'dataset get-meta');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('get-api')
        .description('Get the api (schema, description) for a specific dataset')
        .argument('<id>', 'The ID of the dataset')
        .action(async (id) => {
            try {
                const meta = await api.getDatasetApi(id);
                printDatasetApi(meta);
            } catch (error) {
                handleError(error, 'dataset get-api');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('delete')
        .description('Deletes a dataset')
        .argument('<id>', 'The ID of the dataset')
        .option('-f, --force', 'Skip confirmation prompt')
        .action(async (id, options) => {
            try {
                // Attempt to get dataset metadata to confirm it exists and show info
                try {
                    const meta = await api.getDatasetMeta(id);
                    printInfo(`Dataset found: "${meta.name}" (${id})`);

                    if (meta.itemCount > 0) {
                        printInfo(`This dataset contains ${meta.itemCount} items that will be deleted.`);
                    }
                } catch (metaError) {
                    // Only warn if we can't get metadata, but continue with delete attempt
                    printError(`Warning: Could not retrieve dataset info: ${metaError.message}`);
                }

                // Confirm deletion unless --force option was used
                if (!options.force) {
                    const { confirmation } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirmation',
                            message: chalk.yellow(`Are you sure you want to delete dataset '${id}'? This action cannot be undone.`),
                            default: false
                        }
                    ]);

                    if (!confirmation) {
                        printInfo('Delete operation cancelled.');
                        return;
                    }
                }

                // Proceed with deletion
                printInfo(`Deleting dataset '${id}'...`);
                await api.deleteDataset(id);
                printSuccess(`Dataset '${id}' successfully deleted.`);
            } catch (error) {
                handleError(error, 'dataset delete');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('create')
        .description('Create a new dataset from a JSON file definition (non-interactive)')
        .requiredOption('-f, --file <path>', 'Path to a JSON file containing the dataset definition')
        .action(async (options) => {
            try {
                const datasetDef = readJsonFile(options.file);
                if (!datasetDef.id || !datasetDef.name || !datasetDef.idField || !datasetDef.nameField || !datasetDef.fields) {
                    throw new Error('JSON file must contain id, name, idField, nameField, and fields properties.');
                }
                const result = await api.createDataset(
                    datasetDef.id,
                    datasetDef.name,
                    datasetDef.description || '',
                    datasetDef.idField,
                    datasetDef.nameField,
                    datasetDef.fields,
                    datasetDef.items || {}
                );
                printSuccess(`Dataset '${result.id}' created successfully from file.`);
                printJson(result);
            } catch (error) {
                handleError(error, 'dataset create');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('update')
        .description('Update an existing dataset\'s name and fields from a JSON file')
        .argument('<id>', 'The ID of the dataset to update')
        .requiredOption('-f, --file <path>', 'Path to a JSON file containing { "name": "...", "fields": [...] }')
        .action(async (id, options) => {
            try {
                const updateData = readJsonFile(options.file);
                if (updateData.name === undefined || updateData.fields === undefined) { // Check presence, allow empty string/array
                    throw new Error('JSON file must contain "name" and "fields" properties for update.');
                }
                const result = await api.updateDataset(id, updateData.name, updateData.fields);
                printSuccess(`Dataset '${id}' updated successfully.`);
                printJson(result);
            } catch (error) {
                handleError(error, 'dataset update');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('get-state')
        .description('Retrieve the overall state snapshot of the RefWire system')
        .action(async () => {
            try {
                const state = await api.getSystemState();
                printInfo('Current System State:');
                printJson(state);
            } catch (error) {
                handleError(error, 'dataset get-state');
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('import')
        .description('Create a new dataset interactively via a wizard')
        .action(async () => {
            try {
                await runImportWizard();
                // Success message is printed at the end of the wizard function
            } catch (error) {
                // Catch errors specifically from the wizard steps
                if (error.message === 'Wizard cancelled.') {
                    printInfo('Dataset import cancelled.');
                } else if (error.message.startsWith('ListStor download failed')) {
                    // Specific handling for download errors if needed
                    handleError(error, 'dataset import (ListStor)');
                } else {
                    handleError(error, 'dataset import');
                }
                process.exitCode = 1;
            }
        });

    datasetCommand
        .command('pull')
        .description('Pull a dataset directly from ListStor')
        .argument('<liststorId>', 'The ID of the dataset to pull from ListStor')
        .option('-V, --dataset-version <version>', 'Dataset version to pull (semantic versioning, e.g. 1.0.0)')
        .option('-i, --id <datasetId>', 'Local dataset ID to create (defaults to ListStor ID)')
        .option('-n, --name <datasetName>', 'Human-readable name for the dataset (defaults to ListStor name)')
        .option('-d, --description <description>', 'Description for the dataset (defaults to ListStor description)')
        .option('--id-field <fieldName>', 'The field to use as unique ID')
        .option('--name-field <fieldName>', 'The field to use as display name')
        .action(async (liststorId, options) => {
            try {
                const datasetVersion = options.datasetVersion; 
                // If the user passed a version, validate it’s semver-ish
                if (datasetVersion) {
                    const semverRe = /^\d+\.\d+\.\d+$/;
                    if (!semverRe.test(datasetVersion)) {
                        throw new Error(`Invalid version '${datasetVersion}'. Expected format x.y.z`);
                    }
                    printInfo(`Using explicit version: ${datasetVersion}`);
                }



                // Initialize wizard state similar to the import wizard
                let wizardState = {
                    jsonContent: null,
                    parsedJson: null,
                    fields: [],
                    itemCount: 0,
                    datasetId: options.id || '',  
                    datasetName: options.name || '',
                    datasetDescription: options.description || '',
                    specifiedIdField: options.idField,
                    specifiedNameField: options.nameField
                };

                // Show operation details
                printInfo(`Pulling dataset '${liststorId}' from ListStor...`);

                // Construct the URL to pull from ListStor
                printInfo(`Attempting to download from ListStor`);
                var responseData = {};
                // Download the dataset
                try {
                    printInfo("Downloading dataset...");
                    responseData = await listStorApi.getDataset(liststorId, datasetVersion);

                    printInfo("Successfully downloaded dataset...");

                    // Use the response data properties as defaults if not provided
                    if (!wizardState.datasetId && responseData.meta.id) {
                        wizardState.datasetId = responseData.meta.id.toLowerCase();
                        printInfo(`Using ListStor ID as local dataset ID: '${wizardState.datasetId}'`);
                    }

                    if (!wizardState.datasetName && responseData.meta.title) {
                        wizardState.datasetName = responseData.meta.title;
                        printInfo(`Using ListStor name as local dataset name: '${wizardState.datasetName}'`);
                    }

                    if (!wizardState.datasetDescription && responseData.meta.description) {
                        wizardState.datasetDescription = responseData.meta.description;
                        printInfo(`Using ListStor summary as local dataset description`);
                    }

                    // Validate the downloaded content
                    try {
                        wizardState.jsonContent = responseData.data;
                        printSuccess(`Successfully downloaded dataset '${liststorId}' from ListStor.`);
                    } catch (parseError) {
                        throw new Error(`ListStor download failed: Content is not valid JSON. ${parseError.message}`);
                    }
                } catch (error) {
                    throw new Error(`ListStor download failed: ${error.message}`);
                }

                // Process and validate the JSON
                if (!jsonProcessor.validateAndProcessJson(wizardState)) {
                    throw new Error('JSON validation failed. Cannot proceed.');
                }

                printSuccess('JSON is valid and processed.');
                printInfo(`Detected ${wizardState.itemCount} items and ${wizardState.fields.length} unique fields.`);

                // Handle missing required parameters after attempting to use defaults
                if (!wizardState.datasetId) {
                    printInfo(`Dataset ID is not provided with --id parameter, using the dataset default: ${responseData.meta.idField}`);
                }

                if (!wizardState.datasetName) {
                    throw new Error('Dataset name is required. Provide it with --name parameter or ensure ListStor response includes a name.');
                }

                // Determine ID and Name fields
                const fieldNames = wizardState.fields.map(f => f.name);

                // Set ID field - either from parameter or attempt to find a suitable one
                if (wizardState.specifiedIdField) {
                    // Validate the specified ID field exists
                    if (!fieldNames.includes(wizardState.specifiedIdField)) {
                        throw new Error(`Specified ID field '${wizardState.specifiedIdField}' not found in dataset. Available fields: ${fieldNames.join(', ')}`);
                    }

                    // Mark the specified field as ID
                    wizardState.fields.forEach(f => {
                        f.isId = (f.name === wizardState.specifiedIdField);
                    });
                } else {

                    let idFieldFound = false;
                    const field = wizardState.fields.find(f => f.name === responseData.meta.idField);
                    if (field) {
                        field.isId = true;
                        idFieldFound = true;
                        printInfo(`Auto-selected '${field.name}' as ID field.`);
                    }

                    if (!idFieldFound) {
                        throw new Error('No ID field specified and could not auto-detect one. Use --id-field to specify which field to use as ID.');
                    }
                }

                // Set Name field - either from parameter or attempt to find a suitable one
                if (wizardState.specifiedNameField) {
                    // Validate the specified Name field exists
                    if (!fieldNames.includes(wizardState.specifiedNameField)) {
                        throw new Error(`Specified Name field '${wizardState.specifiedNameField}' not found in dataset. Available fields: ${fieldNames.join(', ')}`);
                    }

                    // Mark the specified field as Name
                    wizardState.fields.forEach(f => {
                        f.isName = (f.name === wizardState.specifiedNameField);
                    });
                } else {

                    let nameFieldFound = false;
                    const field = wizardState.fields.find(f => f.name === responseData.meta.nameField);
                    if (field) {
                        field.isName = true;
                        nameFieldFound = true;
                        printInfo(`Auto-selected '${field.name}' as Name field.`);
                    }
                    if (!nameFieldFound) {
                        throw new Error('No Name field specified and could not auto-detect one. Use --name-field to specify which field to use as Name.');
                    }
                }

                // Validate dataset ID format
                if (/\s/.test(wizardState.datasetId)) {
                    throw new Error('Dataset ID should not contain spaces.');
                }
                if (wizardState.datasetId !== wizardState.datasetId.toLowerCase()) {
                    wizardState.datasetId = wizardState.datasetId.toLowerCase();
                    printInfo(`Dataset ID normalized to lowercase: '${wizardState.datasetId}'`);
                }

                // Display confirmation of what will be created
                const idField = wizardState.fields.find(f => f.isId);
                const nameField = wizardState.fields.find(f => f.isName);

                console.log(chalk.cyan('\n--- Dataset Configuration ---'));
                console.log(` ${chalk.bold('Dataset ID:')}      ${wizardState.datasetId}`);
                console.log(` ${chalk.bold('Dataset Name:')}    ${wizardState.datasetName}`);
                console.log(` ${chalk.bold('Description:')}     ${wizardState.datasetDescription || chalk.dim('(none)')}`);
                console.log(` ${chalk.bold('ID Field:')}        ${idField.name} (${idField.dataType})`);
                console.log(` ${chalk.bold('Name Field:')}      ${nameField.name} (${nameField.dataType})`);
                console.log(` ${chalk.bold('Total Items:')}     ${wizardState.itemCount}`);
                console.log(` ${chalk.bold('Fields:')}          ${fieldNames.length} (all fields will be included)`);

                // Prepare and save the dataset
                printInfo('Saving dataset to server... This might take a moment for large datasets.');

                // Mark all fields as included
                wizardState.fields.forEach(f => f.isIncluded = true);

                // Prepare items payload and field definitions
                const itemsPayload = {};
                let skippedItemsCount = 0;

                // Process items same way as in the wizard
                wizardState.parsedJson.forEach((item, index) => {
                    const itemIdValue = item[idField.name];
                    const itemNameValue = item[nameField.name];

                    // Validate presence of ID and Name values
                    if (itemIdValue === null || itemIdValue === undefined || itemNameValue === null || itemNameValue === undefined) {
                        skippedItemsCount++;
                        return; // Skip this item
                    }

                    const itemIdString = String(itemIdValue);
                    const itemNameString = String(itemNameValue);

                    if (!itemIdString) {
                        skippedItemsCount++;
                        return;
                    }

                    // Check for duplicate item IDs
                    if (itemsPayload[itemIdString]) {
                        skippedItemsCount++;
                        return;
                    }

                    // Include all fields in the item's data
                    const data = {};
                    wizardState.fields.forEach(field => {
                        if (Object.hasOwnProperty.call(item, field.name)) {
                            data[field.name] = item[field.name];
                        }
                    });

                    // Add the processed item to the payload
                    itemsPayload[itemIdString] = {
                        Id: itemIdString,
                        Name: itemNameString,
                        Data: data,
                        IsArchived: false,
                    };
                });

                if (skippedItemsCount > 0) {
                    printInfo(`${skippedItemsCount} items were skipped due to missing/empty ID/Name fields or duplicates.`);
                }

                // Prepare the field definitions for the API
                const finalFields = wizardState.fields.map(f => ({
                    Name: f.name,
                    DataType: f.dataType,
                    IsId: f.isId,
                    IsName: f.isName,
                    IsRequired: f.isId || f.isName,
                    IsIncluded: true,
                    SampleValues: f.sampleValues,
                }));

                // Create the dataset via API
                await api.createDataset(
                    wizardState.datasetId,
                    wizardState.datasetName,
                    wizardState.datasetDescription,
                    idField.name,
                    nameField.name,
                    finalFields,
                    itemsPayload
                );

                printSuccess(`Dataset '${wizardState.datasetId}' successfully pulled and created!`);
                printInfo(`View details with: refwire dataset get-meta ${wizardState.datasetId}`);

            } catch (error) {
                handleError(error, 'dataset pull');
                process.exitCode = 1;
            }
        });

    // Helper: Wizard Logic
    async function runImportWizard() {
        let wizardState = {
            jsonContent: null,      // Raw JSON string input
            parsedJson: null,       // JavaScript array parsed from jsonContent
            fields: [],             // Array of field objects: { name, dataType, sampleValues[], isId, isName, isIncluded }
            itemCount: 0,           // Number of items in the array
            datasetId: '',          // User-defined dataset ID
            datasetName: '',        // User-defined dataset name
            datasetDescription: '', // User-defined dataset description
        };

        // === Step 1: Input ===
        await promptForInput(wizardState);

        // === Step 2: Validation ===
        if (!jsonProcessor.validateAndProcessJson(wizardState)) {
            throw new Error('JSON validation failed. Cannot proceed.'); // Will be caught by the action handler
        }
        printSuccess('JSON is valid and processed.');
        printInfo(`Detected ${wizardState.itemCount} items and ${wizardState.fields.length} unique fields.`);

        // === Step 3: Field Configuration ===
        await configureFields(wizardState);

        // === Step 4: Metadata ===
        await promptForMetadata(wizardState);

        // === Step 5: Confirmation & Save ===
        await confirmAndSave(wizardState);

        // Final success message if everything completes
        printSuccess(`Dataset '${wizardState.datasetId}' imported successfully!`);
        printInfo(`View details with: refwire dataset get-meta ${wizardState.datasetId}`);
    }

    // Wizard Step Functions
    async function promptForInput(state) {
        const { inputMethod } = await inquirer.prompt([
            {
                type: 'list',
                name: 'inputMethod',
                message: 'Choose JSON input source:',
                choices: [
                    { name: 'Provide local file path', value: 'file' },
                    { name: 'Cancel', value: 'cancel' },
                ],
            },
        ]);

        if (inputMethod === 'cancel') throw new Error('Wizard cancelled.');

        if (inputMethod === 'file') {
            const { filePath } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'filePath',
                    message: 'Enter the path to the JSON file:',
                    validate: async (input) => {
                        if (!input) return 'File path cannot be empty.';
                        try {
                            // Try to resolve the path relative to the current working directory
                            const absolutePath = path.resolve(process.cwd(), input);
                            await fs.access(absolutePath); // Check if file exists and is accessible
                            return true;
                        } catch (err) {
                            return `Cannot access file: ${input} (Error: ${err.code})`;
                        }
                    },
                }
            ]);
            const absolutePath = path.resolve(process.cwd(), filePath);
            try {
                state.jsonContent = await fs.readFile(absolutePath, 'utf-8');
                printInfo(`Read content from ${filePath}`);
            } catch (readError) {
                printError(`Error reading file ${filePath}: ${readError.message}`);
                throw new Error(`Failed to read file: ${readError.message}`); // Stop wizard
            }
        }
    }

    async function configureFields(state) {
        printInfo(chalk.cyan('\n--- Step 3: Field Configuration ---'));
        const dataTypes = ['Text', 'Date', 'Number', 'List', 'Boolean', 'Unknown']; 

        let configuring = true;
        while (configuring) {
            // Display current configuration in a table
            const table = new Table({
                head: [
                    chalk.cyan('Field Name'),
                    chalk.cyan('Data Type'),
                    chalk.cyan('Samples'),
                    chalk.yellow('Is ID?'),
                    chalk.yellow('Is Name?'),
                    chalk.yellow('Included?')
                ],
                colWidths: [25, 15, 40, 10, 10, 12], 
                wordWrap: true,
            });

            state.fields.forEach(f => {
                table.push([
                    f.name,
                    f.dataType,
                    f.sampleValues.join(', ') || chalk.dim('(none)'),
                    f.isId ? chalk.green('Yes') : 'No',
                    f.isName ? chalk.green('Yes') : 'No',
                    f.isIncluded ? chalk.green('Yes') : chalk.red('No') 
                ]);
            });
            console.log(table.toString());

            // Check if conditions are met to proceed
            const hasId = state.fields.some(f => f.isId);
            const hasName = state.fields.some(f => f.isName);
            const canProceed = hasId && hasName;

            // Prompt for the next configuration action
            const fieldNames = state.fields.map(f => f.name); // Get current field names for choices
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Configure fields (use arrow keys & enter):',
                    choices: [
                        { name: 'Set ID Field', value: 'set_id', disabled: fieldNames.length === 0 },
                        { name: 'Set Name Field', value: 'set_name', disabled: fieldNames.length === 0 },
                        { name: 'Change Data Type', value: 'change_type', disabled: fieldNames.length === 0 },
                        { name: 'Toggle Included Status', value: 'toggle_include', disabled: fieldNames.length === 0 },
                        new inquirer.Separator(),
                        { name: 'Proceed to Metadata', value: 'proceed', disabled: !canProceed ? ' (Select ID and Name fields first)' : false },
                        { name: 'Cancel Import', value: 'cancel' },
                    ],
                },
            ]);

            // Handle the chosen action
            switch (action) {
                case 'set_id': {
                    const { fieldToSet } = await inquirer.prompt([
                        { type: 'list', name: 'fieldToSet', message: 'Select the field to use as the unique ID:', choices: fieldNames },
                    ]);
                    // Ensure only one field is marked as ID
                    state.fields.forEach(f => f.isId = (f.name === fieldToSet));
                    break;
                }
                case 'set_name': {
                    const { fieldToSet } = await inquirer.prompt([
                        { type: 'list', name: 'fieldToSet', message: 'Select the field to use as the display Name:', choices: fieldNames },
                    ]);
                    // Ensure only one field is marked as Name
                    state.fields.forEach(f => f.isName = (f.name === fieldToSet));
                    break;
                }
                case 'change_type': {
                    const { fieldToChange } = await inquirer.prompt([
                        { type: 'list', name: 'fieldToChange', message: 'Select field to change data type:', choices: fieldNames },
                    ]);
                    const currentField = state.fields.find(f => f.name === fieldToChange);
                    const { newType } = await inquirer.prompt([
                        { type: 'list', name: 'newType', message: `Select new data type for '${fieldToChange}' (current: ${currentField?.dataType}):`, choices: dataTypes },
                    ]);
                    if (currentField) currentField.dataType = newType;
                    break;
                }
                case 'toggle_include': {
                    const { fieldToToggle } = await inquirer.prompt([
                        { type: 'list', name: 'fieldToToggle', message: 'Select field to include/exclude from the dataset:', choices: fieldNames },
                    ]);
                    const field = state.fields.find(f => f.name === fieldToToggle);
                    if (field) {
                        // Prevent excluding ID or Name fields
                        if (field.isId || field.isName) {
                            printError("Cannot exclude the ID or Name field.");
                        } else {
                            field.isIncluded = !field.isIncluded;
                        }
                    }
                    break;
                }
                case 'proceed':
                    configuring = false; // Exit the configuration loop
                    break;
                case 'cancel':
                    throw new Error('Wizard cancelled.'); // Stop the wizard
            }
        }
        printSuccess('Field configuration complete.');
    }

    async function promptForMetadata(state) {
        printInfo(chalk.cyan('\n--- Step 4: Dataset Metadata ---'));
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'datasetId',
                message: 'Enter Dataset ID (unique, lowercase, no spaces recommended, e.g., "country-codes"):',
                validate: (input) => {
                    if (!input) return 'Dataset ID cannot be empty.';
                    if (/\s/.test(input)) return 'Dataset ID should not contain spaces.';
                    if (input !== input.toLowerCase()) return 'Dataset ID should be lowercase.';
                    return true;
                },
                filter: (input) => input.toLowerCase(), // Force lowercase
            },
            {
                type: 'input',
                name: 'datasetName',
                message: 'Enter Dataset Name (human-readable, e.g., "Country Codes"):',
                validate: (input) => input ? true : 'Dataset Name cannot be empty.',
            },
            {
                type: 'input', // Use 'editor' for better multi-line input if needed
                name: 'datasetDescription',
                message: 'Enter Dataset Description (optional):',
            },
        ]);
        // Assign prompted values to the wizard state
        state.datasetId = answers.datasetId;
        state.datasetName = answers.datasetName;
        state.datasetDescription = answers.datasetDescription;
    }

    async function confirmAndSave(state) {
        printInfo(chalk.cyan('\n--- Step 5: Confirmation ---'));

        // Find the selected ID and Name fields from the configured state
        const idField = state.fields.find(f => f.isId);
        const nameField = state.fields.find(f => f.isName);
        // Get names of fields that are marked to be included
        const includedFields = state.fields.filter(f => f.isIncluded).map(f => f.name);

        // Display summary - Check if idField/nameField were found
        if (!idField || !nameField) {
            printError('Critical Error: ID or Name field is missing in the final configuration state. Cannot proceed.');
            throw new Error('Wizard cancelled due to configuration error.');
        }

        console.log(` ${chalk.bold('Dataset ID:')}      ${state.datasetId}`);
        console.log(` ${chalk.bold('Dataset Name:')}    ${state.datasetName}`);
        console.log(` ${chalk.bold('Description:')}   ${state.datasetDescription || chalk.dim('(none)')}`);
        console.log(chalk.blue('--- Configuration ---'));
        console.log(` ${chalk.bold('ID Field:')}        ${idField.name} (${idField.dataType})`);
        console.log(` ${chalk.bold('Name Field:')}      ${nameField.name} (${nameField.dataType})`);
        console.log(` ${chalk.bold('Total Items:')}     ${state.itemCount}`);
        console.log(` ${chalk.bold('Included Fields:')} ${includedFields.length > 0 ? includedFields.join(', ') : chalk.dim('(none)')}`);
        // Display excluded fields
        const excludedFields = state.fields.filter(f => !f.isIncluded).map(f => f.name);
        if (excludedFields.length > 0) console.log(` ${chalk.dim.italic('Excluded Fields:')} ${excludedFields.join(', ')}`);

        // Final confirmation prompt
        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Review the details above. Proceed with saving this dataset to the server?', default: true },
        ]);

        if (!confirm) {
            throw new Error('Wizard cancelled.');
        }

        // Construct final payload for the API 
        const itemsPayload = {}; // This will be the Dictionary<string, DatasetItem>
        let skippedItemsCount = 0;
        state.parsedJson.forEach((item, index) => {
            const itemIdValue = item[idField.name];
            const itemNameValue = item[nameField.name];

            // Validate presence and basic type of ID and Name values from the source item
            if (itemIdValue === null || itemIdValue === undefined || itemNameValue === null || itemNameValue === undefined) {
                console.warn(chalk.yellow(`Skipping item at index ${index} due to missing ID ('${idField.name}') or Name ('${nameField.name}') field.`));
                skippedItemsCount++;
                return; // Skip this item
            }

            const itemIdString = String(itemIdValue); // Convert ID to string
            const itemNameString = String(itemNameValue); // Convert Name to string

            if (!itemIdString) { // Check if ID string is empty after conversion
                console.warn(chalk.yellow(`Skipping item at index ${index} due to empty ID ('${idField.name}') field after conversion.`));
                skippedItemsCount++;
                return;
            }

            // Check for duplicate item IDs being added to the payload
            if (itemsPayload[itemIdString]) {
                console.warn(chalk.yellow(`Skipping item at index ${index}: Duplicate item ID '${itemIdString}' already processed. Using first occurrence.`));
                skippedItemsCount++;
                return;
            }

            // Build the Data dictionary for this item, including only the 'included' fields
            const data = {};
            state.fields.forEach(field => {
                // Only include fields marked for inclusion AND that actually exist in the current source item
                if (field.isIncluded && Object.hasOwnProperty.call(item, field.name)) {
                    data[field.name] = item[field.name];
                }
            });

            // Add the processed item to the payload dictionary
            itemsPayload[itemIdString] = {
                Id: itemIdString, // Ensure ID matches the key
                Name: itemNameString,
                Data: data,
                IsArchived: false, // New items are not archived
            };
        });

        if (skippedItemsCount > 0) {
            printInfo(`${skippedItemsCount} items were skipped due to missing/empty ID/Name fields or duplicates.`);
        }

        // Prepare the final 'Fields' array for the API payload
        // Only include fields marked as 'Included' and map to the expected C# structure
        const finalFields = state.fields
            .filter(f => f.isIncluded)
            .map(f => ({ // Map to the structure RefWireDB.Core.Models.DatasetField
                Name: f.name,
                DataType: f.dataType,
                IsId: f.isId,
                IsName: f.isName,
                // Define IsRequired based on IsId/IsName
                IsRequired: f.isId || f.isName,
                IsIncluded: f.isIncluded, // Should always be true here due to filter
                SampleValues: f.sampleValues, // Include collected samples
            }));

        // Ensure we still have an ID and Name field after filtering
        if (!finalFields.some(f => f.IsId) || !finalFields.some(f => f.IsName)) {
            printError("Critical Error: The final list of included fields is missing an ID or Name field. This might happen if the ID/Name field was excluded.");
            throw new Error("Wizard cancelled due to invalid final field configuration.");
        }

        printInfo('Saving dataset to server... This might take a moment for large datasets.');

        // Make the API call to create the dataset
        await api.createDataset(
            state.datasetId,
            state.datasetName,
            state.datasetDescription,
            idField.name,      // The name of the field designated as ID
            nameField.name,     // The name of the field designated as Name
            finalFields,       // The array of included & configured field definitions
            itemsPayload       // The dictionary of processed dataset items
        );
        // Success message is handled by the caller (runImportWizard)
    }
}