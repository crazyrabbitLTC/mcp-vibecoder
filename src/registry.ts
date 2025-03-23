/**
 * @file registry.ts
 * @version 1.1.0
 * 
 * Provides registries for tools and resources in the Vibe-Coder MCP Server.
 * These registries manage URI templates, matching, and tool handlers.
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, createErrorResponse, createToolErrorResponse } from './errors.js';
import { Feature } from './types.js';

// --------- Tool Registry ---------

/**
 * Type for tool handler function
 */
export type ToolHandler<T = any> = (params: T) => Promise<any>;

/**
 * Tool metadata type
 */
export interface ToolMetadata {
  description: string;
  inputSchema: any;
  examples?: any[];
}

/**
 * Tool registry to map tool names to their handler functions and metadata
 */
export class ToolRegistry {
  private handlers: Map<string, ToolHandler> = new Map();
  private toolMetadata: Map<string, ToolMetadata> = new Map();
  
  /**
   * Register a tool handler with metadata
   * @param name Tool name
   * @param handler Tool handler function
   * @param description Tool description
   * @param inputSchema Tool input schema
   * @param examples Optional examples for the tool
   */
  register<T>(
    name: string, 
    handler: ToolHandler<T>, 
    description: string, 
    inputSchema: any,
    examples?: any[]
  ): void {
    this.handlers.set(name, handler);
    this.toolMetadata.set(name, { 
      description, 
      inputSchema,
      examples 
    });
  }
  
  /**
   * Get a tool handler by name
   * @param name Tool name
   * @returns The tool handler function or undefined if not found
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }
  
  /**
   * Get tool metadata by name
   * @param name Tool name
   * @returns The tool metadata or undefined if not found
   */
  getMetadata(name: string): ToolMetadata | undefined {
    return this.toolMetadata.get(name);
  }
  
  /**
   * Check if a tool exists
   * @param name Tool name
   * @returns True if the tool exists
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }
  
  /**
   * Execute a tool by name with parameters
   * @param name Tool name
   * @param params Tool parameters
   * @returns The tool execution result
   */
  async execute(name: string, params: any): Promise<any> {
    const handler = this.getHandler(name);
    
    if (!handler) {
      return createToolErrorResponse(`Unknown tool "${name}"`);
    }
    
    try {
      return await handler(params);
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return createToolErrorResponse(
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  }
  
  /**
   * List all registered tools with their metadata
   * @returns Array of tool information objects
   */
  listTools(): { name: string; description: string; inputSchema: any; examples?: any[] }[] {
    return Array.from(this.handlers.keys()).map((name) => {
      const metadata = this.toolMetadata.get(name);
      return {
        name,
        description: metadata?.description || "No description provided",
        inputSchema: metadata?.inputSchema || {},
        examples: metadata?.examples
      };
    });
  }
}

// --------- Resource Registry ---------

/**
 * Resource handler type
 */
export type ResourceHandler = (uri: URL, params: Record<string, string>) => Promise<any>;

/**
 * Resource registry entry
 */
type ResourceRegistryEntry = {
  template: ResourceTemplate;
  handler: ResourceHandler;
};

/**
 * Resource registry for managing URI templates and handlers
 */
export class ResourceRegistry {
  private resources: ResourceRegistryEntry[] = [];
  
  /**
   * Register a resource with a template and handler
   */
  register(template: ResourceTemplate, handler: ResourceHandler): void {
    this.resources.push({ template, handler });
  }
  
  /**
   * Find a matching resource and extract parameters
   */
  findMatch(uri: string): { handler: ResourceHandler; params: Record<string, string> } | undefined {
    const url = new URL(uri);
    
    for (const { template, handler } of this.resources) {
      const match = this.matchTemplate(url, template);
      
      if (match) {
        return { handler, params: match };
      }
    }
    
    return undefined;
  }
  
  /**
   * Match a URL against a template and extract parameters
   */
  private matchTemplate(url: URL, template: ResourceTemplate): Record<string, string> | undefined {
    // Convert template to regex pattern
    const pattern = this.templateToPattern(template.pattern);
    const regex = new RegExp(pattern.pattern);
    
    // Match against the full URL
    const match = regex.exec(url.href);
    
    if (!match) {
      return undefined;
    }
    
    // Extract named parameters
    const params: Record<string, string> = {};
    
    pattern.paramNames.forEach((name, index) => {
      params[name] = match[index + 1] || '';
    });
    
    return params;
  }
  
  /**
   * Convert a URI template to a regex pattern
   * Handles {param} syntax in templates
   */
  private templateToPattern(template: string): { pattern: string; paramNames: string[] } {
    const paramNames: string[] = [];
    let pattern = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace {param} with capture groups
    pattern = pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    // Replace * with wildcard
    pattern = pattern.replace(/\\\*/g, '.*');
    
    // Anchor to start of string
    pattern = `^${pattern}$`;
    
    return { pattern, paramNames };
  }
  
  /**
   * List all registered resources
   * @returns Array of resource templates
   */
  listResources(): { template: string }[] {
    return this.resources.map(({ template }) => ({
      template: template.pattern
    }));
  }
}

// Create global instances
export const toolRegistry = new ToolRegistry();
export const resourceRegistry = new ResourceRegistry(); 