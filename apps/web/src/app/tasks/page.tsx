import { Metadata } from "next";
import TasksPageContent from "./components/TasksPageContent";

export const metadata: Metadata = {
  title: "Tasks - Open SWE",
  description: "Manage all your development tasks in one place",
};

export default function TasksPage() {
  return <TasksPageContent />;
}
