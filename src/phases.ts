/**
 * Phase management module for the Vibe-Coder MCP Server.
 * This module handles the creation and management of development phases and tasks.
 */
import { Feature, Phase, Task, PhaseStatus } from './types.js';
import { updateFeature, getFeature } from './storage.js';
import { generateId, createPhaseObject, createTaskObject, isValidPhaseStatus, now } from './utils.js';

/**
 * Define valid phase status transitions
 * A map of current status to valid next statuses
 */
const VALID_PHASE_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  'pending': ['in_progress'],
  'in_progress': ['completed'],
  'completed': ['reviewed'],
  'reviewed': []
};

/**
 * Create a new phase for a feature
 * @param featureId The ID of the feature to create the phase for
 * @param name The name of the phase
 * @param description The description of the phase
 * @returns The created phase or undefined if the feature is not found
 */
export function createPhase(
  featureId: string,
  name: string,
  description: string
): Phase | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  const newPhase = createPhaseObject(name, description);
  
  updateFeature(featureId, {
    phases: [...feature.phases, newPhase]
  });
  
  return newPhase;
}

/**
 * Get a phase by ID
 * @param featureId The ID of the feature
 * @param phaseId The ID of the phase to get
 * @returns The phase or undefined if not found
 */
export function getPhase(
  featureId: string,
  phaseId: string
): Phase | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  return feature.phases.find(p => p.id === phaseId);
}

/**
 * Add a new phase to a feature
 * @param featureId The ID of the feature to add the phase to
 * @param name The name of the phase
 * @param description The description of the phase
 * @returns The updated feature or undefined if not found
 */
export function addPhase(
  featureId: string,
  name: string,
  description: string
): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  const newPhase = createPhaseObject(name, description);
  
  return updateFeature(featureId, {
    phases: [...feature.phases, newPhase]
  });
}

/**
 * Add a task to a phase
 * @param featureId The ID of the feature
 * @param phaseId The ID of the phase to add the task to
 * @param description The description of the task
 * @returns The updated feature or undefined if not found
 */
export function addTask(
  featureId: string,
  phaseId: string,
  description: string
): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  const newTask = createTaskObject(description);
  
  const updatedPhases = [...feature.phases];
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    tasks: [...updatedPhases[phaseIndex].tasks, newTask],
    updatedAt: now()
  };
  
  return updateFeature(featureId, { phases: updatedPhases });
}

/**
 * Update the status of a phase
 * @param featureId The ID of the feature
 * @param phaseId The ID of the phase to update
 * @param status The new status
 * @returns The updated feature or undefined if not found
 */
export function updatePhaseStatus(
  featureId: string,
  phaseId: string,
  status: PhaseStatus
): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  // Validate the status transition
  const phase = feature.phases[phaseIndex];
  const validationResult = validatePhaseTransition(phase.status, status);
  if (!validationResult.valid) {
    console.error(validationResult.message);
    return undefined;
  }
  
  const updatedPhases = [...feature.phases];
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    status,
    updatedAt: now()
  };
  
  return updateFeature(featureId, { phases: updatedPhases });
}

/**
 * Update a task's completion status
 * @param featureId The ID of the feature
 * @param phaseId The ID of the phase
 * @param taskId The ID of the task to update
 * @param completed Whether the task is completed
 * @returns The updated feature or undefined if not found
 */
export function updateTaskStatus(
  featureId: string,
  phaseId: string,
  taskId: string,
  completed: boolean
): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  const taskIndex = feature.phases[phaseIndex].tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return undefined;
  
  const updatedPhases = [...feature.phases];
  const updatedTasks = [...updatedPhases[phaseIndex].tasks];
  
  updatedTasks[taskIndex] = {
    ...updatedTasks[taskIndex],
    completed,
    updatedAt: now()
  };
  
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    tasks: updatedTasks,
    updatedAt: now()
  };
  
  return updateFeature(featureId, { phases: updatedPhases });
}

/**
 * Validate a phase status transition
 * @param currentStatus The current status
 * @param newStatus The proposed new status
 * @returns An object with valid flag and message
 */
