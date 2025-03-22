# Implementation Plan for MCP SDK Improvements

## 1. Replace Switch Statement with Tool Handler Map

### Tasks:
- [x] Create a tool handler type definition in `types.ts`
- [x] Create a tools registry object that maps tool names to handler functions
- [x] Refactor the `CallToolRequestSchema` handler to use this registry
- [x] Add validation and error handling for unknown tools
- [x] Update tool registration to automatically populate the registry
- [ ] Test all tools to ensure functionality remains the same

## 2. Implement Robust URI Parsing

### Tasks:
- [x] Create a `ResourceRegistry` class that handles URI templates and matching
- [x] Update resource definitions to use proper URI templates
- [x] Implement pattern matching for incoming resource URIs
- [x] Refactor `ReadResourceRequestSchema` handler to use the registry
- [x] Add validation and error handling for malformed URIs
- [ ] Test with various URI patterns to ensure correct matching

## 3. Improve Error Handling Consistency

### Tasks:
- [x] Define standard error response types following JSON-RPC 2.0 spec
- [x] Create utility functions for generating consistent error responses
- [x] Update all error returns to use these utility functions
- [x] Ensure error codes are appropriate and consistent
- [x] Add more detailed error messages with context
- [x] Improve validation error reporting
- [ ] Test error scenarios to verify consistent responses

## 4. Use More Specific Types and Reduce Type Assertions

### Tasks:
- [x] Create Zod schemas for core data structures (Feature, Phase, Task)
- [x] Implement branded types for identifiers (FeatureId, PhaseId, TaskId)
- [x] Replace string types with more specific types where appropriate
- [ ] Eliminate `@ts-ignore` comments by fixing underlying type issues
- [x] Add runtime type validation at critical boundaries
- [x] Update function signatures to use the new types
- [ ] Test type safety with various inputs

## Implementation Order and Dependencies

1. **First Phase**: Type improvements (foundation for other changes) ✅
   - Implement specific types and Zod schemas ✅
   - Remove type assertions where possible ✅

2. **Second Phase**: Error handling improvements ✅
   - Create error utilities ✅
   - Update error responses to use common format ✅

3. **Third Phase**: Resource URI handling ✅
   - Implement resource registry ✅
   - Update URI parsing and matching ✅

4. **Fourth Phase**: Tool handler refactoring ✅
   - Create tools registry ✅ 
   - Refactor call tool request handling ✅

## Next Steps

1. Testing strategy:
   - Create unit tests for each component
   - Test edge cases and error scenarios
   - Compare outputs before and after changes to ensure consistency

2. Create a PR with the changes
   - Update the documentation
   - Add examples of using the new APIs 