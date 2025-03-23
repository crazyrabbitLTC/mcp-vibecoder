# Vibe-Coder MCP Server

A Model Context Protocol server that implements a structured development workflow for LLM-based coding.

## Overview

This MCP server helps LLMs build features in an organized, clean, and safe manner by providing:

- A structured feature clarification process with guided questions
- PRD and implementation plan generation
- Phased development with task tracking
- Progress tracking and status reporting
- Document storage and retrieval capabilities

## Features

### Resources
- Feature details, PRDs, and implementation plans
- Progress reports and status tracking
- Phase and task details

### Tools
- `start_feature_clarification` - Begin the feature clarification process
- `provide_clarification` - Answer clarification questions about a feature
- `generate_prd` - Generate a Product Requirements Document and implementation plan
- `create_phase` - Create a development phase for a feature
- `add_task` - Add tasks to a development phase
- `update_phase_status` - Update the status of a phase
- `update_task_status` - Update the completion status of a task
- `get_next_phase_action` - Get guidance on what to do next
- `get_document_path` - Get the path of a generated document
- `save_document` - Save a document to a specific location

### Prompts
- `feature-planning` - A prompt template for planning feature development

## Document Storage

The server includes a hybrid document storage system that:

1. Automatically saves generated documents (PRDs, implementation plans) to files
2. Maintains an in-memory copy for quick access
3. Allows clients to retrieve document paths and save to custom locations

### Default Storage Location

Documents are stored in the `documents/{featureId}/` directory by default, with filenames based on document type:

- `documents/{featureId}/prd.md` - Product Requirements Document
- `documents/{featureId}/implementation-plan.md` - Implementation Plan

### Custom Storage

You can use the `save_document` tool to save documents to custom locations:

```json
{
  "featureId": "feature-123",
  "documentType": "prd",
  "filePath": "/custom/path/feature-123-prd.md"
}
```

### Path Retrieval

To get the path of a document, use the `get_document_path` tool:

```json
{
  "featureId": "feature-123",
  "documentType": "prd"
}
```

This returns both the path and whether the document has been saved to disk.

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

## Workflow

The Vibe-Coder MCP server is designed to guide the development process through the following steps:

1. **Feature Clarification**: Start by gathering requirements and understanding the feature's purpose, target users, and constraints
2. **Documentation**: Generate a PRD and implementation plan based on the clarified requirements
3. **Phased Development**: Break down the implementation into logical phases with clear tasks
4. **Progress Tracking**: Monitor the completion of tasks and phases to guide development
5. **Completion**: Verify that all requirements have been implemented and the feature is ready for use 