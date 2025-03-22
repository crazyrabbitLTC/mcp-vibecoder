/**
 * @file tool-handlers.ts
 * @version 1.0.0
 * 
 * Provides handlers for the MCP tools exposed by the Vibe-Coder MCP Server.
 * These handlers are registered with the tool registry for consistent handling.
 */

import { z } from 'zod';
import { ToolHandler, toolRegistry } from './registry.js';
import { getFeature, updateFeature } from './storage.js';
import { 
  getNextClarificationQuestion,
  isClarificationComplete, 
  getClarificationStatus 
} from './clarification.js';
import { 
  generatePRD, 
  generateImplementationPlan 
} from './documentation.js';
import {
  createPhase,
  updatePhaseStatus,
  addTask,
  updateTaskStatus
} from './phases.js';
import {
  createFeatureObject
} from './utils.js';
import {
  validateFeatureId,
  validatePhaseId,
  validateTaskId,
  validateFeaturePhaseTask,
  validateRequiredText,
  validatePhaseStatusValue
} from './validators.js';
import { 
  createToolErrorResponse, 
  featureNotFoundError, 
  phaseNotFoundError, 
  taskNotFoundError, 
  invalidPhaseTransitionError, 
  clarificationIncompleteError 
} from './errors.js';

// Schema for start_feature_clarification
const StartFeatureClarificationSchema = z.object({
  featureName: z.string().min(2).max(100),
  initialDescription: z.string().optional().default("")
});

/**
 * Start feature clarification handler
 */
