export interface User {
  id: number;
  name: string;
  email: string;
  empId?: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  passwordResetRequired?: boolean;
  token?: string;
  department?: string;
  createdAt?: string;
  onboardedBy?: number;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  objective?: string;
  teamSize?: number;
  deadline?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: User;
  projectType?: string;
  category?: string;
  teamMembers?: User[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  columnId: number;
  orderIndex: number;
  assignee?: User;
  assigneeId?: number;
  coAssignee?: User;
  coAssigneeId?: number;
  reporter?: User;
  reporterId?: number;
  project?: Project;
  projectId?: number;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  attachments?: string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  environment?: string;
  status?: string;
  issueType?: string;
  storyPoints?: number;
  sprintId?: number;
  sprint?: Sprint;
  parentTask?: Task;
  parentId?: number;
  subTasks?: Task[];
  epicColor?: string;
  projectSequence?: number;
  fixVersionId?: number;
  fixVersion?: Version;
  affectsVersionId?: number;
  affectsVersion?: Version;
  originalEstimate?: string;
  originalEstimateSeconds?: number;
  timeSpentSeconds?: number;
  remainingEstimateSeconds?: number;
  workLogs?: WorkLog[];
}

export interface WorkLog {
  id: number;
  taskId: number;
  user: User;
  timeSpent: string;
  timeSpentSeconds: number;
  workDate: string;
  comment?: string;
  createdAt: string;
}

export interface Version {
  id: number;
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
  status: 'UNRELEASED' | 'RELEASED' | 'ARCHIVED';
  releaseNotes?: string;
  projectId: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  projectId: number;
}

export interface Comment {
  id: number;
  content: string;
  user: User;
  createdAt: string;
}

export interface BoardColumn {
  id: number;
  projectId: number;
  name: string;
  orderIndex: number;
}

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}
