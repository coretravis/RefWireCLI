import { Command } from 'commander';
import chalk from 'chalk';
import * as api from '../lib/apiClient.js';
import { handleError } from '../utils/errorHandler.js';
import { printInfo, printJson } from '../utils/outputFormatter.js';

export default function registerHealthCommands(program) {
    const healthCommand = program.command('health')
        .description(`${chalk.yellow('[Admin]')} Check system health`);

    healthCommand
        .command('report')
        .description('Retrieve a health report of the RefWire system')
        .action(async () => {
            try {
                const report = await api.getHealthReport();
                printInfo('System Health Report:');
                printJson(report);
            } catch (error) {
                handleError(error, 'health report');
                process.exitCode = 1;
            }
        });
}