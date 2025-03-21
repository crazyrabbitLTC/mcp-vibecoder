# Vibe-Coder MCP Server Implementation Plan

After examining the existing template MCP server and the provided documents, I'll outline a detailed implementation plan for creating the Vibe-Coder MCP server according to the PRD and Implementation documents.

## Overview

The Vibe-Coder MCP server will guide casual coders through a structured development process using features exposed via the Model Context Protocol. It will transform the existing notes system into a comprehensive development workflow tool, helping LLMs organize code development through clarification workflows, documentation generation, and phased implementation.

## Implementation Steps

### Step 1: Server Configuration and Core Structure

I'll start by modifying the existing MCP server to align with the Vibe-Coder requirements:

1. Update server metadata and capabilities
2. Define core data structures for features, PRDs, and implementation plans
3. Create in-memory storage for projects and their phases

```typescript
// Core data types
type Feature = {
  id: string;
  name: string;
  description: string;
  clarificationResponses: ClarificationResponse[];
  prdDoc?: string;
  implDoc?: string;
  phases: Phase[];
};

type ClarificationResponse = {
  question: string;
  answer: string;
};

type Phase = {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  status: "pending" | "in_progress" | "completed" | "reviewed";
};

type Task = {
  description: string;
  completed: boolean;
};

// In-memory storage
const features: { [id: string]: Feature } = {};
```

### Step 2: Feature Clarification Implementation

The clarification module will use MCP tools to engage users in iterative questioning:

1. Create a tool to initiate feature clarification
2. Implement a tool to receive clarification responses
3. Create a resource to retrieve clarification status

```typescript
// Tool for initiating clarification
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "start_feature_clarification") {
    const featureName = String(request.params.arguments?.featureName || "");
    const featureId = generateId();
    
    features[featureId] = {
      id: featureId,
      name: featureName,
      description: String(request.params.arguments?.initialDescription || ""),
      clarificationResponses: [],
      phases: []
    };
    
    // Return first clarification question
    return {
      content: [{
        type: "text",
        text: `Feature ID: ${featureId}\n\nLet's clarify your feature request. What specific problem does this feature solve?`
      }]
    };
  }

  // Handle other tools...
});
```

### Step 3: PRD and Implementation Plan Generation

Implement tools to generate documentation based on clarification responses:

1. Create a tool to generate the PRD document
2. Implement a tool to create the implementation plan
3. Add resources to access these documents

```typescript
// Tool for generating PRD
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "generate_prd") {
    const featureId = String(request.params.arguments?.featureId);
    const feature = features[featureId];
    
    if (!feature) {
      throw new Error("Feature not found");
    }
    
    // Generate PRD content based on clarification responses
    const prdContent = generatePRD(feature);
    feature.prdDoc = prdContent;
    
    return {
      content: [{
        type: "text",
        text: `PRD generated successfully for ${feature.name}. You can view it using the "feature_prd" resource.`
      }]
    };
  }
  
  // Similar implementation for implementation plan generation...
});
```

### Step 4: Phase Management Implementation

Create tools to manage development phases:

1. Implement a tool to create phases
2. Add a tool to update phase status
3. Create resources to view phase details

```typescript
// Tool for creating a new phase
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "create_phase") {
    const featureId = String(request.params.arguments?.featureId);
    const phaseName = String(request.params.arguments?.name);
    const phaseDescription = String(request.params.arguments?.description);
    const tasks = JSON.parse(String(request.params.arguments?.tasks || "[]"));
    
    const feature = features[featureId];
    if (!feature) {
      throw new Error("Feature not found");
    }
    
    const phaseId = generateId();
    feature.phases.push({
      id: phaseId,
      name: phaseName,
      description: phaseDescription,
      tasks: tasks.map((task: string) => ({ description: task, completed: false })),
      status: "pending"
    });
    
    return {
      content: [{
        type: "text",
        text: `Phase "${phaseName}" created with ID: ${phaseId}`
      }]
    };
  }
  
  // Handle other tools...
});
```

### Step 5: Resource Implementation

Implement resources to retrieve feature data, PRDs, and implementation plans:

1. Create resources for listing all features
2. Add resources for accessing feature details
3. Implement resources for retrieving PRDs and implementation plans

```typescript
// Handler for listing available features as resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "features://list",
        mimeType: "text/plain",
        name: "Features List",
        description: "Lists all features being developed"
      },
      ...Object.values(features).flatMap(feature => [
        {
          uri: `feature://${feature.id}`,
          mimeType: "text/plain", 
          name: feature.name,
          description: `Details about feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/prd`,
          mimeType: "text/markdown",
          name: `${feature.name} PRD`,
          description: `PRD document for feature: ${feature.name}`
        },
        {
          uri: `feature://${feature.id}/implementation`,
          mimeType: "text/markdown",
          name: `${feature.name} Implementation Plan`,
          description: `Implementation plan for feature: ${feature.name}`
        }
      ])
    ]
  };
});

