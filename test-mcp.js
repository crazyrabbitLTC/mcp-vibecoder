#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('Starting Vibe-Coder MCP server...');
// Start the MCP server
const serverProcess = spawn('node', ['./build/index.js']);

// Create readline interface to read server output
const rl = createInterface({
  input: serverProcess.stdout,
  output: process.stdout,
  terminal: false
});

// Set up error handling
serverProcess.stderr.on('data', (data) => {
  console.error(`Server stderr: ${data.toString()}`);
});

// Wait for server to start
setTimeout(() => {
  console.log('Sending initialize request...');
  
  // First, send the initialize request
  const initializeMsg = {
    jsonrpc: "2.0",
    id: "init1",
    method: "initialize",
    params: {
      client: {
        name: "Test Client",
        version: "1.0.0"
      },
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(initializeMsg) + '\n');
  
  // Wait for response and send clarification
  let featureId = null;
  let questionIndex = 0;
  
  rl.on('line', (line) => {
    try {
      console.log('Raw server output:', line);
      const response = JSON.parse(line);
      console.log('Parsed response:', JSON.stringify(response, null, 2));
      
      // After initialization, list available tools
      if (response.id === "init1") {
        console.log('Initialization successful, listing tools...');
        const listToolsMsg = {
          jsonrpc: "2.0",
          id: "list1",
          method: "listTools",
          params: {}
        };
        serverProcess.stdin.write(JSON.stringify(listToolsMsg) + '\n');
      }
      
      // After listing tools, call the start_feature_clarification tool
      if (response.id === "list1") {
        console.log('Tools listed, starting feature clarification...');
        const callToolMsg = {
          jsonrpc: "2.0",
          id: "call1",
          method: "callTool",
          params: {
            name: "start_feature_clarification",
            arguments: {
              featureName: "Test Automated Feature",
              initialDescription: "This is a test automated feature for testing the clarification flow"
            }
          }
        };
        serverProcess.stdin.write(JSON.stringify(callToolMsg) + '\n');
      }
      
      // Check if this is a response to start_feature_clarification
      if (response.id === "call1" && response.result?.content) {
        // Extract feature ID from response text
        const text = response.result.content[0].text;
        const match = text.match(/Feature ID: ([a-z0-9]+)/);
        
        if (match && match[1]) {
          featureId = match[1];
          console.log(`Extracted feature ID: ${featureId}`);
          
          // Send first clarification
          sendClarification(featureId, questionIndex, "This is an answer to question 0");
        }
      }
      
      // Check if this is a response to any of the clarification messages
      if (response.id && response.id.startsWith("clarify") && response.result?.content) {
        const text = response.result.content[0].text;
        console.log('Clarification response text:', text);
        
        // Check if we need to send the next question
        if (text.startsWith("Response recorded.")) {
          questionIndex++;
          if (questionIndex < 7) { // We have 7 default questions
            setTimeout(() => {
              sendClarification(featureId, questionIndex, `This is an answer to question ${questionIndex}`);
            }, 500);
          } else {
            console.log('All questions answered, test complete');
            serverProcess.kill();
            process.exit(0);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing JSON response:', e);
    }
  });
  
  function sendClarification(featureId, index, answer) {
    const clarifyMsg = {
      jsonrpc: "2.0",
      id: `clarify${index}`,
      method: "callTool",
      params: {
        name: "provide_clarification",
        arguments: {
          featureId: featureId,
          question: `Question #${index}`,
          answer: answer
        }
      }
    };
    console.log(`Sending clarification ${index}...`);
    serverProcess.stdin.write(JSON.stringify(clarifyMsg) + '\n');
  }
}, 1000);

// Handle process exit
process.on('exit', () => {
  serverProcess.kill();
}); 