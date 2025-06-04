import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ENV_VAR_URL = 'LISTSERV_URL';
const ENV_VAR_API_KEY = 'LISTSERV_API_KEY';
const ENV_VAR_STORE_URL = 'LISTSERV_STORE_URL';
const DEFAULT_STORE_URL = 'stor.refwire.online';

const CONFIG_DIR = path.join(os.homedir(), '.refwiredb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

let sessionConfig = {
    serverUrl: process.env[ENV_VAR_URL] || null,
    apiKey: process.env[ENV_VAR_API_KEY] || null,
    storeUrl: process.env[ENV_VAR_STORE_URL] || null,
};

function normalizeUrl(url) {
    if (!url) return url;
    try {
        const parsed = new URL(url);
        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return url; // Leave it as-is for validation to catch later
    }
}

function loadLocalConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            sessionConfig = {
                ...sessionConfig,
                ...configData,
                serverUrl: normalizeUrl(configData.serverUrl) || sessionConfig.serverUrl,
                storeUrl: normalizeUrl(configData.storeUrl) || sessionConfig.storeUrl,
            };
            return true;
        }
    } catch (err) {
        console.error(chalk.dim('Error loading saved configuration:', err.message));
    }
    return false;
}

function saveLocalConfig(config) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error(chalk.dim('Error saving configuration:', err.message));
        return false;
    }
}

export async function getCredentials() {
    if (!sessionConfig.serverUrl || !sessionConfig.apiKey) {
        loadLocalConfig();
    }

    const questions = [];
    if (!sessionConfig.serverUrl) {
        questions.push({
            type: 'input',
            name: 'serverUrl',
            message: `Enter the RefWireDB server URL (or set ${ENV_VAR_URL} env var):`,
            validate: (input) => {
                if (!input) return 'Server URL cannot be empty.';
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL.';
                }
            }
        });
    }

    if (!sessionConfig.apiKey) {
        questions.push({
            type: 'password',
            name: 'apiKey',
            mask: '*',
            message: `Enter your API Key (or set ${ENV_VAR_API_KEY} env var):`,
            validate: (input) => input ? true : 'API Key cannot be empty.',
        });
    }

    if (!sessionConfig.storeUrl) {
        questions.push({
            type: 'input',
            name: 'storeUrl',
            message: `Enter the Store URL (optional, press Enter for default):`,
            default: DEFAULT_STORE_URL,
            validate: (input) => {
                if (!input) return true;
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL.';
                }
            }
        });
    }

    if (questions.length > 0) {
        const answers = await inquirer.prompt(questions);
        if (answers.serverUrl) sessionConfig.serverUrl = normalizeUrl(answers.serverUrl);
        if (answers.apiKey) sessionConfig.apiKey = answers.apiKey;
        if (answers.storeUrl) sessionConfig.storeUrl = normalizeUrl(answers.storeUrl);

        saveLocalConfig(sessionConfig);
        console.log(chalk.green('Credentials saved for future sessions.'));
    }

    return sessionConfig;
}

function _resolveConfig() {
    const envUrl = process.env[ENV_VAR_URL];
    const envApiKey = process.env[ENV_VAR_API_KEY];
    const envStoreUrl = process.env[ENV_VAR_STORE_URL];

    let config = {
        serverUrl: envUrl || sessionConfig.serverUrl,
        apiKey: envApiKey || sessionConfig.apiKey,
        storeUrl: envStoreUrl || sessionConfig.storeUrl || DEFAULT_STORE_URL,
    };

    if (!config.serverUrl || !config.apiKey || !config.storeUrl) {
        loadLocalConfig();
        config.serverUrl = config.serverUrl || sessionConfig.serverUrl;
        config.apiKey = config.apiKey || sessionConfig.apiKey;
        config.storeUrl = config.storeUrl || sessionConfig.storeUrl;
    }

    config.serverUrl = normalizeUrl(config.serverUrl);
    config.storeUrl = normalizeUrl(config.storeUrl);

    return config;
}

export function getConfig() {
    const config = _resolveConfig();
    if (!config.serverUrl || !config.apiKey || !config.storeUrl) {
        throw new Error(`Server URL, API Key and STOR Url are not configured. Run the command again or set ${ENV_VAR_URL}/${ENV_VAR_API_KEY} environment variables.`);
    }
    return config;
}

export function getSilentConfig() {
    return _resolveConfig();
}

export const constants = {
    ENV_VAR_URL,
    ENV_VAR_API_KEY,
    ENV_VAR_STORE_URL,
    DEFAULT_STORE_URL,
    CONFIG_FILE
};
