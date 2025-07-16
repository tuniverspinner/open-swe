# TaskPlan Implementation Documentation

This document provides a comprehensive overview of the taskPlan implementation in the Open SWE monorepo, including all files, functions, utilities, and other important code related to task planning.

## Table of Contents

1. [Core Architecture Overview](#core-architecture-overview)
2. [Data Types and Structures](#data-types-and-structures)
3. [Task Management Utilities](#task-management-utilities)
4. [Current V1 UI Implementation](#current-v1-ui-implementation)
5. [Current V2 UI Structure](#current-v2-ui-structure)
6. [Data Flow and Graph Integration](#data-flow-and-graph-integration)
7. [Polling Infrastructure](#polling-infrastructure)
8. [GitHub Integration](#github-integration)
9. [Plan for New V2 TaskPlan Component](#plan-for-new-v2-taskplan-component)

## Core Architecture Overview

The taskPlan system in Open SWE is designed around a hierarchical structure of **Tasks** containing **Plan Revisions** which contain **Plan Items**. This allows for:

- Multiple tasks per session
- Multiple revisions per task (for plan updates)
- Granular progress tracking per plan item
- Agent and user collaboration on plan modifications

### Key Components

- **Manager Graph**: Orchestrates the overall process and holds the main taskPlan
- **Planner Graph**: Creates and proposes task plans
- **Programmer Graph**: Executes task plans and updates progress
- **Web UI**: Displays task progress and allows user interaction

## Data Types and Structures

### Core Types (`packages/shared/src/open-swe/types.ts`)

```typescript
export type PlanItem = {
  index: number;           // Execution order
  plan: string;           // Task description
  completed: boolean;     // Completion status
  summary?: string;       // Summary when completed
};

export type PlanRevision = {
  revisionIndex: number;   // Version number
  plans: PlanItem[];      // The actual plan items
  createdAt: number;      // Timestamp
  createdBy: "agent" | "user"; // Who created this revision
};

export type Task = {
  id: string;                    // Unique identifier
  taskIndex: number;             // Chronological order
  request: string;               // Original user request
  title: string;                 // LLM-generated title
  createdAt: number;
  completed: boolean;
  completedAt?: number;
  summary?: string;
  planRevisions: PlanRevision[];
  activeRevisionIndex: number;   // Currently active revision
  parentTaskId?: string;         // For derived tasks
};

export type TaskPlan = {
  tasks: Task[];           // All tasks in the system
  activeTaskIndex: number; // Currently active task
};
```

### State Integration

TaskPlan is integrated into the graph states:

- **Manager Graph State**: Contains the main taskPlan
- **Planner Graph State**: Can propose new plans
- **Programmer Graph State**: Updates task progress

## Task Management Utilities

### Core Functions (`packages/shared/src/open-swe/tasks.ts`)

#### Task Creation
```typescript
// Creates a new task with plan items
createNewTask(
  request: string,
  title: string, 
  planItems: PlanItem[],
  options?: {
    existingTaskPlan?: TaskPlan;
    parentTaskId?: string;
  }
): TaskPlan
```

#### Plan Updates
```typescript
// Updates plan items by creating a new revision
updateTaskPlanItems(
  taskPlan: TaskPlan,
  taskId: string,
  planItems: PlanItem[],
  createdBy: "agent" | "user" = "agent"
): TaskPlan
```

#### Progress Tracking
```typescript
// Gets active plan items for the current task
getActivePlanItems(taskPlan: TaskPlan): PlanItem[]

// Gets the currently active task
getActiveTask(taskPlan: TaskPlan): Task

// Marks a specific plan item as completed
completePlanItem(
  taskPlan: TaskPlan,
  taskId: string,
  planItemIndex: number,
  summary?: string
): TaskPlan

// Marks an entire task as completed
completeTask(
  taskPlan: TaskPlan,
  taskId: string,
  summary?: string
): TaskPlan
```

### Usage Throughout Codebase

The utilities are used extensively:

- **Programmer Graph**: Updates progress and completes plan items
- **Planner Graph**: Creates new tasks and proposes plans
- **Manager Graph**: Orchestrates task flow
- **Web UI**: Displays progress and calculates completion status

## Current V1 UI Implementation

### Main Components

#### 1. TaskPlanView (`apps/web/src/components/tasks/index.tsx`)

**Purpose**: Main container for task plan display
**Key Features**:
- Handles multiple tasks
- Task switching via dropdown
- Plan revision navigation
- Expandable summaries
- Progress filtering (all, completed, current, pending)

**Key Props**:
```typescript
interface TaskPlanViewProps {
  taskPlan: TaskPlan;
  onTaskChange?: (taskId: string) => void;
}
```

#### 2. TasksSidebar Component

**Features**:
- Full task plan display in sidebar
- Task navigation
- Plan revision history
- Detailed plan item status
- Collapsible summaries

#### 3. ProgressBar (`apps/web/src/components/tasks/progress-bar.tsx`)

**Purpose**: Compact progress display
**Key Features**:
- Visual progress bar with completion percentage
- Click to open full sidebar
- Current task indicator
- Status legend

```typescript
interface ProgressBarProps {
  taskPlan?: TaskPlan;
  className?: string;
  onOpenSidebar?: () => void;
}
```

#### 4. useTaskPlan Hook (`apps/web/src/components/tasks/useTaskPlan.tsx`)

**Purpose**: Reactive hook for taskPlan data
**Current Implementation**:
```typescript
export function useTaskPlan() {
  const { values } = useStreamContext();
  const [taskPlan, setTaskPlan] = useState<TaskPlan>();

  useEffect(() => {
    const currentPlanStr = JSON.stringify(taskPlan, null, 2);
    const newPlanStr = JSON.stringify(values?.taskPlan, null, 2);
    if (currentPlanStr !== newPlanStr) {
      setTaskPlan(values?.taskPlan);
    }
  }, [values?.taskPlan]);

  return { taskPlan };
}
```

### Plan Item Status Logic

Plan items have three states:
- **Completed**: `item.completed === true`
- **Current**: Lowest index among uncompleted items
- **Remaining**: All other uncompleted items

## Current V2 UI Structure

### Thread View Layout (`apps/web/src/components/v2/thread-view.tsx`)

The V2 UI uses a split-pane layout:

```
┌─────────────────────────────────────────────────────────┐
│ Header (status, title, repository, thread switcher)    │
├─────────────────┬───────────────────────────────────────┤
│                 │ ┌─────────────────────────────────┐   │
│ Manager Chat    │ │ Tabs: Planner | Programmer      │   │
│ (1/3 width)     │ │ [Cancel Buttons]                │   │
│                 │ └─────────────────────────────────┘   │
│                 │                                       │
│                 │ Actions & Plan Content               │
│                 │ (2/3 width)                          │
└─────────────────┴───────────────────────────────────────┘
```

### Key Components

#### 1. Tab Layout
**Location**: Lines 158-185 in `thread-view.tsx`
```typescript
<div className="flex items-center justify-between">
  <TabsList className="bg-muted/70 dark:bg-gray-800">
    <TabsTrigger value="planner">Planner</TabsTrigger>
    <TabsTrigger value="programmer">Programmer</TabsTrigger>
  </TabsList>
  
  <div className="flex gap-2">
    {/* Cancel buttons for each tab */}
  </div>
</div>
```

#### 2. Actions Renderer
**Purpose**: Shows the real-time progress of planner/programmer operations
**Location**: `apps/web/src/components/v2/actions-renderer.tsx`

## Data Flow and Graph Integration

### 1. Plan Creation Flow
```
User Request → Manager → Planner → Proposed Plan → User Approval → TaskPlan
```

### 2. Plan Execution Flow
```
TaskPlan → Programmer → Progress Updates → Plan Item Completion → GitHub Updates
```

### 3. Data Propagation

1. **Manager Graph State** holds the authoritative taskPlan
2. **Planner Graph** creates/updates plans via `createNewTask` and `updateTaskPlanItems`
3. **Programmer Graph** updates progress via `completePlanItem` and `completeTask`
4. **GitHub Issues** store taskPlan as JSON for persistence
5. **Web UI** polls for updates via thread status service

### Key Integration Points

- **Plan Generation**: `apps/open-swe/src/graphs/planner/nodes/generate-plan/index.ts`
- **Progress Updates**: `apps/open-swe/src/graphs/programmer/nodes/progress-plan-step.ts`
- **Task Completion**: `apps/open-swe/src/graphs/programmer/nodes/generate-conclusion.ts`

## Polling Infrastructure

### Current Polling System

The V2 UI already has a robust polling infrastructure:

#### 1. Thread Status Service (`apps/web/src/services/thread-status.service.ts`)

**Purpose**: Fetches thread status and taskPlan data
**Key Features**:
- Polls every 15 seconds (configurable)
- Optimized caching to avoid redundant requests
- Returns taskPlan data in the response
- Handles manager/planner/programmer graph states

```typescript
interface StatusResult {
  graph: "manager" | "planner" | "programmer";
  runId: string;
  threadId: string;
  status: ThreadUIStatus;
  taskPlan?: TaskPlan; // Available for programmer sessions
}
```

#### 2. SWR Configuration (`apps/web/src/lib/swr-config.ts`)

```typescript
export const THREAD_STATUS_SWR_CONFIG = {
  refreshInterval: 15000,    // 15 second polling
  revalidateOnFocus: true,   // Update when window focused
  revalidateOnReconnect: true,
  errorRetryCount: 3,
  dedupingInterval: 5000,
} as const;
```

#### 3. Status Hooks

- **Single Thread**: `useThreadStatus(threadId)` in `apps/web/src/hooks/useThreadStatus.ts`
- **Multiple Threads**: `useThreadsStatus(threadIds)` in `apps/web/src/hooks/useThreadsStatus.ts`

### TaskPlan in Status Response

The polling system already includes taskPlan data:
- **Programmer threads** include `taskPlan` in the status response
- **Task completion detection** uses `areAllPlanItemsCompleted(taskPlan)`
- **Real-time updates** are available via the existing polling infrastructure

## GitHub Integration

### Task Plan Storage

TaskPlan data is stored in GitHub issues for persistence:

#### 1. Storage Functions (`apps/open-swe/src/utils/github/issue-task.ts`)

```typescript
// Adds taskPlan to GitHub issue body
addTaskPlanToIssue(
  input: GetIssueTaskPlanInput,
  config: GraphConfig, 
  taskPlan: TaskPlan
): Promise<void>

// Adds proposed plan to issue
addProposedPlanToIssue(/* ... */): Promise<void>

// Retrieves plans from issue
getPlansFromIssue(/* ... */): Promise<{ taskPlan?: TaskPlan }>
```

#### 2. Storage Format

TaskPlan is stored as JSON in GitHub issue bodies between special tags:
```html
<open-swe-do-not-edit-task-plan>
{
  "tasks": [...],
  "activeTaskIndex": 0
}
</open-swe-do-not-edit-task-plan>
```

### Integration Points

- **Plan Updates**: Automatically synced to GitHub issues
- **Progress Updates**: Written to issues after plan item completion  
- **Task Completion**: Final summary written to issues
- **Plan Proposals**: Stored temporarily during user approval

## Plan for New V2 TaskPlan Component

### Goal

Create a taskPlan component in the V2 UI that:
1. Shows on the top row with the programmer/planner tabs and cancel button
2. Uses polling rather than GitHub API for real-time updates
3. Provides similar functionality to the V1 TaskPlanView

### Implementation Strategy

#### 1. Component Location

Add the taskPlan component to the tab header area in `apps/web/src/components/v2/thread-view.tsx`:

```typescript
// Current structure (around line 158):
<div className="flex items-center justify-between">
  <TabsList className="bg-muted/70 dark:bg-gray-800">
    <TabsTrigger value="planner">Planner</TabsTrigger>
    <TabsTrigger value="programmer">Programmer</TabsTrigger>
  </TabsList>
  
  {/* NEW: Add TaskPlan component here */}
  <TaskPlanProgress taskPlan={polledTaskPlan} />
  
  <div className="flex gap-2">
    {/* Cancel buttons */}
  </div>
</div>
```

#### 2. Data Source

Utilize the existing polling infrastructure instead of GitHub API:

```typescript
// NEW: Hook for polling taskPlan data
function usePolledTaskPlan(threadId: string) {
  const { status, isLoading } = useThreadStatus(threadId);
  
  // Get taskPlan from programmer session status
  const taskPlan = useMemo(() => {
    // Extract taskPlan from the polling response
    // This data is already available in the thread status service
    return extractTaskPlanFromThreadStatus(status);
  }, [status]);
  
  return { taskPlan, isLoading };
}
```

#### 3. Component Structure

Create a compact horizontal taskPlan component:

```typescript
// NEW: Compact horizontal taskPlan component
interface TaskPlanProgressProps {
  taskPlan?: TaskPlan;
  className?: string;
}

export function TaskPlanProgress({ taskPlan, className }: TaskPlanProgressProps) {
  // Show compact progress bar with click-to-expand functionality
  // Similar to existing ProgressBar but optimized for horizontal layout
  // Include:
  // - Current task title
  // - Progress percentage
  // - Current plan item indicator
  // - Click to open full sidebar/modal
}
```

#### 4. Detailed View

Reuse existing V1 components for detailed view:

```typescript
// Reuse TasksSidebar from V1 in a modal/sidebar
function TaskPlanModal({ isOpen, onClose, taskPlan }: TaskPlanModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[800px]">
        <TasksSidebar 
          isOpen={true}
          onClose={onClose}
          taskPlan={taskPlan}
        />
      </SheetContent>
    </Sheet>
  );
}
```

#### 5. Integration Points

**Modify these files**:

1. **`apps/web/src/components/v2/thread-view.tsx`**
   - Add TaskPlanProgress component to tab header
   - Add usePolledTaskPlan hook

2. **Create `apps/web/src/components/v2/task-plan-progress.tsx`**
   - Compact horizontal progress component
   - Click handler for detailed view

3. **Create `apps/web/src/hooks/usePolledTaskPlan.ts`**
   - Extract taskPlan from thread status polling
   - Handle loading and error states

4. **Update `apps/web/src/services/thread-status.service.ts`**
   - Ensure taskPlan is properly included in responses
   - Add utility to extract taskPlan from status

#### 6. Advantages of Polling Approach

**Real-time Updates**: 15-second polling provides near real-time progress
**No GitHub API Calls**: Reduces API rate limiting concerns  
**Consistent Data**: Uses same data source as other UI components
**Better Performance**: Leverages existing caching and optimization
**Error Resilience**: Built-in retry and error handling

#### 7. Migration Path

1. **Phase 1**: Implement polling-based taskPlan extraction
2. **Phase 2**: Create compact progress component
3. **Phase 3**: Add detailed view modal/sidebar
4. **Phase 4**: Replace V1 components gradually
5. **Phase 5**: Remove V1 taskPlan components

### Development Steps

1. **Extract TaskPlan from Polling**
   - Modify thread status service to ensure taskPlan is included
   - Create hook to extract taskPlan from polling data

2. **Create Compact Component**
   - Build horizontal progress component
   - Implement click-to-expand functionality

3. **Add to V2 UI**
   - Integrate into thread-view.tsx tab header
   - Test with existing threads

4. **Enhance with Detailed View**
   - Create modal/sidebar for detailed plan view
   - Reuse existing TasksSidebar component

5. **Polish and Optimize**
   - Add loading states
   - Optimize for different screen sizes
   - Add keyboard shortcuts

This approach leverages the existing robust polling infrastructure while providing a modern, real-time taskPlan component that fits naturally into the V2 UI design. 