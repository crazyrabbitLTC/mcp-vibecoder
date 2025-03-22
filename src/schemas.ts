/**
 * @file schemas.ts
 * @version 1.0.0
 * 
 * Provides Zod schemas and branded types for the Vibe-Coder MCP Server.
 * These schemas enable runtime validation and improve type safety across the codebase.
 */

import { z } from 'zod';
import { PhaseStatus } from './types.js';

// --------- Branded Types for IDs ---------

/**
 * Branded type for Feature IDs
 */
export type FeatureId = string & { readonly _brand: unique symbol };

/**
 * Branded type for Phase IDs
 */
export type PhaseId = string & { readonly _brand: unique symbol };

/**
 * Branded type for Task IDs
 */
export type TaskId = string & { readonly _brand: unique symbol };

/**
 * Type guards for branded types
 */
export const isFeatureId = (id: string): id is FeatureId => id.startsWith('feature-');
export const isPhaseId = (id: string): id is PhaseId => id.startsWith('phase-');
export const isTaskId = (id: string): id is TaskId => id.startsWith('task-');

/**
 * Brand creator functions
 */
export const createFeatureId = (id: string): FeatureId => {
  if (!isFeatureId(id)) throw new Error(`Invalid feature ID format: ${id}`);
  return id as FeatureId;
};

export const createPhaseId = (id: string): PhaseId => {
  if (!isPhaseId(id)) throw new Error(`Invalid phase ID format: ${id}`);
  return id as PhaseId;
};

export const createTaskId = (id: string): TaskId => {
  if (!isTaskId(id)) throw new Error(`Invalid task ID format: ${id}`);
  return id as TaskId;
};

// --------- Core Zod Schemas ---------

/**
 * Schema for ClarificationResponse
 */
export const ClarificationResponseSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  answer: z.string().min(1, "Answer cannot be empty"),
  timestamp: z.date(),
});

/**
 * Schema for Task
 */
export const TaskSchema = z.object({
  id: z.string().refine(isTaskId, "Invalid task ID format"),
  description: z.string().min(3, "Task description must be at least 3 characters"),
  completed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for PhaseStatus
 */
export const PhaseStatusSchema = z.enum(["pending", "in_progress", "completed", "reviewed"]);

/**
 * Schema for Phase
 */
export const PhaseSchema = z.object({
  id: z.string().refine(isPhaseId, "Invalid phase ID format"),
  name: z.string().min(2, "Phase name must be at least 2 characters").max(100, "Phase name must be at most 100 characters"),
  description: z.string(),
  tasks: z.array(TaskSchema),
  status: PhaseStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for Feature
 */
export const FeatureSchema = z.object({
  id: z.string().refine(isFeatureId, "Invalid feature ID format"),
  name: z.string().min(2, "Feature name must be at least 2 characters").max(100, "Feature name must be at most 100 characters"),
  description: z.string(),
  clarificationResponses: z.array(ClarificationResponseSchema),
  prd: z.string().optional(),
  prdDoc: z.string().optional(),
  implementationPlan: z.string().optional(),
  implDoc: z.string().optional(),
  phases: z.array(PhaseSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// --------- Type Inference ---------

/**
 * Zod-inferred types to ensure schema and type compatibility
 */
export type ZodFeature = z.infer<typeof FeatureSchema>;
export type ZodPhase = z.infer<typeof PhaseSchema>;
export type ZodTask = z.infer<typeof TaskSchema>;
export type ZodClarificationResponse = z.infer<typeof ClarificationResponseSchema>;

/**
 * Validation functions for inputs
 */
export const validateFeature = (feature: unknown): ZodFeature => {
  return FeatureSchema.parse(feature);
};

export const validatePhase = (phase: unknown): ZodPhase => {
  return PhaseSchema.parse(phase);
};

export const validateTask = (task: unknown): ZodTask => {
  return TaskSchema.parse(task);
};

export const validateClarificationResponse = (response: unknown): ZodClarificationResponse => {
  return ClarificationResponseSchema.parse(response);
}; 