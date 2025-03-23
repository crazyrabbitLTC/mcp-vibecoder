/**
 * @file documentation.ts
 * @version 1.1.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2023-03-23
 * 
 * Documentation module for the Vibe-Coder MCP Server.
 * This module handles PRD and implementation plan generation
 * based on clarification responses.
 * 
 * IMPORTANT:
 * - Document generation uses structured templates
 * - Output is stored both in-memory and in the file system
 * 
 * Functionality:
 * - PRD generation
 * - Implementation plan generation
 * - Document storage via DocumentStorage module
 */

import { Feature, ClarificationResponse } from './types.js';
import { formatDate } from './utils.js';
import { documentStorage, DocumentType } from './document-storage.js';

/**
 * Extract objectives from clarification responses
 * @param responses Clarification responses
 * @returns Array of objectives
 */
export function extractObjectivesFromClarifications(responses: ClarificationResponse[]): string[] {
  // Find the response to the problem question
  const problemResponse = responses.find(r => 
    r.question.toLowerCase().includes('what specific problem') ||
    r.question.toLowerCase().includes('what problem')
  );
  
  if (!problemResponse) return [];
  
  // Extract objectives from the problem statement
  const answer = problemResponse.answer;
  const objectives: string[] = [];
  
  // If the response has numbered points or bullet points
  if (answer.includes('\n- ') || answer.includes('\n* ') || /\n\d+\./.test(answer)) {
    const lines = answer.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // Look for bullet points or numbered lists
      if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\./.test(line)) {
        // Clean up the line (remove the bullet or number)
        const cleanLine = line.replace(/^- |^\* |^\d+\.\s*/, '');
        objectives.push(cleanLine);
      }
    }
  } else {
    // No clear bullet points, try to extract sentences
    const sentences = answer.split(/\.(?!\d)/g).map(s => s.trim()).filter(s => s.length > 10);
    objectives.push(...sentences);
  }
  
  return objectives;
}

/**
 * Extract requirements from clarification responses
 * @param responses Clarification responses
 * @returns Array of requirements
 */
export function extractRequirementsFromClarifications(responses: ClarificationResponse[]): string[] {
  // Find the response to the requirements question
  const requirementsResponse = responses.find(r => 
    r.question.toLowerCase().includes('key requirements')
  );
  
  if (!requirementsResponse) return [];
  
  // Extract requirements from the response
  const answer = requirementsResponse.answer;
  const requirements: string[] = [];
  
  // If the response has numbered points or bullet points
  if (answer.includes('\n- ') || answer.includes('\n* ') || /\n\d+\./.test(answer)) {
    const lines = answer.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // Look for bullet points or numbered lists
      if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s*/.test(line)) {
        // Clean up the line (remove the bullet or number)
        let cleanLine = line.replace(/^- |^\* |^\d+\.\s*/, '');
        
        // Check if the line itself contains a nested list
        if (cleanLine.includes(':')) {
          const [req, details] = cleanLine.split(':');
          requirements.push(req.trim());
          
          // If there are nested items, add them as separate requirements
          if (details && (details.includes(', ') || details.includes(' and '))) {
            const nestedItems = details
              .split(/,\s*|\s+and\s+/)
              .map(item => item.trim())
              .filter(Boolean);
            
            for (const item of nestedItems) {
              requirements.push(`${req.trim()} - ${item}`);
            }
          }
        } else {
          requirements.push(cleanLine);
        }
      }
    }
  } else {
    // No clear bullet points, try to extract sentences
    const sentences = answer.split(/\.(?!\d)/g).map(s => s.trim()).filter(s => s.length > 10);
    requirements.push(...sentences);
  }
  
  return requirements;
}

/**
 * Extract technical specifications from clarification responses
 * @param responses Clarification responses
 * @returns Array of technical specifications
 */
export function extractTechnicalSpecsFromClarifications(responses: ClarificationResponse[]): string[] {
  // Find the response to the technical constraints question
  const technicalResponse = responses.find(r => 
    r.question.toLowerCase().includes('technical constraints') ||
    r.question.toLowerCase().includes('technical considerations')
  );
  
  if (!technicalResponse) return [];
  
  // Extract technical specifications from the response
  const answer = technicalResponse.answer;
  const specs: string[] = [];
  
  // If the response has numbered points or bullet points
  if (answer.includes('\n- ') || answer.includes('\n* ') || /\n\d+\./.test(answer)) {
    const lines = answer.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // Look for bullet points or numbered lists
      if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s*/.test(line)) {
        // Clean up the line (remove the bullet or number)
        const cleanLine = line.replace(/^- |^\* |^\d+\.\s*/, '');
        specs.push(cleanLine);
      }
    }
  } else {
    // No clear bullet points, try to extract sentences
    const sentences = answer.split(/\.(?!\d)/g).map(s => s.trim()).filter(s => s.length > 10);
    specs.push(...sentences);
  }
  
  return specs;
}

/**
 * Generate a Product Requirements Document (PRD) for a feature
 * @param feature The feature to generate a PRD for
 * @returns The PRD document as a markdown string
 */