export function validatePhaseTransition(
  currentStatus: PhaseStatus,
  newStatus: PhaseStatus
): { valid: boolean; message: string } {
  // Allow same status
  if (currentStatus === newStatus) {
    return { valid: true, message: "Status unchanged" };
  }
  
  // Check if the status is valid
  if (!isValidPhaseStatus(newStatus)) {
    return { 
      valid: false, 
      message: `Invalid status: ${newStatus}. Valid statuses are: pending, in_progress, completed, reviewed`
    };
  }
  
  // Check if the transition is valid
  const validNextStatuses = VALID_PHASE_TRANSITIONS[currentStatus];
  if (!validNextStatuses.includes(newStatus)) {
    return {
      valid: false,
      message: `Invalid transition from ${currentStatus} to ${newStatus}. Valid next statuses are: ${validNextStatuses.join(', ')}`
    };
  }
  
  return { valid: true, message: "Valid transition" };
}

/**
 * Get the next logical status for a phase
 * @param currentStatus The current status
 * @returns The recommended next status, or null if no valid transition
 */
export function getNextPhaseStatus(currentStatus: PhaseStatus): PhaseStatus | null {
  const validNextStatuses = VALID_PHASE_TRANSITIONS[currentStatus];
  
  if (validNextStatuses.length === 0) {
    return null;
  }
  
  return validNextStatuses[0];
}

/**
 * Get a summary of the phases for a feature
 * @param featureId The ID of the feature
 * @returns A text summary of the phases
 */
export function getPhaseSummary(featureId: string): string {
  const feature = getFeature(featureId);
  if (!feature) return "Feature not found";
  
  if (feature.phases.length === 0) {
    return "No phases defined for this feature yet.";
  }
  
  const phasesSummary = feature.phases.map(phase => {
    const completedTasks = phase.tasks.filter(t => t.completed).length;
    const totalTasks = phase.tasks.length;
    return `${phase.name} (${phase.status}): ${completedTasks}/${totalTasks} tasks completed`;
  }).join('\n');
  
  return `Phases for ${feature.name}:\n${phasesSummary}`;
}

/**
 * Initialize default phases for a feature based on its implementation plan
 * @param featureId The ID of the feature
 * @returns The updated feature or undefined if not found
 */
export function initializeDefaultPhases(featureId: string): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  // If the feature already has phases, don't override them
  if (feature.phases && feature.phases.length > 0) {
    return feature;
  }
  
  // Create default phases
  const defaultPhases = [
    createPhaseObject(
      "Requirements Analysis and Design",
      "Analyze requirements, design the architecture, and create a detailed implementation plan."
    ),
    createPhaseObject(
      "Core Implementation",
      "Implement the core functionality based on the design."
    ),
    createPhaseObject(
      "Testing and Integration",
      "Test all components, integrate with existing systems, and refine the implementation."
    ),
    createPhaseObject(
      "Documentation and Finalization",
      "Finalize documentation, clean up code, and prepare for deployment."
    )
  ];
  
  // Add default tasks for each phase
  const phase1 = defaultPhases[0];
  addTask(featureId, phase1.id, "Review and analyze clarification responses");
  addTask(featureId, phase1.id, "Identify key components and their interactions");
  addTask(featureId, phase1.id, "Design the system architecture");
  addTask(featureId, phase1.id, "Create UML diagrams if necessary");
  addTask(featureId, phase1.id, "Identify potential edge cases and risks");
  
  const phase2 = defaultPhases[1];
  addTask(featureId, phase2.id, "Set up project structure and dependencies");
  addTask(featureId, phase2.id, "Implement data models and interfaces");
  addTask(featureId, phase2.id, "Build core business logic");
  addTask(featureId, phase2.id, "Create unit tests for core functionality");
  addTask(featureId, phase2.id, "Ensure code follows best practices");
  
  const phase3 = defaultPhases[2];
  addTask(featureId, phase3.id, "Write unit tests for all components");
  addTask(featureId, phase3.id, "Perform integration testing");
  addTask(featureId, phase3.id, "Fix bugs and edge cases");
  addTask(featureId, phase3.id, "Optimize performance");
  addTask(featureId, phase3.id, "Document any known limitations");
  
  const phase4 = defaultPhases[3];
  addTask(featureId, phase4.id, "Complete inline code documentation");
  addTask(featureId, phase4.id, "Create user documentation");
  addTask(featureId, phase4.id, "Clean up and refactor code");
  addTask(featureId, phase4.id, "Prepare deployment strategy");
  addTask(featureId, phase4.id, "Create final pull request");
  
  return updateFeature(featureId, { phases: defaultPhases });
} 