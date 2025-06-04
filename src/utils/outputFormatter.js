import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';

export function printSuccess(message) {
    console.log(chalk.green(`✅ Success: ${message}`));
}

export function printError(message) {
    console.error(chalk.red(`❌ Error: ${message}`));
}

export function printWarning(message) {
    console.error(chalk.yellow(`⚠️ Warning: ${message}`));
}

export function printInfo(message) {
    console.log(chalk.blueBright(`ℹ️ ${message}`));
}

export function printDimmed(message) {
    console.log(chalk.dim(`ℹ️ ${message}`));
}

export function printJson(data) {
    console.log(JSON.stringify(data, null, 2));
}

export function printKeyCreated(response) {
    console.log(response);
    console.log(chalk.green('🔑 API Key Created Successfully!'));
    console.log(chalk.yellow('IMPORTANT: Store this key securely. It will not be shown again.'));
    console.log('------------------------------------------');
    console.log(` ${chalk.bold('ID:')}    ${response.id}`);
    console.log(` ${chalk.bold('Name:')}  ${response.name}`);
    console.log(` ${chalk.bold('Key:')}   ${chalk.cyan(response.oneTimeDisplayKey)}`);
    console.log(` ${chalk.bold('Expires:')} ${new Date(response.expiresAt).toLocaleString()}`);
    console.log('------------------------------------------');
}

export function printApiKeysTable(keys) {
    if (!keys || keys.length === 0) {
        printInfo('No API keys found.');
        return;
    }
    const table = new Table({
        head: [
            chalk.cyan('ID'),
            chalk.cyan('Name'),
            chalk.cyan('Expires')
        ],
        colWidths: [38, 20, 25, 25, 30],
        wordWrap: true
    });

    keys.forEach(key => {
        table.push([
            key.id,
            key.name || '-',
            key.expiresAt ? new Date(key.expiresAt).toLocaleString() : '-'
        ]);
    });
    console.log(table.toString());
}

export function printInstancesTable(instances) {
    if (!instances || instances.length === 0) {
        printInfo('No app instances found.');
        return;
    }
    const table = new Table({
        head: [
            chalk.cyan('ID'),
            chalk.cyan('Alive'),
            chalk.cyan('Datasets'),
            chalk.cyan('Memory'),
            chalk.cyan('CPU'),
            chalk.cyan('Leader'),
        ],
        colWidths: [38, 30, 15],
    });

    instances.forEach(inst => {
        table.push([
            inst.hostName,
            inst.isAlive ? chalk.green('Yes') : chalk.red('No'),
            inst.loadedDatasets,
            inst.mangedMemory ? `${inst.mangedMemory} MB` : 'N/A',
            inst.cpuUsage ? `${inst.cpuUsage} %` : 'N/A',
            inst.isLeader ? chalk.green('Yes') : 'No',
        ]);
    });
    console.log(table.toString());
}

