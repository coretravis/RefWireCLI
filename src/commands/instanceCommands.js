import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../lib/apiClient.js';
import { handleError } from '../utils/errorHandler.js';
import { printSuccess, printInstancesTable } from '../utils/outputFormatter.js';

export default function registerInstanceCommands(program) {
    const instanceCommand = program.command('instance')
        .description(`${chalk.yellow('[Admin]')} Manage distributed app instances`);

    instanceCommand
        .command('list')
        .description('List all registered distributed app instances')
        .action(async () => {
            try {
                const instances = await api.listAppInstances();

                printInstancesTable(instances);
            } catch (error) {
                handleError(error, 'instance list');
                process.exitCode = 1;
            }
        });

    instanceCommand
        .command('remove')
        .description('Remove a specific app instance by its ID')
        .argument('<instanceId>', 'The GUID of the instance to remove')
        .action(async (instanceId) => {
            try {
                await api.removeAppInstance(instanceId);
                printSuccess(`App instance ${instanceId} removed successfully.`);
            } catch (error) {
                handleError(error, 'instance remove');
                process.exitCode = 1;
            }
        });
}