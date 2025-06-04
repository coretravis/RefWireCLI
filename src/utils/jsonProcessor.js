export function validateAndProcessJson(state) {
    if (!state.jsonContent) {
        printError("No JSON content provided or downloaded.");
        return false;
    }
    try {
        const parsed = JSON.parse(state.jsonContent);

        if (!Array.isArray(parsed)) {
            printError('Validation Error: Input must be a JSON array.');
            return false;
        }
        if (parsed.length === 0) {
            printError('Validation Error: JSON array cannot be empty.');
            return false;
        }

        state.parsedJson = parsed; // Store the parsed array for later use
        state.itemCount = parsed.length;
        const fieldsDict = new Map(); // Use Map for efficient property checking and storage

        for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            // Ensure item is a valid object
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                printError(`Validation Error: Item at index ${i} is not a valid JSON object.`);
                return false;
            }

            // Discover fields and collect samples from this item
            for (const key in item) {
                if (Object.hasOwnProperty.call(item, key)) {
                    const value = item[key];
                    if (!fieldsDict.has(key)) {
                        // Initialize field definition on first encounter
                        fieldsDict.set(key, {
                            name: key,
                            dataType: determineDataType(value),
                            sampleValues: new Set(), // Use Set for unique samples
                            isId: false,
                            isName: false,
                            isIncluded: true, // Default to included
                        });
                    }
                    const field = fieldsDict.get(key);

                    // Collect up to 3 unique, non-empty sample values
                    if (field.sampleValues.size < 3) {
                        const sample = getSampleValue(value);
                        if (sample !== null && sample !== undefined && sample !== '') {
                            field.sampleValues.add(sample);
                        }
                    }

                    // Basic type consistency check (can be expanded)
                    const currentType = determineDataType(value);
                    if (field.dataType === 'Unknown' && currentType !== 'Unknown') {
                        field.dataType = currentType;
                    }
                }
            }
        }

        if (fieldsDict.size === 0) {
            printError('Validation Error: No fields found across all items in the JSON array.');
            return false;
        }

        // Convert the collected field definitions (from Map values) to an array
        // Also convert the Set of sampleValues to an array for easier use
        state.fields = Array.from(fieldsDict.values()).map(f => ({
            ...f,
            sampleValues: Array.from(f.sampleValues)
        }));

        return true; // Validation and processing successful

    } catch (e) {
        printError(`JSON Parsing Error: ${e.message}`);
        return false;
    }
}

// Helper to determine data type, mirroring Blazor logic
export function determineDataType(value) {
    const type = typeof value;
    switch (type) {
        case 'string':
            // Basic date check
            if (/\d{4}-\d{2}-\d{2}/.test(value) && !isNaN(Date.parse(value))) {
                return 'Date';
            }
            return 'Text';
        case 'number':
            return 'Number';
        case 'boolean':
            return 'Boolean';
        case 'object':
            if (value === null) return 'Unknown'; // Treat null as Unknown for type determination initially
            if (Array.isArray(value)) return 'List';
            return 'Unknown'; // Treat generic objects as Unknown type for now
        default:
            return 'Unknown';
    }
}

// Helper to get a representative sample value string, mirroring Blazor logic
export function getSampleValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return undefined; // Should not happen with valid JSON

    const type = typeof value;
    switch (type) {
        case 'string':
            // Truncate long strings for display
            return value.length > 30 ? value.substring(0, 27) + '...' : value;
        case 'number':
        case 'boolean':
            return value.toString(); // Simple string representation
        case 'object':
            if (Array.isArray(value)) return '[...]'; // Indicate array
            return '{...}'; // Indicate object
        default:
            // Fallback for unexpected types
            return String(value).substring(0, 30);
    }
}