/**
 * @file document-storage.ts
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2023-03-23
 * 
 * Document storage module for Vibe-Coder MCP Server.
 * Provides both in-memory and file-based storage for documents
 * generated during the feature development process.
 * 
 * IMPORTANT:
 * - Path validation is critical for security
 * - All file operations must be properly error-handled
 * - Document metadata must be maintained consistently
 * 
 * Functionality:
 * - Store documents in memory and file system
 * - Retrieve documents from storage
 * - Path resolution and validation
 * - Error handling for file operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Feature } from './types.js';

/**
 * Document types that can be stored
 */
export enum DocumentType {
  PRD = 'prd',
  IMPLEMENTATION_PLAN = 'implementation-plan'
}

/**
 * Document storage options
 */
export interface DocumentStorageOptions {
  /** Root directory for document storage */
  rootDir: string;
  /** Whether to automatically save documents to files */
  autoSave: boolean;
  /** Whether to create directories if they don't exist */
  createDirs: boolean;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Document type */
  type: DocumentType;
  /** Feature ID this document belongs to */
  featureId: string;
  /** Timestamp when the document was generated */
  generatedAt: Date;
  /** Path to the file, if saved */
  filePath?: string;
  /** Whether the document has been saved to a file */
  isSaved: boolean;
}

/**
 * Document with its content and metadata
 */
export interface Document {
  /** Document content */
  content: string;
  /** Document metadata */
  metadata: DocumentMetadata;
}

/**
 * Default document storage options
 */
const DEFAULT_OPTIONS: DocumentStorageOptions = {
  rootDir: path.join(process.cwd(), 'documents'),
  autoSave: true,
  createDirs: true
};

/**
 * Document storage class
 */
export class DocumentStorage {
  private options: DocumentStorageOptions;
  private documents: Map<string, Document> = new Map();

  /**
   * Create a new document storage instance
   * @param options Storage options
   */
  constructor(options: Partial<DocumentStorageOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a document key
   * @param featureId Feature ID
   * @param type Document type
   * @returns Document key
   */
  private getDocumentKey(featureId: string, type: DocumentType): string {
    return `${featureId}:${type}`;
  }

  /**
   * Generate a file path for a document
   * @param featureId Feature ID
   * @param type Document type
   * @returns File path
   */
  private getDocumentPath(featureId: string, type: DocumentType): string {
    const featureDir = path.join(this.options.rootDir, featureId);
    const filename = `${type}.md`;
    return path.join(featureDir, filename);
  }

  /**
   * Validate a file path to prevent directory traversal attacks
   * @param filePath File path to validate
   * @returns Normalized file path if valid, throws an error otherwise
   */
  private validatePath(filePath: string): string {
    // Normalize the path to resolve .. and . segments
    const normalizedPath = path.normalize(filePath);
    
    // Convert both paths to absolute paths for comparison
    const absolutePath = path.isAbsolute(normalizedPath) 
      ? normalizedPath 
      : path.join(process.cwd(), normalizedPath);
    
    const rootDir = path.isAbsolute(this.options.rootDir)
      ? this.options.rootDir
      : path.join(process.cwd(), this.options.rootDir);
    
    // Check if the path is outside the root directory
    if (!absolutePath.startsWith(rootDir)) {
      throw new Error(`Invalid file path: Path must be within ${rootDir}`);
    }
    
    return normalizedPath;
  }

  /**
   * Validate a custom file path provided by a client
   * @param filePath File path to validate
   * @returns Normalized file path if valid, throws an error otherwise
   */
  public validateCustomPath(filePath: string): string {
    // First validate that it's within the root directory
    const normalizedPath = this.validatePath(filePath);
    
    // Additional validation for custom paths
    if (path.extname(normalizedPath) !== '.md') {
      throw new Error('Invalid file path: File must have .md extension');
    }
    
    return normalizedPath;
  }

  /**
   * Ensure directory exists, creating it if necessary and allowed
   * @param dirPath Directory path
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (this.options.createDirs) {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }
    }
  }

  /**
   * Store a document
   * @param featureId Feature ID
   * @param type Document type
   * @param content Document content
   * @param autoSave Whether to automatically save the document to a file
   * @returns Stored document
   */
  public async storeDocument(
    featureId: string, 
    type: DocumentType, 
    content: string,
    autoSave: boolean = this.options.autoSave
  ): Promise<Document> {
    const key = this.getDocumentKey(featureId, type);
    const filePath = this.getDocumentPath(featureId, type);
    
    const metadata: DocumentMetadata = {
      type,
      featureId,
      generatedAt: new Date(),
      filePath,
      isSaved: false
    };
    
    const document: Document = {
      content,
      metadata
    };
    
    this.documents.set(key, document);
    
    if (autoSave) {
      try {
        await this.saveDocumentToFile(featureId, type);
      } catch (error) {
        console.error(`Failed to auto-save document: ${error}`);
        // Note that we still store the document in memory even if file save fails
      }
    }
    
    return document;
  }

  /**
   * Get a document
   * @param featureId Feature ID
   * @param type Document type
   * @returns Document or undefined if not found
   */
  public getDocument(featureId: string, type: DocumentType): Document | undefined {
    const key = this.getDocumentKey(featureId, type);
    return this.documents.get(key);
  }

  /**
   * Check if a document exists
   * @param featureId Feature ID
   * @param type Document type
   * @returns True if the document exists
   */
  public hasDocument(featureId: string, type: DocumentType): boolean {
    const key = this.getDocumentKey(featureId, type);
    return this.documents.has(key);
  }

  /**
   * Save a document to a file using its default path
   * @param featureId Feature ID
   * @param type Document type
   * @returns Path to the saved file
   */
  public async saveDocumentToFile(featureId: string, type: DocumentType): Promise<string> {
    const document = this.getDocument(featureId, type);
    
    if (!document) {
      throw new Error(`Document not found: ${featureId}:${type}`);
    }
    
    const filePath = document.metadata.filePath!;
    const dirPath = path.dirname(filePath);
    
    await this.ensureDir(dirPath);
    await fs.writeFile(filePath, document.content, 'utf-8');
    
    // Update metadata
    document.metadata.isSaved = true;
    
    return filePath;
  }

  /**
   * Save a document to a custom file path
   * @param featureId Feature ID
   * @param type Document type
   * @param customPath Custom file path
   * @returns Path to the saved file
   */
  public async saveDocumentToCustomPath(
    featureId: string, 
    type: DocumentType, 
    customPath: string
  ): Promise<string> {
    const document = this.getDocument(featureId, type);
    
    if (!document) {
      throw new Error(`Document not found: ${featureId}:${type}`);
    }
    
    const validatedPath = this.validateCustomPath(customPath);
    const dirPath = path.dirname(validatedPath);
    
    await this.ensureDir(dirPath);
    await fs.writeFile(validatedPath, document.content, 'utf-8');
    
    // Don't update metadata.filePath as we want to keep the default path
    // Just mark it as saved
    document.metadata.isSaved = true;
    
    return validatedPath;
  }

  /**
   * Get the default file path for a document
   * @param featureId Feature ID
   * @param type Document type
   * @returns Default file path
   */
  public getDefaultFilePath(featureId: string, type: DocumentType): string {
    return this.getDocumentPath(featureId, type);
  }
}

// Create a singleton instance
export const documentStorage = new DocumentStorage(); 