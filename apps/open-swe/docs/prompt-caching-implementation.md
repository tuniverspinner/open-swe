# Prompt Caching Implementation Plan for Generate-Message Node

## Overview

This document provides a comprehensive plan for implementing Anthropic prompt caching in the `generate-message` node of the Open SWE programmer graph. The implementation will optimize API costs and response times by caching static portions of the large system prompt while maintaining dynamic functionality.

## Current Architecture Analysis

### Generate-Message Node Structure

**Location**: `apps/open-swe/src/graphs/programmer/nodes/generate-message/index.ts`

The current implementation follows this pattern:

```typescript
export async function generateAction(
  state: GraphState,
  config: GraphConfig,
): Promise<GraphUpdate> {
  const model = await loadModel(config, Task.ACTION_GENERATOR);
  const tools = [/* various tools */];
  
  const modelWithTools = model.bindTools(tools, {
    tool_choice: "auto",
    parallel_tool_calls: true,
  });

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: formatPrompt(state),
    },
    ...state.internalMessages,
    ...missingMessages,
  ]);
}
```

### System Prompt Analysis

**Location**: `apps/open-swe/src/graphs/programmer/nodes/generate-message/prompt.ts`

The `SYSTEM_PROMPT` is a large template containing:

1. **Static Elements** (ideal for caching):
   - Identity and core behavior instructions
   - Task execution guidelines
   - File and code management rules
   - Coding standards
   - Tool usage best practices
   - Communication guidelines

2. **Dynamic Elements** (cache invalidation triggers):
   - `{PLAN_PROMPT_WITH_SUMMARIES}` - Current plan state
   - `{CODEBASE_TREE}` - Repository structure
   - `{CUSTOM_RULES}` - User-specific rules
   - `{CODE_REVIEW_PROMPT}` - Code review context
   - `{CURRENT_TASK_NUMBER}` - Active task index

### Current Model Configuration

- **Model**: `claude-sonnet-4-0` (supports prompt caching)
- **SDK**: `@langchain/anthropic ^0.3.20`
- **Cache Requirements**: Minimum 1024 tokens (met by current prompt)
- **Tool Binding**: Multiple tools with parallel execution

## Anthropic Prompt Caching Overview

### How It Works

Prompt caching allows reusing processed prompt prefixes across API calls:

1. **Cache Hierarchy**: `tools` → `system` → `messages`
2. **Cache Breakpoints**: Up to 4 `cache_control` markers
3. **Cache Lifetime**: 5 minutes (default) or 1 hour (premium)
4. **Cache Scope**: Organization-specific, content-hash based

### Pricing Structure

For Claude Sonnet 4:
- **Base Input**: $3.00 / MTok
- **Cache Writes**: $3.75 / MTok (1.25x base)
- **Cache Hits**: $0.30 / MTok (0.1x base)
- **Output**: $15.00 / MTok (unchanged)

### Cache Invalidation Rules

Changes at any level invalidate that level and all subsequent levels:
- **Tool changes** → Invalidates entire cache
- **System changes** → Invalidates system + messages cache
- **Message changes** → Only invalidates messages cache

## Optimal Cache Strategy

### Recommended 4-Tier Cache Structure

Based on the current prompt structure and invalidation patterns, implement these cache breakpoints:

#### Cache Breakpoint 1: Tools Definition
```typescript
const tools = [
  createSearchTool(state),
  createShellTool(state),
  createApplyPatchTool(state),
  // ... other tools
];

// Mark the last tool with cache_control
tools[tools.length - 1] = {
  ...tools[tools.length - 1],
  cache_control: { type: "ephemeral" }
};
```

#### Cache Breakpoint 2: Static System Instructions
```typescript
const staticInstructions = {
  type: "text",
  text: `# Identity

You are a terminal-based agentic coding assistant built by LangChain...

# Instructions

## Core Behavior
...
## Task Execution Guidelines
...
## Coding Standards
...`,
  cache_control: { type: "ephemeral" }
};
```

#### Cache Breakpoint 3: Dynamic Context
```typescript
const dynamicContext = {
  type: "text",
  text: `# Context

<plan_information>
${formatPlanPrompt(getActivePlanItems(state.taskPlan), { includeSummaries: true })}
</plan_information>

<codebase_structure>
${state.codebaseTree || "No codebase tree generated yet."}
</codebase_structure>

${formatCustomRulesPrompt(state.customRules)}`,
  cache_control: { type: "ephemeral" }
};
```

#### Cache Breakpoint 4: Code Review Context
```typescript
const codeReviewContext = {
  type: "text",
  text: codeReview ? formatCodeReviewPrompt(CODE_REVIEW_PROMPT, {
    review: codeReview.review,
    newActions: codeReview.newActions,
  }) : "",
  cache_control: { type: "ephemeral" }
};
```