export function generatePRD(feature: Feature): string {
  const { name, description, clarificationResponses } = feature;
  
  // Find specific clarification responses
  const problemResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('what specific problem') ||
    r.question.toLowerCase().includes('what problem')
  );
  
  const usersResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('target users')
  );
  
  const requirementsResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('key requirements')
  );
  
  const technicalResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('technical constraints') ||
    r.question.toLowerCase().includes('technical considerations')
  );
  
  const metricsResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('measure') && 
    r.question.toLowerCase().includes('success')
  );
  
  const dependenciesResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('dependencies')
  );
  
  const risksResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('risks') ||
    r.question.toLowerCase().includes('challenges')
  );
  
  // Extract structured information
  const objectives = extractObjectivesFromClarifications(clarificationResponses);
  const requirements = extractRequirementsFromClarifications(clarificationResponses);
  const technicalSpecs = extractTechnicalSpecsFromClarifications(clarificationResponses);
  
  // Format the PRD
  const prd = `# ${name} - Product Requirements Document

## 1. Introduction

### 1.1 Purpose
${problemResponse ? problemResponse.answer : description}

### 1.2 Scope
This document outlines the requirements and specifications for the ${name} feature.

### 1.3 Background
${description}

## 2. Product Overview

### 2.1 Product Description
${description}

### 2.2 Target Users
${usersResponse ? usersResponse.answer : 'To be determined during development.'}

## 3. Functional Requirements

${requirements.map((req, index) => `### 3.${index + 1} ${req}`).join('\n\n')}

## 4. Non-Functional Requirements

### 4.1 Technical Constraints
${technicalResponse ? technicalResponse.answer : 'No specific technical constraints identified.'}

### 4.2 Performance Requirements
${technicalSpecs.filter(spec => 
  spec.toLowerCase().includes('performance') || 
  spec.toLowerCase().includes('speed') ||
  spec.toLowerCase().includes('time') ||
  spec.toLowerCase().includes('fast')
).map(spec => `- ${spec}`).join('\n') || 'No specific performance requirements identified.'}

## 5. Success Metrics

### 5.1 Key Performance Indicators
${metricsResponse ? metricsResponse.answer : 'Success metrics to be determined.'}

## 6. Dependencies

### 6.1 System Dependencies
${dependenciesResponse ? dependenciesResponse.answer : 'No specific dependencies identified.'}

## 7. Risks and Challenges

### 7.1 Identified Risks
${risksResponse ? risksResponse.answer : 'Risks to be assessed during development.'}

## 8. Milestones and Implementation Plan

Refer to the Implementation Plan document for detailed phases and tasks.

---

Generated on: ${formatDate(new Date())}
`;

  // Store the generated PRD in the document storage system
  documentStorage.storeDocument(feature.id, DocumentType.PRD, prd)
    .catch(error => console.error(`Failed to store PRD document: ${error}`));
  
  return prd;
}

/**
 * Generate an implementation plan for a feature
 * @param feature The feature to generate an implementation plan for
 * @returns The implementation plan as a markdown string
 */
export function generateImplementationPlan(feature: Feature): string {
  const { name, description, clarificationResponses } = feature;
  
  // Find specific clarification responses
  const requirementsResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('key requirements')
  );
  
  const technicalResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('technical constraints') ||
    r.question.toLowerCase().includes('technical considerations')
  );
  
  const dependenciesResponse = clarificationResponses.find(r => 
    r.question.toLowerCase().includes('dependencies')
  );
  
  // Extract structured information
  const requirements = extractRequirementsFromClarifications(clarificationResponses);
  const technicalSpecs = extractTechnicalSpecsFromClarifications(clarificationResponses);
  
  // Format the implementation plan
  const implementationPlan = `# ${name} - Implementation Plan

## 1. Overview

${description}

## 2. Requirements Summary

${requirementsResponse ? requirementsResponse.answer : 'Requirements to be determined.'}

## 3. Technical Approach

${technicalResponse ? technicalResponse.answer : 'Technical approach to be determined during development.'}

## 4. Implementation Phases

### Phase 1: Setup and Initial Development

**Description**: Set up the development environment and implement core functionality.

**Tasks**:
${requirements.slice(0, Math.ceil(requirements.length / 3)).map(req => `- Implement ${req}`).join('\n')}

### Phase 2: Core Feature Implementation

**Description**: Implement the main feature components and functionality.

**Tasks**:
${requirements.slice(Math.ceil(requirements.length / 3), Math.ceil(requirements.length * 2 / 3)).map(req => `- Implement ${req}`).join('\n')}

### Phase 3: Testing and Refinement

**Description**: Test the feature thoroughly and refine based on feedback.

**Tasks**:
${requirements.slice(Math.ceil(requirements.length * 2 / 3)).map(req => `- Test and refine ${req}`).join('\n')}
- Write automated tests for all functionality
- Conduct code review
- Performance optimization

## 5. Dependencies and Prerequisites

${dependenciesResponse ? dependenciesResponse.answer : 'No specific dependencies identified.'}

## 6. Timeline Estimate

- Phase 1: 1-2 weeks
- Phase 2: 2-3 weeks
- Phase 3: 1-2 weeks

Total estimated time: 4-7 weeks, depending on complexity and available resources.

## 7. Resources Required

- Developer time: 1-2 developers
- Testing resources
- Technical documentation
- Any specific tools or libraries mentioned in dependencies

---

Generated on: ${formatDate(new Date())}
`;

  // Store the generated implementation plan in the document storage system
  documentStorage.storeDocument(feature.id, DocumentType.IMPLEMENTATION_PLAN, implementationPlan)
    .catch(error => console.error(`Failed to store implementation plan document: ${error}`));
  
  return implementationPlan;
} 