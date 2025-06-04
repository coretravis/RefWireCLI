import axios from 'axios';
import https from 'https';
import JSZip from 'jszip';
import { getConfig } from './configManager.js';
import chalk from 'chalk';

console.log(chalk.blue('[INIT] Loading ListStor client module...'));

// HTTPS agent to ignore self-signed certificates in local development
const insecureHttpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

/**
 * Initialize an Axios client for ListStor API.
 * @param {boolean} binary - whether to expect binary response (zip)
 * @returns {import('axios').AxiosInstance}
 */
export const getListStorClient = (binary = false) => {
    console.log(chalk.blue('[CLIENT INIT] Fetching configuration...'));
    const config = getConfig();
    console.log(chalk.green('[CLIENT INIT] Configuration loaded:'), config);

    const rawUrl = config.storeUrl;
    const baseURL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    console.log(chalk.green('[CLIENT INIT] Normalized store URL:'), baseURL);

    const isLocalDev = /^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(baseURL);
    console.log(chalk.yellow('[CLIENT INIT] Is Local Dev ='), isLocalDev);

    return axios.create({
        baseURL,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
        httpsAgent: isLocalDev ? insecureHttpsAgent : undefined,
        responseType: binary ? 'arraybuffer' : 'json',
    });
};

/**
 * Fetch metadata for a dataset.
 * @param {string} datasetId
 * @returns {Promise<object>}
 */
export const getDatasetMeta = async (datasetId) => {
    console.log(chalk.blue(`[getDatasetMeta] Fetching metadata for ID: ${datasetId}`));
    const client = getListStorClient();
    try {
        const res = await client.get(`/datasets/${encodeURIComponent(datasetId)}/meta`);
        console.log(chalk.green(`[getDatasetMeta] Success: ${res.status}`));
        return res.data;
    } catch (err) {
        console.error(chalk.red(`[getDatasetMeta] Failed to fetch metadata for ID: ${datasetId}`));
        console.error(chalk.red(err.message));
        throw new Error(`getDatasetMeta error: ${err.message}`);
    }
};

/**
 * Download, unzip, and parse a dataset package.
 * @param {string} datasetId
 * @param {string} [version]
 * @returns {Promise<{ data: any; meta: any }>}
 */
export const getDataset = async (datasetId, version) => {
    console.log(chalk.blue(`[getDataset] Fetching dataset ID: ${datasetId}, version: ${version || 'latest'}`));
    const client = getListStorClient(true);
    const query = version ? `?version=${encodeURIComponent(version)}` : '';
    const endpoint = `/packages/${encodeURIComponent(datasetId)}${query}`;
    console.log(chalk.blue(`[getDataset] Requesting: ${endpoint}`));

    try {
        const res = await client.get(endpoint);
        console.log(chalk.green(`[getDataset] Downloaded: ${res.status}`));

        const contentType = res.headers['content-type'];
        console.log(chalk.blue(`[getDataset] Content-Type: ${contentType}`));
        if (!contentType || !contentType.includes('application/zip')) {
            throw new Error(`Unexpected content-type: ${contentType}`);
        }

        console.log(chalk.blue('[getDataset] Unzipping payload...'));
        const zip = await JSZip.loadAsync(res.data);

        const dataEntry = zip.file('data.json');
        const metaEntry = zip.file('data.meta.json');
        if (!dataEntry || !metaEntry) {
            throw new Error('Zip is missing data.json or data.meta.json');
        }

        const [dataStr, metaStr] = await Promise.all([
            dataEntry.async('string'),
            metaEntry.async('string'),
        ]);

        console.log(chalk.green('[getDataset] Extraction and parsing complete'));

        // Log the meta
        console.log(chalk.blue('[getDataset] Metadata:'), metaStr);
        
        return { data: dataStr, meta: JSON.parse(metaStr) };
    } catch (err) {
        console.error(chalk.red(`[getDataset] Error fetching dataset: ${err.message}`));
        throw err;
    }
};

/**
 * Retrieve the normalized store URL from config.
 * @returns {string}
 */
export const GetStorUrl = () => {
    console.log(chalk.blue('[GetStorUrl] Retrieving base URL.'));
    const config = getConfig();
    return config.storeUrl.startsWith('http')
        ? config.storeUrl
        : `https://${config.storeUrl}`;
};

// Default export for legacy compatibility
export default getListStorClient;