export function printDatasetMetadata(metadata) {
    if (!metadata) {
        printError('No dataset metadata provided');
        return;
    }

    // Create a boxed header with dataset basic info
    const headerContent = [
        `${chalk.bold.cyan('Dataset:')} ${chalk.white(metadata.name || 'Unnamed')} ${chalk.gray(`(${metadata.id})`)}`,
        metadata.description ? `${chalk.bold.cyan('Description:')} ${chalk.white(metadata.description)}` : '',
        `${chalk.bold.cyan('ID Field:')} ${chalk.yellow(metadata.idField || 'None')}`,
        `${chalk.bold.cyan('Name Field:')} ${chalk.yellow(metadata.nameField || 'None')}`
    ].filter(Boolean).join('\n');

    console.log(boxen(headerContent, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor: 'blue',
        borderStyle: 'round'
    }));

    // If no fields, exit early
    if (!metadata.fields || metadata.fields.length === 0) {
        printInfo('This dataset has no fields defined.');
        return;
    }

    // Create fields table
    const fieldsTable = new Table({
        head: [
            chalk.cyan('Field Name'),
            chalk.cyan('Data Type'),
            chalk.cyan('Properties'),
            chalk.cyan('Sample Values')
        ],
        colWidths: [20, 15, 25, 40],
        wordWrap: true
    });

    // Add each field to the table
    metadata.fields.forEach(field => {
        // Build properties list
        const properties = [];
        if (field.isId) properties.push(chalk.yellow('ID Field'));
        if (field.isName) properties.push(chalk.green('Name Field'));
        if (field.isRequired) properties.push(chalk.red('Required'));
        if (field.isIncluded) properties.push(chalk.blue('Included'));

        // Format sample values
        let sampleValues = 'None';
        if (field.sampleValues && field.sampleValues.length > 0) {
            // Limit to 3 samples with ellipsis if more exist
            const samples = field.sampleValues.slice(0, 3);
            if (field.sampleValues.length > 3) {
                samples.push('...');
            }
            sampleValues = samples.join(', ');
        }

        fieldsTable.push([
            chalk.white(field.name),
            chalk.cyan(field.dataType || 'Unknown'),
            properties.join('\n') || '-',
            chalk.dim(sampleValues)
        ]);
    });

    console.log(chalk.bold.underline('Fields Definition:'));
    console.log(fieldsTable.toString());

    // Show field count summary
    console.log(chalk.dim(`\nTotal Fields: ${metadata.fields.length}`));
}

export function printDatasetApi(apiSpec) {
    if (!apiSpec) {
        printError('No API specification provided');
        return;
    }

    // Create a boxed header for the API spec
    const headerContent = chalk.bold.cyan('🔌 Dataset API Endpoints');

    console.log(boxen(headerContent, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor: 'cyan',
        borderStyle: 'round'
    }));

    // Create endpoints table
    const endpointsTable = new Table({
        head: [
            chalk.cyan('Operation'),
            chalk.cyan('Endpoint URL')
        ],
        colWidths: [25, 75],
        wordWrap: true
    });

    // Add each endpoint to the table with appropriate formatting
    endpointsTable.push(
        [chalk.green('List Items'), chalk.white(apiSpec.listItemsUrl || 'Not defined')],
        [chalk.green('Get Item By ID'), chalk.white(apiSpec.getItemByIdUrl || 'Not defined')],
        [chalk.green('Search Items By IDs'), chalk.white(apiSpec.searchItemsByIdsUrl || 'Not defined')],
        [chalk.green('Search Items'), chalk.white(apiSpec.searchItemsUrl || 'Not defined')]
    );

    console.log(endpointsTable.toString());

    if (apiSpec.UpdateItemUrlTemplate || apiSpec.ArchiveItemUrlTemplate) {
        console.log(boxen(
            chalk.yellow('Note: URLs marked with templates contain placeholders that need to be replaced with actual item IDs'),
            {
                padding: 1,
                borderColor: 'yellow',
                dimBorder: true
            }
        ));
    }

    // Display usage examples
    console.log(chalk.bold.underline('\nExample Usage:'));

    if (apiSpec.GetItemByIdUrl) {
        console.log(`${chalk.dim('GET')} ${chalk.cyan(apiSpec.GetItemByIdUrl)} ${chalk.dim('- Retrieves a specific item')}`);
    }

    if (apiSpec.SearchItemsUrl) {
        console.log(`${chalk.dim('POST')} ${chalk.cyan(apiSpec.SearchItemsUrl)} ${chalk.dim('- Finds items matching query criteria')}`);
    }

    if (apiSpec.UpdateItemUrlTemplate) {
        // Extract base URL and replace placeholder with example ID
        const exampleUpdateUrl = apiSpec.UpdateItemUrlTemplate.replace('{id}', '123456');
        console.log(`${chalk.dim('PUT')} ${chalk.cyan(exampleUpdateUrl)} ${chalk.dim('- Updates an existing item')}`);
    }
}