// Handler for reading feature resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  
  // Handle various resource types...
  if (url.protocol === "features:") {
    if (url.pathname === "/list") {
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/plain",
          text: Object.values(features).map(f => `${f.id}: ${f.name}`).join("\n")
        }]
      };
    }
  }
  
  if (url.protocol === "feature:") {
    const parts = url.pathname.split('/').filter(Boolean);
    const featureId = parts[0];
    const feature = features[featureId];
    
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }
    
    if (parts.length === 1) {
      // Return feature details
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/plain",
          text: formatFeatureDetails(feature)
        }]
      };
    }
    
    if (parts[1] === "prd") {
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "text/markdown",
          text: feature.prdDoc || "PRD not yet generated"
        }]
      };
    }
    
    // Handle other resource types...
  }
  
  throw new Error("Resource not found");
});
```

### Step 6: Tool Implementation

Expose the main tools for interacting with the Vibe-Coder MCP server:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "start_feature_clarification",
        description: "Start the clarification process for a new feature",
        inputSchema: {
          type: "object",
          properties: {
            featureName: {
              type: "string",
              description: "Name of the feature"
            },
            initialDescription: {
              type: "string",
              description: "Initial description of the feature"
            }
          },
          required: ["featureName"]
        }
      },
      {
        name: "provide_clarification",
        description: "Provide answer to a clarification question",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            },
            question: {
              type: "string",
              description: "Clarification question"
            },
            answer: {
              type: "string",
              description: "Answer to the clarification question"
            }
          },
          required: ["featureId", "question", "answer"]
        }
      },
      {
        name: "generate_prd",
        description: "Generate a PRD document based on clarification responses",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            }
          },
          required: ["featureId"]
        }
      },
      {
        name: "generate_implementation_plan",
        description: "Generate an implementation plan document",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            }
          },
          required: ["featureId"]
        }
      },
      {
        name: "create_phase",
        description: "Create a new implementation phase",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            },
            name: {
              type: "string",
              description: "Name of the phase"
            },
            description: {
              type: "string",
              description: "Description of the phase"
            },
            tasks: {
              type: "string",
              description: "JSON array of task descriptions"
            }
          },
          required: ["featureId", "name", "description"]
        }
      },
      {
        name: "update_phase_status",
        description: "Update the status of a phase",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string",
              description: "ID of the feature"
            },
            phaseId: {
              type: "string",
              description: "ID of the phase"
            },
            status: {
              type: "string",
              description: "New status (pending, in_progress, completed, reviewed)"
            }
          },
          required: ["featureId", "phaseId", "status"]
        }
      },
      {
        name: "update_task_status",
        description: "Mark a task as completed or not completed",
        inputSchema: {
          type: "object",
          properties: {
            featureId: {
              type: "string", 
              description: "ID of the feature"
            },
            phaseId: {
              type: "string",
              description: "ID of the phase"
            },
            taskIndex: {
              type: "number",
              description: "Index of the task"
            },
            completed: {
              type: "boolean",
              description: "Whether the task is completed"
            }
          },
          required: ["featureId", "phaseId", "taskIndex", "completed"]
        }
      }
    ]
  };
});
```

