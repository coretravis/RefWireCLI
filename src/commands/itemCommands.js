import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../lib/apiClient.js';
import { handleError } from '../utils/errorHandler.js';
import { printSuccess, printJson, printError } from '../utils/outputFormatter.js';
import { readJsonFile } from '../utils/fileReader.js';

// Helper to parse JSON string safely
const parseJsonString = (jsonString, fieldName) => {
    if (!jsonString) return {};
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`Invalid JSON provided for ${fieldName}: ${e.message}`);
    }
};

export default function registerItemCommands(program) {
    const itemCommand = program.command('item')
        .description(`${chalk.yellow('[Admin]')} Manage Items within Datasets`);

    itemCommand
        .command('add')
        .description('Add a new item to a dataset')
        .argument('<datasetId>', 'ID of the target dataset')
        .argument('<itemId>', 'Unique ID for the new item')
        .argument('<name>', 'Name for the new item')
        .option('-d, --data <json>', 'Item data as a JSON string (e.g., \'{"key":"value"}\')')
        .option('--data-file <path>', 'Path to a JSON file containing item data object')
        .action(async (datasetId, itemId, name, options) => {
            try {
                let itemData = {};
                if (options.dataFile) {
                    itemData = readJsonFile(options.dataFile);
                } else if (options.data) {
                    itemData = parseJsonString(options.data, '--data');
                }

                const result = await api.addDatasetItem(datasetId, itemId, name, itemData);
                printSuccess(`Item '${itemId}' added to dataset '${datasetId}'.`);
                printJson(result);
            } catch (error) {
                handleError(error, 'item add');
                process.exitCode = 1;
            }
        });

    itemCommand
        .command('add-bulk')
        .description('Add multiple items to a dataset from a JSON file')
        .argument('<datasetId>', 'ID of the target dataset')
        .requiredOption('-f, --file <path>', 'Path to a JSON file containing an array of items (e.g., [{"id": "...", "name": "...", "data": {...}}, ...])')
        .action(async (datasetId, options) => {
            try {
                const itemsArray = readJsonFile(options.file);
                if (!Array.isArray(itemsArray)) {
                    throw new Error('JSON file must contain an array of item objects.');
                }
                
                const result = await api.addDatasetItemsBulk(datasetId, itemsArray);
                printSuccess(`Successfully added ${result.length} items to dataset '${datasetId}'.`);                
            } catch (error) {
                handleError(error, 'item add-bulk');
                process.exitCode = 1;
            }
        });

    itemCommand
        .command('update')
        .description('Update an existing item in a dataset')
        .argument('<datasetId>', 'ID of the target dataset')
        .argument('<itemId>', 'ID of the item to update')
        .option('-n, --name <name>', 'New name for the item')
        .option('-d, --data <json>', 'New item data as a JSON string (replaces existing data)')
        .option('--data-file <path>', 'Path to a JSON file containing the new item data object')
        .action(async (datasetId, itemId, options) => {
            if (!options.name && !options.data && !options.dataFile) {
                printError('At least one option (--name, --data, --data-file) must be provided for update.');
                process.exit(1);
            }

            try {
                let itemData = undefined; // Explicitly undefined if not provided
                if (options.dataFile) {
                    itemData = readJsonFile(options.dataFile);
                } else if (options.data) {
                    itemData = parseJsonString(options.data, '--data');
                }

                const updatedItem = {
                    name: options.name, // Will be null if not provided
                    data: itemData     // Will be undefined if not provided
                };

                // Filter out undefined/null properties before sending if API requires clean object
                const payload = {};
                if (updatedItem.name !== undefined && updatedItem.name !== null) payload.name = updatedItem.name;
                if (updatedItem.data !== undefined) payload.data = updatedItem.data;

                if (Object.keys(payload).length === 0) {
                    printError("No update parameters provided."); // Should have been caught earlier, but defensive check.
                    process.exit(1);
                }

                // Call the specific API function expecting name and data
                const result = await api.updateDatasetItem(datasetId, itemId, payload.name, payload.data);

                printSuccess(`Item '${itemId}' in dataset '${datasetId}' updated successfully.`);
                printJson(result);

            } catch (error) {
                handleError(error, 'item update');
                process.exitCode = 1;
            }
        });

    itemCommand
        .command('archive')
        .description('Archive (soft-delete) an item in a dataset')
        .argument('<datasetId>', 'ID of the target dataset')
        .argument('<itemId>', 'ID of the item to archive')
        .action(async (datasetId, itemId) => {
            try {
                await api.archiveDatasetItem(datasetId, itemId);
                printSuccess(`Item '${itemId}' in dataset '${datasetId}' has been archived.`);
            } catch (error) {
                handleError(error, 'item archive');
                process.exitCode = 1;
            }
        });
}