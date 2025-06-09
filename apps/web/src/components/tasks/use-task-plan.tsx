import { TaskPlan } from "@open-swe/shared/open-swe/types"
import { useState } from "react"

// Example data for demonstration using the new interface
const initialTaskPlan: TaskPlan = {
  tasks: [
    {
      id: "task-1",
      taskIndex: 1,
      request: "Build React Dashboard",
      createdAt: Date.now() - 86400000 * 3, // 3 days ago
      completed: true,
      completedAt: Date.now() - 86400000 * 2, // 2 days ago
      summary:
        "Successfully built a modern dashboard with TypeScript, Tailwind CSS, and data visualization components.",
      planRevisions: [
        {
          revisionIndex: 0,
          plans: [
            {
              index: 1,
              plan: "Set up React project with TypeScript",
              completed: true,
              summary: "Created React app with TypeScript, Tailwind CSS, and basic project structure.",
            },
            {
              index: 2,
              plan: "Create dashboard layout",
              completed: true,
              summary: "Built responsive dashboard layout with sidebar navigation and main content area.",
            },
            {
              index: 3,
              plan: "Add data visualization components",
              completed: true,
              summary: "Integrated Chart.js for displaying project metrics and analytics.",
            },
          ],
          createdAt: Date.now() - 86400000 * 3,
          createdBy: "agent",
        },
      ],
      activeRevisionIndex: 0,
    },
    {
      id: "task-2",
      taskIndex: 2,
      request: "Implement User Authentication",
      createdAt: Date.now() - 86400000 * 2, // 2 days ago
      completed: true,
      completedAt: Date.now() - 86400000 * 1, // 1 day ago
      summary: "Implemented secure authentication system with multiple providers including Google, GitHub, and email.",
      planRevisions: [
        {
          revisionIndex: 0,
          plans: [
            {
              index: 1,
              plan: "Install and configure NextAuth.js",
              completed: true,
              summary: "Set up NextAuth.js with environment variables and basic configuration.",
            },
            {
              index: 2,
              plan: "Add Google OAuth provider",
              completed: true,
              summary: "Configured Google OAuth with proper scopes and callback URLs.",
            },
          ],
          createdAt: Date.now() - 86400000 * 2,
          createdBy: "agent",
        },
        {
          revisionIndex: 1,
          plans: [
            {
              index: 1,
              plan: "Install and configure NextAuth.js",
              completed: true,
              summary: "Set up NextAuth.js with environment variables and basic configuration.",
            },
            {
              index: 2,
              plan: "Add Google OAuth provider",
              completed: true,
              summary: "Configured Google OAuth with proper scopes and callback URLs.",
            },
            {
              index: 3,
              plan: "Add email authentication",
              completed: true,
              summary: "Implemented magic link email authentication with custom email templates.",
            },
            {
              index: 4,
              plan: "Add GitHub OAuth provider",
              completed: true,
              summary: "Configured GitHub OAuth for developer-friendly authentication.",
            },
          ],
          createdAt: Date.now() - 86400000 * 2 + 3600000, // 2 days ago + 1 hour
          createdBy: "user",
        },
      ],
      activeRevisionIndex: 1,
    },
    {
      id: "task-3",
      taskIndex: 3,
      request: "Add Real-time Chat Feature",
      createdAt: Date.now() - 86400000, // 1 day ago
      completed: false,
      planRevisions: [
        {
          revisionIndex: 0,
          plans: [
            {
              index: 1,
              plan: "Set up WebSocket server with Socket.io",
              completed: true,
              summary: "Configured Socket.io server with proper CORS and authentication middleware.",
            },
            {
              index: 2,
              plan: "Create chat UI components",
              completed: true,
              summary: "Built message list, input field, and user list components with responsive design.",
            },
            {
              index: 3,
              plan: "Implement message persistence",
              completed: false,
            },
            {
              index: 4,
              plan: "Add file sharing capabilities",
              completed: false,
            },
          ],
          createdAt: Date.now() - 86400000,
          createdBy: "agent",
        },
        {
          revisionIndex: 1,
          plans: [
            {
              index: 1,
              plan: "Set up WebSocket server with Socket.io",
              completed: true,
              summary: "Configured Socket.io server with proper CORS and authentication middleware.",
            },
            {
              index: 2,
              plan: "Create chat UI components",
              completed: true,
              summary: "Built message list, input field, and user list components with responsive design.",
            },
            {
              index: 3,
              plan: "Implement message persistence with database",
              completed: false,
            },
            {
              index: 4,
              plan: "Add typing indicators",
              completed: false,
            },
            {
              index: 5,
              plan: "Implement message reactions",
              completed: false,
            },
            {
              index: 6,
              plan: "Add file sharing with drag & drop",
              completed: false,
            },
            {
              index: 7,
              plan: "Create message search functionality",
              completed: false,
            },
          ],
          createdAt: Date.now() - 86400000 + 7200000, // 1 day ago + 2 hours
          createdBy: "user",
        },
      ],
      activeRevisionIndex: 1,
    },
  ],
  activeTaskIndex: 2, // Currently working on task 3
}