### Step 7: Prompt Implementation

Create prompts to guide users through the development workflow:

```typescript
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "clarify_feature",
        description: "Guide to clarify a feature request through questioning"
      },
      {
        name: "generate_prd_template",
        description: "Guide to generate a PRD document from clarifications"
      },
      {
        name: "phase_implementation_guide",
        description: "Guide for implementing a development phase"
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "clarify_feature") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Help me clarify this feature request by asking questions about:"
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: "1. The specific problem it solves\n2. The target users\n3. Key requirements\n4. Success criteria\n5. Technical constraints\n\nAsk one question at a time, analyze the response, then proceed to the next most relevant question."
          }
        }
      ]
    };
  }
  
  // Handle other prompts...
});
```

## Helper Functions to Implement

Here are the core helper functions needed for the implementation:

```typescript
// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Format feature details for display
function formatFeatureDetails(feature: Feature): string {
  return `
Feature: ${feature.name}
ID: ${feature.id}
Description: ${feature.description}

Clarification Responses:
${feature.clarificationResponses.map(cr => `Q: ${cr.question}\nA: ${cr.answer}`).join('\n\n')}

Phases (${feature.phases.length}):
${feature.phases.map(p => `- ${p.name} (${p.status}): ${p.tasks.filter(t => t.completed).length}/${p.tasks.length} tasks completed`).join('\n')}
`;
}

// Generate PRD document
function generatePRD(feature: Feature): string {
  const clarifications = feature.clarificationResponses;
  
  return `# ${feature.name} PRD

## 1. Introduction

${feature.description}

## 2. Feature Objectives

${extractObjectivesFromClarifications(clarifications)}

## 3. Scope and Requirements

${extractRequirementsFromClarifications(clarifications)}

## 4. High-Level Implementation Overview

To be determined based on the implementation plan.

## 5. Feedback and Iteration Process

This PRD will be updated as the implementation progresses and feedback is received.
`;
}

// Generate implementation plan
function generateImplementationPlan(feature: Feature): string {
  // Similar to PRD generation, but creating an implementation plan
  // ...
}

// Extract objectives from clarification responses
function extractObjectivesFromClarifications(responses: ClarificationResponse[]): string {
  // Logic to extract objectives based on responses to clarification questions
  // ...
}

// Extract requirements from clarification responses
function extractRequirementsFromClarifications(responses: ClarificationResponse[]): string {
  // Logic to extract requirements based on responses to clarification questions
  // ...
}
```

## File Structure

The implementation will be organized as follows:

```
src/
  ├── index.ts               # Main server entry point
  ├── types.ts               # Type definitions
  ├── storage.ts             # Feature storage management
  ├── clarification.ts       # Clarification workflow logic
  ├── documentation.ts       # PRD and implementation plan generation
  ├── phases.ts              # Phase and task management
  ├── utils.ts               # Helper utilities
  ├── handlers/              # MCP request handlers
  │   ├── resources.ts       # Resource request handlers
  │   ├── tools.ts           # Tool request handlers
  │   └── prompts.ts         # Prompt request handlers
  └── templates/             # Documentation templates
      ├── prd-template.md    # PRD document template
      └── impl-template.md   # Implementation plan template
```

## Implementation Timeline

1. **Week 1**: Set up core server structure and data models
2. **Week 2**: Implement feature clarification workflow
3. **Week 3**: Build PRD and implementation plan generation
4. **Week 4**: Develop phase management functionality
5. **Week 5**: Complete resources and refinements
6. **Week 6**: Testing and documentation

## Next Steps

1. Start by modifying the existing server to match the Vibe-Coder requirements
2. Implement the core data structures and storage
3. Build feature clarification tools and resources
4. Add document generation capabilities
5. Implement phase management tools
6. Complete integration with MCP 