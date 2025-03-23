#!/usr/bin/env node

/**
 * @file Vibe-Coder MCP Server
 * @version 0.3.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2023-03-23
 * 
 * This MCP server implements a structured development workflow that helps
 * LLM-based coders build features in an organized, clean, and safe manner.
 * 
 * IMPORTANT:
 * - Test any modifications thoroughly
 * - Maintain backward compatibility
 * 
 * Functionality:
 * - Feature request clarification through iterative questioning
 * - PRD and implementation plan generation
 * - Phased development with tasks and status tracking
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import core modules
import { Feature, Phase, Task, ClarificationResponse, PhaseStatus } from './types.js';
import { getFeature, updateFeature, listFeatures } from './storage.js';
import { 
  getNextClarificationQuestion, 
  addClarificationResponse,
  formatClarificationResponses,
  isClarificationComplete
} from './clarification.js';
import { generatePRD, generateImplementationPlan } from './documentation.js';
import { createFeatureObject, generateFeatureProgressSummary, createPhaseObject, createTaskObject, now } from './utils.js';

/**
 * Create an MCP server
 */
const server = new McpServer({
  name: "Vibe-Coder",
  version: "0.3.0"
});

// --------- Helper Functions ---------

/**
 * Create a new phase for a feature directly
 */
function createPhaseDirectly(feature: Feature, name: string, description: string): Phase {
  const newPhase = createPhaseObject(name, description);
  feature.phases.push(newPhase);
  feature.updatedAt = new Date();
  return newPhase;
}

/**
 * Update phase status directly
 */
function updatePhaseStatusDirectly(feature: Feature, phaseId: string, status: PhaseStatus): void {
  const phase = feature.phases.find(p => p.id === phaseId);
  if (!phase) {
    throw new Error(`Phase ${phaseId} not found`);
  }
  
  phase.status = status;
  phase.updatedAt = now();
  feature.updatedAt = now();
}

/**
 * Add task directly
 */
function addTaskDirectly(feature: Feature, phaseId: string, description: string): Task {
  const phase = feature.phases.find(p => p.id === phaseId);
  if (!phase) {
    throw new Error(`Phase ${phaseId} not found`);
  }
  
  const newTask = createTaskObject(description);
  phase.tasks.push(newTask);
  phase.updatedAt = now();
  feature.updatedAt = now();
  return newTask;
}

/**
 * Update task status directly
 */
function updateTaskStatusDirectly(feature: Feature, phaseId: string, taskId: string, completed: boolean): void {
  const phase = feature.phases.find(p => p.id === phaseId);
  if (!phase) {
    throw new Error(`Phase ${phaseId} not found`);
  }
  
  const task = phase.tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  task.completed = completed;
  task.updatedAt = now();
  phase.updatedAt = now();
  feature.updatedAt = now();
}

// --------- Register Resources ---------

// Features list resource
server.resource(
  "features-list",
  "features://list",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: listFeatures().map(f => `${f.id}: ${f.name}`).join("\n")
    }]
  })
);

// Features status resource
server.resource(
  "features-status",
  "features://status",
  async (uri) => {
    const features = listFeatures();
    
    if (features.length === 0) {
      return {
        contents: [{
          uri: uri.href,
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
        uri: uri.href,
        text: `# Project Status\n\n${featuresStatus}`
      }]
    };
  }
);

// Feature detail resource with parameter
server.resource(
  "feature-detail",
  new ResourceTemplate("feature://{featureId}", { list: undefined }),
  async (uri, { featureId }) => {
    const feature = getFeature(featureId as string);
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
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
        uri: uri.href,
        text: featureDetails
      }]
    };
  }
);

// Feature progress resource
server.resource(
  "feature-progress",
  new ResourceTemplate("feature://{featureId}/progress", { list: undefined }),
  async (uri, { featureId }) => {
    const feature = getFeature(featureId as string);
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const progressReport = generateFeatureProgressSummary(feature);
    
    return {
      contents: [{
        uri: uri.href,
        text: progressReport
      }]
    };
  }
);

