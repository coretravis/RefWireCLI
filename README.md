[![GitHub stars](https://img.shields.io/github/stars/coretravis/RefWireCLI.svg?style=social)](https://github.com/coretravis/RefWireCLI/stargazers) [![GitHub forks](https://img.shields.io/github/forks/coretravis/RefWireCLI.svg?style=social)](https://github.com/coretravis/RefWireCLI/network) [![GitHub issues](https://img.shields.io/github/issues/coretravis/RefWireCLI.svg)](https://github.com/coretravis/RefWireCLI/issues)

# RefWire CLI

**RefWire CLI** is an open-source, Node.js-based command-line tool for administering your [RefWire](https://github.com/coretravis/RefWire) instance(s) via its RESTful API. It provides a consistent, interactive, and scriptable interface for:

* **API Key Management**
* **Dataset Operations**
* **Item Management**
* **System Health & Instance Administration**
* **Credential & Session Management**

---

## Table of Contents

* [Quick Start](#quick-start)
* [Overview](#overview)
* [Features](#features)
* [Architecture & Context](#architecture--context)
* [Installation](#installation)
* [Configuration & Authentication](#configuration--authentication)
* [Usage](#usage)

  * [Global Options](#global-options)
  * [Command Categories](#command-categories)
* [Examples](#examples)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)

---

## Quick Start

```bash
npm install -g @coretravis/refwire

refwire dataset list-ids
```
This will prompt you for:
- RefWire Url: Your RefWire Instance URL e.g `https://myrefwireeintance.com`, `https://localhost:7050`
- ApiKey (Use 'ThisIsTheApiKey' for demo purposes but make sure to set a strong key for production via Configuration)
- ListStor Server Url (optional): Set this to `https://refpack.refwire.online` to use the `refwire **pull** {datasetID}` command which give you access to standardized datasets found at https://stor.refwire.online
- **Note: You will only need to set the configuration only once**

---

## Overview

RefWire CLI streamlines administrative tasks for your RefWire data service:

* Securely create, list, update, and revoke API keys.
* Import, update, and delete datasets—with an interactive JSON import wizard.
* Add, update, or archive items individually or in bulk.
* Monitor system health and manage distributed application instances.
* Persist credentials across sessions using environment variables or a local config file.

---

## Features

### API Key Management

* **Create** keys (30-day default TTL).
* **List & Retrieve** key details.
* **Update & Revoke** keys on demand.

### Dataset Operations

* **Non-Interactive Create/Update** from local JSON files.
* **Interactive Import Wizard** for guided dataset creation.
* **Pull** datasets from RefWire Stor with automatic ID/Name field detection.
* **Inspect** metadata and API schemas.
* **Delete** datasets with confirmation and item-count warnings.

### Item Management

* **Add/Update** single items or bulk-load via JSON files.
* **Archive** (soft-delete) items to preserve history.

### System Administration & Orchestration

* **Health Reporting**: view system diagnostics.
* **Instance Management**: list/remove distributed app instances (leader/follower).
* **System Snapshot**: capture full system state (datasets, instances, health).
* **Security**: rate limiting, CORS support, and credential validation included.

### Session & Credential Management

* Credentials are sourced in this order:

  1. **Environment variables**
  2. **Local config file** (`~/.refwiredb/config.json`)
  3. **Interactive prompts**
* `logout` command to clear saved credentials.
* `status` command to inspect your current authentication config.

---

## Architecture & Context

Built with **Node.js** (v14+), RefWire CLI uses [Commander.js](https://github.com/tj/commander.js/) for command parsing, communicates with your RefWire Server’s REST API, and persists session data in `~/.refwiredb/config.json`.

---

## Installation

### Prerequisites

* **Node.js** v14 or newer
* **npm** (comes with Node.js)
* **Docker** (optional—for containerized builds)

### Option 1: Install via npm (Recommended)

```bash
npm install -g @coretravis/refwire
```

### Option 2: Install from Source

```bash
git clone https://github.com/coretravis/RefWireCLI.git
cd RefWireCLI
npm install
npm run build         # only if modifying source
npm link              # makes `refwire` available globally
```

Verify installation:

```bash
refwire --help
```

---

## Configuration & Authentication

The CLI retrieves your server configuration from the following, in order:

1. **Environment Variables**

   ```bash
   export LISTSERV_URL=https://api.example.com
   export LISTSERV_API_KEY=your_api_key_here
   export LISTSERV_STORE_URL=stor.refwire.online
   ```
2. **Local Config File** (`~/.refwiredb/config.json`)

   ```json
   {
     "url": "https://api.example.com",
     "apiKey": "your_saved_api_key",
     "storeUrl": "stor.refwire.online"
   }
   ```
3. **Interactive Prompts**
   If no credentials are found, the CLI will prompt for them and save the configuration locally.

---

## Usage

Basic command syntax:

```bash
refwire <category> <command> [options]
```

### Global Options

* `--version` — Show CLI version
* `--help` — Show help for CLI or specific command

### Command Categories

<details>
<summary><strong>api-key</strong> — Manage API Keys</summary>

```bash
refwire api-key create "WebKey" -d "Public access" -s read
```

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `create <name>` | Create new key (30-day TTL). Supports `-d`, `-s`.          |
| `list`          | List all API keys.                                         |
| `get <id>`      | Show details for a specific API key.                       |
| `update <id>`   | Update name, description, or scopes (replaces old scopes). |
| `revoke <id>`   | Delete a specific API key.                                 |

</details>

<details>
<summary><strong>dataset</strong> — Manage Datasets</summary>

| Command                                            | Description                                         |
| -------------------------------------------------- | --------------------------------------------------- |
| `list-ids`                                         | List all dataset IDs.                               |
| `get-meta <id>`                                    | View dataset metadata.                              |
| `get-api <id>`                                     | View dataset API schema.                            |
| `get-state`                                        | Full system snapshot (datasets, instances, health). |
| `delete <id> [--force]`                            | Delete dataset, confirm unless `--force`.           |
| `create --file <path>`                             | Create dataset from JSON file.                      |
| `update <id> --file <path>`                        | Update dataset from file.                           |
| `import`                                           | Launch interactive import wizard.                   |
| `pull <liststorId>`                                | Download from ListStor. Options:                    |
|     `-i`, `-n`, `-d`, `--id-field`, `--name-field` |                                                     |

</details>

<details>
<summary><strong>item</strong> — Manage Items</summary>

```bash
refwire item add      <datasetId> <itemId> "Name" -d '{"key":"value"}'
refwire item add-bulk <datasetId> --file items.json
```

| Command    | Description               |
| ---------- | ------------------------- |
| `add`      | Add single item.          |
| `add-bulk` | Add items from JSON file. |
| `update`   | Update item fields.       |
| `archive`  | Soft-delete item.         |

</details>

<details>
<summary><strong>health</strong> — System Diagnostics</summary>

| Command  | Description                |
| -------- | -------------------------- |
| `report` | View system health report. |

</details>

<details>
<summary><strong>instance</strong> — Instance Management</summary>

| Command       | Description                 |
| ------------- | --------------------------- |
| `list`        | List registered instances.  |
| `remove <id>` | Remove a specific instance. |

</details>

<details>
<summary><strong>auth</strong> — Authentication</summary>

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `logout [--force]` | Clears saved credentials. Prompts unless `--force`. |
| `status`           | Shows current authentication setup.                 |

</details>

---

## Examples

### Create a Read-Only API Key

```bash
refwire api-key create "WebClientKey" -d "Key for public web app" -s read
```

### List All Dataset IDs

```bash
refwire dataset list-ids
```

### Show Metadata for `countries`

```bash
refwire dataset get-meta countries
```

### Delete a Dataset (with Prompt)

```bash
refwire dataset delete obsoleteDataset
```

### Force-Delete Without Prompt

```bash
refwire dataset delete obsoleteDataset --force
```

### Import via Wizard

```bash
refwire dataset import
```

### Pull from ListStor

```bash
refwire dataset pull world-countries \
  --id countries \
  --name "All Countries" \
  --description "ISO country list" \
  --id-field iso2 \
  --name-field name
```

*On success:*

```
Dataset 'countries' successfully pulled and created!
View details with: refwire dataset get-meta countries
```

### Logout & Clear Credentials

```bash
refwire auth logout
```

### Force Logout Without Prompt

```bash
refwire auth logout --force
```

### Check Authentication Status

```bash
refwire auth status
```

*Sample Output:*

```
You are fully configured with the following settings:
Server URL: https://api.example.com
API Key: *******
Store URL: stor.refwire.online (default)

Using environment variables: LISTSERV_URL, LISTSERV_API_KEY
```

---

## Contributing

We welcome all contributions! See our [CONTRIBUTING](CONTRIBUTING.md) guide for:

* Fork & branch workflow
* Coding standards
* Linting & testing
* PR guidelines

Use GitHub Discussions to propose features or report bugs.

---

## License

MIT License — see [LICENSE](LICENSE.txt).

---

## Contact

For support or questions, use GitHub Discussions or email [info@coretravis.work](mailto:info@coretravis.work).
