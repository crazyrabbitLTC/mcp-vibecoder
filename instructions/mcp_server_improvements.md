# Implementation Plan: MCP Server Improvements

## Phase 1: Critical Fixes (High Priority)

### Task 1: Fix Resource Registry Import
- [x] Update `index-updated.ts` to import `resourceRegistry` at the top of the file
- [x] Remove the `require` call from the `ReadResourceRequestSchema` handler
- [x] Test the handler to ensure it works properly with the imported registry

### Task 2: Improve Error Handling
- [x] Modify `documentation.ts` to throw proper errors when template loading fails
- [x] Update `clarification.ts` to throw specific errors and return completion objects
- [x] Add try/catch blocks where necessary to handle these new errors properly
- [ ] Test the error handling with invalid inputs

## Phase 2: Architecture Improvements (Medium Priority)

### Task 1: Enhance Tool Registry with Metadata
- [x] Modify the `ToolRegistry` class in `registry.ts` to store and manage tool metadata
- [x] Add `listTools()` method to return all registered tools with their metadata
- [x] Update the `register` method to accept description and input schema
- [x] Modify `index-updated.ts` to use `toolRegistry.listTools()` in the handler

### Task 2: Implement Self-Registration Pattern
- [ ] Create a new file `tool-registry.ts` to define the tool registration process
- [ ] Modify each tool handler file to self-register on import
- [ ] Remove the centralized `registerToolHandlers` function
- [ ] Repeat the same pattern for resource handlers
- [ ] Test that all tools and resources are properly registered

## Phase 3: Enhance Testing Framework (Medium Priority)

### Task 1: Set Up Jest Testing Framework
- [ ] Install Jest and related dependencies
- [ ] Configure Jest for TypeScript testing
- [ ] Create a basic test setup file with server startup/shutdown

### Task 2: Migrate Existing Tests to Jest
- [ ] Convert the `test-mcp-improved.js` to use Jest's test structure
- [ ] Replace timeouts with proper async/await and promises
- [ ] Add assertions to verify responses

### Task 3: Add Comprehensive Tests
- [ ] Add tests for error cases and edge conditions
- [ ] Test URI matching with various patterns
- [ ] Test tool execution with valid and invalid inputs
- [ ] Test resource handling with various URIs

## Phase 4: Additional Improvements (Lower Priority)

### Task 1: Implement Better Templating
- [ ] Research and select an appropriate templating engine
- [ ] Update `documentation.ts` to use the selected templating engine
- [ ] Create improved templates with proper variable handling

### Task 2: Ensure Consistent Code Style
- [ ] Apply consistent naming conventions throughout the codebase
- [ ] Add JSDoc comments to all functions and classes
- [ ] Set up a code formatter like Prettier

## Implementation Steps

### For Phase 1:
1. Fix Resource Registry Import: ✅
   ```typescript
   // At the top of index-updated.ts
   import { toolRegistry, resourceRegistry } from './registry.js';
   
   // In the ReadResourceRequestSchema handler
   const match = resourceRegistry.findMatch(uri);
   ```

2. Improve Error Handling: ✅
   ```typescript
   // In documentation.ts
   function loadTemplate(templateName: string): string {
     try {
       return fs.readFileSync(templatePath, 'utf-8');
     } catch (error) {
       throw new Error(`Failed to load template ${templateName}: ${error}`);
     }
   }
   
   // In clarification.ts
   export function getNextClarificationQuestion(feature: Feature): string | { done: true } {
     if (!feature.clarificationResponses) {
       throw new Error(`Feature is missing clarificationResponses array: ${feature.id}`);
     }
     
     if (feature.clarificationResponses.length >= DEFAULT_CLARIFICATION_QUESTIONS.length) {
       return { done: true };
     }
     
     return DEFAULT_CLARIFICATION_QUESTIONS[feature.clarificationResponses.length];
   }
   ```

### For Phase 2:
1. Enhance Tool Registry: ✅
   ```typescript
   // In registry.ts
   export class ToolRegistry {
     private handlers: Map<string, ToolHandler> = new Map();
     private toolMetadata: Map<string, { description: string; inputSchema: any }> = new Map();
   
     register<T>(
       name: string,
       handler: ToolHandler<T>,
       description: string,
       inputSchema: any
     ): void {
       this.handlers.set(name, handler);
       this.toolMetadata.set(name, { description, inputSchema });
     }
   
     // ... existing methods ...
   
     listTools(): { name: string; description: string; inputSchema: any }[] {
       return Array.from(this.handlers.keys()).map((name) => {
         const metadata = this.toolMetadata.get(name);
         return {
           name,
           description: metadata?.description || "No description provided.",
           inputSchema: metadata?.inputSchema || {},
         };
       });
     }
   }
   
   // In index-updated.ts
   server.setRequestHandler(ListToolsRequestSchema, async () => {
     return {
       tools: toolRegistry.listTools(),
     };
   });
   ```

## Timeline and Dependencies

1. Phase 1 (1-2 days): ✅
   - Resource registry fix: 0.5 day ✅
   - Error handling improvements: 1-1.5 days ✅
   - No dependencies

2. Phase 2 (2-3 days): 🔄
   - Tool registry enhancements: 1-1.5 days ✅
   - Self-registration pattern: 1-1.5 days 🔄
   - Depends on Phase 1 completion ✅ 