## Implementation Plan

### Phase 1: Restructure Prompt Function

Modify `formatPrompt()` to return structured content blocks instead of a single string:

```typescript
interface CacheablePromptSegment {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

const formatCacheablePrompt = (state: GraphState): CacheablePromptSegment[] => {
  const repoDirectory = getRepoAbsolutePath(state.targetRepository);
  const activePlanItems = getActivePlanItems(state.taskPlan);
  const codeReview = getCodeReviewFields(state.internalMessages);

  return [
    // Segment 1: Static Instructions (Cache Breakpoint 2)
    {
      type: "text",
      text: STATIC_SYSTEM_INSTRUCTIONS,
      cache_control: { type: "ephemeral" }
    },
    
    // Segment 2: Dynamic Context (Cache Breakpoint 3)
    {
      type: "text",
      text: `# Context

<plan_information>
## Generated Plan with Summaries
${formatPlanPrompt(activePlanItems, { includeSummaries: true })}

## Plan Generation Notes
${state.contextGatheringNotes || "No context gathering notes available."}

## Current Task Statuses
${formatPlanPrompt(activePlanItems)}
</plan_information>

<codebase_structure>
## Codebase Tree (3 levels deep, respecting .gitignore)
Generated via: \`git ls-files | tree --fromfile -L 3\`
Location: ${repoDirectory}

${state.codebaseTree || "No codebase tree generated yet."}
</codebase_structure>

${formatCustomRulesPrompt(state.customRules)}`,
      cache_control: { type: "ephemeral" }
    },
    
    // Segment 3: Code Review Context (Cache Breakpoint 4)
    {
      type: "text",
      text: codeReview ? formatCodeReviewPrompt(CODE_REVIEW_PROMPT, {
        review: codeReview.review,
        newActions: codeReview.newActions,
      }) : "",
      cache_control: { type: "ephemeral" }
    }
  ].filter(segment => segment.text.trim() !== "");
};
```

### Phase 2: Extract Static Instructions

Create a new constant for static instructions:

```typescript
const STATIC_SYSTEM_INSTRUCTIONS = `# Identity

You are a terminal-based agentic coding assistant built by LangChain. You wrap LLM models to enable natural language interaction with local codebases. You are precise, safe, and helpful.

You are currently executing a specific task from a pre-generated plan. You have access to:
- Project context and files
- Shell commands and code editing tools
- A sandboxed, git-backed workspace with rollback support

# Instructions

## Core Behavior

* **Persistence**: Keep working until the current task is completely resolved. Only terminate when you are certain the task is complete.
* **Accuracy**: Never guess or make up information. Always use tools to gather accurate data about files and codebase structure.
* **Planning**: Leverage the plan context and task summaries heavily - they contain critical information about completed work and the overall strategy.

## Task Execution Guidelines

### Working with the Plan

* You are executing a task from the plan.
* Previous completed tasks and their summaries contain crucial context - always review them first
* Condensed context messages in conversation history summarize previous work - read these to avoid duplication
* The plan generation summary provides important codebase insights
* After some tasks are completed, you may be provided with a code review and additional tasks. Ensure you inspect the code review (if present) and new tasks to ensure the work you're doing satisfies the user's request.

### File and Code Management

* **Repository location**: /home/daytona/open-swe
* **Current directory**: /home/daytona/open-swe
* All changes are auto-committed - no manual commits needed, and you should never create backup files.
* Work only within the existing Git repository
* Use \`apply_patch\` for file edits (accepts diffs and file paths)
* Use \`shell\` with \`touch\` to create new files (not \`apply_patch\`)
* Always use \`workdir\` parameter instead of \`cd\` when running commands via the \`shell\` tool
* Use \`install_dependencies\` to install dependencies (skip if installation fails). IMPORTANT: You should only call this tool if you're executing a task which REQUIRES installing dependencies. Keep in mind that not all tasks will require installing dependencies.

### Tool Usage Best Practices

* **Search**: Use \`search\` tool for all file searches. The \`search\` tool allows for efficient simple and complex searches, and it respect .gitignore patterns.
    * It's significantly faster results than alternatives like grep or ls -R.
    * When searching for specific file types, use glob patterns
    * The pattern field supports both basic strings, and regex
* **Dependencies**: Use the correct package manager; skip if installation fails
* **Pre-commit**: Run \`pre-commit run --files ...\` if .pre-commit-config.yaml exists
* **History**: Use \`git log\` and \`git blame\` for additional context when needed
* **Parallel Tool Calling**: You're allowed, and encouraged to call multiple tools at once, as long as they do not conflict, or depend on each other.
* **URL Content**: Use the \`get_url_content\` tool to fetch the contents of a URL. You should only use this tool to fetch the contents of a URL the user has provided, or that you've discovered during your context searching, which you believe is vital to gathering context for the user's request.
* **File Edits**: Use the \`apply_patch\` tool to edit files. You should always read a file, and the specific parts of the file you want to edit before using the \`apply_patch\` tool to edit the file.
    * This is important, as you never want to blindly edit a file before reading the part of the file you want to edit.
* **Scripts may require dependencies to be installed**: Remember that sometimes scripts may require dependencies to be installed before they can be run.
    * Always ensure you've installed dependencies before running a script which might require them.

### Coding Standards

When modifying files:
* Read files before modifying them
* Fix root causes, not symptoms
* Maintain existing code style
* Update documentation as needed
* Remove unnecessary inline comments after completion
* Comments should only be included if a core maintainer of the codebase would not be able to understand the code without them
* Never add copyright/license headers unless requested
* Ignore unrelated bugs or broken tests
* Write concise and clear code. Do not write overly verbose code
* Any tests written should always be executed to ensure they pass.
    * If you've created a new test, ensure the plan has an explicit step to run this new test. If the plan does not include a step to run the tests, ensure you call the \`update_plan\` tool to add a step to run the tests.
    * When running a test, ensure you include the proper flags/environment variables to exclude colors/text formatting. This can cause the output to be unreadable. For example, when running Jest tests you pass the \`--no-colors\` flag. In PyTest you set the \`NO_COLOR\` environment variable (prefix the command with \`export NO_COLOR=1\`)
* Only install trusted, well-maintained packages. If installing a new dependency which is not explicitly requested by the user, ensure it is a well-maintained, and widely used package.
    * Ensure package manager files are updated to include the new dependency.
* If a command you run fails (e.g. a test, build, lint, etc.), and you make changes to fix the issue, ensure you always re-run the command after making the changes to ensure the fix was successful.

### Communication Guidelines

* For coding tasks: Focus on implementation and provide brief summaries

## Special Tools

* **request_human_help**: Use only after exhausting all attempts to gather context
* **update_plan**: Use this tool to add or remove tasks from the plan, or to update the plan in any other way`;
```

### Phase 3: Modify Model Invocation

Update the `generateAction` function to use the new cacheable structure:

```typescript
export async function generateAction(
  state: GraphState,
  config: GraphConfig,
): Promise<GraphUpdate> {
  const model = await loadModel(config, Task.ACTION_GENERATOR);
  const mcpTools = await getMcpTools(config);

  const tools = [
    createSearchTool(state),
    createShellTool(state),
    createApplyPatchTool(state),
    createRequestHumanHelpToolFields(),
    createUpdatePlanToolFields(),
    createGetURLContentTool(),
    ...mcpTools,
    ...(state.dependenciesInstalled
      ? []
      : [createInstallDependenciesTool(state)]),
  ];

  // Add cache control to the last tool (Cache Breakpoint 1)
  if (tools.length > 0) {
    tools[tools.length - 1] = {
      ...tools[tools.length - 1],
      cache_control: { type: "ephemeral" }
    };
  }

  const modelWithTools = model.bindTools(tools, {
    tool_choice: "auto",
    parallel_tool_calls: true,
  });

  const [missingMessages, { taskPlan: latestTaskPlan }] = await Promise.all([
    getMissingMessages(state, config),
    getPlansFromIssue(state, config),
  ]);

  const systemPromptSegments = formatCacheablePrompt({
    ...state,
    taskPlan: latestTaskPlan ?? state.taskPlan,
  });

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: systemPromptSegments,
    },
    ...state.internalMessages,
    ...missingMessages,
  ]);

  // ... rest of the function remains the same
}
```

## Cache Invalidation Scenarios & Mitigation

### Scenario 1: Plan Updates
**Trigger**: Changes to `state.taskPlan`
**Impact**: Invalidates Cache Breakpoint 3 and 4
**Mitigation**: 
- Cache Breakpoints 1 and 2 remain valid
- ~70% cache hit rate maintained
- Consider plan change frequency in cache TTL selection

### Scenario 2: Codebase Structure Changes
**Trigger**: Updates to `state.codebaseTree`
**Impact**: Invalidates Cache Breakpoint 3 and 4
**Mitigation**:
- Cache Breakpoints 1 and 2 remain valid
- Implement codebase tree diffing to minimize updates
- Consider incremental tree updates

### Scenario 3: Custom Rules Modifications
**Trigger**: Changes to `state.customRules`
**Impact**: Invalidates Cache Breakpoint 3 and 4
**Mitigation**:
- Cache Breakpoints 1 and 2 remain valid
- Custom rules change infrequently in practice
- High cache hit rate expected

### Scenario 4: Tool Configuration Changes
**Trigger**: Adding/removing tools, MCP tool updates
**Impact**: Invalidates entire cache (all breakpoints)
**Mitigation**:
- Tool configurations are relatively stable
- Consider tool versioning strategies
- Monitor tool change frequency

### Scenario 5: Code Review Context
**Trigger**: New code reviews or review updates
**Impact**: Only invalidates Cache Breakpoint 4
**Mitigation**:
- Cache Breakpoints 1, 2, and 3 remain valid
- ~85% cache hit rate maintained
- Code reviews are episodic, not continuous

## Performance Monitoring

### Key Metrics to Track

Implement monitoring for these response fields:

```typescript
interface CacheMetrics {
  cache_creation_input_tokens: number;  // New cache entries created
  cache_read_input_tokens: number;      // Tokens read from cache
  input_tokens: number;                 // Non-cached input tokens
  output_tokens: number;                // Generated output tokens
}

