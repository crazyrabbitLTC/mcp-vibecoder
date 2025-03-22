/**
 * Documentation generation functions for the Vibe-Coder MCP Server.
 * This module handles generating PRDs and implementation plans from feature clarifications.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Feature, ClarificationResponse, Phase } from './types.js';
import { formatDate } from './utils.js';

/**
 * Load a template file and return its contents
 * @param templateName The name of the template file (without the path)
 * @returns The template content as a string
 * @throws Error if the template cannot be loaded
 */
function loadTemplate(templateName: string): string {
  try {
    const templatePath = path.join(process.cwd(), 'src', 'templates', templateName);
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw new Error(`Failed to load template ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a PRD document from a feature and its clarification responses
 * @param feature The feature to generate a PRD for
 * @returns The generated PRD markdown content
 */
export function generatePRD(feature: Feature): string {
  try {
    const template = loadTemplate('prd-template.md');
    
    // Replace template variables
    return template
      .replace(/{{featureName}}/g, feature.name)
      .replace(/{{featureDescription}}/g, feature.description || '')
      .replace(/{{featureNameSlug}}/g, slugify(feature.name))
      .replace(/{{stepNumber}}/g, '01')
      .replace(/{{objectives}}/g, extractObjectivesFromClarifications(feature.clarificationResponses))
      .replace(/{{requirements}}/g, extractRequirementsFromClarifications(feature.clarificationResponses))
      .replace(/{{technicalSpecs}}/g, extractTechnicalSpecsFromClarifications(feature.clarificationResponses))
      .replace(/{{implementationPhases}}/g, generateImplementationPhasesList(feature));
  } catch (error) {
    console.warn(`Template loading failed, falling back to basic PRD: ${error instanceof Error ? error.message : String(error)}`);
    return generateBasicPRD(feature);
  }
}

/**
 * Generate a basic PRD as fallback if template loading fails
 * @param feature The feature to generate a PRD for
 * @returns A basic PRD markdown content
 */
function generateBasicPRD(feature: Feature): string {
  return `# ${feature.name} PRD

## 1. Introduction

${feature.description}

## 2. Feature Objectives

${extractObjectivesFromClarifications(feature.clarificationResponses)}

## 3. Scope and Requirements

${extractRequirementsFromClarifications(feature.clarificationResponses)}

## 4. Technical Specifications

${extractTechnicalSpecsFromClarifications(feature.clarificationResponses)}

## 5. Implementation Phases

${generateImplementationPhasesList(feature)}

## 6. Feedback and Iteration Process

This PRD will be updated as the implementation progresses and feedback is received.
`;
}

/**
 * Generate an implementation plan from a feature and its clarification responses
 * @param feature The feature to generate an implementation plan for
 * @returns The generated implementation plan markdown content
 */
export function generateImplementationPlan(feature: Feature): string {
  try {
    const template = loadTemplate('implementation-plan-template.md');
    
    // Replace template variables
    return template
      .replace(/{{featureName}}/g, feature.name)
      .replace(/{{featureDescription}}/g, feature.description || '')
      .replace(/{{featureNameSlug}}/g, slugify(feature.name))
      .replace(/{{stepNumber}}/g, '02')
      .replace(/{{objectives}}/g, extractObjectivesFromClarifications(feature.clarificationResponses))
      .replace(/{{requirements}}/g, extractRequirementsFromClarifications(feature.clarificationResponses))
      .replace(/{{technicalSpecs}}/g, extractTechnicalSpecsFromClarifications(feature.clarificationResponses))
      .replace(/{{implementationPhases}}/g, generateImplementationPhasesList(feature))
      .replace(/{{developmentPhases}}/g, generateDefaultPhases(feature).map(p => `## ${p.name}\n\n${p.description}`).join('\n\n'))
      .replace(/{{fileStructure}}/g, generateFileStructure(feature))
      .replace(/{{nextSteps}}/g, generateNextSteps(feature).map(step => `- ${step}`).join('\n'));
  } catch (error) {
    console.warn(`Template loading failed, falling back to basic implementation plan: ${error instanceof Error ? error.message : String(error)}`);
    return generateBasicImplementationPlan(feature);
  }
}

/**
 * Generate a basic implementation plan as fallback if template loading fails
 * @param feature The feature to generate an implementation plan for
 * @returns A basic implementation plan markdown content
 */
function generateBasicImplementationPlan(feature: Feature): string {
  const phases = generateDefaultPhases(feature);
  
  let phasesContent = '';
  phases.forEach((phase, index) => {
    phasesContent += `\n### Phase ${index + 1}: ${phase.name}\n\n`;
    phasesContent += `**Objectives**: ${phase.objectives}\n\n`;
    phasesContent += `**Tasks**:\n`;
    phase.tasks.forEach((task: string) => {
      phasesContent += `- [ ] ${task}\n`;
    });
    phasesContent += `\n**Code Style & Practices**: ${phase.codeStyle}\n\n`;
  });
  
  return `# ${feature.name} Implementation Plan

## Overview

${feature.description}

## Implementation Steps
${phasesContent}

## File Structure

\`\`\`
${generateFileStructure(feature)}
\`\`\`

## Implementation Timeline

${phases.map((phase, i) => `${i + 1}. **${phase.name}**: ${phase.timeEstimate || '1-2 days'}`).join('\n')}

## Next Steps

${generateNextSteps(feature).map((step, i) => `${i + 1}. ${step}`).join('\n')}
`;
}

/**
 * Extract objectives from clarification responses
 * @param responses The clarification responses to extract objectives from
 * @returns Markdown content for the objectives section
 */
export function extractObjectivesFromClarifications(responses: ClarificationResponse[]): string {
  if (responses.length === 0) {
    return "No objectives defined yet. Complete the clarification process to generate objectives.";
  }
  
  // Look for responses related to problems and users
  const problemResponse = responses.find(r => r.question.includes("problem"));
  const usersResponse = responses.find(r => r.question.includes("users"));
  const successResponse = responses.find(r => r.question.includes("success"));
  
  let objectives = "Based on the clarification responses, this feature aims to:\n\n";
  
  if (problemResponse) {
    objectives += `- **Solve a Problem**: ${problemResponse.answer}\n`;
  }
  
  if (usersResponse) {
    objectives += `- **Target Users**: ${usersResponse.answer}\n`;
  }
  
  if (successResponse) {
    objectives += `- **Success Criteria**: ${successResponse.answer}\n`;
  }
  
  objectives += "\nThe key objectives are to create a solution that is:\n";
  objectives += "- Clean and maintainable\n";
  objectives += "- Well-documented\n";
  objectives += "- Follows best practices\n";
  
  return objectives;
}

/**
 * Extract requirements from clarification responses
 * @param responses The clarification responses to extract requirements from
 * @returns Markdown content for the requirements section
 */
export function extractRequirementsFromClarifications(responses: ClarificationResponse[]): string {
  if (responses.length === 0) {
    return "No requirements defined yet. Complete the clarification process to generate requirements.";
  }
  
  // Look for responses related to requirements
  const requirementsResponse = responses.find(r => r.question.includes("requirements"));
  const dependenciesResponse = responses.find(r => r.question.includes("dependencies"));
  
  let requirements = "Based on the clarification responses, this feature requires:\n\n";
  
  if (requirementsResponse) {
    // Split the requirements by common delimiters and format as a list
    const reqList = requirementsResponse.answer
      .split(/[,.;]/)
      .filter(item => item.trim().length > 0)
      .map(item => `- ${item.trim()}`);
    
    requirements += reqList.join('\n');
    requirements += '\n\n';
  }
  
  if (dependenciesResponse) {
    requirements += `**Dependencies**:\n${dependenciesResponse.answer}\n\n`;
  }
  
  return requirements;
}

/**
 * Extract technical specifications from clarification responses
 * @param responses The clarification responses to extract technical specifications from
 * @returns Markdown content for the technical specifications section
 */
export function extractTechnicalSpecsFromClarifications(responses: ClarificationResponse[]): string {
  if (responses.length === 0) {
    return "No technical specifications defined yet. Complete the clarification process.";
  }
  
  // Look for responses related to technical constraints
  const technicalResponse = responses.find(r => r.question.includes("technical constraints") || r.question.includes("considerations"));
  const risksResponse = responses.find(r => r.question.includes("risks") || r.question.includes("challenges"));
  
  let specs = "";
  
  if (technicalResponse) {
    specs += `**Technical Constraints**:\n${technicalResponse.answer}\n\n`;
  }
  
  if (risksResponse) {
    specs += `**Potential Risks and Challenges**:\n${risksResponse.answer}\n\n`;
  }
  
  specs += `**Development Approach**:\n`;
  specs += `- Use TypeScript for type safety\n`;
  specs += `- Follow functional programming principles\n`;
  specs += `- Implement thorough testing\n`;
  specs += `- Use modular design\n`;
  
  return specs;
}

/**
 * Generate a list of implementation phases for the PRD
 * @param feature The feature to generate phases for
 * @returns Markdown content for the implementation phases section
 */
function generateImplementationPhasesList(feature: Feature): string {
  const phases = generateDefaultPhases(feature);
  
  let phasesList = "";
  phases.forEach((phase, index) => {
    phasesList += `**Phase ${index + 1}: ${phase.name}**\n`;
    phasesList += `${phase.objectives}\n\n`;
  });
  
  return phasesList;
}

/**
 * Generate default implementation phases based on the feature
 * @param feature The feature to generate phases for
 * @returns An array of phase objects
 */
function generateDefaultPhases(feature: Feature): any[] {
  // If the feature already has phases defined, use those
  if (feature.phases && feature.phases.length > 0) {
    return feature.phases.map(phase => ({
      name: phase.name,
      objectives: phase.description,
      tasks: phase.tasks.map(task => task.description),
      codeStyle: "Follow TypeScript best practices, use functional programming where appropriate, and ensure thorough testing.",
      timeEstimate: "1-2 days"
    }));
  }
  
  // Otherwise, generate default phases
  return [
    {
      name: "Requirements Analysis and Design",
      objectives: "Analyze requirements, design the architecture, and create a detailed implementation plan.",
      tasks: [
        "Review and analyze clarification responses",
        "Identify key components and their interactions",
        "Design the system architecture",
        "Create UML diagrams if necessary",
        "Identify potential edge cases and risks"
      ],
      codeStyle: "Create clear documentation with diagrams and detailed explanations.",
      timeEstimate: "1-2 days"
    },
    {
      name: "Core Implementation",
      objectives: "Implement the core functionality based on the design.",
      tasks: [
        "Set up project structure and dependencies",
        "Implement data models and interfaces",
        "Build core business logic",
        "Create unit tests for core functionality",
        "Ensure code follows best practices"
      ],
      codeStyle: "Use TypeScript with clear typing, follow functional programming principles, and use TDD where appropriate.",
      timeEstimate: "2-3 days"
    },
    {
      name: "Testing and Integration",
      objectives: "Test all components, integrate with existing systems, and refine the implementation.",
      tasks: [
        "Write unit tests for all components",
        "Perform integration testing",
        "Fix bugs and edge cases",
        "Optimize performance",
        "Document any known limitations"
      ],
      codeStyle: "Focus on test coverage and quality, fix edge cases, and document limitations.",
      timeEstimate: "1-2 days"
    },
    {
      name: "Documentation and Finalization",
      objectives: "Finalize documentation, clean up code, and prepare for deployment.",
      tasks: [
        "Complete inline code documentation",
        "Create user documentation",
        "Clean up and refactor code",
        "Prepare deployment strategy",
        "Create final pull request"
      ],
      codeStyle: "Ensure comprehensive documentation, clean code, and prepare for smooth deployment.",
      timeEstimate: "1 day"
    }
  ];
}

/**
 * Generate a file structure based on the feature
 * @param feature The feature to generate a file structure for
 * @returns A string representation of the file structure
 */
function generateFileStructure(feature: Feature): string {
  const featureNameSlug = slugify(feature.name);
  
  return `src/
  ├── ${featureNameSlug}/
  │   ├── index.ts                 # Main entry point
  │   ├── types.ts                 # Type definitions
  │   ├── components/              # UI components (if applicable)
  │   │   └── index.ts
  │   ├── hooks/                   # Custom hooks (if applicable)
  │   │   └── index.ts
  │   ├── utils/                   # Utility functions
  │   │   └── index.ts
  │   └── tests/                   # Tests
  │       └── index.test.ts
  └── index.ts                     # Re-export public API`;
}

/**
 * Generate next steps for implementing the feature
 * @param feature The feature to generate next steps for
 * @returns An array of next steps
 */
function generateNextSteps(feature: Feature): string[] {
  return [
    "Set up the project structure and dependencies",
    "Implement core functionality based on the PRD",
    "Write comprehensive tests for all components",
    "Create clear documentation for users and developers",
    "Prepare for code review and deployment"
  ];
}

/**
 * Convert a string to a slug format
 * @param str The string to convert
 * @returns The slug version of the string
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
} 