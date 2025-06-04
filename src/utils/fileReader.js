import { readFileSync } from 'fs';
import path from 'path';
import chalk from 'chalk';

export function readJsonFile(filePath) {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const fileContent = readFileSync(absolutePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(chalk.red(`Error reading or parsing JSON file: ${filePath}`));
        if (error instanceof SyntaxError) {
            console.error(chalk.red(`Invalid JSON: ${error.message}`));
        } else if (error.code === 'ENOENT') {
            console.error(chalk.red('File not found.'));
        } else {
            console.error(chalk.red(error.message));
        }
        // Re-throw a user-friendly error to be caught by command handler
        throw new Error(`Failed to read or parse JSON file: ${filePath}`);
    }
}