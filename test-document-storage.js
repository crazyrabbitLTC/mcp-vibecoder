#!/usr/bin/env node

/**
 * @file test-document-storage.js
 * 
 * Simple test script for the document storage functionality.
 * Run with: node test-document-storage.js
 */

import { documentStorage, DocumentType } from './build/document-storage.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test feature ID
const featureId = 'test-feature';

/**
 * Check if a file exists
 * @param {string} filePath Path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run document storage tests
 */
async function runTests() {
  console.log('=== Document Storage Test ===\n');
  
  try {
    // Create documents directory if it doesn't exist
    const testDirPath = path.join(process.cwd(), 'documents', featureId);
    try {
      await fs.mkdir(testDirPath, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    // Test 1: Store a PRD document
    console.log('Test 1: Storing PRD document');
    const prdContent = `# Test Feature - PRD\n\nThis is a test PRD document.`;
    const prdDocument = await documentStorage.storeDocument(featureId, DocumentType.PRD, prdContent);
    console.log(`- Document stored in memory: ${Boolean(prdDocument)}`);
    console.log(`- Document metadata:`, prdDocument.metadata);
    console.log(`- Document saved to disk: ${prdDocument.metadata.isSaved}`);
    
    // Test 2: Retrieve the document
    console.log('\nTest 2: Retrieving document');
    const retrievedDoc = documentStorage.getDocument(featureId, DocumentType.PRD);
    console.log(`- Document retrieved: ${Boolean(retrievedDoc)}`);
    console.log(`- Document content preview: ${retrievedDoc?.content.substring(0, 30)}...`);
    
    // Test 3: Save to custom path
    console.log('\nTest 3: Saving to custom path');
    const customPath = path.join(process.cwd(), 'documents', `${featureId}-custom.md`);
    try {
      const savedPath = await documentStorage.saveDocumentToCustomPath(
        featureId, 
        DocumentType.PRD, 
        customPath
      );
      console.log(`- Document saved to custom path: ${savedPath}`);
      
      // Check if the file was created
      const fileExistsResult = await fileExists(customPath);
      console.log(`- Custom file exists: ${fileExistsResult}`);
    } catch (error) {
      console.error(`- Error saving to custom path: ${error.message}`);
    }

    // Test 4: Path validation
    console.log('\nTest 4: Path validation');
    try {
      // Try to save outside the documents directory (should fail)
      const invalidPath = path.join(process.cwd(), '..', 'invalid-path.md');
      await documentStorage.saveDocumentToCustomPath(
        featureId,
        DocumentType.PRD,
        invalidPath
      );
      console.log('- Path validation FAILED: Allowed path outside documents directory');
    } catch (error) {
      console.log(`- Path validation successful: ${error.message}`);
    }
    
    console.log('\n=== Tests completed successfully ===');
  } catch (error) {
    console.error('\nTest failed with error:', error);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 