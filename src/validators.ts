/**
 * @file validators.ts
 * @version 1.0.0
 * 
 * Provides validation utilities for the Vibe-Coder MCP Server tools.
 * These validators ensure that tool inputs are valid and provide consistent
 * error handling across all tools.
 */

import { Feature, Phase, Task, PhaseStatus } from './types.js';
import { getFeature } from './storage.js';
import { isValidPhaseStatus } from './utils.js';

/**
 * Standard validation result type
 */
export type ValidationResult = {
  valid: boolean;
  message: string;
  data?: any; // Optional validated data
};

/**
 * Validate feature ID and return the feature if valid
 * @param featureId The feature ID to validate
 * @returns Validation result with feature in data if valid
 */
export function validateFeatureId(featureId: string): ValidationResult {
  // Check if feature ID is provided
  if (!featureId || featureId.trim() === '') {
    return {
      valid: false,
      message: 'Feature ID is required'
    };
  }

  // Check if feature exists
  const feature = getFeature(featureId);
  if (!feature) {
    return {
      valid: false,
      message: `Feature with ID ${featureId} not found`
    };
  }

  return {
    valid: true,
    message: 'Feature is valid',
    data: feature
  };
}

/**
 * Validate phase ID in the context of a feature
 * @param feature The feature containing the phase
 * @param phaseId The phase ID to validate
 * @returns Validation result with phase in data if valid
 */
export function validatePhaseId(feature: Feature, phaseId: string): ValidationResult {
  // Check if phase ID is provided
  if (!phaseId || phaseId.trim() === '') {
    return {
      valid: false,
      message: 'Phase ID is required'
    };
  }

  // Check if phase exists in feature
  const phase = feature.phases.find(p => p.id === phaseId);
  if (!phase) {
    return {
      valid: false,
      message: `Phase with ID ${phaseId} not found in feature ${feature.name}`
    };
  }

  return {
    valid: true,
    message: 'Phase is valid',
    data: phase
  };
}

/**
 * Validate task ID in the context of a phase
 * @param phase The phase containing the task
 * @param taskId The task ID to validate
 * @returns Validation result with task in data if valid
 */
export function validateTaskId(phase: Phase, taskId: string): ValidationResult {
  // Check if task ID is provided
  if (!taskId || taskId.trim() === '') {
    return {
      valid: false,
      message: 'Task ID is required'
    };
  }

  // Check if task exists in phase
  const task = phase.tasks.find(t => t.id === taskId);
  if (!task) {
    return {
      valid: false,
      message: `Task with ID ${taskId} not found in phase ${phase.name}`
    };
  }

  return {
    valid: true,
    message: 'Task is valid',
    data: task
  };
}

/**
 * Validate phase status
 * @param status The status to validate
 * @returns Validation result
 */
export function validatePhaseStatusValue(status: string): ValidationResult {
  if (!status || status.trim() === '') {
    return {
      valid: false,
      message: 'Phase status is required'
    };
  }

  if (!isValidPhaseStatus(status)) {
    return {
      valid: false,
      message: `Invalid phase status: ${status}. Valid values are: pending, in_progress, completed, reviewed`
    };
  }

  return {
    valid: true,
    message: 'Phase status is valid',
    data: status as PhaseStatus
  };
}

/**
 * Validate required text field
 * @param value The text value
 * @param fieldName The name of the field for error messages
 * @param minLength Minimum allowed length
 * @param maxLength Maximum allowed length
 * @returns Validation result
 */
export function validateRequiredText(
  value: string,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 1000
): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      valid: false,
      message: `${fieldName} is required`
    };
  }

  if (value.length < minLength) {
    return {
      valid: false,
      message: `${fieldName} must be at least ${minLength} characters`
    };
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      message: `${fieldName} must be no more than ${maxLength} characters`
    };
  }

  return {
    valid: true,
    message: `${fieldName} is valid`,
    data: value.trim()
  };
}

/**
 * Validate feature, phase, and task IDs together
 * @param featureId Feature ID
 * @param phaseId Phase ID
 * @param taskId Task ID (optional)
 * @returns Validation result with feature, phase, and task in data if valid
 */
export function validateFeaturePhaseTask(
  featureId: string,
  phaseId: string,
  taskId?: string
): ValidationResult {
  // Validate feature
  const featureResult = validateFeatureId(featureId);
  if (!featureResult.valid) {
    return featureResult;
  }

  // Validate phase
  const phaseResult = validatePhaseId(featureResult.data, phaseId);
  if (!phaseResult.valid) {
    return phaseResult;
  }

  // If taskId is provided, validate it
  if (taskId) {
    const taskResult = validateTaskId(phaseResult.data, taskId);
    if (!taskResult.valid) {
      return taskResult;
    }

    return {
      valid: true,
      message: 'Feature, phase, and task are valid',
      data: {
        feature: featureResult.data,
        phase: phaseResult.data,
        task: taskResult.data
      }
    };
  }

  return {
    valid: true,
    message: 'Feature and phase are valid',
    data: {
      feature: featureResult.data,
      phase: phaseResult.data
    }
  };
} 