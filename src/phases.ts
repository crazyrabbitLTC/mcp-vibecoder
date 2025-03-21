/**
 * Phase management module for the Vibe-Coder MCP Server.
 * This module handles the creation and management of development phases and tasks.
 */
import { Feature, Phase, Task, PhaseStatus } from './types.js';
import { updateFeature } from './storage.js';
import { generateId, createPhaseObject, createTaskObject, isValidPhaseStatus } from './utils.js';

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
  // This will be fully implemented in Step 4
  
  const newPhase = createPhaseObject(name, description);
  
  return updateFeature(featureId, {
    phases: [
      ...updateFeature(featureId, {})?.phases || [],
      newPhase
    ]
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
  // This will be fully implemented in Step 4
  
  const feature = updateFeature(featureId, {});
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  const newTask = createTaskObject(description);
  
  const updatedPhases = [...feature.phases];
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    tasks: [...updatedPhases[phaseIndex].tasks, newTask]
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
  // This will be fully implemented in Step 4
  
  const feature = updateFeature(featureId, {});
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  const updatedPhases = [...feature.phases];
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    status
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
  // This will be fully implemented in Step 4
  
  const feature = updateFeature(featureId, {});
  if (!feature) return undefined;
  
  const phaseIndex = feature.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) return undefined;
  
  const taskIndex = feature.phases[phaseIndex].tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return undefined;
  
  const updatedPhases = [...feature.phases];
  const updatedTasks = [...updatedPhases[phaseIndex].tasks];
  
  updatedTasks[taskIndex] = {
    ...updatedTasks[taskIndex],
    completed
  };
  
  updatedPhases[phaseIndex] = {
    ...updatedPhases[phaseIndex],
    tasks: updatedTasks
  };
  
  return updateFeature(featureId, { phases: updatedPhases });
} 