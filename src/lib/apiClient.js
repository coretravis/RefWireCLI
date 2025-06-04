import axios from 'axios';
import https from 'https';
import { getConfig } from './configManager.js';
import chalk from 'chalk';

// Create an HTTPS agent that ignores self-signed certificate errors 
// for local development against trusted localhost servers.
const insecureHttpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const getApiClient = () => {
    const config = getConfig(); // Ensures credentials exist

    // Determine if this is a local development environment
    const isLocalDev = config.serverUrl.match(/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/);

    const instance = axios.create({
        baseURL: `${config.serverUrl}/admin`,
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': config.apiKey,
        },
        timeout: 15000,
        // Only bypass SSL validation for HTTPS connections to localhost/127.0.0.1/[::1]
        httpsAgent: isLocalDev ? insecureHttpsAgent : undefined,
    });

    // Add interceptors for logging or error handling
    instance.interceptors.response.use(
        (response) => response,
        (error) => {

            // Provide more context for API errors
            if (error.code === 'ECONNREFUSED') {
                console.error(chalk.red(`API Error: Connection refused.`));
                console.error(chalk.red(`Endpoint: ${error.config?.method?.toUpperCase()} ${error.config?.url}`));
                console.error(chalk.red(`Is the server running at ${error.config?.baseURL}?`));
            } else if (error.response) {

                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error(chalk.red(`API Error: ${error.response.status} ${error.response.statusText}`));
                console.error(chalk.red(`Endpoint: ${error.config.method?.toUpperCase()} ${error.config.url}`));
                if (error.response.data) {
                    // Try to display server-provided error message
                    const errorMessage = typeof error.response.data === 'string'
                        ? error.response.data
                        : JSON.stringify(error.response.data);
                    console.error(chalk.red(`Details: ${errorMessage}`));
                }
            } else if (error.request) {
                // The request was made but no response was received
                console.error(chalk.red('API Error: No response received from server.'));
                console.error(chalk.red(`URL: ${error.config?.baseURL}${error.config?.url}`));

                // Add specific hint for potential SSL issues when targeting localhost https
                if (error.config?.baseURL?.startsWith('https://localhost') && error.message.includes('certificate')) {
                    console.error(chalk.yellow('Hint: This often happens with localhost HTTPS due to self-signed certificates. The CLI attempts to bypass this for development. Ensure the server is running and accessible via HTTPS.'));
                } else {
                    console.error(chalk.red('Check server URL and network connectivity.'));
                }
            } else {

                // Something happened in setting up the request that triggered an Error
                console.error(chalk.red('API Error: Request setup failed.'));
                console.error(error.message);
            }

            // Re-throw a simplified error or a custom error object
            return Promise.reject(new Error('API request failed. See details above.'));
        }
    );

    return instance;
};

export default getApiClient;


export const createApiKey = async (name, description, scopes) => {
    const client = getApiClient();
    const response = await client.post('/api-keys/', { name, description, scopes });
    return response.data; // ApiKeyCreationResponse (includes Id and Key)
};

export const listApiKeys = async () => {
    const client = getApiClient();
    const response = await client.get('/api-keys/');
    return response.data; // IEnumerable<ApiKey> (doesn't include the key itself)
};

export const getApiKey = async (id) => {
    const client = getApiClient();
    const response = await client.get(`/api-keys/${id}`);
    return response.data; // ApiKey
};

export const updateApiKey = async (id, name, description, scopes) => {
    const client = getApiClient();
    const response = await client.put(`/api-keys/${id}`, { name, description, scopes });
    return response.data; // Updated ApiKey
};

export const revokeApiKey = async (id) => {
    const client = getApiClient();
    await client.delete(`/api-keys/${id}`);
    // No content returned on success (204)
};

// --- Health ---
export const getHealthReport = async () => {
    const client = getApiClient();
    const response = await client.get('/health/');
    return response.data;
};

// --- Datasets ---
export const getDatasetMeta = async (id) => {
    const client = getApiClient();
    const response = await client.get(`/datasets/${id}/meta`);
    return response.data; // DatasetMeta
};


export const deleteDataset = async (id) => {
    const client = getApiClient();
    const response = await client.delete(`/datasets/${id}`);
    return response.data; // DatasetMeta
};

export const getDatasetApi = async (id) => {
    const client = getApiClient();
    const response = await client.get(`/datasets/${id}/api/spec`);
    return response.data; // DatasetMeta
};

export const listDatasetIds = async () => {
    const client = getApiClient();
    const response = await client.get('/datasets/list');
    return response.data; // IEnumerable<string>
};

export const createDataset = async (id, name, description, idField, nameField, fields, items) => {
    const client = getApiClient();
    const response = await client.post('/datasets/', { id, name, description, idField, nameField, fields, items });
    return response.data; // Dataset
};

export const updateDataset = async (id, name, fields) => {
    const client = getApiClient();
    const response = await client.put(`/datasets/${id}`, { name, fields });
    return response.data; // Dataset
};

export const getSystemState = async () => {
    const client = getApiClient();
    const response = await client.get('/datasets/state');
    return response.data; // System state object
};

// --- Items ---
export const addDatasetItem = async (datasetId, itemId, name, data) => {
    const client = getApiClient();
    const response = await client.post(`/datasets/${datasetId}/items`, { id: itemId, name, data });
    return response.data; // DatasetItem
};

export const addDatasetItemsBulk = async (datasetId, items) => {
    const client = getApiClient();
    const response = await client.post(`/datasets/${datasetId}/items/bulk`, { items });
    return response.data; // The list of created items
};

export const updateDatasetItem = async (datasetId, itemId, name, data) => {
    const client = getApiClient();
    const response = await client.put(`/datasets/${datasetId}/items/${itemId}`, { name, data });
    return response.data; // Updated DatasetItem
};

export const archiveDatasetItem = async (datasetId, itemId) => {
    const client = getApiClient();
    await client.delete(`/datasets/${datasetId}/items/${itemId}`, { data: {} }); // Sending empty data object for body
};

// --- Instances ---
export const listAppInstances = async () => {
    const client = getApiClient();
    const response = await client.get('/instances/');
    return response.data; // IEnumerable<AppInstance>
};

export const removeAppInstance = async (instanceId) => {
    const client = getApiClient();
    await client.delete(`/instances/${instanceId}`);
};