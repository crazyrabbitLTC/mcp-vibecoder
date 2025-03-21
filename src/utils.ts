/**
 * Utility functions for the Vibe-Coder MCP Server
 */

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