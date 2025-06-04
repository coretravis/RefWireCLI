import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../lib/apiClient.js';
import { handleError } from '../utils/errorHandler.js';
import { printSuccess, printApiKeysTable, printKeyCreated, printJson, printInfo } from '../utils/outputFormatter.js';

export default function registerApiKeyCommands(program) {
    const apiKeyCommand = program.command('api-key')
        .description(`${chalk.yellow('[Admin]')} Manage API Keys`);

    apiKeyCommand
        .command('create')
        .description('Create a new API key (expires in 30 days)')
        .argument('<name>', 'A descriptive name for the key')
        .option('-d, --description <text>', 'Optional description for the key')
        .option('-s, --scopes <scopes...>', 'Optional space-separated list of scopes')
        .action(async (name, options) => {
            try {
                const result = await api.createApiKey(name, options.description, options.scopes || []);
                printKeyCreated(result);
            } catch (error) {
                handleError(error, 'api-key create');
                process.exitCode = 1;
            }
        });

    apiKeyCommand
        .command('list')
        .description('List all API keys')
        .action(async () => {
            try {
                const keys = await api.listApiKeys();
                printApiKeysTable(keys);
            } catch (error) {
                handleError(error, 'api-key list');
                process.exitCode = 1;
            }
        });

    apiKeyCommand
        .command('get')
        .description('Get details of a specific API key by ID')
        .argument('<id>', 'The ID of the API key')
        .action(async (id) => {
            try {
                const key = await api.getApiKey(id);
                if (key) {
                    printInfo(`Details for API Key ID: ${id}`);
                    printJson(key);
                } else {
                    printInfo(`API Key with ID ${id} not found.`);
                }
            } catch (error) {
                // API client might throw 404 as an error
                handleError(error, 'api-key get');
                process.exitCode = 1;
            }
        });

    apiKeyCommand
        .command('update')
        .description('Update an existing API key\'s name, description, or scopes')
        .argument('<id>', 'The ID of the API key to update')
        .option('-n, --name <name>', 'New name for the key')
        .option('-d, --description <text>', 'New description for the key')
        .option('-s, --scopes <scopes...>', 'New space-separated list of scopes (replaces existing)')
        .action(async (id, options) => {

            if (!options.name && !options.description && !options.scopes) {
                console.error(chalk.red('Error: At least one option (--name, --description, --scopes) must be provided to update.'));
                process.exit(1);
            }

            try {
                const currentKey = await api.getApiKey(id);
                if (!currentKey) {
                    printError(`API Key with ID ${id} not found.`);
                    process.exit(1);
                }

                const newName = options.name ?? currentKey.name;
                const newDescription = options.description ?? currentKey.description;

                // Handle scopes carefully: if provided, replace; otherwise, keep old.
                const newScopes = options.scopes !== undefined ? (options.scopes || []) : currentKey.scopes;

                const updatedKey = await api.updateApiKey(id, newName, newDescription, newScopes);
                printSuccess(`API Key ${id} updated successfully.`);
                printJson(updatedKey);
            } catch (error) {
                handleError(error, 'api-key update');
                process.exitCode = 1;
            }
        });

    apiKeyCommand
        .command('revoke')
        .description('Revoke (delete) an API key by ID')
        .argument('<id>', 'The ID of the API key to revoke')
        .action(async (id) => {
            try {
                await api.revokeApiKey(id);
                printSuccess(`API Key ${id} revoked successfully.`);
            } catch (error) {
                handleError(error, 'api-key revoke');
                process.exitCode = 1;
            }
        });
}