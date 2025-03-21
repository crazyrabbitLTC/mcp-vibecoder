#!/usr/bin/env node

/**
 * @file Vibe-Coder MCP Server
 * @version 0.1.0
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
import { Feature, FeatureStorage } from './types.js';
import { features, storeFeature, getFeature, updateFeature, listFeatures } from './storage.js';
import { generateId, createFeatureObject, createPhaseObject, createTaskObject } from './utils.js';
import { 
  DEFAULT_CLARIFICATION_QUESTIONS, 
  getNextClarificationQuestion, 
  addClarificationResponse,
  formatClarificationResponses
} from './clarification.js';
import { generatePRD, generateImplementationPlan } from './documentation.js';

/**
 * Type alias for a note object.
 */
type Note = { title: string, content: string };

/**
 * Simple in-memory storage for notes.
 * In a real implementation, this would likely be backed by a database.
 */
const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" }
};

/**
 * Create an MCP server with capabilities for resources, tools, and prompts
 */
const server = new Server(
  {
    name: "Vibe-Coder MCP Server",
    version: "0.1.0",
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
 * Handler for listing available resources.
 * Exposes:
 * - A list of all features
 * - Individual feature details
 * - PRD and implementation plan documents
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
      ...listFeatures().flatMap(feature => [
        {
          uri: `feature://${feature.id}`,
          mimeType: "text/plain", 
          name: feature.name,
          description: `Details about feature: ${feature.name}`
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
        }
      ])
    ]
  };
});

/**
 * Handler for reading feature resources.
 * Supports:
 * - List of all features
 * - Individual feature details
 * - PRD and implementation plan documents
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  
  // Handle list of all features
  if (url.protocol === "features:") {
    if (url.pathname === "/list") {
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/plain",
          text: listFeatures().map(f => `${f.id}: ${f.name}`).join("\n")
        }]
      };
    }
  }
  
  // Handle feature-specific resources
  if (url.protocol === "feature:") {
    const parts = url.pathname.split('/').filter(Boolean);
    const featureId = parts[0];
    const feature = getFeature(featureId);
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    // Return feature details
    if (parts.length === 1) {
      const timestamp = feature.updatedAt.toISOString();
      const clarifications = formatClarificationResponses(feature.clarificationResponses);
      const phasesText = feature.phases.map(p => 
        `- ${p.name} (${p.status}): ${p.tasks.filter(t => t.completed).length}/${p.tasks.length} tasks completed`
      ).join('\n');
      
      const featureDetails = `
Feature: ${feature.name}
ID: ${feature.id}
Description: ${feature.description}
Last Updated: ${timestamp}

Clarification Responses:
${clarifications}

Phases (${feature.phases.length}):
${phasesText}
`;
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/plain",
          text: featureDetails
        }]
      };
    }
    
    // Return PRD document
    if (parts[1] === "prd") {
      const prdContent = feature.prdDoc || generatePRD(feature);
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/markdown",
          text: prdContent
        }]
      };
    }
    
    // Return implementation plan document
    if (parts[1] === "implementation") {
      const implContent = feature.implDoc || generateImplementationPlan(feature);
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/markdown",
          text: implContent
        }]
      };
    }
  }
  
  throw new Error("Resource not found");
});

/**
 * Handler that lists available tools.
 * Exposes tools for feature clarification and development.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "start_feature_clarification",
        description: "Start the clarification process for a new feature",
        inputSchema: {
          type: "object",
          properties: {
            featureName: {
              type: "string",
              description: "Name of the feature"
            },
            initialDescription: {
              type: "string",
              description: "Initial description of the feature"
            }
          },
          required: ["featureName"]
        }
      },
      {
        name: "provide_clarification",
        description: "Provide answer to a clarification question",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            },
            question: {
              type: "string",
              description: "Clarification question"
            },
            answer: {
              type: "string",
              description: "Answer to the clarification question"
            }
          },
          required: ["featureId", "question", "answer"]
        }
      },
      {
        name: "generate_prd",
        description: "Generate a PRD document based on clarification responses",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            }
          },
          required: ["featureId"]
        }
      }
    ]
  };
});

/**
 * Handler for implementing MCP tools.
 * Handles feature clarification, PRD generation, and more.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "start_feature_clarification": {
      const featureName = String(request.params.arguments?.featureName || "");
      const initialDescription = String(request.params.arguments?.initialDescription || "");
      
      // Create a new feature
      const feature = createFeatureObject(featureName, initialDescription);
      storeFeature(feature);
      
      // Get the first clarification question
      const firstQuestion = getNextClarificationQuestion(feature);
      
      return {
        content: [{
          type: "text",
          text: `Feature ID: ${feature.id}\n\nLet's clarify your feature request. ${firstQuestion}`
        }]
      };
    }
    
    case "provide_clarification": {
      const featureId = String(request.params.arguments?.featureId || "");
      const question = String(request.params.arguments?.question || "");
      const answer = String(request.params.arguments?.answer || "");
      
      // Validate inputs
      if (!featureId) {
        throw new Error("Feature ID is required");
      }
      
      if (!question || !answer) {
        throw new Error("Question and answer are required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Add the clarification response
      const updatedFeature = addClarificationResponse(featureId, question, answer);
      
      // Get the next question
      const nextQuestion = getNextClarificationQuestion(updatedFeature!);
      
      if (nextQuestion) {
        return {
          content: [{
            type: "text",
            text: `Response recorded. Next question: ${nextQuestion}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `All clarification questions answered! You can now generate a PRD using the generate_prd tool with featureId: ${featureId}`
          }]
        };
      }
    }
    
    case "generate_prd": {
      const featureId = String(request.params.arguments?.featureId || "");
      
      // Validate inputs
      if (!featureId) {
        throw new Error("Feature ID is required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Generate the PRD
      const prdContent = generatePRD(feature);
      
      // Update the feature with the PRD
      updateFeature(featureId, { prdDoc: prdContent });
      
      return {
        content: [{
          type: "text",
          text: `PRD generated successfully for ${feature.name}. You can view it at resource://feature/${featureId}/prd`
        }]
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
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
 * Returns a prompt that guides feature clarification.
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
  
  throw new Error("Unknown prompt");
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  console.error("Starting Vibe-Coder MCP Server...");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
