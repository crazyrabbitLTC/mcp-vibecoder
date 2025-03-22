/**
 * @file resource-handlers.ts
 * @version 1.0.0
 * 
 * Provides handlers for resources exposed by the Vibe-Coder MCP Server.
 * These handlers are registered with the resource registry for consistent handling.
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resourceRegistry, ResourceHandler } from './registry.js';
import { Feature } from './types.js';
import { listFeatures, getFeature } from './storage.js';
import { formatClarificationResponses } from './clarification.js';
import { generatePRD, generateImplementationPlan } from './documentation.js';
import { generateFeatureProgressSummary } from './utils.js';
import { ErrorCode, createErrorResponse } from './errors.js';

/**
 * Define resource templates for all resources
 */
const RESOURCE_TEMPLATES = {
  featuresList: new ResourceTemplate('features://list', { list: undefined }),
  featuresStatus: new ResourceTemplate('features://status', { list: undefined }),
  featureDetail: new ResourceTemplate('feature://{featureId}', { list: undefined }),
  featureProgress: new ResourceTemplate('feature://{featureId}/progress', { list: undefined }),
  featurePrd: new ResourceTemplate('feature://{featureId}/prd', { list: undefined }),
  featureImplementation: new ResourceTemplate('feature://{featureId}/implementation', { list: undefined }),
  featurePhases: new ResourceTemplate('feature://{featureId}/phases', { list: undefined }),
  featureTasks: new ResourceTemplate('feature://{featureId}/tasks', { list: undefined }),
  phaseDetail: new ResourceTemplate('feature://{featureId}/phase/{phaseId}', { list: undefined }),
  phaseTasks: new ResourceTemplate('feature://{featureId}/phase/{phaseId}/tasks', { list: undefined }),
  taskDetail: new ResourceTemplate('feature://{featureId}/phase/{phaseId}/task/{taskId}', { list: undefined }),
};

/**
 * Handler for the features list resource
 */
const featuresListHandler: ResourceHandler = async (uri, params) => {
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: listFeatures().map(f => `${f.id}: ${f.name}`).join("\n")
    }]
  };
};

/**
 * Handler for the features status resource
 */
const featuresStatusHandler: ResourceHandler = async (uri, params) => {
  const features = listFeatures();
  
  if (features.length === 0) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: "# Project Status\n\nNo features have been created yet."
      }]
    };
  }
  
  const featuresStatus = features.map(feature => {
    const totalPhases = feature.phases.length;
    const completedPhases = feature.phases.filter(p => p.status === 'completed' || p.status === 'reviewed').length;
    const totalTasks = feature.phases.reduce((acc, phase) => acc + phase.tasks.length, 0);
    const completedTasks = feature.phases.reduce(
      (acc, phase) => acc + phase.tasks.filter(t => t.completed).length, 0
    );
    
    return `## ${feature.name}
- ID: ${feature.id}
- Status: ${completedPhases === totalPhases && totalPhases > 0 ? 'Completed' : 'In Progress'}
- Phases: ${completedPhases}/${totalPhases} completed
- Tasks: ${completedTasks}/${totalTasks} completed
- [View Details](feature://${feature.id}/progress)
`;
  }).join('\n');
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/markdown",
      text: `# Project Status\n\n${featuresStatus}`
    }]
  };
};

/**
 * Handler for the feature detail resource
 */
const featureDetailHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const timestamp = feature.updatedAt.toISOString();
  const clarifications = formatClarificationResponses(feature.clarificationResponses);
  const phasesText = feature.phases.map(p => 
    `- ${p.name} (${p.status}): ${p.tasks.filter(t => t.completed).length}/${p.tasks.length} tasks completed`
  ).join('\n');
  
  const featureDetails = `
Feature: ${feature.name}
ID: ${feature.id}
Description: ${feature.description}
Last Updated: ${timestamp}

Clarification Responses:
${clarifications}

Phases (${feature.phases.length}):
${phasesText}
`;
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: featureDetails
    }]
  };
};

/**
 * Handler for the feature progress resource
 */
const featureProgressHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const progressReport = generateFeatureProgressSummary(feature);
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/markdown",
      text: progressReport
    }]
  };
};

/**
 * Handler for the feature PRD resource
 */
const featurePrdHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const prdContent = feature.prdDoc || generatePRD(feature);
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/markdown",
      text: prdContent
    }]
  };
};

/**
 * Handler for the feature implementation plan resource
 */
const featureImplementationHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const implContent = feature.implDoc || generateImplementationPlan(feature);
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/markdown",
      text: implContent
    }]
  };
};

/**
 * Handler for the feature phases resource
 */
const featurePhasesHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  if (feature.phases.length === 0) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text: `No phases defined for feature: ${feature.name}`
      }]
    };
  }
  
  const phasesContent = feature.phases.map(phase => {
    const completedTasks = phase.tasks.filter(t => t.completed).length;
    const totalTasks = phase.tasks.length;
    return `Phase: ${phase.name} (ID: ${phase.id})
Status: ${phase.status}
Description: ${phase.description}
Progress: ${completedTasks}/${totalTasks} tasks completed
Last Updated: ${phase.updatedAt.toISOString()}
`;
  }).join('\n---\n\n');
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: `# Phases for Feature: ${feature.name}\n\n${phasesContent}`
    }]
  };
};

/**
 * Handler for the feature tasks resource
 */
const featureTasksHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const allTasks = feature.phases.flatMap(phase => 
    phase.tasks.map(task => ({
      ...task,
      phaseName: phase.name,
      phaseId: phase.id,
      phaseStatus: phase.status
    }))
  );
  
  if (allTasks.length === 0) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text: `No tasks defined for feature: ${feature.name}`
      }]
    };
  }
  
  const pendingTasks = allTasks.filter(t => !t.completed);
  const completedTasks = allTasks.filter(t => t.completed);
  
  const pendingTasksText = pendingTasks.length > 0 
    ? pendingTasks.map(task => `- [ ] ${task.description} (ID: ${task.id}, Phase: ${task.phaseName})`).join('\n')
    : "No pending tasks.";
    
  const completedTasksText = completedTasks.length > 0
    ? completedTasks.map(task => `- [x] ${task.description} (ID: ${task.id}, Phase: ${task.phaseName})`).join('\n')
    : "No completed tasks.";
  
  const tasksContent = `# All Tasks for Feature: ${feature.name}

## Pending Tasks (${pendingTasks.length})
${pendingTasksText}

## Completed Tasks (${completedTasks.length})
${completedTasksText}
`;
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: tasksContent
    }]
  };
};

/**
 * Handler for the phase detail resource
 */
const phaseDetailHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const phaseId = params.phaseId;
  
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const phase = feature.phases.find(p => p.id === phaseId);
  
  if (!phase) {
    return createErrorResponse(ErrorCode.PHASE_NOT_FOUND, `Phase ${phaseId} not found in feature ${feature.name}`);
  }
  
  const completedTasks = phase.tasks.filter(t => t.completed).length;
  const totalTasks = phase.tasks.length;
  
  const taskList = phase.tasks.map(task => 
    `- [${task.completed ? 'x' : ' '}] ${task.description} (ID: ${task.id})`
  ).join('\n');
  
  const phaseDetails = `
Phase: ${phase.name}
ID: ${phase.id}
Status: ${phase.status}
Description: ${phase.description}
Created: ${phase.createdAt.toISOString()}
Last Updated: ${phase.updatedAt.toISOString()}
Progress: ${completedTasks}/${totalTasks} tasks completed

Tasks:
${taskList}
`;
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: phaseDetails
    }]
  };
};

/**
 * Handler for the phase tasks resource
 */
const phaseTasksHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const phaseId = params.phaseId;
  
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const phase = feature.phases.find(p => p.id === phaseId);
  
  if (!phase) {
    return createErrorResponse(ErrorCode.PHASE_NOT_FOUND, `Phase ${phaseId} not found in feature ${feature.name}`);
  }
  
  if (phase.tasks.length === 0) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text: `No tasks defined for phase: ${phase.name}`
      }]
    };
  }
  
  const tasksContent = phase.tasks.map(task => `
Task: ${task.description}
ID: ${task.id}
Status: ${task.completed ? 'Completed' : 'Pending'}
Created: ${task.createdAt.toISOString()}
Last Updated: ${task.updatedAt.toISOString()}
`).join('\n---\n');
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: `# Tasks for Phase: ${phase.name}\n\n${tasksContent}`
    }]
  };
};

/**
 * Handler for the task detail resource
 */
const taskDetailHandler: ResourceHandler = async (uri, params) => {
  const featureId = params.featureId;
  const phaseId = params.phaseId;
  const taskId = params.taskId;
  
  const feature = getFeature(featureId);
  
  if (!feature) {
    return createErrorResponse(ErrorCode.FEATURE_NOT_FOUND, `Feature ${featureId} not found`);
  }
  
  const phase = feature.phases.find(p => p.id === phaseId);
  
  if (!phase) {
    return createErrorResponse(ErrorCode.PHASE_NOT_FOUND, `Phase ${phaseId} not found in feature ${feature.name}`);
  }
  
  const task = phase.tasks.find(t => t.id === taskId);
  
  if (!task) {
    return createErrorResponse(ErrorCode.TASK_NOT_FOUND, `Task ${taskId} not found in phase ${phase.name}`);
  }
  
  const taskDetails = `
Task: ${task.description}
ID: ${task.id}
Status: ${task.completed ? 'Completed' : 'Pending'}
Created: ${task.createdAt.toISOString()}
Last Updated: ${task.updatedAt.toISOString()}
`;
  
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: taskDetails
    }]
  };
};

/**
 * Register all resource handlers
 */
export function registerResourceHandlers() {
  resourceRegistry.register(RESOURCE_TEMPLATES.featuresList, featuresListHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featuresStatus, featuresStatusHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featureDetail, featureDetailHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featureProgress, featureProgressHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featurePrd, featurePrdHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featureImplementation, featureImplementationHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featurePhases, featurePhasesHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.featureTasks, featureTasksHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.phaseDetail, phaseDetailHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.phaseTasks, phaseTasksHandler);
  resourceRegistry.register(RESOURCE_TEMPLATES.taskDetail, taskDetailHandler);
}

// Export individual handlers for testing or direct usage
export {
  featuresListHandler,
  featuresStatusHandler,
  featureDetailHandler,
  featureProgressHandler,
  featurePrdHandler,
  featureImplementationHandler,
  featurePhasesHandler,
  featureTasksHandler,
  phaseDetailHandler,
  phaseTasksHandler,
  taskDetailHandler
}; 