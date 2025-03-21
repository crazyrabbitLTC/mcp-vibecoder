/**
 * Core data types for the Vibe-Coder MCP Server
 */

/**
 * Represents a feature being developed
 */
export type Feature = {
  id: string;
  name: string;
  description: string;
  clarificationResponses: ClarificationResponse[];
  prd?: string;
  prdDoc?: string;
  implementationPlan?: string;
  implDoc?: string;
  phases: Phase[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Represents a question and answer pair from the clarification process
 */
export type ClarificationResponse = {
  question: string;
  answer: string;
  timestamp: Date;
};

/**
 * Represents a development phase within a feature
 */
export type Phase = {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  status: PhaseStatus;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Possible statuses for a development phase
 */
export type PhaseStatus = "pending" | "in_progress" | "completed" | "reviewed";

/**
 * Represents a task within a development phase
 */
export type Task = {
  id: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Storage interface for features
 */
export interface FeatureStorage {
  [id: string]: Feature;
} 