const trackCachePerformance = (response: any) => {
  const metrics: CacheMetrics = {
    cache_creation_input_tokens: response.usage?.cache_creation_input_tokens || 0,
    cache_read_input_tokens: response.usage?.cache_read_input_tokens || 0,
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
  };

  // Calculate cache efficiency
  const totalInputTokens = metrics.cache_creation_input_tokens + 
                          metrics.cache_read_input_tokens + 
                          metrics.input_tokens;
  
  const cacheHitRate = metrics.cache_read_input_tokens / totalInputTokens;
  const costSavings = calculateCostSavings(metrics);

  logger.info("Cache Performance", {
    cacheHitRate: `${(cacheHitRate * 100).toFixed(2)}%`,
    costSavings: `$${costSavings.toFixed(4)}`,
    ...metrics,
  });
};
```

### Cost Calculation

```typescript
const calculateCostSavings = (metrics: CacheMetrics): number => {
  const SONNET_4_BASE_RATE = 3.0 / 1_000_000;  // $3 per MTok
  const CACHE_WRITE_MULTIPLIER = 1.25;
  const CACHE_READ_MULTIPLIER = 0.1;

  const cacheWriteCost = metrics.cache_creation_input_tokens * 
                        SONNET_4_BASE_RATE * CACHE_WRITE_MULTIPLIER;
  
  const cacheReadCost = metrics.cache_read_input_tokens * 
                       SONNET_4_BASE_RATE * CACHE_READ_MULTIPLIER;
  
  const regularInputCost = metrics.input_tokens * SONNET_4_BASE_RATE;
  
  // Cost without caching (all tokens at base rate)
  const totalTokens = metrics.cache_creation_input_tokens + 
                     metrics.cache_read_input_tokens + 
                     metrics.input_tokens;
  const costWithoutCaching = totalTokens * SONNET_4_BASE_RATE;
  
  // Actual cost with caching
  const actualCost = cacheWriteCost + cacheReadCost + regularInputCost;
  
  return costWithoutCaching - actualCost;
};
```

### Recommended Monitoring Dashboard

Track these KPIs:
- **Cache Hit Rate**: Target >60% for cost effectiveness
- **Average Cost per Request**: Monitor reduction over time
- **Cache Invalidation Frequency**: By breakpoint level
- **Response Time Improvement**: Cached vs non-cached requests
- **Token Distribution**: Creation vs read vs regular input

## Implementation Checklist

- [ ] **Phase 1**: Restructure `formatPrompt()` to return content blocks
- [ ] **Phase 2**: Extract static instructions to separate constant
- [ ] **Phase 3**: Implement 4-tier cache breakpoint strategy
- [ ] **Phase 4**: Update model invocation to use cacheable structure
- [ ] **Phase 5**: Add cache performance monitoring
- [ ] **Phase 6**: Implement cost tracking and alerting
- [ ] **Phase 7**: Test cache invalidation scenarios
- [ ] **Phase 8**: Monitor production performance and optimize

## Expected Outcomes

### Performance Improvements
- **Response Time**: 20-40% reduction for cache hits
- **Cost Reduction**: 60-80% for cached tokens
- **API Efficiency**: Reduced token processing load

### Cache Hit Rate Projections
- **Steady State**: 70-85% cache hit rate
- **Plan Updates**: Temporary drop to 40-50%
- **Tool Changes**: Temporary drop to 0% (full invalidation)
- **Code Reviews**: Minimal impact (85%+ maintained)

This implementation will significantly optimize the generate-message node's performance while maintaining full functionality and providing detailed monitoring capabilities.

