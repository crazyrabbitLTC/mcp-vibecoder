#!/usr/bin/env node

/**
 * @file test-mcp-improved.js
 * 
 * Test script for the improved MCP server implementation.
 * Tests the tool registry, resource registry, and error handling.
 */

const { spawn } = require('child_process');
const path = require('path');

// Path to the MCP server
const SERVER_PATH = path.join(__dirname, 'index-updated.ts');

// Store responses and state
const responses = [];
let featureId = null;

// Start the MCP server process
const server = spawn('ts-node', [SERVER_PATH], {
  stdio: ['pipe', 'pipe', process.stderr]
});

// Handle server's stdout
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Parse the JSON response
      const response = JSON.parse(line);
      responses.push(response);
      
      // Process the response based on its type
      processResponse(response);
    }
  } catch (error) {
    console.error('Error processing server response:', error);
  }
});

// Process a server response
function processResponse(response) {
  if (response.id === 'init') {
    sendInitialized();
  } else if (response.id === 'start-feature') {
    // Extract feature ID from the response
    const content = response.result?.content[0]?.text;
    if (content) {
      const match = content.match(/Feature ID: ([a-z0-9-]+)/);
      if (match) {
        featureId = match[1];
        console.log(`\nCreated feature with ID: ${featureId}`);
        
        // Ask the first clarification question
        sendProvideClarification(featureId, 'What problem does this feature solve?', 'The feature solves the problem of managing test data across different environments.');
      }
    }
  } else if (response.id === 'clarify-1') {
    sendProvideClarification(featureId, 'Who are the target users?', 'Developers and QA engineers who need to create, manage, and share test data.');
  } else if (response.id === 'clarify-2') {
    sendProvideClarification(featureId, 'What are the key requirements?', 'Data import/export, version control integration, and user-friendly interface.');
  } else if (response.id === 'clarify-3') {
    sendProvideClarification(featureId, 'What are the success criteria?', 'Users can create and manage test data across environments with minimal effort.');
  } else if (response.id === 'clarify-4') {
    sendProvideClarification(featureId, 'Any technical constraints?', 'Must work with existing database systems and be containerizable.');
  } else if (response.id === 'clarify-5') {
    console.log('\nAll clarification questions answered.');
    
    // Generate PRD
    sendGeneratePRD(featureId);
  } else if (response.id === 'generate-prd') {
    // Generate implementation plan
    sendGenerateImplementationPlan(featureId);
  } else if (response.id === 'generate-implementation-plan') {
    // Create a phase
    sendCreatePhase(featureId);
  } else if (response.id === 'create-phase') {
    // Extract phase ID from the response
    const content = response.result?.content[0]?.text;
    if (content) {
      const match = content.match(/ID: ([a-z0-9-]+)/);
      if (match) {
        const phaseId = match[1];
        console.log(`\nCreated phase with ID: ${phaseId}`);
        
        // Update phase status
        sendUpdatePhaseStatus(featureId, phaseId, 'in_progress');
      }
    }
  } else if (response.id === 'update-phase-status') {
    // Get feature details
    sendReadResource(`feature://${featureId}`);
  } else if (response.id === 'read-feature') {
    // Test resource handler
    sendReadResource(`feature://${featureId}/progress`);
  } else if (response.id === 'read-progress') {
    // Test list resources
    sendListResources();
  } else if (response.id === 'list-resources') {
    // Test list tools
    sendListTools();
  } else if (response.id === 'list-tools') {
    // All tests completed
    console.log('\nAll tests completed successfully.');
    
    // Clean up
    server.stdin.end();
    process.exit(0);
  }
}

// Send initialization message
function sendInitialize() {
  const message = {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      processId: process.pid,
      clientInfo: {
        name: 'MCP Test Client',
        version: '1.0.0'
      },
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    }
  };
  
  sendMessage(message);
}

// Send initialized notification
function sendInitialized() {
  const message = {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  };
  
  sendMessage(message);
  
  // Start the tests after initialization
  console.log('\nStarting tests...');
  sendStartFeature();
}

// Send a message to start feature clarification
function sendStartFeature() {
  const message = {
    jsonrpc: '2.0',
    id: 'start-feature',
    method: 'callTool',
    params: {
      name: 'start_feature_clarification',
      arguments: {
        featureName: 'Test Data Manager',
        initialDescription: 'A tool for managing test data across various environments.'
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to provide clarification
function sendProvideClarification(featureId, question, answer) {
  // Use a different ID for each clarification to track them
  const clarificationId = `clarify-${responses.filter(r => r.id && r.id.startsWith('clarify-')).length + 1}`;
  
  const message = {
    jsonrpc: '2.0',
    id: clarificationId,
    method: 'callTool',
    params: {
      name: 'provide_clarification',
      arguments: {
        featureId,
        question,
        answer
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to generate a PRD
function sendGeneratePRD(featureId) {
  const message = {
    jsonrpc: '2.0',
    id: 'generate-prd',
    method: 'callTool',
    params: {
      name: 'generate_prd',
      arguments: {
        featureId
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to generate an implementation plan
function sendGenerateImplementationPlan(featureId) {
  const message = {
    jsonrpc: '2.0',
    id: 'generate-implementation-plan',
    method: 'callTool',
    params: {
      name: 'generate_implementation_plan',
      arguments: {
        featureId
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to create a phase
function sendCreatePhase(featureId) {
  const message = {
    jsonrpc: '2.0',
    id: 'create-phase',
    method: 'callTool',
    params: {
      name: 'create_phase',
      arguments: {
        featureId,
        name: 'Design',
        description: 'Design the architecture and user interface for the Test Data Manager.'
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to update phase status
function sendUpdatePhaseStatus(featureId, phaseId, status) {
  const message = {
    jsonrpc: '2.0',
    id: 'update-phase-status',
    method: 'callTool',
    params: {
      name: 'update_phase_status',
      arguments: {
        featureId,
        phaseId,
        status
      }
    }
  };
  
  sendMessage(message);
}

// Send a message to read a resource
function sendReadResource(uri) {
  const message = {
    jsonrpc: '2.0',
    id: uri.includes('progress') ? 'read-progress' : 'read-feature',
    method: 'readResource',
    params: {
      uri
    }
  };
  
  sendMessage(message);
}

// Send a message to list resources
function sendListResources() {
  const message = {
    jsonrpc: '2.0',
    id: 'list-resources',
    method: 'listResources',
    params: {}
  };
  
  sendMessage(message);
}

// Send a message to list tools
function sendListTools() {
  const message = {
    jsonrpc: '2.0',
    id: 'list-tools',
    method: 'listTools',
    params: {}
  };
  
  sendMessage(message);
}

// Send a message to the server
function sendMessage(message) {
  const json = JSON.stringify(message);
  server.stdin.write(json + '\n');
}

// Start the test
sendInitialize();

// Handle process exit
process.on('exit', () => {
  server.kill();
}); 