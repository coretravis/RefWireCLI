import chalk from 'chalk';

export function handleError(error, commandName = 'Command') {
    console.error(chalk.red(`\nError during ${commandName}:`));
    if (error.message) {
        // Handle generic errors and API client re-thrown errors
        console.error(chalk.red(`> ${error.message}`));
    } else {
        // Fallback for unexpected error types
        console.error(chalk.red('> An unexpected error occurred:'), error);
    }
    console.error(chalk.yellow('\nUse --help for command usage.\n'));
}