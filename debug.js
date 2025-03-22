#!/usr/bin/env node

// This file is just for inspecting the features state
// Since we can't access the runtime state directly, 
// we'll examine how the clarification functions work

import { getNextClarificationQuestion, DEFAULT_CLARIFICATION_QUESTIONS } from './build/clarification.js';

console.log('Default questions:', DEFAULT_CLARIFICATION_QUESTIONS);

// Test the function with a mock feature
const mockFeature = {
  id: 'test',
  clarificationResponses: []
};

console.log('Initial question:', getNextClarificationQuestion(mockFeature));

// Add a response and check next question
mockFeature.clarificationResponses.push({
  question: DEFAULT_CLARIFICATION_QUESTIONS[0],
  answer: 'Test answer',
  timestamp: new Date()
});

console.log('After 1 response, next question:', getNextClarificationQuestion(mockFeature));

// Add another response
mockFeature.clarificationResponses.push({
  question: DEFAULT_CLARIFICATION_QUESTIONS[1],
  answer: 'Test answer 2',
  timestamp: new Date()
});

console.log('After 2 responses, next question:', getNextClarificationQuestion(mockFeature)); 