const startFeatureClarificationHandler: ToolHandler<z.infer<typeof StartFeatureClarificationSchema>> = async (params) => {
  try {
    const { featureName, initialDescription } = StartFeatureClarificationSchema.parse(params);
    
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for provide_clarification
const ProvideClarificationSchema = z.object({
  featureId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1)
});

/**
 * Provide clarification handler
 */
const provideClarificationHandler: ToolHandler<z.infer<typeof ProvideClarificationSchema>> = async (params) => {
  try {
    const { featureId, question, answer } = ProvideClarificationSchema.parse(params);
    
    console.log(`\n[CLARIFICATION] Received request for feature ${featureId}\n  Question: "${question.substring(0, 50)}..."\n  Answer: "${answer.substring(0, 50)}..."`);
    
    // Get the feature
    const feature = getFeature(featureId);
    if (!feature) {
      console.log(`[CLARIFICATION] Feature ID ${featureId} not found`);
      return featureNotFoundError(featureId);
    }
    
    console.log(`[CLARIFICATION] Found feature: ${feature.name} with ${feature.clarificationResponses.length} existing responses`);
    
    // Add the clarification response to the feature
    feature.clarificationResponses.push({
      question,
      answer,
      timestamp: new Date()
    });
    
    console.log(`[CLARIFICATION] Added response, now has ${feature.clarificationResponses.length} responses`);
    
    // Save the feature with the updated clarification response
    updateFeature(featureId, feature);
    
    // Get the next question or indicate all questions are answered
    const nextQuestion = getNextClarificationQuestion(feature);
    
    if (nextQuestion) {
      console.log(`[CLARIFICATION] Returning next question: "${nextQuestion.substring(0, 50)}..."`);
      return {
        content: [{
          type: "text",
          text: `Response recorded. ${nextQuestion}`
        }]
      };
    } else {
      // All questions answered
      console.log(`[CLARIFICATION] All questions answered`);
      return {
        content: [{
          type: "text",
          text: "All clarification questions have been answered. You can now generate a PRD for this feature."
        }]
      };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for generate_prd
const GeneratePrdSchema = z.object({
  featureId: z.string().min(1)
});

/**
 * Generate PRD handler
 */
const generatePrdHandler: ToolHandler<z.infer<typeof GeneratePrdSchema>> = async (params) => {
  try {
    const { featureId } = GeneratePrdSchema.parse(params);
    
    // Validate feature ID
    const featureResult = validateFeatureId(featureId);
    if (!featureResult.valid) {
      return createToolErrorResponse(featureResult.message);
    }
    
    const feature = featureResult.data;
    
    // Check if clarifications are complete
    if (!isClarificationComplete(feature)) {
      return clarificationIncompleteError(getClarificationStatus(feature));
    }
    
    // Generate PRD
    const prdDoc = generatePRD(feature);
    
    // Store the document
    feature.prdDoc = prdDoc;
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `PRD generated for feature ${feature.name}. You can view it using the resource URI: feature://${feature.id}/prd`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for generate_implementation_plan
const GenerateImplementationPlanSchema = z.object({
  featureId: z.string().min(1)
});

/**
 * Generate implementation plan handler
 */
const generateImplementationPlanHandler: ToolHandler<z.infer<typeof GenerateImplementationPlanSchema>> = async (params) => {
  try {
    const { featureId } = GenerateImplementationPlanSchema.parse(params);
    
    // Validate feature ID
    const featureResult = validateFeatureId(featureId);
    if (!featureResult.valid) {
      return createToolErrorResponse(featureResult.message);
    }
    
    const feature = featureResult.data;
    
    // Check if clarifications are complete
    if (!isClarificationComplete(feature)) {
      return clarificationIncompleteError(getClarificationStatus(feature));
    }
    
    // Generate the implementation plan
    const implDoc = generateImplementationPlan(feature);
    
    // Store the document
    feature.implDoc = implDoc;
    updateFeature(featureId, feature);
    
    return {
      content: [{
        type: "text",
        text: `Implementation plan generated for feature ${feature.name}. You can view it using the resource URI: feature://${feature.id}/implementation`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for create_phase
const CreatePhaseSchema = z.object({
  featureId: z.string().min(1),
  name: z.string().min(2).max(100),
  description: z.string().min(1)
});

/**
 * Create phase handler
 */
const createPhaseHandler: ToolHandler<z.infer<typeof CreatePhaseSchema>> = async (params) => {
  try {
    const { featureId, name, description } = CreatePhaseSchema.parse(params);
    
    // Validate feature ID
    const featureResult = validateFeatureId(featureId);
    if (!featureResult.valid) {
      return createToolErrorResponse(featureResult.message);
    }
    
    const feature = featureResult.data;
    
    // Create the phase
    const phase = createPhase(featureId, name, description);
    
    if (!phase) {
      return createToolErrorResponse(`Failed to create phase for feature ${feature.name}`);
    }
    
    return {
      content: [{
        type: "text",
        text: `Phase "${name}" created with ID: ${phase.id}`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for update_phase_status
const UpdatePhaseStatusSchema = z.object({
  featureId: z.string().min(1),
  phaseId: z.string().min(1),
  status: z.enum(["pending", "in_progress", "completed", "reviewed"])
});

/**
 * Update phase status handler
 */
const updatePhaseStatusHandler: ToolHandler<z.infer<typeof UpdatePhaseStatusSchema>> = async (params) => {
  try {
    const { featureId, phaseId, status } = UpdatePhaseStatusSchema.parse(params);
    
    // Validate feature and phase
    const validationResult = validateFeaturePhaseTask(featureId, phaseId);
    if (!validationResult.valid) {
      return createToolErrorResponse(validationResult.message);
    }
    
    const { feature, phase } = validationResult.data;
    
    // Validate the status transition
    const transitionResult = phase.status !== status; 
    if (!transitionResult) {
      return invalidPhaseTransitionError(phase.status, status);
    }
    
    // Update the phase status
    const updatedPhase = updatePhaseStatus(featureId, phaseId, status);
    
    return {
      content: [{
        type: "text",
        text: `Phase status updated to "${status}"`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for add_task
const AddTaskSchema = z.object({
  featureId: z.string().min(1),
  phaseId: z.string().min(1),
  description: z.string().min(3).max(500)
});

/**
 * Add task handler
 */
const addTaskHandler: ToolHandler<z.infer<typeof AddTaskSchema>> = async (params) => {
  try {
    const { featureId, phaseId, description } = AddTaskSchema.parse(params);
    
    // Validate feature and phase
    const validationResult = validateFeaturePhaseTask(featureId, phaseId);
    if (!validationResult.valid) {
      return createToolErrorResponse(validationResult.message);
    }
    
    const { feature, phase } = validationResult.data;
    
    // Add the task
    const taskId = addTask(featureId, phaseId, description);
    
    return {
      content: [{
        type: "text",
        text: `Task added to phase "${phase.name}" with ID: ${taskId}`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for update_task_status
const UpdateTaskStatusSchema = z.object({
  featureId: z.string().min(1),
  phaseId: z.string().min(1),
  taskId: z.string().min(1),
  completed: z.boolean()
});

/**
 * Update task status handler
 */
const updateTaskStatusHandler: ToolHandler<z.infer<typeof UpdateTaskStatusSchema>> = async (params) => {
  try {
    const { featureId, phaseId, taskId, completed } = UpdateTaskStatusSchema.parse(params);
    
    // Validate feature, phase and task
    const validationResult = validateFeaturePhaseTask(featureId, phaseId, taskId);
    if (!validationResult.valid) {
      return createToolErrorResponse(validationResult.message);
    }
    
    const { feature, phase, task } = validationResult.data;
    
    // Update the task status
    const updatedTask = updateTaskStatus(featureId, phaseId, taskId, completed);
    
    // Check if all tasks are completed and suggest phase update if applicable
    let message = `Task status updated to ${completed ? 'completed' : 'not completed'}`;
    
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

// Schema for get_next_phase_action
const GetNextPhaseActionSchema = z.object({
  featureId: z.string().min(1)
});

/**
 * Get next phase action handler
 */
const getNextPhaseActionHandler: ToolHandler<z.infer<typeof GetNextPhaseActionSchema>> = async (params) => {
  try {
    const { featureId } = GetNextPhaseActionSchema.parse(params);
    
    // Validate feature ID
    const featureResult = validateFeatureId(featureId);
    if (!featureResult.valid) {
      return createToolErrorResponse(featureResult.message);
    }
    
    const feature = featureResult.data;
    
    // Find the current active phase (first non-completed/reviewed phase)
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
    const completedTasks = currentPhase.tasks.filter(t => t.completed);
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createToolErrorResponse(`Validation error: ${errorMessage}`);
    }
    return createToolErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
};

/**
 * Register all tool handlers with the tool registry
 */
export function registerToolHandlers() {
  toolRegistry.register(
    'start_feature_clarification', 
    startFeatureClarificationHandler,
    'Start the clarification process for a new feature',
    {
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
    },
    [
      {
        featureName: "User Authentication",
        initialDescription: "Add login and registration functionality to the application"
      },
      {
        featureName: "Data Export",
        initialDescription: "Allow users to export their data in CSV and JSON formats"
      }
    ]
  );

  toolRegistry.register(
    'provide_clarification', 
    provideClarificationHandler,
    'Provide answer to a clarification question',
    {
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
    },
    [
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
  );

  toolRegistry.register(
    'generate_prd', 
    generatePrdHandler,
    'Generate a PRD document based on clarification responses',
    {
      type: "object",
      properties: {
        featureId: {
          type: "string",
          description: "ID of the feature"
        }
      },
      required: ["featureId"]
    },
    [
      { featureId: "feature-123" }
    ]
  );

  toolRegistry.register(
    'generate_implementation_plan', 
    generateImplementationPlanHandler,
    'Generate an implementation plan for a feature based on clarifications and PRD',
    {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'The ID of the feature to generate an implementation plan for'
        }
      },
      required: ['featureId']
    }
  );

  toolRegistry.register(
    'create_phase', 
    createPhaseHandler,
    'Create a new development phase for a feature',
    {
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
    [
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
  );

  toolRegistry.register(
    'update_phase_status', 
    updatePhaseStatusHandler,
    'Update the status of a development phase',
    {
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
    [
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
  );

  toolRegistry.register(
    'add_task', 
    addTaskHandler,
    'Add a task to a development phase',
    {
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
    [
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
  );

  toolRegistry.register(
    'update_task_status', 
    updateTaskStatusHandler,
    'Update the completion status of a task',
    {
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
    [
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
  );

  toolRegistry.register(
    'get_next_phase_action', 
    getNextPhaseActionHandler,
    'Get guidance on what to do next in the current phase or whether to move to the next phase',
    {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'ID of the feature'
        }
      },
      required: ['featureId']
    },
    [
      { featureId: "feature-123" }
    ]
  );
}

// Export all handlers for testing or direct usage
export {
  startFeatureClarificationHandler,
  provideClarificationHandler,
  generatePrdHandler,
  generateImplementationPlanHandler,
  createPhaseHandler,
  updatePhaseStatusHandler,
  addTaskHandler,
  updateTaskStatusHandler,
  getNextPhaseActionHandler
}; 