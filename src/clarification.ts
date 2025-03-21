/**
 * Feature clarification module for the Vibe-Coder MCP Server.
 * This module handles the iterative questioning to clarify feature requests.
 */
import { Feature, ClarificationResponse } from './types.js';
import { updateFeature, getFeature } from './storage.js';
import { now } from './utils.js';

/**
 * Default questions to ask during feature clarification
 */
export const DEFAULT_CLARIFICATION_QUESTIONS = [
  "What specific problem does this feature solve?",
  "Who are the target users for this feature?",
  "What are the key requirements for this feature?",
  "What are the technical constraints or considerations?",
  "How will we measure the success of this feature?",
  "Are there any dependencies on other features or systems?",
  "What are the potential risks or challenges in implementing this feature?"
];

/**
 * Get the next clarification question for a feature
 * @param feature The feature to get the next question for
 * @returns The next question to ask or null if all questions have been answered
 */
export function getNextClarificationQuestion(feature: Feature): string | null {
  // Check if we've asked all the default questions
  if (feature.clarificationResponses.length >= DEFAULT_CLARIFICATION_QUESTIONS.length) {
    return null;
  }
  
  // Get the next question based on the number of responses
  return DEFAULT_CLARIFICATION_QUESTIONS[feature.clarificationResponses.length];
}

/**
 * Add a clarification response to a feature
 * @param featureId The ID of the feature to add the response to
 * @param question The question that was asked
 * @param answer The user's answer
 * @returns The updated feature or undefined if not found
 */
export function addClarificationResponse(
  featureId: string,
  question: string,
  answer: string
): Feature | undefined {
  const feature = getFeature(featureId);
  if (!feature) return undefined;
  
  // Create a new response
  const newResponse: ClarificationResponse = {
    question,
    answer,
    timestamp: now()
  };
  
  // Update the feature with the new response
  return updateFeature(featureId, {
    clarificationResponses: [...feature.clarificationResponses, newResponse]
  });
}

/**
 * Format clarification responses as text
 * @param responses The responses to format
 * @returns Formatted text
 */
export function formatClarificationResponses(responses: ClarificationResponse[]): string {
  if (responses.length === 0) {
    return "No clarification responses yet.";
  }
  
  return responses.map(cr => `Q: ${cr.question}\nA: ${cr.answer}`).join('\n\n');
}

/**
 * Check if a feature has completed the clarification process
 * @param feature The feature to check
 * @returns True if clarification is complete, false otherwise
 */
export function isClarificationComplete(feature: Feature): boolean {
  return feature.clarificationResponses.length >= DEFAULT_CLARIFICATION_QUESTIONS.length;
}

/**
 * Get a summary of the clarification status
 * @param feature The feature to get the status for
 * @returns A text summary of the clarification status
 */
export function getClarificationStatus(feature: Feature): string {
  const total = DEFAULT_CLARIFICATION_QUESTIONS.length;
  const completed = feature.clarificationResponses.length;
  
  return `Clarification progress: ${completed}/${total} questions answered.`;
} 