/**
 * Feature clarification module for the Vibe-Coder MCP Server.
 * This module handles the iterative questioning to clarify feature requests.
 */
import { Feature, ClarificationResponse } from './types.js';
import { updateFeature } from './storage.js';
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
  // This will be fully implemented in Step 2
  
  // For now, just return the first question if no responses yet
  if (feature.clarificationResponses.length === 0) {
    return DEFAULT_CLARIFICATION_QUESTIONS[0];
  }
  
  // If we've asked all questions, return null
  if (feature.clarificationResponses.length >= DEFAULT_CLARIFICATION_QUESTIONS.length) {
    return null;
  }
  
  // Otherwise, return the next question
  return DEFAULT_CLARIFICATION_QUESTIONS[feature.clarificationResponses.length];
}

/**
 * Add a clarification response to a feature
 * @param feature The feature to add the response to
 * @param question The question that was asked
 * @param answer The user's answer
 * @returns The updated feature
 */
export function addClarificationResponse(
  featureId: string,
  question: string,
  answer: string
): Feature | undefined {
  // This will be fully implemented in Step 2
  return updateFeature(featureId, {
    clarificationResponses: [
      ...updateFeature(featureId, {})?.clarificationResponses || [],
      {
        question,
        answer,
        timestamp: now()
      }
    ]
  });
}

/**
 * Format clarification responses as text
 * @param responses The responses to format
 * @returns Formatted text
 */
export function formatClarificationResponses(responses: ClarificationResponse[]): string {
  return responses.map(cr => `Q: ${cr.question}\nA: ${cr.answer}`).join('\n\n');
} 