

# Vibe-Coder MCP Server PRD

## 1. Introduction

The Vibe-Coder MCP Server is designed to help casual, LLM-based coders build new features in an organized, clean, and safe manner. By leveraging the Model Context Protocol (MCP), this server guides users through a structured process—from clarifying feature requests to implementing them in discrete, verifiable phases. This document defines the product requirements and lays the groundwork for the detailed implementation plan.

## 2. Feature Objectives

- **Assist LLM-based Coders:** Enable casual developers (vibe coders) to request and build features efficiently using an LLM-driven workflow.
- **Structured Development:** Organize the feature creation process into clearly defined stages, ensuring each phase is documented, reviewed, and implemented according to best practices.
- **Clean and Safe Code:** Enforce code quality standards, safe implementation practices, and thorough documentation throughout the development cycle.
- **Iterative Clarification:** Engage users in rounds of questions to continuously refine and narrow down the feature requirements.

## 3. Scope and Requirements

### 3.1 Feature Request Clarification
- **Iterative Engagement:**  
  - The system will prompt users with follow-up questions to clarify the exact goals and nuances of the requested feature.
  - User responses will be recorded and used to refine the feature’s scope.

### 3.2 PRD Documentation
- **Concise PRD Drafting:**  
  - Develop a narrow and specific PRD that captures:
    - **Feature Objectives:** A clear description of what the feature should achieve.
    - **Detailed Requirements:** Specific, actionable requirements and constraints.
    - **Documentation References:** Links or references to relevant code formats, style guides, and best practices.
- **File Organization:**  
  - Save the PRD as a Markdown file using the naming convention:  
    `StepNumber_FeatureName_PRD.md`  
    *(Example: “01_VibeCoder_PRD.md”)*

### 3.3 Implementation Specification
- **Phased Breakdown:**  
  - Divide the feature’s implementation into discrete phases, where each phase addresses a single focused task.
- **Checklists and Standards:**  
  - For each phase, include a checklist detailing:
    - Task requirements
    - Code style and practices that must be adhered to
- **Separate Documentation:**  
  - Save the implementation plan in its own Markdown file, following the naming convention:  
    `StepNumber_FeatureName_Implementation.md`

## 4. High-Level Implementation Overview

### 4.1 Development Workflow and Branching Strategy
- **Feature Branch:**  
  - Begin each new feature on a dedicated branch.
- **Phase Branches:**  
  - For every discrete phase within a feature, create a new branch off the feature branch.
- **Commit and Code Review Process:**  
  - After completing each phase:
    - Create detailed git commits capturing all changes.
    - Request a targeted code review that includes the PRD, the phase-specific implementation plan, and the relevant code changes.
    - Merge the phase branch back into the feature branch (retain phase branches for history).

### 4.2 Finalization Process
- **Project Summary:**  
  - Upon feature completion, update the project README with a summary of the new functionality.
- **Feature-Specific README:**  
  - Create a dedicated README that details:
    - The new feature’s functionality
    - How to use the feature
    - The adherence to the documented practices and checklists
- **Final Code Review:**  
  - Conduct a comprehensive code review covering all documentation and code, ensuring only the relevant portions are evaluated.

## 5. Structuring the MCP for LLM Compliance

To ensure the LLM follows the outlined instructions accurately, the following practices are essential:

- **Clear Hierarchical Sections:**  
  - Use distinct headings and subheadings for each major section (e.g., Introduction, Objectives, Scope, etc.).
- **Step-by-Step Breakdown:**  
  - Organize tasks in numbered steps with clear, actionable directives (e.g., “Draft the PRD,” “Create phase-specific branches”).
- **Consistent Naming Conventions:**  
  - Specify precise file and branch naming formats to eliminate ambiguity.
- **Imperative Language:**  
  - Use direct commands (e.g., “Create,” “Define,” “Save,” “Merge”) to ensure clarity.
- **Checklists and Examples:**  
  - Provide concrete examples or templates for PRD sections, implementation plans, and commit messages to serve as models.
- **Feedback Loops:**  
  - Include instructions to ask clarifying questions if any step is ambiguous.
- **Documentation Focus:**  
  - Emphasize thorough documentation of every phase with clear checklists and version control histories.

## 6. Feedback and Iteration Process

- **User Feedback Integration:**  
  - Regularly incorporate user feedback to refine feature objectives and requirements.
- **Iterative Updates:**  
  - Update both the PRD and the implementation plan as new details emerge during the development process.
- **Review and Approval:**  
  - Ensure that each phase is reviewed and approved before moving to subsequent phases.

## 7. Appendix

### 7.1 File Naming Conventions
- **PRD File:** `StepNumber_FeatureName_PRD.md`  
  *(Example: “01_VibeCoder_PRD.md”)*
- **Implementation Plan File:** `StepNumber_FeatureName_Implementation.md`

### 7.2 Example Checklists and Templates
- **Feature Request Checklist:**  
  - [ ] Define feature objective  
  - [ ] Clarify user requirements through iterative questions  
  - [ ] Record user responses for scope refinement  
- **Phase Implementation Checklist:**  
  - [ ] Define phase-specific tasks  
  - [ ] Outline required code standards and practices  
  - [ ] Document progress with commit messages  
  - [ ] Request targeted code review  
  - [ ] Merge phase branch into feature branch after review

