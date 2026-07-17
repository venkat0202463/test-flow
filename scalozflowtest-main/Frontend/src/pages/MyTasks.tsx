import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, AlertCircle, CheckCircle2, Clock, Bug, Bookmark, CheckSquare, Zap } from 'lucide-react';
import api from '../services/api';
import type { Task, Project } from '../types';
import { useAuth } from '../context/AuthContext';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTaskCode } from '../services/projectUtils';

const MyTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('');
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const statusFilter = searchParams.get('status');
  const typeFilter = searchParams.get('filter');
  const issueTypeFilter = searchParams.get('issueType');
  const assigneeNameFilter = searchParams.get('assigneeName');

  const targetUserName = assigneeNameFilter || user?.name;

  const projectsList = allProjects.length > 0
    ? Array.from(
        new Set(
          allProjects
            .filter(p => {
              if (!targetUserName) return true;
              const isCreator = p.createdBy?.name === targetUserName;
              const isMember = p.teamMembers?.some(m => m.name === targetUserName);
              const hasTask = tasks.some(t => 
                t.project?.id === p.id && 
                (t.assignee?.name === targetUserName || t.coAssignee?.name === targetUserName)
              );
              return isCreator || isMember || hasTask;
            })
            .map(p => p.name)
            .filter(Boolean)
        )
      ) as string[]
    : Array.from(new Set(tasks.map(t => t.project?.name).filter(Boolean))) as string[];

  useEffect(() => {
    fetchMyTasks();
  }, [user, searchParams]);

  const fetchMyTasks = async () => {
    if (!user) return;
    try {
      const projectsRes = await api.get('/projects');
      setAllProjects(projectsRes.data);

      if (issueTypeFilter === 'EPIC' || issueTypeFilter === 'BUG' || assigneeNameFilter) {
        const tasksRes = await api.get('/tasks');
        const userProjectIds = new Set(projectsRes.data.map((p: any) => p.id));
        const relevantTasks = tasksRes.data.filter((t: any) => t.project && userProjectIds.has(t.project.id));
        setTasks(relevantTasks);
      } else {
        const { data } = await api.get(`/stats/dashboard-tasks`);
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching my tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Hide unapproved tasks from the developer's task list
    const statusUpper = (task.status || '').toUpperCase();
    if (statusUpper === 'REJECTED' || statusUpper === 'PENDING PM REVIEW' || statusUpper === 'AWAITING CLARIFICATION') {
      return false;
    }

    // Dropdown filters
    if (selectedProject !== 'all' && task.project?.name !== selectedProject) return false;

    if (selectedStatus !== 'all') {
      const tStatus = (task.status || 'TODO').toUpperCase().replace(/_|\s/g, '');
      const sStatus = selectedStatus.toUpperCase().replace(/_|\s/g, '');
      if (tStatus !== sStatus) return false;
    }

    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;
    if (selectedIssueType !== 'all' && task.issueType !== selectedIssueType) return false;

    if (dueDateFilter) {
      if (!task.dueDate) return false;
      try {
        const taskDate = new Date(task.dueDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const taskDateStr = `${taskDate.getFullYear()}-${pad(taskDate.getMonth() + 1)}-${pad(taskDate.getDate())}`;
        if (taskDateStr !== dueDateFilter) return false;
      } catch (e) {
        return false;
      }
    }

    // Default view filters out Done status (keeping all open/active statuses like Backlog, To Do, In Progress, In Review, etc.)
    if (!statusFilter && !typeFilter && !issueTypeFilter && !assigneeNameFilter) {
      const s = (task.status || 'TODO').toUpperCase().replace(/_/g, ' ').trim();
      if (s === 'DONE') return false;
    }

    // Case-insensitive status filter
    if (statusFilter && task.status?.toUpperCase() !== statusFilter.toUpperCase()) return false;

    if (typeFilter === 'overdue') {
      const isOverdue = task.dueDate && new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && task.status?.toUpperCase() !== 'DONE';
      if (!isOverdue) return false;
    }

    if (issueTypeFilter && issueTypeFilter !== 'BUG' && task.issueType?.toUpperCase() !== issueTypeFilter.toUpperCase()) return false;

    // Custom filter logic for Linked Issues (explicitly linked tasks)
    if (issueTypeFilter === 'BUG') {
      const isLinkedIssue = task.tags && task.tags.includes('_link');
      if (!isLinkedIssue) return false;
    }

    // For Epics, filter out completed ones since the page is "Open Epics"
    if (issueTypeFilter === 'EPIC' && task.status?.toUpperCase() === 'DONE') return false;

    if (assigneeNameFilter) {
      if (assigneeNameFilter === 'Unassigned') {
        if (task.assignee || task.coAssignee) return false;
      } else {
        if (task.assignee?.name !== assigneeNameFilter && task.coAssignee?.name !== assigneeNameFilter) return false;
      }
    }

    return true;
  });

  const getPageTitle = () => {
    if (assigneeNameFilter) return `${assigneeNameFilter}'s Tasks`;
    if (statusFilter === 'DONE') return 'Completed Tasks';
    if (typeFilter === 'overdue') return 'Overdue Issues';
    if (issueTypeFilter === 'EPIC') return 'Open Epics';
    if (issueTypeFilter === 'BUG') return 'Linked Issues';
    return 'Open Tasks';
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'HIGH': return 'text-[#DE350B] bg-[#FFEBE6]';
      case 'MEDIUM': return 'text-[#FF991F] bg-[#FFF0B3]';
      case 'LOW': return 'text-[#006644] bg-[#E3FCEF]';
      default: return 'text-[#42526E] bg-[#F4F5F7]';
    }
  };

  const getStatusIcon = (status?: string) => {
    const s = (status || '').toLowerCase().replace('_', ' ');
    if (s === 'done') return <CheckCircle2 size={14} className="text-[#006644]" />;
    if (s === 'in progress') return <Clock size={14} className="text-[#1F6FEB]" />;
    if (s === 'in review') return <Clock size={14} className="text-[#FF991F]" />;
    return <AlertCircle size={14} className="text-[#42526E]" />;
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'To Do';
    if (status.toUpperCase() === 'UAT') return 'UAT';
    // Convert enum-style (IN_PROGRESS) or already title-case (In Progress) to readable form
    return status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
    </div>
  );

  return (
    <div className="content-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="section-title">{getPageTitle()}</h1>
            {(selectedProject !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all' || selectedIssueType !== 'all' || dueDateFilter !== '') && (
              <button
                onClick={() => {
                  setSelectedProject('all');
                  setSelectedStatus('all');
                  setSelectedPriority('all');
                  setSelectedIssueType('all');
                  setDueDateFilter('');
                }}
                className="text-xs font-bold text-[#1F6FEB] hover:underline transition-colors cursor-pointer bg-[#DEEBFF] px-2.5 py-1 rounded-[3px]"
              >
                Clear Filters
              </button>
            )}
          </div>
          <p className="section-subtitle">
            {assigneeNameFilter ? `Viewing tasks assigned to ${assigneeNameFilter}` :
              statusFilter === 'DONE' ? 'Your recently finished items.' :
              typeFilter === 'overdue' ? 'Items past their target date.' :
                issueTypeFilter === 'EPIC' ? 'High-level roadmap items in your projects.' :
                  issueTypeFilter === 'BUG' ? 'All linked issues and dependencies across your projects.' :
                    'All open tasks across all projects currently assigned to your node.'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#DFE1E6] rounded-[3px] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6]">
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-24">
                <div className="flex flex-col gap-1">
                  <span>Type</span>
                  <select
                    value={selectedIssueType}
                    onChange={(e) => setSelectedIssueType(e.target.value)}
                    className="mt-1 bg-white border border-[#DFE1E6] rounded-[3px] py-0.5 px-1 text-[10px] font-semibold text-[#42526E] outline-none w-full block normal-case"
                  >
                    <option value="all">All</option>
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="EPIC">Epic</option>
                  </select>
                </div>
              </th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-28 align-top pt-3">Key</th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider align-top pt-3">Summary</th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-44">
                <div className="flex flex-col gap-1">
                  <span>Project</span>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="mt-1 bg-white border border-[#DFE1E6] rounded-[3px] py-0.5 px-1 text-[10px] font-semibold text-[#42526E] outline-none w-full block normal-case"
                  >
                    <option value="all">All</option>
                    {projectsList.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-32">
                <div className="flex flex-col gap-1">
                  <span>Priority</span>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="mt-1 bg-white border border-[#DFE1E6] rounded-[3px] py-0.5 px-1 text-[10px] font-semibold text-[#42526E] outline-none w-full block normal-case"
                  >
                    <option value="all">All</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-36">
                <div className="flex flex-col gap-1">
                  <span>Status</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mt-1 bg-white border border-[#DFE1E6] rounded-[3px] py-0.5 px-1 text-[10px] font-semibold text-[#42526E] outline-none w-full block normal-case"
                  >
                    <option value="all">All</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                    <option value="UAT">UAT</option>
                  </select>
                </div>
              </th>
              <th className="px-4 py-2 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider w-36">
                <div className="flex flex-col gap-1">
                  <span>Due Date</span>
                  <input
                    type="date"
                    value={dueDateFilter}
                    onChange={(e) => setDueDateFilter(e.target.value)}
                    className="mt-1 bg-white border border-[#DFE1E6] rounded-[3px] py-0.5 px-1 text-[10px] font-semibold text-[#42526E] outline-none w-full block normal-case"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE1E6]">
            {filteredTasks.map((task) => (
              <tr
                key={task.id}
                className="hover:bg-[#F4F5F7] transition-colors group cursor-pointer"
                onClick={() => {
                  setActiveTaskId(task.id);
                  setIsDetailModalOpen(true);
                }}
              >
                 <td className="px-4 py-3">
                  <div className="flex items-center justify-center w-6 h-6">
                    {task.parentTask || task.parentId ? (
                      <span className="text-[9px] font-extrabold bg-[#E9F2FF] text-[#0052CC] px-1 py-0.5 rounded-[3px]" title="Subtask">SUB</span>
                    ) : task.issueType === 'BUG' ? (
                      <Bug size={16} className="text-[#FF5630]" />
                    ) : task.issueType === 'STORY' ? (
                      <Bookmark size={16} className="text-[#36B37E]" />
                    ) : task.issueType === 'EPIC' ? (
                      <Zap size={16} className="text-[#6554C0]" />
                    ) : (
                      <CheckSquare size={16} className="text-[#4C9AFF]" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[13px] font-medium text-[#5E6C84]">{getTaskCode(task.id, task.project?.name, task.projectSequence)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    {(task.parentTask || task.parentId) && (
                      <span className="text-[11px] font-semibold text-[#5E6C84] flex items-center gap-1.5">
                        Subtask of <span className="bg-[#EBECF0] px-1.5 py-0.5 rounded text-[#42526E] font-bold text-[10px]">{task.parentTask ? getTaskCode(task.parentTask.id, task.project?.name, task.parentTask.projectSequence) : `XH-${task.parentId}`}</span> {task.parentTask?.title || ''}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-[#1F6FEB] hover:underline transition-colors">
                      {task.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/dashboard/project/${task.project?.id || task.projectId}`}
                    className="text-[13px] text-[#42526E] hover:text-[#1F6FEB] hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.project?.name || 'Unknown Project'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                    {task.priority || 'MEDIUM'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <span className="text-[13px] font-semibold text-[#42526E]">{formatStatus(task.status)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[12px] text-[#5E6C84]">
                    <Calendar size={14} />
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTasks.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
            <CheckCircle2 size={48} className="text-[#36B37E] mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-[#172B4D]">All Clear</h3>
            <p className="text-sm text-[#5E6C84] mt-1">No tasks assigned to your node in this segment.</p>
          </div>
        )}
      </div>

      {isDetailModalOpen && activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId}
          projectId={tasks.find(t => t.id === activeTaskId)?.project?.id || 0}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={fetchMyTasks}
          onDelete={fetchMyTasks}
        />
      )}
    </div>
  );
};

export default MyTasks;
