/**
 * @file errors.ts
 * @version 1.0.0
 * 
 * Provides standardized error handling utilities for the Vibe-Coder MCP Server.
 * These utilities ensure consistent error responses following the JSON-RPC 2.0 specification.
 */

import { z } from 'zod';

// --------- Error Codes ---------

/**
 * Standard JSON-RPC 2.0 error codes
 * https://www.jsonrpc.org/specification#error_object
 */
export enum ErrorCode {
  // JSON-RPC 2.0 Standard Error Codes
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // Custom Error Codes (must be between -32000 and -32099)
  VALIDATION_ERROR = -32000,
  RESOURCE_NOT_FOUND = -32001,
  TOOL_NOT_FOUND = -32002,
  PROMPT_NOT_FOUND = -32003,
  UNAUTHORIZED = -32004,
  FEATURE_NOT_FOUND = -32010,
  PHASE_NOT_FOUND = -32011,
  TASK_NOT_FOUND = -32012,
  INVALID_PHASE_TRANSITION = -32013,
  CLARIFICATION_INCOMPLETE = -32014,
}

// --------- Error Responses ---------

/**
 * Standard JSON-RPC 2.0 error response structure
 */
export type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    data?: any;
  }
};

/**
 * Tool error response
 */
export type ToolErrorResponse = {
  content: [{
    type: "text";
    text: string;
  }];
  isError?: boolean;
};

/**
 * Create a standard error response for JSON-RPC 2.0
 */
export const createErrorResponse = (
  code: ErrorCode, 
  message: string, 
  data?: any
): ErrorResponse => {
  return {
    error: {
      code,
      message,
      data
    }
  };
};

/**
 * Create a tool error response
 */
export const createToolErrorResponse = (
  message: string, 
  details?: any
): ToolErrorResponse => {
  return {
    content: [{
      type: "text",
      text: `Error: ${message}`
    }],
    isError: true
  };
};

/**
 * Capture and format Zod validation errors
 */
export const handleZodError = (error: z.ZodError): ErrorResponse => {
  const formattedErrors = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
  
  return createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    "Validation error",
    formattedErrors
  );
};

/**
 * Handle feature not found errors
 */
export const featureNotFoundError = (featureId: string): ToolErrorResponse => {
  return createToolErrorResponse(`Feature with ID ${featureId} not found`);
};

/**
 * Handle phase not found errors
 */
export const phaseNotFoundError = (
  phaseId: string, 
  featureName: string
): ToolErrorResponse => {
  return createToolErrorResponse(
    `Phase with ID ${phaseId} not found in feature ${featureName}`
  );
};

/**
 * Handle task not found errors
 */
export const taskNotFoundError = (
  taskId: string, 
  phaseName: string
): ToolErrorResponse => {
  return createToolErrorResponse(
    `Task with ID ${taskId} not found in phase ${phaseName}`
  );
};

/**
 * Handle invalid phase transition errors
 */
export const invalidPhaseTransitionError = (
  currentStatus: string, 
  newStatus: string
): ToolErrorResponse => {
  return createToolErrorResponse(
    `Cannot transition phase from "${currentStatus}" to "${newStatus}"`
  );
};

/**
 * Handle clarification incomplete errors
 */
export const clarificationIncompleteError = (
  status: any
): ToolErrorResponse => {
  return createToolErrorResponse(
    `Cannot proceed until clarification is complete`,
    { clarificationStatus: status }
  );
};

/**
 * Try-catch wrapper for Zod validation
 */
export const tryValidate = <T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ErrorResponse } => {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: handleZodError(error) };
    }
    return {
      success: false,
      error: createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Unknown error"
      )
    };
  }
}; 