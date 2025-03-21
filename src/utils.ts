/**
 * Utility functions for the Vibe-Coder MCP Server
 */

import { Feature, Phase, Task, PhaseStatus } from './types.js';

/**
 * Generate a unique ID for features, phases, tasks, etc.
 * @returns A random string ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Format a date to ISO string without milliseconds
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('.')[0] + 'Z';
}

/**
 * Create a new timestamp
 * @returns Current date
 */
export function now(): Date {
  return new Date();
}

/**
 * Create a default feature object with the given name and description
 * @param name The feature name
 * @param description The feature description
 * @returns A new feature object
 */
export function createFeatureObject(name: string, description: string = ""): any {
  const timestamp = now();
  
  return {
    id: generateId(),
    name,
    description,
    clarificationResponses: [],
    phases: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Create a default phase object with the given name and description
 * @param name The phase name
 * @param description The phase description
 * @returns A new phase object
 */
export function createPhaseObject(name: string, description: string): any {
  const timestamp = now();
  
  return {
    id: generateId(),
    name,
    description,
    tasks: [],
    status: "pending" as const,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Create a default task object with the given description
 * @param description The task description
 * @returns A new task object
 */
export function createTaskObject(description: string): any {
  const timestamp = now();
  
  return {
    id: generateId(),
    description,
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * Validate if a status is a valid phase status
 * @param status The status to validate
 * @returns True if valid, false otherwise
 */
export function isValidPhaseStatus(status: string): boolean {
  return ['pending', 'in_progress', 'completed', 'reviewed'].includes(status);
}

/**
 * Generate a detailed progress summary for a feature
 * @param feature The feature to generate a summary for
 * @returns A formatted string with the feature's progress details
 */
export function generateFeatureProgressSummary(feature: Feature): string {
  const totalPhases = feature.phases.length;
  const completedPhases = feature.phases.filter((p: Phase) => p.status === 'completed' || p.status === 'reviewed').length;
  const inProgressPhases = feature.phases.filter((p: Phase) => p.status === 'in_progress').length;
  
  const totalTasks = feature.phases.reduce((acc: number, phase: Phase) => acc + phase.tasks.length, 0);
  const completedTasks = feature.phases.reduce(
    (acc: number, phase: Phase) => acc + phase.tasks.filter((t: Task) => t.completed).length, 0
  );
  
  const phaseProgress = totalPhases > 0 
    ? Math.round((completedPhases / totalPhases) * 100) 
    : 0;
    
  const taskProgress = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : 0;
  
  let summary = `
# Feature Progress: ${feature.name}

## Overview
- Feature ID: ${feature.id}
- Created: ${feature.createdAt.toISOString()}
- Last Updated: ${feature.updatedAt.toISOString()}
- Description: ${feature.description}

## Progress Summary
- Phases: ${completedPhases}/${totalPhases} completed (${phaseProgress}%)
- Tasks: ${completedTasks}/${totalTasks} completed (${taskProgress}%)
- Phases in Progress: ${inProgressPhases}

## Phase Details
`;

  if (totalPhases === 0) {
    summary += "\nNo phases defined for this feature yet.";
  } else {
    feature.phases.forEach((phase: Phase) => {
      const phaseTasks = phase.tasks.length;
      const phaseCompletedTasks = phase.tasks.filter((t: Task) => t.completed).length;
      const phaseTaskProgress = phaseTasks > 0 
        ? Math.round((phaseCompletedTasks / phaseTasks) * 100) 
        : 0;
      
      summary += `
### ${phase.name} (${phase.status})
- ID: ${phase.id}
- Progress: ${phaseCompletedTasks}/${phaseTasks} tasks (${phaseTaskProgress}%)
- Description: ${phase.description}

Tasks:
${phase.tasks.map((task: Task) => `- [${task.completed ? 'x' : ' '}] ${task.description}`).join('\n')}
`;
    });
  }
  
  return summary;
} 