// Feature PRD resource
server.resource(
  "feature-prd",
  new ResourceTemplate("feature://{featureId}/prd", { list: undefined }),
  async (uri, { featureId }) => {
    const feature = getFeature(featureId as string);
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    if (!isClarificationComplete(feature)) {
      return {
        contents: [{
          uri: uri.href,
          text: "# PRD Not Available\n\nThe clarification process is not complete. Please answer all clarification questions first."
        }]
      };
    }
    
    const prd = generatePRD(feature);
    
    return {
      contents: [{
        uri: uri.href,
        text: prd
      }]
    };
  }
);

// Feature implementation plan resource
server.resource(
  "feature-implementation-plan",
  new ResourceTemplate("feature://{featureId}/implementation", { list: undefined }),
  async (uri, { featureId }) => {
    const feature = getFeature(featureId as string);
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    if (!isClarificationComplete(feature)) {
      return {
        contents: [{
          uri: uri.href,
          text: "# Implementation Plan Not Available\n\nThe clarification process is not complete. Please answer all clarification questions first."
        }]
      };
    }
    
    const implementationPlan = generateImplementationPlan(feature);
    
    return {
      contents: [{
        uri: uri.href,
        text: implementationPlan
      }]
    };
  }
);

// --------- Register Tools ---------

// Start feature clarification tool
server.tool(
  "start_feature_clarification",
  { 
    featureName: z.string().min(2).max(100),
    initialDescription: z.string().optional().default("")
  },
  async ({ featureName, initialDescription }) => {
    // Create a new feature
    const feature = createFeatureObject(featureName, initialDescription);
    updateFeature(feature.id, feature);
    
    // Get the first clarification question
    const firstQuestion = getNextClarificationQuestion(feature);
    
    return {
      content: [{
        type: "text",
        text: `Feature ID: ${feature.id}\n\nLet's clarify your feature request. ${firstQuestion}`
      }]
    };
  }
);

// Provide clarification tool
server.tool(
  "provide_clarification",
  {
    featureId: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1)
  },
  async ({ featureId, question, answer }) => {
    // Get the feature
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    // Add the clarification response to the feature
    feature.clarificationResponses.push({
      question,
      answer,
      timestamp: new Date()
    });
    
    // Save the feature with the updated clarification response
    updateFeature(featureId, feature);
    
    // Get the next question or indicate all questions are answered
    const nextQuestion = getNextClarificationQuestion(feature);
    
    if (nextQuestion) {
      return {
        content: [{
          type: "text",
          text: `Response recorded. ${nextQuestion}`
        }]
      };
    } else {
      // All questions answered
      return {
        content: [{
          type: "text",
          text: "All clarification questions have been answered. You can now generate a PRD for this feature."
        }]
      };
    }
  }
);

// Generate PRD tool
server.tool(
  "generate_prd",
  {
    featureId: z.string().min(1)
  },
  async ({ featureId }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    if (!isClarificationComplete(feature)) {
      throw new Error("Clarification process not complete. Please answer all clarification questions.");
    }
    
    const prd = generatePRD(feature);
    feature.prd = prd;
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `PRD generated successfully for "${feature.name}". You can view it at feature://${featureId}/prd`
      }]
    };
  }
);

// Create phase tool
server.tool(
  "create_phase",
  {
    featureId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1)
  },
  async ({ featureId, name, description }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const phase = createPhaseDirectly(feature, name, description);
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `Created phase "${name}" with ID ${phase.id} for feature "${feature.name}"`
      }]
    };
  }
);