export function useTaskPlan() {
  const [taskPlan, setTaskPlan] = useState<TaskPlan>(initialTaskPlan)

  const handleTaskChange = (taskId: string) => {
    console.log(`Switched to task: ${taskId}`)
  }

  const handleRevisionChange = (taskId: string, revisionIndex: number) => {
    console.log(`Task ${taskId} switched to revision ${revisionIndex}`)
  }

  const handleEditPlanItem = (taskId: string, planItemIndex: number, newPlan: string) => {
    setTaskPlan((prevTaskPlan) => ({
      ...prevTaskPlan,
      tasks: prevTaskPlan.tasks.map((task) => {
        if (task.id === taskId) {
          const updatedRevisions = [...task.planRevisions]
          const activeRevision = updatedRevisions[task.activeRevisionIndex]
          updatedRevisions[task.activeRevisionIndex] = {
            ...activeRevision,
            plans: activeRevision.plans.map((item) =>
              item.index === planItemIndex ? { ...item, plan: newPlan } : item,
            ),
          }
          return { ...task, planRevisions: updatedRevisions }
        }
        return task
      }),
    }))
    console.log(`Edited plan item ${planItemIndex} in task ${taskId}: ${newPlan}`)
  }

  const handleAddPlanItem = (taskId: string, plan: string) => {
    setTaskPlan((prevTaskPlan) => ({
      ...prevTaskPlan,
      tasks: prevTaskPlan.tasks.map((task) => {
        if (task.id === taskId) {
          const updatedRevisions = [...task.planRevisions]
          const activeRevision = updatedRevisions[task.activeRevisionIndex]
          const maxIndex = Math.max(...activeRevision.plans.map((item) => item.index), 0)
          const newPlanItem = {
            index: maxIndex + 1,
            plan,
            completed: false,
          }

          updatedRevisions[task.activeRevisionIndex] = {
            ...activeRevision,
            plans: [...activeRevision.plans, newPlanItem],
          }
          return { ...task, planRevisions: updatedRevisions }
        }
        return task
      }),
    }))
    console.log(`Added new plan item to task ${taskId}: ${plan}`)
  }

  const handleDeletePlanItem = (taskId: string, planItemIndex: number) => {
    setTaskPlan((prevTaskPlan) => ({
      ...prevTaskPlan,
      tasks: prevTaskPlan.tasks.map((task) => {
        if (task.id === taskId) {
          const updatedRevisions = [...task.planRevisions]
          const activeRevision = updatedRevisions[task.activeRevisionIndex]
          updatedRevisions[task.activeRevisionIndex] = {
            ...activeRevision,
            plans: activeRevision.plans.filter((item) => item.index !== planItemIndex),
          }
          return { ...task, planRevisions: updatedRevisions }
        }
        return task
      }),
    }))
    console.log(`Deleted plan item ${planItemIndex} from task ${taskId}`)
  }

  return {
    taskPlan,
    handleTaskChange,
    handleRevisionChange,
    handleEditPlanItem,
    handleAddPlanItem,
    handleDeletePlanItem,
  }
}