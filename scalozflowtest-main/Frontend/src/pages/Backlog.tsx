import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  Layout,
  Settings,
  Edit2,
  X,
  Users,
  Zap,
  Bug,
  Bookmark,
  CheckSquare
} from 'lucide-react';
import api from '../services/api';
import type { Task, Sprint, Project, User } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import CreateIssueModal from '../components/CreateIssueModal';
import TaskDetailModal from '../components/TaskDetailModal';
import TeamMembersModal from '../components/TeamMembersModal';
import { getTaskCode } from '../services/projectUtils';

const Backlog = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { user: authUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  const isLead = authUser?.id === project?.createdBy?.id || authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN';

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'TASK' | 'EPIC'>('TASK');
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [openSprintMenuId, setOpenSprintMenuId] = useState<number | null>(null);
  const [openFilterMenuId, setOpenFilterMenuId] = useState<number | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [editingSprintId, setEditingSprintId] = useState<number | null>(null);
  const [editingAction, setEditingAction] = useState<'EDIT' | 'DATES'>('EDIT');
  const [editSprintData, setEditSprintData] = useState({ name: '', startDate: '', endDate: '' });
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editProjectData, setEditProjectData] = useState({ name: '', description: '', deadline: '' });

  const fetchData = async () => {
    try {
      const [projRes, tasksRes, sprintsRes, usersRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/tasks?projectId=${projectId}`),
        api.get(`/projects/${projectId}/sprints`),
        api.get('/auth/users')
      ]);
      setProject(projRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (projectId) fetchData();
    const handleClickOutside = () => {
      setOpenSprintMenuId(null);
      setOpenFilterMenuId(null);
      setShowHeaderMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const moveToSprint = async (taskId: number, sprintId: number | null) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task && ['Pending PM Review', 'Awaiting Clarification', 'Approved Awaiting Assignment', 'Rejected'].includes(task.status || '')) {
        addNotification('Locked', 'This task is in the PM review phase and cannot be moved or assigned to a sprint cycle.', 'warning');
        return;
      }

      const cleanedTask = { ...task };
      delete cleanedTask.subTasks;
      delete cleanedTask.parentTask;
      delete cleanedTask.project;
      delete cleanedTask.assignee;
      delete cleanedTask.coAssignee;
      delete cleanedTask.reporter;
      delete cleanedTask.sprint;

      await api.put(`/tasks/${taskId}`, {
        projectId: Number(projectId),
        sprintId: sprintId,
        task: {
          ...cleanedTask,
          environment: sprintId ? 'SPRINT' : 'BACKLOG'
        },
        assigneeId: task?.assigneeId || task?.assignee?.id || null,
        coAssigneeId: task?.coAssigneeId || task?.coAssignee?.id || null,
        parentId: task?.parentId || task?.parentTask?.id || null,
        reporterId: task?.reporterId || task?.reporter?.id || null
      });
      fetchData();
    } catch { fetchData(); }
  };

  const handleCreateSprint = async () => {
    try {
      const sprintCount = sprints.length;
      await api.post(`/projects/${projectId}/sprints`, {
        name: `Sprint ${sprintCount + 1}`,
        status: 'PLANNED',
        projectId: Number(projectId)
      });
      addNotification('Success', 'New sprint cycle initialized', 'success');
      fetchData();
    } catch { addNotification('Error', 'Failed to create sprint', 'error'); }
  };

  const handleEditSprintSubmit = async () => {
    try {
      await api.put(`/projects/${projectId}/sprints/${editingSprintId}`, {
        name: editSprintData.name,
        startDate: editSprintData.startDate || null,
        endDate: editSprintData.endDate || null
      });
      addNotification('Success', 'Sprint updated', 'success');
      setEditingSprintId(null);
      fetchData();
    } catch {
      addNotification('Error', 'Failed to update sprint', 'error');
    }
  };

  const deleteSprint = async (sprintId: number) => {
    if (!window.confirm('Delete this cycle? Issues will return to backlog.')) return;
    try {
      await api.delete(`/projects/${projectId}/sprints/${sprintId}`);
      addNotification('Deleted', 'Cycle removed', 'info');
      fetchData();
    } catch { addNotification('Error', 'Failed to delete cycle', 'error'); }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${projectId}`);
      addNotification('Success', 'Project moved to trash', 'success');
      navigate('/dashboard/projects');
    } catch {
      addNotification('Error', 'Failed to delete project', 'error');
    }
  };

  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${projectId}`, {
        ...project,
        name: editProjectData.name,
        description: editProjectData.description,
        deadline: editProjectData.deadline
      });
      addNotification('Success', 'Project configuration updated', 'success');
      setIsEditProjectModalOpen(false);
      fetchData();
    } catch {
      addNotification('Error', 'Failed to update project', 'error');
    }
  };

  const toggleMember = async (userId: number) => {
    try {
      const isMember = project?.teamMembers?.some((m) => m.id === userId);
      if (!project) return;
      const updatedMembers = isMember
        ? (project.teamMembers || []).filter((m) => m.id !== userId)
        : [...(project.teamMembers || []), allUsers.find(u => u.id === userId)];

      await api.put(`/projects/${projectId}`, {
        ...project,
        teamMembers: updatedMembers
      });
      fetchData();
      addNotification('Project Updated', isMember ? 'Member removed' : 'Member added', 'success');
    } catch {
      addNotification('Error', 'Failed to update members', 'error');
    }
  };

  const startCycle = async (sprintId: number, isKanban: boolean) => {
    if (sprints.some(s => s.status?.toUpperCase() === 'ACTIVE')) {
      addNotification('Active Cycle Exists', 'Complete your current cycle before starting a new one.', 'warning');
      return;
    }
    try {
      await api.put(`/projects/${projectId}/sprints/${sprintId}`, {
        status: 'ACTIVE',
        name: sprints.find(s => s.id === sprintId)?.name
      });
      addNotification('Success', `${isKanban ? 'Kanban' : 'Sprint'} started`, 'success');
      navigate(isKanban ? `/dashboard/project/${projectId}` : `/dashboard/sprint-board/${projectId}`);
    } catch { addNotification('Error', `Failed to start ${isKanban ? 'kanban' : 'sprint'}`, 'error'); }
  };

  const backlogTasks = tasks.filter(task => {
    // Only hide unapproved tasks from backlog to keep it clean, they should only appear once approved
    const statusUpper = (task.status || '').toUpperCase();
    if (statusUpper === 'REJECTED' || statusUpper === 'PENDING PM REVIEW' || statusUpper === 'AWAITING CLARIFICATION') return false;
    return !task.sprintId && (!task.sprint || !task.sprint.id);
  });
  const visibleBacklogTasks = backlogTasks.filter(t => {
    if (t.issueType === 'EPIC') return t.status?.toUpperCase() !== 'DONE';
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-10 h-10 border-4 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (project?.projectType === 'KANBAN') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white p-20 text-center">
        <Layout size={64} className="text-[#1F6FEB] mb-6 opacity-20" />
        <h2 className="text-2xl font-bold text-[#172B4D] mb-2">Backlog Restricted</h2>
        <p className="text-[#5E6C84] mb-8 max-w-md">Kanban projects use a continuous flow model. Please use the board to manage your work.</p>
        <Link to={`/dashboard/project/${projectId}`} className="jira-button-primary">Go to Board</Link>
      </div>
    );
  }

  const renderIssueRow = (task: Task) => {
    const isReviewState = ['Pending PM Review', 'Awaiting Clarification', 'Approved Awaiting Assignment', 'Rejected'].includes(task.status || '');
    return (
      <div
        key={task.id}
        className={`group flex items-center gap-4 px-4 py-2 border-b border-[#DFE1E6] transition-all ${isReviewState
          ? 'bg-gray-50/50 opacity-90 cursor-default hover:bg-gray-50'
          : 'bg-white hover:bg-[#F4F5F7] cursor-pointer'
          }`}
        onClick={() => { setActiveTaskId(task.id); setIsDetailModalOpen(true); }}
        onDragStart={(e) => {
          if (isReviewState) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('taskId', task.id.toString());
        }}
        draggable={!isReviewState}
      >
        <input type="checkbox" className="w-4 h-4 rounded border-[#DFE1E6]" onClick={e => e.stopPropagation()} />
        <div className="flex items-center justify-center shrink-0 w-4 h-4">
          {task.issueType === 'BUG' ? (
            <Bug size={14} className="text-[#FF5630]" />
          ) : task.issueType === 'EPIC' ? (
            <Zap size={14} className="text-[#6554C0]" />
          ) : task.issueType === 'STORY' ? (
            <Bookmark size={14} className="text-[#36B37E]" />
          ) : (
            <CheckSquare size={14} className="text-[#4C9AFF]" />
          )}
        </div>
        <span className="text-[13px] font-semibold text-[#42526E] min-w-[100px] uppercase">{getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}</span>

        {isReviewState && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${task.status === 'Pending PM Review' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
            task.status === 'Awaiting Clarification' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              task.status === 'Approved Awaiting Assignment' ? 'bg-green-50 text-green-700 border border-green-200' :
                'bg-red-50 text-red-700 border border-red-200'
            }`}>
            {task.status === 'Pending PM Review' ? 'Draft' :
              task.status === 'Awaiting Clarification' ? 'Clarification' :
                task.status === 'Approved Awaiting Assignment' ? 'Approved' :
                  'Rejected'}
          </span>
        )}

        {task.status?.toUpperCase() === 'OVERDUE' && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-[#FFEBE6] text-[#BF2600] border border-[#FFBDAD]">Overdue</span>
        )}

        <span className="text-[14px] font-medium text-[#172B4D] flex-1 truncate">{task.title}</span>

        <div className="flex items-center gap-4">
          {task.priority === 'HIGH' && <span className="bg-[#FFEBE6] text-[#BF2600] text-[10px] font-black px-2 py-0.5 rounded uppercase">High</span>}
          {task.priority === 'MEDIUM' && <span className="bg-[#FFF0B3] text-[#172B4D] text-[10px] font-black px-2 py-0.5 rounded uppercase">Medium</span>}

          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-[#00B3A4] border-2 border-white flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">
              {task.assignee?.name.charAt(0) || 'U'}
            </div>
          </div>

          {task.status === 'DONE' && <span className="text-[10px] font-black text-[#006644] uppercase tracking-tighter bg-[#E3FCEF] px-2 py-0.5 rounded">Done</span>}

          <div className="bg-[#F4F5F7] px-2 py-0.5 rounded text-[13px] font-semibold text-[#42526E] min-w-[20px] text-center">
            {task.storyPoints || 0}
          </div>

        </div>
      </div>
    );
  };

  const renderSprintCluster = (sprint: Sprint) => {
    const sprintTasksUnfiltered = tasks.filter(t => {
      const isSprint = (t.sprintId === sprint.id || (t.sprint && t.sprint.id === sprint.id));
      const statusUpper = (t.status || '').toUpperCase();
      return isSprint && statusUpper !== 'REJECTED' && statusUpper !== 'PENDING PM REVIEW' && statusUpper !== 'AWAITING CLARIFICATION';
    });
    const sprintTasks = sprintTasksUnfiltered.filter(t => {
      if (activeFilterId === 'high-priority') return t.priority === 'HIGH';
      if (activeFilterId === 'medium-priority') return t.priority === 'MEDIUM';
      return true;
    });
    const totalSP = sprintTasksUnfiltered.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    return (
      <div
        key={sprint.id}
        className="mb-10 border border-[#DFE1E6] rounded-md bg-white shadow-sm relative z-[1]"
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          const taskId = Number(e.dataTransfer.getData('taskId'));
          moveToSprint(taskId, sprint.id);
        }}
      >
        <div className="flex items-center justify-between px-4 py-4 bg-[#F4F5F7]/50 border-b border-[#DFE1E6] rounded-t-md">
          <div className="flex items-center gap-4">
            <ChevronDown size={20} className="text-[#42526E]" />
            <h3 className="text-[14px] font-semibold text-[#172B4D]">{sprint.name}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); setIsTeamModalOpen(true); }}
              className="flex -space-x-2 hover:opacity-80 transition-opacity p-1 rounded-lg hover:bg-gray-100 group"
            >
              {(project?.teamMembers || []).map(member => (
                <div key={member.id} title={member.name} className="w-6 h-6 rounded-full bg-[#1F6FEB] border-2 border-white flex items-center justify-center text-[8px] font-black uppercase shadow-sm text-white cursor-pointer">{member.name.charAt(0)}</div>
              ))}
            </button>
            <div className="flex items-center gap-2 relative">
              <button onClick={(e) => { e.stopPropagation(); setOpenFilterMenuId(openFilterMenuId === sprint.id ? null : sprint.id); }} className={`jira-button-subtle text-[11px] font-bold h-7 px-3 ${activeFilterId ? 'bg-[#E6EFFC] text-[#1F6FEB]' : ''}`}>
                Quick filters <ChevronDown size={12} />
              </button>
              {openFilterMenuId === sprint.id && (
                <div className="absolute top-8 left-0 w-40 bg-white border border-[#DFE1E6] rounded shadow-xl py-1 z-50">
                  <button onClick={(e) => { e.stopPropagation(); setActiveFilterId(activeFilterId === 'high-priority' ? null : 'high-priority'); setOpenFilterMenuId(null); }} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center hover:bg-[#F4F5F7] ${activeFilterId === 'high-priority' ? 'bg-[#E6EFFC] text-[#1F6FEB]' : 'text-[#172B4D]'}`}>High Priority {activeFilterId === 'high-priority' && <CheckCircle size={10} />}</button>
                  <button onClick={(e) => { e.stopPropagation(); setActiveFilterId(activeFilterId === 'medium-priority' ? null : 'medium-priority'); setOpenFilterMenuId(null); }} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center hover:bg-[#F4F5F7] ${activeFilterId === 'medium-priority' ? 'bg-[#E6EFFC] text-[#1F6FEB]' : 'text-[#172B4D]'}`}>Medium Priority {activeFilterId === 'medium-priority' && <CheckCircle size={10} />}</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setEditingAction('DATES'); setEditingSprintId(sprint.id); setEditSprintData({ name: sprint.name || '', startDate: sprint.startDate || '', endDate: sprint.endDate || '' }); }} className="jira-button-subtle text-[11px] font-bold h-7 px-3 flex items-center gap-1"><Clock size={12} />{sprint.startDate && sprint.endDate ? `${sprint.startDate} - ${sprint.endDate}` : 'Add dates'}</button>
            <button onClick={() => { setEditingAction('EDIT'); setEditingSprintId(sprint.id); setEditSprintData({ name: sprint.name || '', startDate: sprint.startDate || '', endDate: sprint.endDate || '' }); }} className="jira-button-subtle text-[11px] font-bold h-7 px-3">Edit sprint</button>

            {editingSprintId === sprint.id && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#091E42]/20" onClick={() => setEditingSprintId(null)}>
                <div className="bg-white rounded-lg shadow-xl w-[400px] p-6 border border-[#DFE1E6]" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-[#172B4D] mb-6">{editingAction === 'DATES' ? 'Set Sprint Lifecycle' : 'Edit Sprint Configuration'}</h3>
                  <div className="space-y-4">
                    {editingAction === 'EDIT' && (
                      <div>
                        <label className="block text-xs font-bold text-[#5E6C84] mb-1">Sprint name *</label>
                        <input type="text" value={editSprintData.name} onChange={e => setEditSprintData({ ...editSprintData, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#1F6FEB] transition-colors" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#5E6C84] mb-1">Start date</label>
                        <input type="date" value={editSprintData.startDate} onChange={e => setEditSprintData({ ...editSprintData, startDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#1F6FEB] transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#5E6C84] mb-1">End date</label>
                        <input type="date" value={editSprintData.endDate} onChange={e => setEditSprintData({ ...editSprintData, endDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#1F6FEB] transition-colors" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                    <button onClick={() => setEditingSprintId(null)} className="jira-button-subtle text-sm font-semibold h-8 px-3">Cancel</button>
                    <button onClick={handleEditSprintSubmit} className="jira-button-primary px-4 py-1.5 text-sm h-8">{editingAction === 'DATES' ? 'Save Dates' : 'Apply Pipeline'}</button>
                  </div>
                </div>
              </div>
            )}
            <button onClick={() => startCycle(sprint.id, (sprint.name || '').toLowerCase().includes('kanban'))} className="bg-[#1F6FEB] text-white text-[11px] font-black h-7 px-4 rounded hover:bg-[#003484] shadow-md shadow-blue-500/10">
              {(sprint.name || '').toLowerCase().includes('kanban') ? 'Start kanban' : 'Start sprint'}
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenSprintMenuId(openSprintMenuId === sprint.id ? null : sprint.id); }}
                className="p-1.5 hover:bg-[#EBECF0] rounded text-[#42526E]"
              >
                <MoreHorizontal size={18} />
              </button>
              {openSprintMenuId === sprint.id && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#DFE1E6] rounded shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button onClick={() => deleteSprint(sprint.id)} className="w-full text-left px-4 py-2 text-xs text-[#BF2600] flex items-center gap-2 hover:bg-[#FFEBE6] transition-colors"><Trash2 size={12} /> Delete cycle</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-[#DFE1E6] bg-[#F4F5F7]/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-medium text-[#172B4D]">
            <CheckCircle size={14} className="text-[#36B37E]" /> {sprint.name} · Total {sprintTasks.length} tasks · {totalSP} SP
          </div>
          <div className="flex items-center gap-3">
            <Search size={14} className="text-[#A5ADBA]" />
            <Filter size={14} className="text-[#A5ADBA]" />
          </div>
        </div>

        <div className="min-h-[40px]">
          {sprintTasks.map(renderIssueRow)}
          {sprintTasks.length === 0 && (
            <div className="p-10 text-center text-[15px] text-[#172B4D] italic border-b border-dashed border-[#DFE1E6]">
              Drag tasks here to plan your sprint cycle.
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-white hover:bg-[#F4F5F7] border-t border-[#DFE1E6] group rounded-b-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedSprintId(sprint.id); setCreateModalType('TASK'); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 text-sm font-semibold text-[#42526E] group-hover:text-[#1F6FEB] transition-colors"
            >
              <Plus size={18} className="text-[#1F6FEB]" /> Create task
            </button>
            <button
              onClick={() => { setSelectedSprintId(sprint.id); setCreateModalType('EPIC'); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 text-sm font-semibold text-[#42526E] group-hover:text-[#6554C0] transition-colors"
            >
              <Zap size={16} className="text-[#6554C0]" /> Create epic
            </button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col h-full bg-white font-sans text-sm overflow-y-auto custom-scrollbar-wide">
      <div className="px-10 pb-20 pt-8">
        {/* Breadcrumbs Cluster */}
        <div className="flex items-center gap-2 project-breadcrumb mb-3">
          <Link to="/dashboard/projects" className="hover:underline">Projects</Link>
          <ChevronRight size={14} />
          <Link to={`/dashboard/project-details/${projectId}`} className="hover:underline">{project?.name || 'Loading Project...'}</Link>
          <ChevronRight size={14} />
          <span>Backlog</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold text-[#172B4D] tracking-tight">Backlog</h1>
            <p className="text-[13px] text-[#00B3A4] mt-1">Organize and prioritize tasks before sprint planning</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <MoreHorizontal
                className={`text-[#42526E] cursor-pointer hover:bg-[#EBECF0] rounded p-1 transition-colors ${showHeaderMenu ? 'bg-[#EBECF0] text-[#1F6FEB]' : ''}`}
                size={26}
                onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }}
              />
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-2 border-b border-[#F4F5F7] mb-1">
                    <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-widest">Project Actions</p>
                  </div>
                  {isLead && (
                    <button onClick={() => { setIsBoardSettingsOpen(true); setShowHeaderMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Settings size={14} className="text-[#42526E]" /> Board settings</button>
                  )}
                  {isLead && (
                    <button onClick={() => { setEditProjectData({ name: project?.name || '', description: project?.description || '', deadline: project?.deadline || '' }); setIsEditProjectModalOpen(true); setShowHeaderMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Edit2 size={14} className="text-[#42526E]" /> Edit project</button>
                  )}
                  <button onClick={() => navigate(`/dashboard/project/${projectId}`)} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Layout size={14} className="text-[#42526E]" /> View workflow</button>
                  {isLead && (
                    <>
                      <div className="my-1 border-t border-[#F4F5F7]" />
                      <button onClick={handleDeleteProject} className="w-full text-left px-4 py-2 text-sm text-[#DE350B] hover:bg-[#FFEBE6] flex items-center gap-3 font-medium"><Trash2 size={14} /> Move to trash</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>


        {sprints.filter(s => s.status?.toUpperCase() !== 'ACTIVE' && s.status?.toUpperCase() !== 'COMPLETED').map(renderSprintCluster)}

        {/* Backlog Reservoir */}
        <div
          className="mt-6 border border-[#DFE1E6] rounded-md bg-white shadow-sm"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const taskId = Number(e.dataTransfer.getData('taskId'));
            moveToSprint(taskId, null);
          }}
        >
          <div className="px-4 py-3 bg-[#F4F5F7]/30 flex items-center justify-between rounded-t-md">
            <div className="flex items-center gap-4">
              <h3 className="text-[15px] font-bold text-[#172B4D] bg-white border border-[#DFE1E6] px-3 py-1 rounded">Backlog</h3>
              <span className="text-[15px] font-medium text-[#172B4D]">{visibleBacklogTasks.length} tasks ready</span>
            </div>
            <div className="flex gap-2">
              {project?.projectType === 'SCRUM' && isLead && (
                <button onClick={handleCreateSprint} className="jira-button-subtle text-[11px] font-bold h-8 px-4 border border-[#DFE1E6] bg-white">Create sprint</button>
              )}
            </div>
          </div>

          <div className="min-h-[100px]">
            {(() => {
              const epics = backlogTasks.filter(t => t.issueType === 'EPIC' && t.status?.toUpperCase() !== 'DONE');
              const nonEpics = backlogTasks.filter(t => t.issueType !== 'EPIC');
              const epicsWithTasks = epics.map(epic => {
                const children = tasks.filter(t => t.parentId === epic.id || (t.parentTask && t.parentTask.id === epic.id));
                return {
                  epic,
                  allChildren: children,
                  backlogChildren: children.filter(t => !t.sprintId && (!t.sprint || !t.sprint.id))
                };
              });
              const standaloneTasks = nonEpics.filter(t => {
                const parentId = t.parentId || t.parentTask?.id;
                if (!parentId) return true;
                const parentEpic = tasks.find(parent => parent.id === parentId);
                return !parentEpic || parentEpic.status?.toUpperCase() === 'DONE';
              });

              return (
                <>
                  {epicsWithTasks.map(({ epic, allChildren, backlogChildren }) => {
                    const totalTasks = allChildren.length;
                    const doneTasks = allChildren.filter((t) => {
                      const s = t.status?.toUpperCase();
                      return s === 'DONE' || s === 'CLOSED';
                    }).length;
                    const startedTasks = allChildren.filter((t) => {
                      const s = t.status?.toUpperCase();
                      return s && s !== 'TODO' && s !== 'TO DO' && s !== 'BACKLOG' && s !== 'DONE' && s !== 'CLOSED';
                    }).length;
                    let epicStatus: 'TODO' | 'IN PROGRESS' | 'DONE' = 'TODO';
                    if (totalTasks > 0 && doneTasks === totalTasks) epicStatus = 'DONE';
                    else if (startedTasks > 0 || doneTasks > 0) epicStatus = 'IN PROGRESS';
                    const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
                      'TODO': { label: 'TO DO', bg: '#EBECF0', color: '#42526E' },
                      'IN PROGRESS': { label: 'IN PROGRESS', bg: '#DEEBFF', color: '#1F6FEB' },
                      'DONE': { label: 'DONE', bg: '#E3FCEF', color: '#006644' },
                    };
                    const statusCfg = statusConfig[epicStatus];
                    const epicColor = epic.epicColor || '#6554C0';
                    return (
                      <div key={epic.id} className="border-b border-[#DFE1E6]">
                        <div
                          className="flex items-center gap-2 px-4 py-3 bg-[#F4F5F7]/40 hover:bg-[#EBECF0] transition-colors cursor-pointer group"
                          onClick={() => { setActiveTaskId(epic.id); setIsDetailModalOpen(true); }}
                        >
                          <ChevronDown size={14} className="text-[#42526E]" />
                          <div className="w-2 h-4 rounded-sm shrink-0" style={{ backgroundColor: epicColor }} />
                          <span className="text-[12px] font-black text-[#5E6C84] uppercase tracking-widest">{epic.title}</span>
                          <span className="text-[10px] font-bold ml-1" style={{ color: epicColor }}>
                            [{doneTasks}/{totalTasks} tasks completed]
                          </span>
                          <span
                            className="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                            style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                          >
                            {statusCfg.label}{epicStatus === 'DONE' ? ' ✅' : ''}
                          </span>
                        </div>
                        <div className="pl-4">
                          {backlogChildren.map(renderIssueRow)}
                        </div>
                      </div>
                    );
                  })}

                  {standaloneTasks.length > 0 && (
                    <div className="border-b border-[#DFE1E6]">
                      {epics.length > 0 && (
                        <div className="px-4 py-2 bg-[#F4F5F7]/20">
                          <span className="text-[15px] font-medium text-[#172B4D]">Standalone tasks</span>
                        </div>
                      )}
                      {standaloneTasks.map(renderIssueRow)}
                    </div>
                  )}

                  {backlogTasks.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center bg-white">
                      <div className="w-12 h-12 bg-[#F4F5F7] rounded-full flex items-center justify-center mb-4">
                        <HelpCircle size={24} className="text-[#C1C7D0]" />
                      </div>
                      <span className="text-[15px] text-[#172B4D] italic">Strategic backlog is currently empty.</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="px-4 py-3 bg-white hover:bg-[#F4F5F7] border-t border-[#DFE1E6] group rounded-b-md">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSelectedSprintId(null); setCreateModalType('TASK'); setIsCreateModalOpen(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-[#42526E] group-hover:text-[#1F6FEB] transition-colors"
              >
                <Plus size={18} className="text-[#1F6FEB]" /> Create task
              </button>
              <button
                onClick={() => { setSelectedSprintId(null); setCreateModalType('EPIC'); setIsCreateModalOpen(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-[#42526E] group-hover:text-[#6554C0] transition-colors"
              >
                <Zap size={16} className="text-[#6554C0]" /> Create epic
              </button>
            </div>
          </div>
        </div>
      </div>

      <CreateIssueModal
        isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}
        projectId={Number(projectId)}
        initialSprintId={selectedSprintId}
        initialStatus={selectedSprintId ? 'To Do' : 'Backlog'}
        initialIssueType={createModalType}
        onSuccess={(task, shouldView) => {
          fetchData();
          if (shouldView) {
            setActiveTaskId(task.id);
            setIsDetailModalOpen(true);
          }
        }}
      />

      {isDetailModalOpen && activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId} projectId={Number(projectId)}
          isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)}
          onUpdate={fetchData} onDelete={fetchData}
        />
      )}

      {isTeamModalOpen && project && (
        <TeamMembersModal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          members={project.teamMembers || []}
          projectName={project.name}
        />
      )}
      {isEditProjectModalOpen && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-[3px] max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#172B4D]">Edit Project</h2>
              <button onClick={() => setIsEditProjectModalOpen(false)} className="p-1 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E] transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditProjectSubmit} className="p-6 space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Project name</label>
                <input
                  type="text"
                  className="w-full bg-white border-2 border-[#DFE1E6] focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all"
                  value={editProjectData.name}
                  onChange={e => setEditProjectData({ ...editProjectData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Description</label>
                <textarea
                  className="w-full bg-white border-2 border-[#DFE1E6] focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all h-24 resize-none"
                  value={editProjectData.description}
                  onChange={e => setEditProjectData({ ...editProjectData, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Target Deadline</label>
                <input
                  type="date"
                  className="w-full bg-white border-2 border-[#DFE1E6] focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all"
                  value={editProjectData.deadline}
                  onChange={e => setEditProjectData({ ...editProjectData, deadline: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DFE1E6]">
                <button type="button" onClick={() => setIsEditProjectModalOpen(false)} className="px-4 py-2 text-sm font-bold text-[#42526E] hover:bg-[#F4F5F7] rounded-[3px]">Cancel</button>
                <button type="submit" className="bg-[#1F6FEB] text-white px-5 py-2 rounded-[3px] text-sm font-bold hover:bg-[#003484] transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isBoardSettingsOpen && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-[#F4F5F7]/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1F6FEB] text-white rounded-md flex items-center justify-center"><Settings size={18} /></div>
                <h2 className="text-lg font-bold text-[#172B4D]">Board Settings & Access</h2>
              </div>
              <button onClick={() => setIsBoardSettingsOpen(false)} className="p-1 hover:bg-[#EBECF0] rounded text-[#42526E] transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar-wide">
              <div className="mb-8">
                <h3 className="text-xs font-black text-[#5E6C84] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users size={14} /> Team Access Management
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {allUsers.filter(u => u.id !== project?.createdBy?.id).map(u => {
                    const isMember = project?.teamMembers?.some((m) => m.id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleMember(u.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${isMember ? 'border-[#1F6FEB] bg-[#E6EFFC]' : 'border-[#DFE1E6] bg-white hover:border-[#4C9AFF]'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase ${isMember ? 'bg-[#1F6FEB]' : 'bg-[#6B778C]'}`}>{u.name.charAt(0)}</div>
                          <div className="text-left">
                            <p className={`text-sm font-bold ${isMember ? 'text-[#1F6FEB]' : 'text-[#172B4D]'}`}>{u.name}</p>
                            <p className="text-[10px] text-[#5E6C84] truncate w-24">{u.role}</p>
                          </div>
                        </div>
                        {isMember ? <div className="w-5 h-5 bg-[#1F6FEB] text-white rounded-full flex items-center justify-center shadow-sm"><CheckCircle size={12} /></div> : <Plus size={14} className="text-[#5E6C84]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black text-[#5E6C84] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layout size={14} /> Board Metadata
                </h3>
                <div className="p-4 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6B778C] font-bold">Project Lead:</span>
                    <span className="text-[#172B4D] font-bold">{project?.createdBy?.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6B778C] font-bold">Active Members:</span>
                    <span className="text-[#172B4D] font-bold">{project?.teamMembers?.length || 0} collaborators</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-[#F4F5F7]/50 border-t border-[#DFE1E6] flex justify-end">
              <button onClick={() => setIsBoardSettingsOpen(false)} className="bg-[#1F6FEB] text-white px-6 py-2 rounded text-sm font-bold hover:bg-[#003484] shadow-md shadow-blue-500/20 transition-all">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backlog;
