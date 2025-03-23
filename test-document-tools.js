#!/usr/bin/env bun

// Import the necessary modules from our codebase
import { createFeatureObject } from './build/utils.js';
import { storeFeature } from './build/storage.js';
import { addClarificationResponse } from './build/clarification.js';
import { generatePRD, generateImplementationPlan } from './build/documentation.js';
import { documentStorage, DocumentType } from './build/document-storage.js';

// Function to create a test feature with some clarification responses
async function createTestFeature() {
  console.log('Creating test feature...');
  
  // Create a new feature
  const feature = createFeatureObject(
    'Test Document Tools', 
    'A feature to test document storage tools'
  );
  
  // Store the feature first
  storeFeature(feature);
  
  // Add some clarification responses
  addClarificationResponse(feature.id, 
    'What specific problem does this feature solve?',
    'Testing document tools after fixing enum serialization issues'
  );
  
  addClarificationResponse(feature.id,
    'Who are the target users for this feature?',
    'Developers who need to use document storage tools'
  );
  
  addClarificationResponse(feature.id,
    'What are the key requirements for this feature?',
    'Both sets of document tools must work correctly'
  );
  
  addClarificationResponse(feature.id,
    'What are the technical constraints or considerations?',
    'Must work with various MCP clients'
  );
  
  addClarificationResponse(feature.id,
    'How will we measure the success of this feature?',
    'All document tools work correctly'
  );
  
  addClarificationResponse(feature.id,
    'Are there any dependencies on other features or systems?',
    'Document storage system'
  );
  
  addClarificationResponse(feature.id,
    'What are the potential risks or challenges in implementing this feature?',
    'Enum serialization issues with MCP'
  );
  
  // Generate documents
  const prd = await generatePRD(feature);
  console.log('Generated PRD');
  
  const implementationPlan = await generateImplementationPlan(feature);
  console.log('Generated Implementation Plan');
  
  return feature;
}

// Function to test the document_path_simple tool logic
async function testDocumentPathSimple(feature) {
  console.log('\nTesting document_path_simple tool logic...');
  
  try {
    // Map string to DocumentType enum
    const documentType = 'prd';
    let docType;
    
    if (documentType === 'prd') {
      docType = DocumentType.PRD;
    } else if (documentType === 'implementation-plan') {
      docType = DocumentType.IMPLEMENTATION_PLAN;
    } else {
      throw new Error(`Invalid document type: ${documentType}`);
    }
    
    // Check if the document exists
    if (!documentStorage.hasDocument(feature.id, docType)) {
      throw new Error(`Document of type ${documentType} not found for feature ${feature.id}`);
    }
    
    // Get the default file path for the document
    const filePath = documentStorage.getDefaultFilePath(feature.id, docType);
    
    // Get the document to check if it's been saved
    const document = documentStorage.getDocument(feature.id, docType);
    
    console.log(`Document path: ${filePath}`);
    console.log(`Saved to disk: ${document?.metadata.isSaved ? 'Yes' : 'No'}`);
    
    return {
      filePath,
      isSaved: document?.metadata.isSaved
    };
  } catch (error) {
    console.error(`Error in document_path_simple: ${error.message}`);
    return null;
  }
}

// Function to test the document_save_simple tool logic
async function testDocumentSaveSimple(feature, customPath = null) {
  console.log('\nTesting document_save_simple tool logic...');
  
  try {
    // Map string to DocumentType enum
    const documentType = 'prd';
    let docType;
    
    if (documentType === 'prd') {
      docType = DocumentType.PRD;
    } else if (documentType === 'implementation-plan') {
      docType = DocumentType.IMPLEMENTATION_PLAN;
    } else {
      throw new Error(`Invalid document type: ${documentType}`);
    }
    
    // Check if the document exists
    if (!documentStorage.hasDocument(feature.id, docType)) {
      throw new Error(`Document of type ${documentType} not found for feature ${feature.id}`);
    }
    
    let savedPath;
    
    // If a custom path was provided, use it; otherwise, save to the default path
    if (customPath) {
      savedPath = await documentStorage.saveDocumentToCustomPath(feature.id, docType, customPath);
    } else {
      savedPath = await documentStorage.saveDocumentToFile(feature.id, docType);
    }
    
    console.log(`Document saved successfully to: ${savedPath}`);
    
    return savedPath;
  } catch (error) {
    console.error(`Error in document_save_simple: ${error.message}`);
    return null;
  }
}

// Main function to run all tests
async function main() {
  try {
    console.log('=== Document Tools Test ===');
    
    // Create a test feature and generate documents
    const feature = await createTestFeature();
    console.log(`Feature created with ID: ${feature.id}`);
    
    // Test document_path_simple tool logic
    const pathResult = await testDocumentPathSimple(feature);
    
    // Test document_save_simple tool logic
    const saveResult = await testDocumentSaveSimple(feature);
    
    // Test with a custom path
    const customPath = `./documents/test-document-tools-${Date.now()}.md`;
    const customSaveResult = await testDocumentSaveSimple(feature, customPath);
    
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Feature ID: ${feature.id}`);
    console.log(`Document path: ${pathResult?.filePath || 'Error'}`);
    console.log(`Document saved to default path: ${saveResult || 'Error'}`);
    console.log(`Document saved to custom path: ${customSaveResult || 'Error'}`);
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the main function
main().catch(console.error); 