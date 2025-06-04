#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { getCredentials } from './src/lib/configManager.js';
import registerApiKeyCommands from './src/commands/apiKeyCommands.js';
import registerDatasetCommands from './src/commands/datasetCommands.js';
import registerItemCommands from './src/commands/itemCommands.js';
import registerInstanceCommands from './src/commands/instanceCommands.js';
import registerHealthCommands from './src/commands/healthCommands.js';
import registerAuthCommands from './src/commands/authCommands.js';
import { handleError } from './src/utils/errorHandler.js';
import { readFileSync } from 'fs';

// Load package.json for version info
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const program = new Command();

program
    .name('refwire')
    .description(chalk.blueBright(chalk.cyan(`
  ██████╗ ███████╗███████╗██╗    ██╗██╗██████╗ ███████╗
  ██╔══██╗██╔════╝██╔════╝██║    ██║██║██╔══██╗██╔════╝
  ██████╔╝█████╗  █████╗  ██║ █╗ ██║██║██████╔╝█████╗  
  ██╔══██╗██╔══╝  ██╔══╝  ██║███╗██║██║██╔══██╗██╔══╝  
  ██║  ██║███████╗██║     ╚███╔███╔╝██║██║  ██║███████╗
  ╚═╝  ╚═╝╚══════╝╚═╝      ╚══╝╚══╝ ╚═╝╚═╝  ╚═╝╚══════╝
    
  Visit: https://refwire.online
  Docs:  https://github.com/coretravis/RefWireCLI
  `)))
    .version(packageJson.version);


// Global hook to ensure credentials are set before any command action
program.hook('preAction', async (thisCommand, actionCommand) => {
    try {
        // Skip credential check for auth commands
        const isAuthCommand = actionCommand.parent &&
            actionCommand.parent.name() === 'auth';

        // These specific auth commands don't need credentials
        const skipCredentialCommands = ['logout', 'status'];

        if (isAuthCommand && skipCredentialCommands.includes(actionCommand.name())) {
            console.log(chalk.dim(`Executing: ${actionCommand.name()}`));
            return;
        }
        
        await getCredentials(); // Ensures URL and API Key are prompted for if not already set
        console.log(chalk.dim(`Executing: ${actionCommand.name()}`));
    } catch (error) {
        handleError(error);
        process.exit(1); // Exit if credential setup fails
    }
});

// Register command modules
registerApiKeyCommands(program);
registerDatasetCommands(program);
registerItemCommands(program);
registerHealthCommands(program);
registerInstanceCommands(program);
registerAuthCommands(program);

program.parseAsync(process.argv).catch(err => {
    handleError(err);
    process.exit(1);
});