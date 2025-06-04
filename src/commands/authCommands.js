import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import { getSilentConfig, constants, getCredentials } from '../lib/configManager.js';
import { printError, printInfo, printSuccess, printWarning } from '../utils/outputFormatter.js';

const CONFIG_FILE = constants.CONFIG_FILE;

export default function registerAuthCommands(program) {
    const authCommand = program.command('auth')
        .description('Authentication and session management');

    authCommand
        .command('logout')
        .description('Clear saved credentials and logout from RefWire')
        .option('-f, --force', 'Skip confirmation prompt')
        .action(async (options) => {
            try {
                // Skip confirmation if force flag is set
                if (!options.force) {
                    const { confirm } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Are you sure you want to remove your saved credentials?',
                        default: false
                    }]);
                    if (!confirm) {
                        console.log('Logout canceled');
                        return;
                    }
                }

                // Clear config file if it exists
                if (fs.existsSync(CONFIG_FILE)) {
                    fs.unlinkSync(CONFIG_FILE);
                    printSuccess('Successfully removed saved credentials');
                } else {
                    printWarning(chalk.yellow('No saved credentials found'));
                }

                printInfo(`Note: This does not affect any ${constants.ENV_VAR_URL}, ${constants.ENV_VAR_API_KEY}, or ${constants.ENV_VAR_STORE_URL} environment variables`);
            } catch (error) {
                printError('Error during logout:' + error.message);
                process.exitCode = 1;
            }
        });

    authCommand
        .command('status')
        .description('Check current authentication status')
        .action(() => {
            const config = getSilentConfig();

            const hasServerUrl = Boolean(config.serverUrl);
            const hasApiKey = Boolean(config.apiKey);
            const isFullyConfigured = hasServerUrl && hasApiKey;

            if (!hasServerUrl && !hasApiKey) {
                printWarning('No saved credentials found');
                console.log(chalk.dim('To configure, run any command that requires authentication'));
                return;
            }

            if (isFullyConfigured) {
                printSuccess('You are fully configured with the following settings:');
            } else {
                printWarning('Your configuration is incomplete:');
            }

            // Show server URL status
            if (hasServerUrl) {
                printInfo(`Server URL: ${chalk.cyan(config.serverUrl)}`);
            } else {
                printInfo(`Server URL: ${chalk.red('Not configured')} (required)`);
            }

            // Show API key status
            if (hasApiKey) {
                console.log(`API Key: ${chalk.cyan('********')}`);
            } else {
                printError(`API Key: ('Not configured') (required)`);
            }

            // Show store URL status (optional with default)
            const isDefaultStoreUrl = config.storeUrl === constants.DEFAULT_STORE_URL;
            const storeColor = isDefaultStoreUrl ? chalk.dim : chalk.cyan;
            const storeLabel = isDefaultStoreUrl ? `${config.storeUrl} (default)` : config.storeUrl;
            console.log(`Store URL: ${storeColor(storeLabel)}`);

            // Check environment variables usage
            const envVars = [];
            if (process.env[constants.ENV_VAR_URL]) envVars.push(constants.ENV_VAR_URL);
            if (process.env[constants.ENV_VAR_API_KEY]) envVars.push(constants.ENV_VAR_API_KEY);
            if (process.env[constants.ENV_VAR_STORE_URL]) envVars.push(constants.ENV_VAR_STORE_URL);

            if (envVars.length > 0) {
                console.log(chalk.dim(`\nUsing environment variables: ${envVars.join(', ')}`));
            }
        });
}