// Update phase status tool
server.tool(
  "update_phase_status",
  {
    featureId: z.string().min(1),
    phaseId: z.string().min(1),
    status: z.enum(["pending", "in_progress", "completed", "reviewed"])
  },
  async ({ featureId, phaseId, status }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const phase = feature.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found in feature ${featureId}`);
    }
    
    const oldStatus = phase.status;
    updatePhaseStatusDirectly(feature, phaseId, status);
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `Updated phase "${phase.name}" status from "${oldStatus}" to "${status}"`
      }]
    };
  }
);

// Add task tool
server.tool(
  "add_task",
  {
    featureId: z.string().min(1),
    phaseId: z.string().min(1),
    description: z.string().min(1)
  },
  async ({ featureId, phaseId, description }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const phase = feature.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found in feature ${featureId}`);
    }
    
    const task = addTaskDirectly(feature, phaseId, description);
    updateFeature(featureId, feature);
    
    // Debug log
    console.error(`DEBUG: Task created with ID: ${task.id}, type: ${typeof task.id}`);
    console.error(`DEBUG: Task object: ${JSON.stringify(task)}`);
    
    // Ensure task.id is explicitly converted to string
    const taskId = String(task.id);
    
    return {
      content: [{
        type: "text",
        text: `Added task "${description.substring(0, 30)}${description.length > 30 ? '...' : ''}" with ID: ${taskId} to phase "${phase.name}"`
      }]
    };
  }
);

// Update task status tool
server.tool(
  "update_task_status",
  {
    featureId: z.string().min(1),
    phaseId: z.string().min(1),
    taskId: z.string().min(1),
    completed: z.boolean()
  },
  async ({ featureId, phaseId, taskId, completed }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    const phase = feature.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found in feature ${featureId}`);
    }
    
    const task = phase.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in phase ${phaseId}`);
    }
    
    updateTaskStatusDirectly(feature, phaseId, taskId, completed);
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `Updated task "${task.description.substring(0, 30)}${task.description.length > 30 ? '...' : ''}" status to ${completed ? 'completed' : 'not completed'}`
      }]
    };
  }
);

// Get next phase action tool
server.tool(
  "get_next_phase_action",
  {
    featureId: z.string().min(1)
  },
  async ({ featureId }) => {
    const feature = getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    // Check if we need implementation plan first
    if (!feature.implementationPlan) {
      return {
        content: [{
          type: "text",
          text: "You should generate an implementation plan before creating phases."
        }]
      };
    }
    
    // If no phases, suggest creating first phase
    if (feature.phases.length === 0) {
      return {
        content: [{
          type: "text",
          text: "You should create the first development phase based on the implementation plan."
        }]
      };
    }
    
    // Find the current active phase (the first non-completed phase)
    const currentPhase = feature.phases.find(p => p.status !== 'completed' && p.status !== 'reviewed');
    
    if (!currentPhase) {
      return {
        content: [{
          type: "text",
          text: "All phases are complete. You should mark the final phase as reviewed."
        }]
      };
    }
    
    // Check if all tasks in the phase are completed
    const allTasksCompleted = currentPhase.tasks.every(t => t.completed);
    
    if (currentPhase.tasks.length === 0) {
      return {
        content: [{
          type: "text",
          text: `Current phase "${currentPhase.name}" has no tasks. You should add tasks based on the implementation plan.`
        }]
      };
    } else if (!allTasksCompleted) {
      const pendingTasks = currentPhase.tasks.filter(t => !t.completed);
      
      return {
        content: [{
          type: "text",
          text: `Current phase "${currentPhase.name}" has ${pendingTasks.length} incomplete tasks. Complete these tasks before moving to the next phase.`
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `All tasks in the current phase "${currentPhase.name}" are complete. You can now mark this phase as completed and proceed to the next phase.`
        }]
      };
    }
  }
);

// Define prompt for feature planning
server.prompt(
  "feature-planning",
  { 
    featureId: z.string() 
  },
  ({ featureId }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `I need to plan the development of feature with ID ${featureId}. Please help me:
1. Understand what the feature is about
2. Break down the feature into development phases 
3. Create tasks for each phase
4. Track progress through completion`
      }
    }]
  })
);

// Start the server
async function main() {
  console.error("Starting Vibe-Coder MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error("Error in Vibe-Coder MCP Server:", error);
  process.exit(1);
}); 