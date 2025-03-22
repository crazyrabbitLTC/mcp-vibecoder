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
import { Feature, FeatureStorage, PhaseStatus, Phase, Task } from './types.js';
import { features, storeFeature, getFeature, updateFeature, listFeatures } from './storage.js';
import { 
  DEFAULT_CLARIFICATION_QUESTIONS as CLARIFICATION_QUESTIONS, 
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
import { 
  generateId, 
  createFeatureObject,
  createPhaseObject,
  createTaskObject,
  generateFeatureProgressSummary,
  isValidPhaseStatus
} from './utils.js';
import { validateFeatureId, validatePhaseId, validateTaskId, validateFeaturePhaseTask, validateRequiredText, validatePhaseStatusValue } from './validators.js';

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
 * - Phase and task details
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
 * Supports:
 * - List of all features
 * - Individual feature details
 * - PRD and implementation plan documents
 * - Phase and task details
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
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
      
      if (url.pathname === "/status") {
        const features = listFeatures();
        
        if (features.length === 0) {
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "text/markdown",
              text: "# Project Status\n\nNo features have been created yet."
            }]
          };
        }
        
        const featuresStatus = features.map(feature => {
          const totalPhases = feature.phases.length;
          const completedPhases = feature.phases.filter(p => p.status === 'completed' || p.status === 'reviewed').length;
          const totalTasks = feature.phases.reduce((acc, phase) => acc + phase.tasks.length, 0);
          const completedTasks = feature.phases.reduce(
            (acc, phase) => acc + phase.tasks.filter(t => t.completed).length, 0
          );
          
          return `## ${feature.name}
- ID: ${feature.id}
- Status: ${completedPhases === totalPhases && totalPhases > 0 ? 'Completed' : 'In Progress'}
- Phases: ${completedPhases}/${totalPhases} completed
- Tasks: ${completedTasks}/${totalTasks} completed
- [View Details](feature://${feature.id}/progress)
`;
        }).join('\n');
        
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "text/markdown",
            text: `# Project Status\n\n${featuresStatus}`
          }]
        };
      }
    }
    
    // Handle feature-specific resources
    if (url.protocol === "feature:") {
      // The hostname part is actually our feature ID in feature:// URLs
      let featureId = "";
      
      if (url.hostname) {
        featureId = url.hostname;
      } else {
        // Try to get feature ID from pathname for backward compatibility
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          featureId = parts[0];
        }
      }
      
      if (!featureId) {
        throw new Error(`Invalid feature URI: ${request.params.uri}. Missing feature ID.`);
      }
      
      const feature = getFeature(featureId);
      
      if (!feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      
      // Extract path parts, excluding empty strings
      const parts = url.pathname.split('/').filter(Boolean);
      
      // Return feature details - no additional path parts beyond the feature ID
      if (parts.length === 0) {
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
      
      // Resource is a sub-resource of the feature
      if (parts.length >= 1) {
        const subResource = parts[0];
        
        // Return feature progress report
        if (subResource === "progress") {
          const progressReport = generateFeatureProgressSummary(feature);
          
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "text/markdown",
              text: progressReport
            }]
          };
        }
        
        // Return PRD document
        if (subResource === "prd") {
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
        if (subResource === "implementation") {
          const implContent = feature.implDoc || generateImplementationPlan(feature);
          
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "text/markdown",
              text: implContent
            }]
          };
        }
        
        // Return phase listing
        if (subResource === "phases") {
          if (feature.phases.length === 0) {
            return {
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: `No phases defined for feature: ${feature.name}`
              }]
            };
          }
          
          const phasesContent = feature.phases.map(phase => {
            const completedTasks = phase.tasks.filter(t => t.completed).length;
            const totalTasks = phase.tasks.length;
            return `Phase: ${phase.name} (ID: ${phase.id})
Status: ${phase.status}
Description: ${phase.description}
Progress: ${completedTasks}/${totalTasks} tasks completed
Last Updated: ${phase.updatedAt.toISOString()}
`;
          }).join('\n---\n\n');
          
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "text/plain",
              text: `# Phases for Feature: ${feature.name}\n\n${phasesContent}`
            }]
          };
        }
        
        // Handle list of all tasks for a feature
        if (subResource === "tasks") {
          const allTasks = feature.phases.flatMap(phase => 
            phase.tasks.map(task => ({
              ...task,
              phaseName: phase.name,
              phaseId: phase.id,
              phaseStatus: phase.status
            }))
          );
          
          if (allTasks.length === 0) {
            return {
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: `No tasks defined for feature: ${feature.name}`
              }]
            };
          }
          
          const pendingTasks = allTasks.filter(t => !t.completed);
          const completedTasks = allTasks.filter(t => t.completed);
          
          const pendingTasksText = pendingTasks.length > 0 
            ? pendingTasks.map(task => `- [ ] ${task.description} (ID: ${task.id}, Phase: ${task.phaseName})`).join('\n')
            : "No pending tasks.";
            
          const completedTasksText = completedTasks.length > 0
            ? completedTasks.map(task => `- [x] ${task.description} (ID: ${task.id}, Phase: ${task.phaseName})`).join('\n')
            : "No completed tasks.";
          
          const tasksContent = `# All Tasks for Feature: ${feature.name}

## Pending Tasks (${pendingTasks.length})
${pendingTasksText}

## Completed Tasks (${completedTasks.length})
${completedTasksText}
`;
          
          return {
            contents: [{
              uri: request.params.uri,
              mimeType: "text/plain",
              text: tasksContent
            }]
          };
        }
        
        // Handle phase-specific resources
        if (subResource === "phase" && parts.length >= 2) {
          const phaseId = parts[1];
          const phase = feature.phases.find(p => p.id === phaseId);
          
          if (!phase) {
            throw new Error(`Phase ${phaseId} not found in feature ${feature.name}`);
          }
          
          // Return phase details
          if (parts.length === 2) {
            const completedTasks = phase.tasks.filter(t => t.completed).length;
            const totalTasks = phase.tasks.length;
            
            const taskList = phase.tasks.map(task => 
              `- [${task.completed ? 'x' : ' '}] ${task.description} (ID: ${task.id})`
            ).join('\n');
            
            const phaseDetails = `
Phase: ${phase.name}
ID: ${phase.id}
Status: ${phase.status}
Description: ${phase.description}
Created: ${phase.createdAt.toISOString()}
Last Updated: ${phase.updatedAt.toISOString()}
Progress: ${completedTasks}/${totalTasks} tasks completed

Tasks:
${taskList}
`;
            
            return {
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: phaseDetails
              }]
            };
          }
          
          // Return task listing
          if (parts[2] === "tasks") {
            if (phase.tasks.length === 0) {
              return {
                contents: [{
                  uri: request.params.uri,
                  mimeType: "text/plain",
                  text: `No tasks defined for phase: ${phase.name}`
                }]
              };
            }
            
            const tasksContent = phase.tasks.map(task => `
Task: ${task.description}
ID: ${task.id}
Status: ${task.completed ? 'Completed' : 'Pending'}
Created: ${task.createdAt.toISOString()}
Last Updated: ${task.updatedAt.toISOString()}
`).join('\n---\n');
            
            return {
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: `# Tasks for Phase: ${phase.name}\n\n${tasksContent}`
              }]
            };
          }
          
          // Return individual task details
          if (parts[2] === "task" && parts.length === 4) {
            const taskId = parts[3];
            const task = phase.tasks.find(t => t.id === taskId);
            
            if (!task) {
              throw new Error(`Task ${taskId} not found in phase ${phase.name}`);
            }
            
            const taskDetails = `
Task: ${task.description}
ID: ${task.id}
Status: ${task.completed ? 'Completed' : 'Pending'}
Created: ${task.createdAt.toISOString()}
Last Updated: ${task.updatedAt.toISOString()}
`;
            
            return {
              contents: [{
                uri: request.params.uri,
                mimeType: "text/plain",
                text: taskDetails
              }]
            };
          }
        }
      }
    }
    
    throw new Error(`Resource not found: ${request.params.uri}`);
  } catch (error: any) {
    console.error(`Error reading resource ${request.params.uri}:`, error);
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "text/plain",
        text: `Error: ${error.message || 'Unknown error'}`
      }]
    };
  }
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
          required: ["featureName"],
          examples: [
            {
              featureName: "User Authentication",
              initialDescription: "Add login and registration functionality to the application"
            },
            {
              featureName: "Data Export",
              initialDescription: "Allow users to export their data in CSV and JSON formats"
            }
          ]
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
          required: ["featureId", "question", "answer"],
          examples: [
            {
              featureId: "feature-123",
              question: "What problem does this feature solve?",
              answer: "This feature solves the problem of users forgetting their passwords by providing a secure password reset flow."
            },
            {
              featureId: "feature-456",
              question: "Who are the target users?",
              answer: "The target users are administrators who need to manage user accounts and permissions."
            }
          ]
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
          required: ["featureId"],
          examples: [
            {
              featureId: "feature-123"
            }
          ]
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
          required: ['featureId', 'name', 'description'],
          examples: [
            {
              featureId: "feature-123",
              name: "Requirements Analysis",
              description: "Gather and analyze requirements for the feature"
            },
            {
              featureId: "feature-123",
              name: "Implementation",
              description: "Implement the core functionality of the feature"
            }
          ]
        },
        handler: async (params: {featureId: string, name: string, description: string}) => {
          const { featureId, name, description } = params;
          const feature = getFeature(featureId);
          
          if (!feature) {
            return {
              error: `Feature with ID ${featureId} not found`
            };
          }
          
          // Create the phase with validated inputs
          const phaseId = generateId();
          const phase = createPhase(feature.id, name, description);
          
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
          required: ['featureId', 'phaseId', 'status'],
          examples: [
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              status: "in_progress"
            },
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              status: "completed"
            }
          ]
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
          required: ['featureId', 'phaseId', 'description'],
          examples: [
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              description: "Create database migration scripts"
            },
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              description: "Implement user interface components"
            }
          ]
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
          required: ['featureId', 'phaseId', 'taskId', 'completed'],
          examples: [
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              taskId: "task-789",
              completed: true
            },
            {
              featureId: "feature-123",
              phaseId: "phase-456",
              taskId: "task-789",
              completed: false
            }
          ]
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
          
          // @ts-ignore - We know the task structure from our validation
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
          required: ['featureId'],
          examples: [
            {
              featureId: "feature-123"
            }
          ]
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
          // @ts-ignore - We know the phase structure from our Feature type
          const currentPhase = feature.phases.find(p => p.status === 'pending' || p.status === 'in_progress');
          
          if (!currentPhase) {
            // All phases are completed or reviewed
            return {
              content: [{
                type: "text",
                text: 'All phases are completed or reviewed. The feature implementation is done!'
              }]
            };
          }
          
          // Check task completion status
          // @ts-ignore - We know the task structure from our Phase type
          const completedTasks = currentPhase.tasks.filter(t => t.completed);
          // @ts-ignore - We know the task structure from our Phase type
          const pendingTasks = currentPhase.tasks.filter(t => !t.completed);
          
          // Determine next action based on phase and task status
          let message = '';
          
          if (currentPhase.status === 'pending') {
            message = `Phase "${currentPhase.name}" is pending. Start working on this phase by setting its status to "in_progress".`;
          } else if (currentPhase.status === 'in_progress') {
            if (pendingTasks.length > 0) {
              message = `${completedTasks.length}/${currentPhase.tasks.length} tasks are completed in phase "${currentPhase.name}". Continue working on pending tasks.`;
            } else if (currentPhase.tasks.length === 0) {
              message = `Phase "${currentPhase.name}" has no tasks defined. Add tasks or mark the phase as completed if appropriate.`;
            } else {
              // All tasks are completed
              message = `All tasks in phase "${currentPhase.name}" are completed. Consider marking this phase as completed.`;
            }
          }
          
          return {
            content: [{
              type: "text",
              text: message
            }]
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
  try {
    switch (request.params.name) {
      case "start_feature_clarification": {
        const featureName = String(request.params.arguments?.featureName || "");
        const initialDescription = String(request.params.arguments?.initialDescription || "");
        
        // Validate inputs
        const nameValidation = validateRequiredText(featureName, "Feature name", 2, 100);
        if (!nameValidation.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${nameValidation.message}`
            }]
          };
        }
        
        // Initial description is optional, but if provided, validate its length
        if (initialDescription && initialDescription.trim() !== "") {
          const descValidation = validateRequiredText(initialDescription, "Initial description", 1, 5000);
          if (!descValidation.valid) {
            return {
              content: [{
                type: "text", 
                text: `Error: ${descValidation.message}`
              }]
            };
          }
        }
        
        // Create a new feature
        const feature = createFeatureObject(nameValidation.data, initialDescription);
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
        const answer = String(request.params.arguments?.answer || "");
        let questionIndex = 0;
        
        try {
          // Try to parse the question index from the question parameter if provided
          const questionParam = String(request.params.arguments?.question || "");
          if (questionParam.startsWith("Question #")) {
            const indexStr = questionParam.replace("Question #", "").split(":")[0];
            questionIndex = parseInt(indexStr, 10) - 1;
          }
        } catch (e) {
          console.error("Error parsing question index:", e);
        }
        
        // Get the feature
        const feature = getFeature(featureId);
        if (!feature) {
          return {
            content: [{
              type: "text",
              text: `Error: Feature with ID ${featureId} not found`
            }]
          };
        }
        
        // If no index was provided, use the number of existing responses
        if (isNaN(questionIndex)) {
          questionIndex = feature.clarificationResponses.length;
        }
        
        // Make sure the index is valid
        if (questionIndex < 0 || questionIndex >= CLARIFICATION_QUESTIONS.length) {
          return {
            content: [{
              type: "text",
              text: `Error: Invalid question index ${questionIndex}. There are ${CLARIFICATION_QUESTIONS.length} questions available.`
            }]
          };
        }
        
        // Get the question text for this index
        const questionText = CLARIFICATION_QUESTIONS[questionIndex];
        
        // Validate the answer
        if (!answer || answer.trim() === "") {
          return {
            content: [{
              type: "text",
              text: "Error: Answer cannot be empty"
            }]
          };
        }
        
        // Store the answer for this question
        const newResponse = {
          question: questionText,
          answer: answer,
          timestamp: new Date()
        };
        
        // Create or update the clarificationResponses array
        let updatedResponses = [...(feature.clarificationResponses || [])];
        
        // Replace the response at the specified index, or add it if it doesn't exist
        if (questionIndex < updatedResponses.length) {
          updatedResponses[questionIndex] = newResponse;
        } else {
          updatedResponses.push(newResponse);
        }
        
        // Update the feature with the new responses
        updateFeature(featureId, {
          clarificationResponses: updatedResponses,
        });
        
        // Determine the next question index
        const nextIndex = questionIndex + 1;
        
        // Check if we have more questions
        if (nextIndex < CLARIFICATION_QUESTIONS.length) {
          const nextQuestion = CLARIFICATION_QUESTIONS[nextIndex];
          return {
            content: [{
              type: "text",
              text: `Response recorded. Question #${nextIndex + 1}: ${nextQuestion}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: "All clarification questions have been answered. You can now generate a PRD for this feature."
            }]
          };
        }
      }
      
      case "generate_prd": {
        const featureId = String(request.params.arguments?.featureId || "");
        
        // Validate feature ID
        const featureResult = validateFeatureId(featureId);
        if (!featureResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${featureResult.message}`
            }]
          };
        }
        
        const feature = featureResult.data;
        
        // Check if clarifications are complete
        if (!isClarificationComplete(feature)) {
          return {
            content: [{
              type: "text",
              text: "Error: Please complete all clarification questions before generating a PRD."
            }]
          };
        }
        
        // Generate PRD and implementation plan
        const prdDoc = generatePRD(feature);
        const implementationPlan = generateImplementationPlan(feature);
        
        // Store the documents
        feature.prdDoc = prdDoc;
        feature.implementationPlan = implementationPlan;
        
        return {
          content: [{
            type: "text",
            text: `PRD and Implementation Plan generated for feature ${feature.name}. You can view them using the resource URIs: feature://${feature.id}/prd and feature://${feature.id}/implementation`
          }]
        };
      }
      
      case "create_phase": {
        const featureId = String(request.params.arguments?.featureId || "");
        const phaseName = String(request.params.arguments?.name || "");
        const phaseDescription = String(request.params.arguments?.description || "");
        const tasksJson = String(request.params.arguments?.tasks || "[]");
        
        // Validate feature ID
        const featureResult = validateFeatureId(featureId);
        if (!featureResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${featureResult.message}`
            }]
          };
        }
        
        // Validate phase name
        const nameValidation = validateRequiredText(phaseName, "Phase name", 2, 100);
        if (!nameValidation.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${nameValidation.message}`
            }]
          };
        }
        
        // Validate phase description (optional but if provided, validate)
        if (phaseDescription && phaseDescription.trim() !== "") {
          const descValidation = validateRequiredText(phaseDescription, "Phase description", 5, 1000);
          if (!descValidation.valid) {
            return {
              content: [{
                type: "text",
                text: `Error: ${descValidation.message}`
              }]
            };
          }
        }
        
        // Parse and validate tasks
        let tasks = [];
        try {
          tasks = JSON.parse(tasksJson);
          if (!Array.isArray(tasks)) {
            return {
              content: [{
                type: "text",
                text: "Error: Tasks must be a valid JSON array of task descriptions"
              }]
            };
          }
          
          // Validate each task description
          for (let i = 0; i < tasks.length; i++) {
            const taskDesc = tasks[i];
            if (typeof taskDesc !== 'string' || taskDesc.trim().length < 3) {
              return {
                content: [{
                  type: "text",
                  text: `Error: Task at index ${i} must be a string with at least 3 characters`
                }]
              };
            }
          }
        } catch (e) {
          return {
            content: [{
              type: "text",
              text: "Error: Could not parse tasks JSON. Please provide a valid JSON array."
            }]
          };
        }
        
        const feature = featureResult.data;
        
        // Create the phase
        const phase = createPhase(featureId, nameValidation.data, phaseDescription);
        
        if (!phase) {
          return {
            content: [{
              type: "text",
              text: `Error: Failed to create phase for feature ${feature.name}`
            }]
          };
        }
        
        // Add tasks if provided
        if (tasks.length > 0) {
          tasks.forEach(taskDesc => {
            addTask(featureId, phase.id, taskDesc);
          });
        }
        
        return {
          content: [{
            type: "text",
            text: `Phase "${phaseName}" created with ID: ${phase.id}`
          }]
        };
      }
      
      case "update_phase_status": {
        const featureId = String(request.params.arguments?.featureId || "");
        const phaseId = String(request.params.arguments?.phaseId || "");
        const status = String(request.params.arguments?.status || "");
        
        // Validate feature and phase
        const validationResult = validateFeaturePhaseTask(featureId, phaseId);
        if (!validationResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${validationResult.message}`
            }]
          };
        }
        
        // Validate status
        const statusValidation = validatePhaseStatusValue(status);
        if (!statusValidation.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${statusValidation.message}`
            }]
          };
        }
        
        const { feature, phase } = validationResult.data;
        
        // Update the phase status
        const updatedPhase = updatePhaseStatus(featureId, phaseId, statusValidation.data);
        
        return {
          content: [{
            type: "text",
            text: `Phase status updated to "${status}"`
          }]
        };
      }
      
      case "add_task": {
        const featureId = String(request.params.arguments?.featureId || "");
        const phaseId = String(request.params.arguments?.phaseId || "");
        const taskDescription = String(request.params.arguments?.description || "");
        
        // Validate feature and phase
        const validationResult = validateFeaturePhaseTask(featureId, phaseId);
        if (!validationResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${validationResult.message}`
            }]
          };
        }
        
        // Validate task description
        const descValidation = validateRequiredText(taskDescription, "Task description", 3, 500);
        if (!descValidation.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${descValidation.message}`
            }]
          };
        }
        
        const { feature, phase } = validationResult.data;
        
        // Add the task
        const taskId = addTask(featureId, phaseId, descValidation.data);
        
        return {
          content: [{
            type: "text",
            text: `Task added to phase "${phase.name}" with ID: ${taskId}`
          }]
        };
      }
      
      case "update_task_status": {
        const featureId = String(request.params.arguments?.featureId || "");
        const phaseId = String(request.params.arguments?.phaseId || "");
        const taskId = String(request.params.arguments?.taskId || "");
        const completed = Boolean(request.params.arguments?.completed);
        
        // Validate feature, phase and task
        const validationResult = validateFeaturePhaseTask(featureId, phaseId, taskId);
        if (!validationResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${validationResult.message}`
            }]
          };
        }
        
        const { feature, phase, task } = validationResult.data;
        
        // Update the task status
        const updatedTask = updateTaskStatus(featureId, phaseId, taskId, completed);
        
        // Check if all tasks are completed and suggest phase update if applicable
        let message = `Task status updated to ${completed ? 'completed' : 'not completed'}`;
        
        // @ts-ignore - We know the task structure from our validation
        if (completed && phase.tasks.every(t => t.id === taskId || t.completed)) {
          // All tasks are now completed
          message += `. All tasks in phase ${phase.name} are now completed. Consider updating the phase status to 'completed'.`;
        }
        
        return {
          content: [{
            type: "text",
            text: message
          }]
        };
      }
      
      case "get_next_phase_action": {
        const featureId = String(request.params.arguments?.featureId || "");
        
        // Validate feature ID
        const featureResult = validateFeatureId(featureId);
        if (!featureResult.valid) {
          return {
            content: [{
              type: "text",
              text: `Error: ${featureResult.message}`
            }]
          };
        }
        
        const feature = featureResult.data;
        
        // Find the current active phase (first non-completed/reviewed phase)
        // @ts-ignore - We know the phase structure from our Feature type
        const currentPhase = feature.phases.find(p => p.status === 'pending' || p.status === 'in_progress');
        
        if (!currentPhase) {
          // All phases are completed or reviewed
          return {
            content: [{
              type: "text",
              text: 'All phases are completed or reviewed. The feature implementation is done!'
            }]
          };
        }
        
        // Check task completion status
        // @ts-ignore - We know the task structure from our Phase type
        const completedTasks = currentPhase.tasks.filter(t => t.completed);
        // @ts-ignore - We know the task structure from our Phase type
        const pendingTasks = currentPhase.tasks.filter(t => !t.completed);
        
        // Determine next action based on phase and task status
        let message = '';
        
        if (currentPhase.status === 'pending') {
          message = `Phase "${currentPhase.name}" is pending. Start working on this phase by setting its status to "in_progress".`;
        } else if (currentPhase.status === 'in_progress') {
          if (pendingTasks.length > 0) {
            message = `${completedTasks.length}/${currentPhase.tasks.length} tasks are completed in phase "${currentPhase.name}". Continue working on pending tasks.`;
          } else if (currentPhase.tasks.length === 0) {
            message = `Phase "${currentPhase.name}" has no tasks defined. Add tasks or mark the phase as completed if appropriate.`;
          } else {
            // All tasks are completed
            message = `All tasks in phase "${currentPhase.name}" are completed. Consider marking this phase as completed.`;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: message
          }]
        };
      }
      
      default:
        return {
          content: [{
            type: "text",
            text: `Error: Unknown tool "${request.params.name}"`
          }]
        };
    }
  } catch (error: any) {
    console.error('Error executing tool:', error);
    return {
      content: [{
        type: "text",
        text: `An unexpected error occurred: ${error.message || 'Unknown error'}`
      }]
    };
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
