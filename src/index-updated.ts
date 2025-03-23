#!/usr/bin/env node

/**
 * @file Vibe-Coder MCP Server
 * @version 0.2.0
 * 
 * This MCP server implements a structured development workflow that helps
 * LLM-based coders build features in an organized, clean, and safe manner.
 * 
 * Core functionalities:
 * - Feature request clarification through iterative questioning
 * - PRD and implementation plan generation
 * - Phased development with tasks and status tracking
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import core modules
// Create our own ResourceTemplate class since we can't access the SDK's directly
class ResourceTemplate {
  constructor(public pattern: string, public metadata: any) {}
}
import { Feature, FeatureStorage, PhaseStatus, Phase, Task, ClarificationResponse } from './types.js';
import { features, storeFeature, getFeature, updateFeature, listFeatures } from './storage.js';
import { 
  DEFAULT_CLARIFICATION_QUESTIONS as CLARIFICATION_QUESTIONS, 
  getNextClarificationQuestion, 
  addClarificationResponse,
  formatClarificationResponses,
  isClarificationComplete,
  getClarificationStatus
} from './clarification.js';
import { generatePRD, generateImplementationPlan } from './documentation.js';
import { createPhase, getPhase, updatePhaseStatus, getNextPhaseStatus, validatePhaseTransition, addTask, updateTaskStatus } from './phases.js';
import { generateId, createFeatureObject, createPhaseObject, createTaskObject, generateFeatureProgressSummary, isValidPhaseStatus } from './utils.js';
import { validateFeatureId, validatePhaseId, validateTaskId, validateFeaturePhaseTask, validateRequiredText, validatePhaseStatusValue } from './validators.js';
import { toolRegistry, resourceRegistry } from './registry.js';
import { registerToolHandlers } from './tool-handlers.js';
import { registerResourceHandlers } from './resource-handlers.js';
import { ErrorCode, createErrorResponse, createToolErrorResponse } from './errors.js';

/**
 * Create an MCP server with capabilities for resources, tools, and prompts
 */
const server = new Server(
  {
    name: "Vibe-Coder MCP Server",
    version: "0.2.0",
  },
  {
    capabilities: {
      resources: {}, // Expose resources for features, PRDs, and implementation plans
      tools: {},     // Provide tools for feature clarification and development
      prompts: {},   // Supply prompts for guiding the development process
    },
  }
);

/**
 * Initialize the server by registering all tool and resource handlers
 */
function initializeServer() {
  // Register all tool handlers
  registerToolHandlers();
  
  // Register all resource handlers
  registerResourceHandlers();
  
  console.error("Vibe-Coder MCP Server initialized successfully");
}

/**
 * Handler for listing available resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "features://list",
        mimeType: "text/plain",
        name: "Features List",
        description: "Lists all features being developed"
      },
      {
        uri: "features://status",
        mimeType: "text/markdown",
        name: "Project Status",
        description: "Provides a summary of all features and their development status"
      },
      ...listFeatures().flatMap(feature => [
        {
          uri: `feature://${feature.id}`,
          mimeType: "text/plain", 
          name: feature.name,
          description: `Details about feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/progress`,
          mimeType: "text/markdown",
          name: `${feature.name} Progress Report`,
          description: `Detailed progress report for feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/prd`,
          mimeType: "text/markdown",
          name: `${feature.name} PRD`,
          description: `PRD document for feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/implementation`,
          mimeType: "text/markdown",
          name: `${feature.name} Implementation Plan`,
          description: `Implementation plan for feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/phases`,
          mimeType: "text/plain",
          name: `${feature.name} Phases`,
          description: `Lists all phases for feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/tasks`,
          mimeType: "text/plain",
          name: `${feature.name} All Tasks`,
          description: `Lists all tasks across all phases for feature: ${feature.name}`
        },
        ...feature.phases.flatMap(phase => [
          {
            uri: `feature://${feature.id}/phase/${phase.id}`,
            mimeType: "text/plain",
            name: `${feature.name} - ${phase.name}`,
            description: `Details about phase: ${phase.name} for feature: ${feature.name}`
          },
          {
            uri: `feature://${feature.id}/phase/${phase.id}/tasks`,
            mimeType: "text/plain",
            name: `${feature.name} - ${phase.name} Tasks`,
            description: `Lists all tasks for phase: ${phase.name}`
          },
          ...phase.tasks.map(task => ({
            uri: `feature://${feature.id}/phase/${phase.id}/task/${task.id}`,
            mimeType: "text/plain",
            name: `Task: ${task.description.substring(0, 30)}${task.description.length > 30 ? '...' : ''}`,
            description: `Details about task: ${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}`
          }))
        ])
      ])
    ]
  };
});

/**
 * Handler for reading feature resources.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const uri = request.params.uri;
    
    const match = resourceRegistry.findMatch(uri);
    
    if (match) {
      return await match.handler(new URL(uri), match.params);
    }
    
    return createErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Resource not found: ${uri}`
    );
  } catch (error: any) {
    console.error(`Error reading resource ${request.params.uri}:`, error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error.message || 'Unknown error'
    );
  }
});

/**
 * Handler that lists available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.listTools()
  };
});

/**
 * Handler for implementing MCP tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;
    const toolArguments = request.params.arguments || {};
    
    // Execute the tool using the tool registry
    return await toolRegistry.execute(toolName, toolArguments);
  } catch (error: any) {
    console.error('Error executing tool:', error);
    return createToolErrorResponse(`An unexpected error occurred: ${error.message || 'Unknown error'}`);
  }
});

/**
 * Handler that lists available prompts.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "clarify_feature",
        description: "Guide to clarify a feature request through questioning"
      }
    ]
  };
});

/**
 * Handler for the clarify_feature prompt.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "clarify_feature") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Help me clarify this feature request by asking questions about:"
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: "1. The specific problem it solves\n2. The target users\n3. Key requirements\n4. Success criteria\n5. Technical constraints\n\nAsk one question at a time, analyze the response, then proceed to the next most relevant question."
          }
        }
      ]
    };
  }
  
  return createErrorResponse(
    ErrorCode.PROMPT_NOT_FOUND,
    `Unknown prompt: ${request.params.name}`
  );
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  console.error("Starting Vibe-Coder MCP Server...");
  
  // Initialize the server
  initializeServer();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
}); 