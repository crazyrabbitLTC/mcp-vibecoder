# Vibe-Coder MCP Server

A Model Context Protocol server that implements a structured development workflow for LLM-based coding.

## Overview

This MCP server helps LLMs build features in an organized, clean, and safe manner by providing:

- A structured feature clarification process with guided questions
- PRD and implementation plan generation
- Phased development with task tracking
- Progress tracking and status reporting

## Features

### Resources
- Feature details, PRDs, and implementation plans
- Progress reports and status tracking
- Phase and task details

### Tools
- `start_feature_clarification` - Begin the feature clarification process
- `provide_clarification` - Answer clarification questions about a feature
- `generate_prd` - Generate a Product Requirements Document
- `generate_implementation_plan` - Create a detailed implementation plan
- `create_phase` - Create a development phase for a feature
- `add_task` - Add tasks to a development phase
- `update_phase_status` - Update the status of a phase
- `update_task_status` - Update the completion status of a task
- `get_next_phase_action` - Get guidance on what to do next

### Prompts
- `feature-planning` - A prompt template for planning feature development

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with compatible MCP clients:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vibe-coder-mcp": {
      "command": "/path/to/vibe-coder-mcp/build/mcp-server.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Implementation Notes

This server is implemented using the high-level `McpServer` class from the Model Context Protocol TypeScript SDK, which simplifies the process of creating MCP servers by providing a clean API for defining resources, tools, and prompts.

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create an MCP server
const server = new McpServer({
  name: "Vibe-Coder",
  version: "0.3.0"
});

// Add a resource
server.resource(
  "features-list",
  "features://list",
  async (uri) => ({ /* ... */ })
);

// Add a tool
server.tool(
  "start_feature_clarification",
  { /* parameters schema */ },
  async (params) => ({ /* ... */ })
);

// Add a prompt
server.prompt(
  "feature-planning",
  { /* parameters schema */ },
  (params) => ({ /* ... */ })
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```
