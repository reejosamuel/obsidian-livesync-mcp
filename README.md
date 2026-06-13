# obsidian-livesync-mcp

MCP (Model Context Protocol) server for Obsidian LiveSync vaults.  
Reads/writes notes directly from CouchDB with full E2EE decryption.

## Quick Start

### Prerequisites
- CouchDB instance with an Obsidian LiveSync database
- Your E2EE passphrase (from Obsidian LiveSync plugin settings)

### Docker (recommended)

```bash
export COUCHDB_URL=http://localhost:5984
export DBNAME=your-vault-db
export COUCHDB_USER=admin
export COUCHDB_PASSWORD=change-me
export PASSPHRASE="your-e2ee-passphrase"
export MCP_API_KEY="generate-a-random-key"

docker compose up -d
```

### Bare metal

```bash
git clone --recurse-submodules https://github.com/your-org/obsidian-livesync-mcp
cd obsidian-livesync-mcp
npm install
npm run build

hostname=https://your-couchdb.com \
dbname=your-vault-db \
username=admin \
password=change-me \
PASSPHRASE="your-passphrase" \
MCP_API_KEY="your-key" \
MCP_TRANSPORT=sse \
node dist/index.js
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `hostname` | yes | — | CouchDB URL |
| `dbname` | yes | — | Database name |
| `username` | no | — | CouchDB HTTP auth user |
| `password` | no | — | CouchDB HTTP auth password |
| `PASSPHRASE` | no | — | E2EE passphrase |
| `MCP_TRANSPORT` | no | `stdio` | `stdio` or `sse` |
| `MCP_PORT` | no | `3100` | SSE HTTP port |
| `MCP_API_KEY` | no | — | Bearer token for SSE auth |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |
| `CACHE_TTL` | no | `60` | In-memory cache TTL (seconds) |
| `REQUEST_TIMEOUT` | no | `30000` | CouchDB request timeout (ms) |

## MCP Tools

| Tool | Description |
|---|---|
| `list_files_in_vault` | List all files, optional prefix filter |
| `list_files_in_dir` | List files in a directory |
| `get_file_contents` | Read a file (with E2EE decryption) |
| `search` | Search file contents |
| `create_note` | Create a new note |
| `append_content` | Append to an existing file |
| `patch_content` | Patch under a markdown heading |
| `delete_file` | Delete a file |

## opencode Config

```jsonc
{
  "mcp": {
    "obsidian-livesync": {
      "type": "remote",
      "url": "http://localhost:3100/sse"
    }
  }
}
```

## Development

```bash
npm install
npm run build     # build
npm run dev       # watch mode (tsx)
npm run test      # vitest
npm run lint      # eslint
npm run typecheck # tsc --noEmit
npm run format    # prettier
```

## Architecture

```
opencode ──SSE──> obsidian-livesync-mcp ──HTTP──> CouchDB
                           │
                    E2EE decryption
                    (octagonal-wheels)
```

## License

MIT
