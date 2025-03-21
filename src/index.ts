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
import { Feature, FeatureStorage, PhaseStatus } from './types.js';
import { features, storeFeature, getFeature, updateFeature, listFeatures } from './storage.js';
import { generateId, createFeatureObject, createPhaseObject, createTaskObject } from './utils.js';
import { 
  DEFAULT_CLARIFICATION_QUESTIONS, 
  getNextClarificationQuestion, 
  addClarificationResponse,
  formatClarificationResponses,
  isClarificationComplete,
  getClarificationStatus
} from './clarification.js';
import {
  generatePRD,
  generateImplementationPlan,
  extractObjectivesFromClarifications,
  extractRequirementsFromClarifications,
  extractTechnicalSpecsFromClarifications
} from './documentation.js';
import { 
  createPhase, 
  getPhase, 
  updatePhaseStatus,
  getNextPhaseStatus,
  validatePhaseTransition,
  addTask,
  updateTaskStatus
} from './phases.js';

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
        },
        handler: async (params: {featureId: string}) => {
          const { featureId } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          if (!isClarificationComplete(feature)) {
            return {
              error: 'Cannot generate PRD until clarification is complete',
              clarificationStatus: getClarificationStatus(feature)
            };
          }
          
          // Generate the PRD
          const prd = generatePRD(feature);
          
          // Update the feature with the PRD
          updateFeature(featureId, {
            ...feature,
            prd,
            updatedAt: new Date()
          });
          
          return {
            success: true,
            message: `PRD generated for feature ${feature.name}`,
            prd
          };
        }
      },
      {
        name: 'generate_implementation_plan',
        description: 'Generate an implementation plan for a feature based on clarifications and PRD',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'The ID of the feature to generate an implementation plan for'
            }
          },
          required: ['featureId']
        },
        handler: async (params: {featureId: string}) => {
          const { featureId } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          if (!isClarificationComplete(feature)) {
            return {
              error: 'Cannot generate implementation plan until clarification is complete',
              clarificationStatus: getClarificationStatus(feature)
            };
          }
          
          // Generate the implementation plan
          const implementationPlan = generateImplementationPlan(feature);
          
          // Update the feature with the implementation plan
          updateFeature(featureId, {
            ...feature,
            implementationPlan,
            updatedAt: new Date()
          });
          
          return {
            success: true,
            message: `Implementation plan generated for feature ${feature.name}`,
            implementationPlan
          };
        }
      },
      {
        name: 'create_phase',
        description: 'Create a new development phase for a feature',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'ID of the feature to create a phase for'
            },
            name: {
              type: 'string',
              description: 'Name of the phase'
            },
            description: {
              type: 'string',
              description: 'Description of the phase'
            }
          },
          required: ['featureId', 'name', 'description']
        },
        handler: async (params: {featureId: string, name: string, description: string}) => {
          const { featureId, name, description } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          // Create the phase
          const phase = createPhase(featureId, name, description);
          
          return {
            success: true,
            message: `Phase ${name} created for feature ${feature.name}`,
            phase
          };
        }
      },
      {
        name: 'update_phase_status',
        description: 'Update the status of a development phase',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'ID of the feature containing the phase'
            },
            phaseId: {
              type: 'string',
              description: 'ID of the phase to update'
            },
            status: {
              type: 'string',
              description: 'New status for the phase (pending, in_progress, completed, reviewed)'
            }
          },
          required: ['featureId', 'phaseId', 'status']
        },
        handler: async (params: {featureId: string, phaseId: string, status: PhaseStatus}) => {
          const { featureId, phaseId, status } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          const phase = feature.phases.find(p => p.id === phaseId);
          
          if (!phase) {
            return {
              error: `Phase with ID ${phaseId} not found in feature ${feature.name}`
            };
          }
          
          // Validate the status transition
          const validationResult = validatePhaseTransition(phase.status, status);
          
          if (!validationResult.valid) {
            return {
              error: validationResult.message
            };
          }
          
          // Update the phase status
          const updatedPhase = updatePhaseStatus(featureId, phaseId, status);
          
          return {
            success: true,
            message: `Phase ${phase.name} status updated to ${status}`,
            phase: updatedPhase
          };
        }
      },
      {
        name: 'add_task',
        description: 'Add a task to a development phase',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'ID of the feature containing the phase'
            },
            phaseId: {
              type: 'string',
              description: 'ID of the phase to add the task to'
            },
            description: {
              type: 'string',
              description: 'Description of the task'
            }
          },
          required: ['featureId', 'phaseId', 'description']
        },
        handler: async (params: {featureId: string, phaseId: string, description: string}) => {
          const { featureId, phaseId, description } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          const phase = feature.phases.find(p => p.id === phaseId);
          
          if (!phase) {
            return {
              error: `Phase with ID ${phaseId} not found in feature ${feature.name}`
            };
          }
          
          // Add the task to the phase
          const updatedPhase = addTask(featureId, phaseId, description);
          
          return {
            success: true,
            message: `Task added to phase ${phase.name}`,
            phase: updatedPhase
          };
        }
      },
      {
        name: 'update_task_status',
        description: 'Update the completion status of a task',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'ID of the feature containing the phase'
            },
            phaseId: {
              type: 'string',
              description: 'ID of the phase containing the task'
            },
            taskId: {
              type: 'string',
              description: 'ID of the task to update'
            },
            completed: {
              type: 'boolean',
              description: 'Whether the task is completed'
            }
          },
          required: ['featureId', 'phaseId', 'taskId', 'completed']
        },
        handler: async (params: {featureId: string, phaseId: string, taskId: string, completed: boolean}) => {
          const { featureId, phaseId, taskId, completed } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          const phase = feature.phases.find(p => p.id === phaseId);
          
          if (!phase) {
            return {
              error: `Phase with ID ${phaseId} not found in feature ${feature.name}`
            };
          }
          
          const task = phase.tasks.find(t => t.id === taskId);
          
          if (!task) {
            return {
              error: `Task with ID ${taskId} not found in phase ${phase.name}`
            };
          }
          
          // Update the task status
          const updatedTask = updateTaskStatus(featureId, phaseId, taskId, completed);
          
          // Check if all tasks are completed and suggest phase update if applicable
          let message = `Task status updated to ${completed ? 'completed' : 'not completed'}`;
          
          if (completed && phase.tasks.every(t => t.id === taskId || t.completed)) {
            // All tasks are now completed
            message += `. All tasks in phase ${phase.name} are now completed. Consider updating the phase status to 'completed'.`;
          }
          
          return {
            success: true,
            message,
            task: updatedTask
          };
        }
      },
      {
        name: 'get_next_phase_action',
        description: 'Get guidance on what to do next in the current phase or whether to move to the next phase',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: {
              type: 'string',
              description: 'ID of the feature'
            }
          },
          required: ['featureId']
        },
        handler: async (params: {featureId: string}) => {
          const { featureId } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          // Find the current active phase (first non-completed/reviewed phase)
          const currentPhase = feature.phases.find(p => p.status === 'pending' || p.status === 'in_progress');
          
          if (!currentPhase) {
            // All phases are completed or reviewed
            return {
              message: 'All phases are completed or reviewed. The feature implementation is done!',
              recommendedAction: 'Feature implementation is complete. Consider reviewing the entire feature.'
            };
          }
          
          // Check task completion status
          const completedTasks = currentPhase.tasks.filter(t => t.completed);
          const pendingTasks = currentPhase.tasks.filter(t => !t.completed);
          
          // Determine next action based on phase and task status
          if (currentPhase.status === 'pending') {
            return {
              message: `Phase "${currentPhase.name}" is pending. Start working on this phase by setting its status to "in_progress".`,
              recommendedAction: 'Set phase status to "in_progress"',
              phaseId: currentPhase.id,
              phaseName: currentPhase.name,
              status: 'in_progress'
            };
          } else if (currentPhase.status === 'in_progress') {
            if (pendingTasks.length > 0) {
              return {
                message: `${completedTasks.length}/${currentPhase.tasks.length} tasks are completed in phase "${currentPhase.name}". Continue working on pending tasks.`,
                recommendedAction: 'Complete the pending tasks',
                pendingTasks: pendingTasks.map(t => ({ id: t.id, description: t.description })),
                phaseId: currentPhase.id,
                phaseName: currentPhase.name
              };
            } else if (currentPhase.tasks.length === 0) {
              return {
                message: `Phase "${currentPhase.name}" has no tasks defined. Add tasks or mark the phase as completed if appropriate.`,
                recommendedAction: 'Add tasks to the phase or mark it as completed',
                phaseId: currentPhase.id,
                phaseName: currentPhase.name
              };
            } else {
              // All tasks are completed
              return {
                message: `All tasks in phase "${currentPhase.name}" are completed. Consider marking this phase as completed.`,
                recommendedAction: 'Set phase status to "completed"',
                phaseId: currentPhase.id,
                phaseName: currentPhase.name,
                status: 'completed'
              };
            }
          }
          
          // This code should not be reached, but just in case
          return {
            message: `Phase "${currentPhase.name}" is in status "${currentPhase.status}" with ${completedTasks.length}/${currentPhase.tasks.length} tasks completed.`,
            phaseId: currentPhase.id,
            phaseName: currentPhase.name
          };
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
    
    case "update_phase_status": {
      const args = request.params.arguments || {};
      const featureId = String(args.featureId || "");
      const phaseId = String(args.phaseId || "");
      const status = String(args.status || "");
      
      // Validate inputs
      if (!featureId || !phaseId || !status) {
        throw new Error("Feature ID, phase ID, and status are required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Get the phase
      const phase = feature.phases.find(p => p.id === phaseId);
      if (!phase) {
        throw new Error(`Phase ${phaseId} not found`);
      }
      
      // Validate the status transition
      const validationResult = validatePhaseTransition(phase.status, status as PhaseStatus);
      if (!validationResult.valid) {
        throw new Error(validationResult.message);
      }
      
      // Update the phase status
      const updatedPhase = updatePhaseStatus(featureId, phaseId, status as PhaseStatus);
      
      return {
        content: [{
          type: "text",
          text: `Phase "${phase.name}" status updated to "${status}"`
        }]
      };
    }
    
    case "add_task": {
      const args = request.params.arguments || {};
      const featureId = String(args.featureId || "");
      const phaseId = String(args.phaseId || "");
      const description = String(args.description || "");
      
      // Validate inputs
      if (!featureId || !phaseId || !description) {
        throw new Error("Feature ID, phase ID, and task description are required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Get the phase
      const phase = feature.phases.find(p => p.id === phaseId);
      if (!phase) {
        throw new Error(`Phase ${phaseId} not found`);
      }
      
      // Add the task
      const updatedPhase = addTask(featureId, phaseId, description);
      
      return {
        content: [{
          type: "text",
          text: `Task added to phase "${phase.name}"`
        }]
      };
    }
    
    case "update_task_status": {
      const args = request.params.arguments || {};
      const featureId = String(args.featureId || "");
      const phaseId = String(args.phaseId || "");
      const taskId = String(args.taskId || "");
      const completed = args.completed === true;
      
      // Validate inputs
      if (!featureId || !phaseId || !taskId || args.completed === undefined) {
        throw new Error("Feature ID, phase ID, task ID, and completed status are required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Get the phase
      const phase = feature.phases.find(p => p.id === phaseId);
      if (!phase) {
        throw new Error(`Phase ${phaseId} not found`);
      }
      
      // Get the task
      const task = phase.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      
      // Update the task status
      const updatedTask = updateTaskStatus(featureId, phaseId, taskId, completed);
      
      // Check if all tasks are completed
      let message = `Task status updated to ${completed ? 'completed' : 'not completed'}`;
      
      if (completed && phase.tasks.every(t => t.completed)) {
        message += `. All tasks in phase "${phase.name}" are now completed. Consider updating the phase status to "completed".`;
      }
      
      return {
        content: [{
          type: "text",
          text: message
        }]
      };
    }
    
    case "create_phase": {
      const args = request.params.arguments || {};
      const featureId = String(args.featureId || "");
      const name = String(args.name || "");
      const description = String(args.description || "");
      
      // Validate inputs
      if (!featureId || !name || !description) {
        throw new Error("Feature ID, name, and description are required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Create the phase
      const phase = createPhase(featureId, name, description);
      
      return {
        content: [{
          type: "text",
          text: `Phase "${name}" created for feature "${feature.name}"`
        }]
      };
    }
    
    case "get_next_phase_action": {
      const args = request.params.arguments || {};
      const featureId = String(args.featureId || "");
      
      // Validate inputs
      if (!featureId) {
        throw new Error("Feature ID is required");
      }
      
      // Get the feature
      const feature = getFeature(featureId);
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Find the current active phase
      const currentPhase = feature.phases.find(p => p.status === 'pending' || p.status === 'in_progress');
      
      if (!currentPhase) {
        return {
          content: [{
            type: "text",
            text: 'All phases are completed or reviewed. The feature implementation is done!'
          }]
        };
      }
      
      // Check task completion status
      const completedTasks = currentPhase.tasks.filter(t => t.completed);
      const pendingTasks = currentPhase.tasks.filter(t => !t.completed);
      
      // Determine next action
      let message;
      if (currentPhase.status === 'pending') {
        message = `Phase "${currentPhase.name}" is pending. Start working on this phase by setting its status to "in_progress".`;
      } else if (pendingTasks.length > 0) {
        message = `${completedTasks.length}/${currentPhase.tasks.length} tasks are completed in phase "${currentPhase.name}". Continue working on pending tasks: ${pendingTasks.map(t => `"${t.description}"`).join(', ')}`;
      } else if (currentPhase.tasks.length === 0) {
        message = `Phase "${currentPhase.name}" has no tasks defined. Add tasks or mark the phase as completed if appropriate.`;
      } else {
        message = `All tasks in phase "${currentPhase.name}" are completed. Consider marking this phase as completed.`;
      }
      
      return {
        content: [{
          type: "text",
          text: message
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
