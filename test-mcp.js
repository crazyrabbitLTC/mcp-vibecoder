#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

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
  console.log('Sending start_feature_clarification request...');
  
  // MCP message to start a feature
  const startFeatureMsg = {
    id: "msg1",
    jsonrpc: "2.0",
    method: "callTool",
    params: {
      name: "start_feature_clarification",
      arguments: {
        featureName: "Test Feature",
        initialDescription: "This is a test feature"
      }
    }
  };
  
  // Send the message to the server
  serverProcess.stdin.write(JSON.stringify(startFeatureMsg) + '\n');
  
  // Wait for response and send clarification
  let featureId = null;
  
  rl.on('line', (line) => {
    try {
      const response = JSON.parse(line);
      console.log('Received response:', JSON.stringify(response, null, 2));
      
      // Check if this is a response to start_feature_clarification
      if (response.id === "msg1" && response.result?.content) {
        // Extract feature ID from response text
        const text = response.result.content[0].text;
        const match = text.match(/Feature ID: ([a-z0-9]+)/);
        
        if (match && match[1]) {
          featureId = match[1];
          console.log(`Extracted feature ID: ${featureId}`);
          
          // Send first clarification
          const clarifyMsg = {
            id: "msg2",
            jsonrpc: "2.0",
            method: "callTool",
            params: {
              name: "provide_clarification",
              arguments: {
                featureId: featureId,
                question: "What specific problem does this feature solve?", 
                answer: "This is a test answer for the first question."
              }
            }
          };
          
          setTimeout(() => {
            console.log('Sending first clarification...');
            serverProcess.stdin.write(JSON.stringify(clarifyMsg) + '\n');
          }, 500);
        }
      }
      
      // Check if this is a response to provide_clarification
      if (response.id === "msg2" && response.result?.content) {
        const text = response.result.content[0].text;
        console.log('Clarification response text:', text);
        
        // Send second clarification with next question
        if (featureId) {
          const clarifyMsg2 = {
            id: "msg3",
            jsonrpc: "2.0",
            method: "callTool",
            params: {
              name: "provide_clarification",
              arguments: {
                featureId: featureId,
                question: "Who are the target users for this feature?",
                answer: "This is a test answer for the second question."
              }
            }
          };
          
          setTimeout(() => {
            console.log('Sending second clarification...');
            serverProcess.stdin.write(JSON.stringify(clarifyMsg2) + '\n');
          }, 500);
        }
      }
      
      // After receiving the second clarification response, exit
      if (response.id === "msg3") {
        console.log('Test complete, shutting down...');
        serverProcess.kill();
        process.exit(0);
      }
    } catch (e) {
      console.error('Error parsing JSON response:', e);
    }
  });
}, 1000);

// Handle process exit
process.on('exit', () => {
  serverProcess.kill();
}); 