import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Target,
  Clock,
  Plus,
  Layout,
  Edit2,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Settings,
  X,
  Users,
  CheckCircle,
  Bug,
  Bookmark,
  CheckSquare,
  Zap,
  ArrowLeft,
  Download,
  ExternalLink,
  CalendarDays
} from 'lucide-react';
import api from '../services/api';
import type { Task, BoardColumn, Sprint } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTaskCode } from '../services/projectUtils';
import CreateIssueModal from '../components/CreateIssueModal';
import TeamMembersModal from '../components/TeamMembersModal';

const SprintBoard = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIssueId = searchParams.get('selectedIssue');

  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedIssueId) {
      setActiveTaskId(Number(selectedIssueId));
      setIsDetailModalOpen(true);
    }
  }, [selectedIssueId]);


  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);


  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<number | null>(null);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [issueModalStatus, setIssueModalStatus] = useState<{ status: string, columnId: number } | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'assignee'>('none');
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateDropdownOpen]);

  // Project Settings & Actions State
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: '', description: '', deadline: '' });
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const isLead = user?.role === 'ADMIN' || user?.role === 'MANAGER' || (project && user && project.createdBy?.id === user.id);
  const isManager = isLead; // Map existing check to isLead
  const normalizeStatus = (status?: string, colNames: string[] = []) => {
    if (!status) return colNames[0] || 'Todo';

    const upperStatus = status.trim().toUpperCase();
    const reviewStatuses = ['PENDING PM REVIEW', 'AWAITING CLARIFICATION', 'APPROVED AWAITING ASSIGNMENT', 'REJECTED'];
    if (reviewStatuses.includes(upperStatus)) {
      return colNames[0] || 'Todo';
    }

    const normalized = status.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const exactMatch = colNames.find(c => c.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
    return exactMatch || status;
  };

  useEffect(() => {
    fetchData();
    const handleClickOutside = () => {
      setShowHeaderMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [projectId]);

  const fetchData = async () => {
    if (!projectId || projectId === 'undefined') return;
    try {
      const [sprintsRes, colRes, projRes, usersRes] = await Promise.all([
        api.get(`/projects/${projectId}/sprints`),
        api.get(`/columns?projectId=${projectId}`),
        api.get(`/projects/${projectId}`),
        api.get('/auth/users')
      ]);
      const active = (sprintsRes.data || []).find((s: Sprint) => s.status?.toUpperCase() === 'ACTIVE');
      setActiveSprint(active || null);
      setProject(projRes.data);
      if (colRes.data?.length > 0) {
        setColumns(colRes.data);
      } else {
        // Self-heal: Initialize missing columns in DB
        const defaults = (projRes.data?.projectType || '').toUpperCase() === 'SCRUM' ? ['To Do', 'In Progress', 'Done', 'UAT'] : ['To Do', 'In Progress', 'In Review', 'Done', 'UAT'];
        await Promise.all(defaults.map((name, index) =>
          api.post('/columns', { projectId: Number(projectId), name, orderIndex: index })
        ));
        const refreshedCols = await api.get(`/columns?projectId=${projectId}`);
        setColumns(refreshedCols.data);
      }
      setAllUsers(usersRes.data || []);

      if (active) {
        const tasksRes = await api.get(`/tasks?sprintId=${active.id}`);
        const reviewStatuses = ['Pending PM Review', 'Awaiting Clarification', 'Rejected'];
        const filteredTasks = (tasksRes.data || []).filter((t: any) => {
          const isSubtask = t.parentId || t.parentTask;
          if (isSubtask && reviewStatuses.includes(t.status)) {
            return false;
          }
          return true;
        });
        setTasks(filteredTasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Sync Failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${projectId}`);
      addNotification('Success', 'Project deleted successfully', 'success');
      navigate('/dashboard/projects');
    } catch (err) {
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
    } catch (err) {
      addNotification('Error', 'Failed to update project', 'error');
    }
  };

  const toggleMember = async (userId: number) => {
    try {
      const isMember = project?.teamMembers?.some((m: any) => m.id === userId);
      if (!project) return;
      const updatedMembers = isMember
        ? (project.teamMembers || []).filter((m: any) => m.id !== userId)
        : [...(project.teamMembers || []), allUsers.find(u => u.id === userId)];

      await api.put(`/projects/${projectId}`, {
        ...project,
        teamMembers: updatedMembers
      });
      fetchData();
      addNotification('Project Updated', isMember ? 'Member removed' : 'Member added', 'success');
    } catch (err) {
      addNotification('Error', 'Failed to update members', 'error');
    }
  };
  const toggleUserExpansion = (userId: number) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) newExpanded.delete(userId);
    else newExpanded.add(userId);
    setExpandedUsers(newExpanded);
  };

  const getAllMembers = () => {
    const members = [...(project?.teamMembers || [])];
    if (project?.createdBy && !members.some(m => m.id === project.createdBy.id)) {
      members.push(project.createdBy);
    }
    return members;
  };

  useEffect(() => {
    if (!loading && project && project.projectType?.toUpperCase() === 'KANBAN') {
      navigate(`/dashboard/project/${projectId}`);
    }
  }, [loading, project, projectId, navigate]);

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.status?.toUpperCase() === 'DONE') {
      addNotification('Locked', 'This task is completed and cannot be moved out of Done.', 'warning');
      return;
    }
    if (['Pending PM Review', 'Awaiting Clarification', 'Rejected'].includes(task.status || '')) {
      addNotification('Locked', 'This task is in the PM review phase and cannot be moved.', 'warning');
      return;
    }
    const updatedTask = { ...task, status: newStatus };
    setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
    try {
      const sprintId = activeSprint?.id ?? (task as any).sprintId ?? (task as any).sprint?.id ?? null;
      const assigneeId = (task as any).assigneeId ?? (task as any).assignee?.id ?? null;
      const parentId = (task as any).parentId ?? (task as any).parentTask?.id ?? null;
      await api.put(`/tasks/${taskId}`, {
        task: {
          title: task.title,
          description: task.description,
          status: newStatus,
          priority: task.priority,
          storyPoints: task.storyPoints,
          dueDate: task.dueDate,
          orderIndex: task.orderIndex,
          columnId: task.columnId,
          issueType: task.issueType,
          tags: task.tags,
          attachments: task.attachments,
          epicColor: (task as any).epicColor,
        },
        projectId: Number(projectId),
        sprintId,
        assigneeId,
        parentId,
      });
      addNotification('Success', `Task moved to ${newStatus}`, 'success');
      fetchData(); // Re-sync board with backend after successful status change
    } catch (err) {
      fetchData();
      addNotification('Error', 'Failed to update task status', 'error');
    }
  };

  const handleSwapColumns = async (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    const sourceIndex = columns.findIndex(c => c.id === sourceId);
    const targetIndex = columns.findIndex(c => c.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    // Optimistic update
    setColumns(newColumns);

    try {
      // Update each column's orderIndex in the backend sequentially for stability
      // This uses the existing PUT /api/columns/{id} which is already mapped and active
      for (let i = 0; i < newColumns.length; i++) {
        const col = newColumns[i];
        await api.put(`/columns/${col.id}`, { orderIndex: i });
      }
      addNotification('Success', 'Board layout saved', 'success');
    } catch (err: any) {
      console.error("Persistence failure", err);
      const errorMsg = err.response?.data?.error || 'Failed to sync with server';
      addNotification('Warning', `Layout saved locally: ${errorMsg}`, 'warning');
    }
  };



  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      await api.post('/columns', {
        projectId: Number(projectId),
        name: newColumnName.trim(),
        orderIndex: columns.length + 1
      });
      setNewColumnName('');
      setIsAddingColumn(false);
      fetchData();
      addNotification('Success', 'Column created', 'success');
    } catch (err) {
      addNotification('Error', 'Failed to create column', 'error');
    }
  };

  const handleEditColumn = async (colId: number) => {
    if (!editColumnName.trim()) {
      setEditingColumnId(null);
      return;
    }
    try {
      await api.put(`/columns/${colId}`, { name: editColumnName.trim() });
      setEditingColumnId(null);
      fetchData();
      addNotification('Success', 'Column updated', 'success');
    } catch (err) {
      addNotification('Error', 'Failed to update column', 'error');
      setEditingColumnId(null);
    }
  };

  const handleDeleteColumn = async (colId: number) => {
    const column = columns.find(c => c.id === colId);
    if (!column) return;

    const colTasks = tasks.filter(t => normalizeStatus(t.status, columns.map(c => c.name)) === column.name);

    if (colTasks.length > 0) {
      const otherColumns = columns.filter(c => c.id !== colId);
      if (otherColumns.length === 0) {
        addNotification('Error', 'Cannot delete the last column.', 'error');
        return;
      }

      const targetColName = prompt(`This column has ${colTasks.length} tasks. Enter the name of the column to move them to: (${otherColumns.map(c => c.name).join(', ')})`);
      if (!targetColName) return;

      const targetCol = otherColumns.find(c => c.name.toLowerCase() === targetColName.toLowerCase());
      if (!targetCol) {
        addNotification('Error', 'Invalid target column name.', 'error');
        return;
      }

      try {
        await api.delete(`/columns/${colId}?moveTasksTo=${targetCol.id}`);
        fetchData();
        addNotification('Success', 'Column deleted and tasks moved', 'success');
      } catch (err: any) {
        addNotification('Error', err.response?.data?.message || 'Failed to delete column', 'error');
      }
    } else {
      if (!window.confirm("Are you sure you want to delete this column?")) return;
      try {
        await api.delete(`/columns/${colId}`);
        fetchData();
        addNotification('Success', 'Column deleted', 'success');
      } catch (err: any) {
        addNotification('Error', err.response?.data?.message || 'Failed to delete column', 'error');
      }
    }
  };



  const completeSprint = async () => {
    if (!activeSprint) return;
    try {
      await api.put(`/projects/${projectId}/sprints/${activeSprint.id}`, { ...activeSprint, status: 'COMPLETED' });
      addNotification('Success', 'Sprint Closed', 'success');
      fetchData();
    } catch (err) { addNotification('Error', 'Failure', 'error'); }
  };

  if (loading) return <div className="p-10 font-bold text-[#5E6C84]">Syncing Board...</div>;

  if (!activeSprint) {
    return (
      <div className="board-container h-full flex flex-col items-center justify-center text-center p-20 bg-white">
        <div className="w-24 h-24 bg-[#F4F5F7] rounded-3xl flex items-center justify-center text-[#C1C7D0] mb-6"><Target size={48} /></div>
        <h2 className="text-2xl font-bold text-[#172B4D] mb-2">No Active Sprint</h2>
        <p className="text-[#5E6C84] mb-6">Start a sprint from the backlog to begin.</p>
        <Link to={`/dashboard/backlog/${projectId}`} className="jira-button-primary scale-110">Go to Backlog</Link>
      </div>
    );
  }

  const displayedTasks = tasks.filter(t => {
    // Hide unapproved tasks from the board. They should only appear in the PM Review queue
    // until they are approved (or if they are standard tasks not needing review).
    const statusUpper = (t.status || '').toUpperCase();
    if (statusUpper === 'REJECTED' || statusUpper === 'PENDING PM REVIEW' || statusUpper === 'AWAITING CLARIFICATION') return false;

    if (dateFilterStart || dateFilterEnd) {
      if (!t.createdAt) return false;
      let d: Date;
      if (Array.isArray(t.createdAt)) {
        const [year, month, day] = t.createdAt;
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(t.createdAt);
      }

      if (isNaN(d.getTime())) return false;

      d.setHours(0, 0, 0, 0);

      if (dateFilterStart && dateFilterEnd) {
        const start = new Date(dateFilterStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateFilterEnd);
        end.setHours(0, 0, 0, 0);
        if (d < start || d > end) return false;
      } else if (dateFilterStart) {
        const start = new Date(dateFilterStart);
        start.setHours(0, 0, 0, 0);
        if (d.getTime() !== start.getTime()) return false;
      } else if (dateFilterEnd) {
        const end = new Date(dateFilterEnd);
        end.setHours(0, 0, 0, 0);
        if (d.getTime() !== end.getTime()) return false;
      }
    }
    return true;
  });

  return (
    <div className="board-container h-full bg-white flex flex-col overflow-hidden animate-in fade-in duration-500">
      <div className="px-8 pt-6 pb-4 border-b border-[#DFE1E6]">
        <div className="flex items-center gap-2 project-breadcrumb mb-3">
          <Link to="/dashboard/projects" className="hover:underline transition-colors">Workspace</Link>
          <span className="text-[#DFE1E6]">/</span>
          <Link to={`/dashboard/project-details/${projectId}`} className="hover:underline transition-colors">{project?.name || 'Project'}</Link>
          <span className="text-[#DFE1E6]">/</span>
          <span>Active Sprint</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="section-title tracking-tight flex items-center gap-3">
              {activeSprint.name}
            </h1>
            <p className="section-subtitle mt-1 tracking-tight">Iterative Delivery • {project?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={dateDropdownRef}>
              <button
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className={`flex items-center justify-center p-1.5 rounded-[3px] transition-colors border ${
                  isDateDropdownOpen ? 'bg-[#E9F2FF] text-[#1F6FEB] border-[#1F6FEB]' : 'bg-[#F4F5F7] text-[#5E6C84] border-[#DFE1E6] hover:bg-[#EBECF0]'
                }`}
                title="Filter by Date"
              >
                <CalendarDays size={16} />
                {(dateFilterStart || dateFilterEnd) && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#DE350B] rounded-full border-[0.5px] border-white"></span>
                )}
              </button>
              
              {isDateDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-[#DFE1E6] rounded-md shadow-lg p-3 z-[100] flex flex-col gap-2 min-w-[200px]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-[#5E6C84]">Filter by Date</span>
                    <button onClick={() => setIsDateDropdownOpen(false)} className="text-[#5E6C84] hover:bg-[#F4F5F7] rounded p-0.5"><X size={14} /></button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase">Start Date</label>
                    <input
                      type="date"
                      value={dateFilterStart}
                      onChange={e => setDateFilterStart(e.target.value)}
                      className="w-full bg-[#F4F5F7] border border-[#DFE1E6] focus:border-[#4C9AFF] rounded-[3px] px-2 py-1 text-[11px] outline-none text-[#172B4D]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase">End Date</label>
                    <input
                      type="date"
                      value={dateFilterEnd}
                      onChange={e => setDateFilterEnd(e.target.value)}
                      className="w-full bg-[#F4F5F7] border border-[#DFE1E6] focus:border-[#4C9AFF] rounded-[3px] px-2 py-1 text-[11px] outline-none text-[#172B4D]"
                    />
                  </div>
                  {(dateFilterStart || dateFilterEnd) && (
                    <button
                      onClick={() => { setDateFilterStart(''); setDateFilterEnd(''); }}
                      className="text-[11px] font-bold text-[#DE350B] hover:bg-[#FFEBE6] p-1 rounded transition-colors mt-1"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-[#F4F5F7] p-1 rounded-[3px] border border-[#DFE1E6] mr-4">
              <button
                onClick={() => setGroupBy('none')}
                className={`px-3 py-1 text-[10px] font-bold rounded-[3px] transition-all ${groupBy === 'none' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
              >
                STATUS
              </button>
              <button
                onClick={() => {
                  setGroupBy('assignee');
                  setExpandedUsers(new Set()); // Collapse all by default
                }}
                className={`px-3 py-1 text-[10px] font-bold rounded-[3px] transition-all ${groupBy === 'assignee' ? 'bg-white text-[#1F6FEB] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
              >
                ASSIGNEE
              </button>
            </div>

            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="flex -space-x-1 hover:opacity-80 transition-opacity p-1 rounded-lg hover:bg-gray-50 group"
              title="View all team members"
            >              {getAllMembers().map((member: any) => {
              const memberName = (member?.name || '').trim() || 'Team Member';
              const isLead = project?.createdBy?.id === member.id;

              return (
                <div
                  key={member.id}
                  title={isLead ? `${memberName} (Lead)` : memberName}
                  className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm cursor-pointer hover:z-10 transition-transform hover:scale-110 ${isLead ? 'bg-[#00B3A4] ring-2 ring-[#00B3A4]/10' : 'bg-[#1F6FEB]'
                    }`}
                >
                  {memberName.charAt(0).toUpperCase()}
                </div>
              );
            })}
            </button>

            {isManager && <button onClick={completeSprint} className="jira-button-primary px-4">Complete Sprint</button>}

            {/* Project Actions & Settings Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }}
                className={`p-1.5 hover:bg-[#EBECF0] rounded text-[#42526E] transition-colors ${showHeaderMenu ? 'bg-[#EBECF0]' : ''}`}
                title="Project Actions"
              >
                <MoreHorizontal size={20} />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-2 border-b border-[#F4F5F7] mb-1">
                    <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-widest">Project Actions</p>
                  </div>
                  {isLead && (
                    <>
                      <button onClick={() => { setIsBoardSettingsOpen(true); setShowHeaderMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Settings size={14} className="text-[#42526E]" /> Board settings</button>
                      <button onClick={() => { setEditProjectData({ name: project?.name || '', description: project?.description || '', deadline: project?.deadline || '' }); setIsEditProjectModalOpen(true); setShowHeaderMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Edit2 size={14} className="text-[#42526E]" /> Edit project</button>
                    </>
                  )}
                  <button onClick={() => navigate(`/dashboard/project-details/${projectId}`)} className="w-full text-left px-4 py-2 text-sm text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-3"><Layout size={14} className="text-[#42526E]" /> View details</button>
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#F4F5F7] rounded-full text-[11px] font-bold text-[#42526E] border border-[#DFE1E6]">
            <Clock size={14} /> {activeSprint.startDate} - {activeSprint.endDate || 'Ongoing'}
          </div>
          {(() => {
            const total = tasks.length || 1;
            const done = tasks.filter(t => {
              const s = (t.status || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              return s === 'done' || s === 'complete' || s === 'closed' || s === 'resolved';
            }).length;
            const progress = Math.round((done / total) * 100);
            return (
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-[#EBECF0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#36B37E]" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] font-bold text-[#5E6C84]">{progress}% Done</span>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="board-content custom-scrollbar-wide">
        {groupBy === 'none' ? (
          <div className="flex gap-6 h-fit min-h-full min-w-max pb-4">
            {columns.map(col => {
              const colTasks = displayedTasks.filter(t => normalizeStatus(t.status, columns.map(c => c.name)) === col.name);
              return (
                <div
                  key={col.id}
                  draggable={true}
                  onDragStart={e => {
                    setDraggingColumnId(col.id);
                    e.dataTransfer.setData('columnId', col.id.toString());
                  }}
                  onDragEnd={() => {
                    setDraggingColumnId(null);
                    setDragOverColumn(null);
                  }}
                  className={`w-72 flex flex-col transition-all duration-300 ${dragOverColumn === col.id ? 'scale-[1.02] bg-[#F4F7FB] ring-2 ring-[#1F6FEB] ring-inset rounded-lg z-10' : ''} ${draggingColumnId === col.id ? 'opacity-40 grayscale' : ''}`}
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverColumn(col.id);
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={e => {
                    const droppedColumnId = e.dataTransfer.getData('columnId');
                    const droppedTaskId = e.dataTransfer.getData('taskId');

                    setDragOverColumn(null);

                    if (droppedColumnId) {
                      handleSwapColumns(Number(droppedColumnId), col.id);
                    } else if (droppedTaskId) {
                      handleUpdateTaskStatus(Number(droppedTaskId), col.name);
                    }
                  }}
                >
                  <div className={`board-column-header sprint-column-header flex items-center justify-between px-3 py-2 bg-[#1F6FEB] border border-[#DFE1E6]/10 rounded-t-lg group border-b-0 cursor-move`}>
                    {editingColumnId === col.id ? (
                      <input
                        type="text"
                        value={editColumnName}
                        onChange={e => setEditColumnName(e.target.value)}
                        className="flex-1 px-2 py-0.5 text-[10px] font-bold uppercase border border-[#1F6FEB] rounded outline-none w-full mr-2"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditColumn(col.id);
                          if (e.key === 'Escape') setEditingColumnId(null);
                        }}
                        onBlur={() => handleEditColumn(col.id)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="column-title text-[15px] font-medium text-white uppercase tracking-widest">{col.name}{colTasks.length > 0 ? ` (${colTasks.length})` : ''}</span>
                          {isManager && (
                            <div className="hidden group-hover:flex items-center gap-1">
                              <button onClick={() => { setEditingColumnId(col.id); setEditColumnName(col.name); }} className="text-white/80 hover:text-white"><Edit2 size={12} /></button>
                              <button onClick={() => handleDeleteColumn(col.id)} className="text-white/80 hover:text-red-300"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIssueModalStatus({ status: col.name, columnId: col.id });
                              setIsIssueModalOpen(true);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex-1 bg-[#F4F5F7]/30 border border-[#DFE1E6] border-t-0 rounded-b-lg p-3 space-y-3 min-h-[600px] shadow-inner">
                    {colTasks.map(task => {
                      const isReviewState = ['Pending PM Review', 'Awaiting Clarification', 'Approved Awaiting Assignment', 'Rejected'].includes(task.status || '');
                      const isLockedState = ['Pending PM Review', 'Awaiting Clarification', 'Rejected', 'Done', 'DONE'].includes(task.status || '');
                      return (
                        <div
                          key={task.id}
                          draggable={true}
                          onDragStart={e => {
                            e.stopPropagation(); // Prevent column drag from firing
                            if (isLockedState) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData('taskId', task.id.toString());
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => { setActiveTaskId(task.id); setIsDetailModalOpen(true); }}
                          className={`p-4 transition-all group relative flex flex-col gap-3 rounded-md border shadow-sm ${isLockedState
                            ? 'bg-gray-50/70 border-dashed border-[#DFE1E6]/80 cursor-default opacity-85 hover:border-gray-400'
                            : 'bg-white border-[#DFE1E6] hover:border-[#1F6FEB] hover:shadow-md cursor-grab active:cursor-grabbing'
                            }`}
                        >
                          {/* Parent/Epic Badge */}
                          {task.parentTask && (
                            <div className="flex items-center gap-1 bg-[#F4F5F7] px-1.5 py-0.5 rounded-[2px] w-fit border border-[#DFE1E6]" title={`Subtask of: ${task.parentTask.title}`}>
                              <span className="text-[8px] font-black text-[#0052CC] bg-[#E9F2FF] px-1 rounded-[1px] tracking-tight">SUB</span>
                              <span className="text-[9px] font-black text-[#5E6C84] uppercase tracking-tighter truncate max-w-[120px]">
                                {getTaskCode(task.parentTask.id, task.project?.name, task.parentTask.projectSequence)}
                              </span>
                            </div>
                          )}

                          {/* PM Workflow Status Badge */}
                          {isReviewState && (
                            <div className="flex items-center gap-1.5 w-fit">
                              {task.status === 'Pending PM Review' && (
                                <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-black tracking-wider bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                                  Draft
                                </span>
                              )}
                              {task.status === 'Awaiting Clarification' && (
                                <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-black tracking-wider bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                  Clarification
                                </span>
                              )}
                              {task.status === 'Approved Awaiting Assignment' && (
                                <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-black tracking-wider bg-green-50 text-green-700 border border-green-200 uppercase">
                                  Approved
                                </span>
                              )}
                              {task.status === 'Rejected' && (
                                <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-black tracking-wider bg-red-50 text-red-700 border border-red-200 uppercase">
                                  Rejected
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-[13px] font-bold text-[#172B4D] leading-snug group-hover:text-[#1F6FEB] transition-colors line-clamp-3">
                            {task.title}
                          </p>

                          <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#F4F5F7]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                                {task.issueType === 'BUG' ? (
                                  <Bug size={14} className="text-[#E54937]" />
                                ) : task.issueType === 'STORY' ? (
                                  <Bookmark size={14} className="text-[#36B37E]" />
                                ) : task.issueType === 'EPIC' ? (
                                  <Zap size={14} className="text-[#6554C0]" />
                                ) : (
                                  <CheckSquare size={14} className="text-[#4C9AFF]" />
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">{getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[3px] uppercase tracking-wider shrink-0 ${task.issueType === 'BUG' ? 'bg-[#E54937]/15 text-[#E54937]' :
                                task.issueType === 'STORY' ? 'bg-[#36B37E]/15 text-[#36B37E]' :
                                  task.issueType === 'EPIC' ? 'bg-[#6554C0]/15 text-[#6554C0]' :
                                    'bg-[#4C9AFF]/15 text-[#4C9AFF]'
                                }`}>
                                {task.issueType || 'TASK'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {task.priority && (
                                <div className="text-[13px] font-bold text-[#0B3D91]">
                                  {task.priority.charAt(0)}
                                </div>
                              )}
                              <div className="w-6 h-6 rounded-full bg-[#00B3A4] flex items-center justify-center text-[9px] font-black text-white border border-white shadow-sm ring-1 ring-[#00B3A4]/20">
                                {task.assignee?.name.charAt(0) || '?'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Task button at bottom of each column */}
                    <button
                      onClick={() => {
                        setIssueModalStatus({ status: col.name, columnId: col.id });
                        setIsIssueModalOpen(true);
                      }}
                      className="w-full py-2 flex items-center gap-2 text-[#5E6C84] hover:bg-[#F4F5F7] hover:text-[#172B4D] rounded-[3px] transition-all px-2 mt-2"
                    >
                      <Plus size={16} />
                      <span className="text-sm font-medium">Create task</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {isManager && (
              <div className="w-72 flex flex-col pt-0 shrink-0">
                {!isAddingColumn ? (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="flex items-center gap-2 px-4 py-3 bg-white/60 border border-dashed border-[#DFE1E6] rounded-lg text-[#5E6C84] hover:bg-[#EBECF0] hover:text-[#172B4D] transition-colors"
                  >
                    <Plus size={16} /> <span className="text-sm font-bold">Add Column</span>
                  </button>
                ) : (
                  <div className="p-3 bg-white border border-[#DFE1E6] rounded-lg shadow-sm">
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={e => setNewColumnName(e.target.value)}
                      placeholder="Column name..."
                      className="w-full px-3 py-2 text-sm border border-[#DFE1E6] rounded mb-3 focus:outline-none focus:border-[#1F6FEB]"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={handleAddColumn} className="jira-button-primary px-3 py-1 text-xs">Add</button>
                      <button onClick={() => { setIsAddingColumn(false); setNewColumnName(''); }} className="text-[#5E6C84] hover:text-[#172B4D] text-xs font-bold">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8 pb-20 pt-6 px-6">
            {/* User Board List */}
            <div className="space-y-6">
              {getAllMembers().map(member => {
                const isExpanded = expandedUsers.has(member.id);
                const userTasks = displayedTasks.filter(t => (t.assignee?.id || (t as any).assigneeId) === member.id);

                if (userTasks.length === 0 && (dateFilterStart || dateFilterEnd)) return null;

                return (
                  <div key={member.id} className="flex flex-col group/user">
                    {/* Collapsible User Card (Picture 2) */}
                    <div
                      onClick={() => toggleUserExpansion(member.id)}
                      className={`flex items-center gap-4 py-4 px-6 bg-white border border-[#DFE1E6] hover:border-[#1F6FEB] hover:shadow-md cursor-pointer rounded-lg transition-all w-fit min-w-[320px] relative z-[10] ${isExpanded ? 'border-[#1F6FEB] shadow-sm' : ''}`}
                    >
                      <div className="text-[#6B778C] transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                        <ChevronRight size={18} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-[#1F6FEB] flex items-center justify-center text-sm font-black text-white shadow-inner ring-2 ring-white">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-base font-bold text-[#172B4D] tracking-tight">{member.name}</span>
                      <div className="ml-4 px-3 py-1 bg-[#E9F2FF] text-[#1F6FEB] text-[10px] font-black uppercase tracking-widest rounded-full border border-[#B3D4FF]">
                        {userTasks.length} Work Items
                      </div>
                    </div>

                    {/* Nested Individual Board (Picture 3) */}
                    {isExpanded && (
                      <div className="flex gap-6 mt-6 ml-6 animate-in slide-in-from-top-4 duration-500 ease-out overflow-x-auto pb-4 no-scrollbar">
                        {columns.map(col => {
                          const colTasks = userTasks.filter(t => normalizeStatus(t.status, columns.map(c => c.name)) === col.name);
                          return (
                            <div
                              key={col.id}
                              className="w-[300px] flex flex-col bg-[#F4F5F7]/30 rounded-lg p-4 border border-[#DFE1E6]/50 group/col hover:bg-[#F4F5F7]/60 transition-colors min-h-[300px] shrink-0"
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                const taskId = e.dataTransfer.getData('taskId');
                                if (taskId) handleUpdateTaskStatus(Number(taskId), col.name);
                              }}
                            >
                              {/* Nested Column Header */}
                              <div className="flex items-center justify-between mb-5 px-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black text-[#42526E] uppercase tracking-widest">{col.name}</span>
                                  <span className="text-[10px] font-bold text-[#5E6C84] bg-[#EBECF0] px-2 py-0.5 rounded-full">{colTasks.length}</span>
                                </div>
                              </div>

                              {/* Task Cards */}
                              <div className="space-y-4 flex-1">
                                {colTasks.map(task => (
                                  <div
                                    key={task.id}
                                    draggable={true}
                                    onDragStart={e => {
                                      e.stopPropagation();
                                      e.dataTransfer.setData('taskId', task.id.toString());
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onClick={() => { setActiveTaskId(task.id); setIsDetailModalOpen(true); }}
                                    className="p-4 bg-white border border-[#DFE1E6] rounded-md shadow-sm hover:border-[#1F6FEB] hover:shadow-md transition-all cursor-grab active:cursor-grabbing group/card relative flex flex-col gap-3"
                                  >
                                    {/* Parent/Epic Badge */}
                                    {task.parentTask && (
                                      <div className="flex items-center gap-1 bg-[#F4F5F7] px-1.5 py-0.5 rounded-[2px] w-fit border border-[#DFE1E6]" title={`Subtask of: ${task.parentTask.title}`}>
                                        <span className="text-[8px] font-black text-[#0052CC] bg-[#E9F2FF] px-1 rounded-[1px] tracking-tight">SUB</span>
                                        <span className="text-[9px] font-black text-[#5E6C84] uppercase tracking-tighter truncate max-w-[120px]">
                                          {getTaskCode(task.parentTask.id, task.project?.name || project?.name, task.parentTask.projectSequence)}
                                        </span>
                                      </div>
                                    )}

                                    <p className="text-[13px] font-bold text-[#172B4D] leading-snug group-hover/card:text-[#1F6FEB] transition-colors line-clamp-3">
                                      {task.title}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#F4F5F7]">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center justify-center w-4 h-4 shrink-0">
                                          {task.issueType === 'BUG' ? (
                                            <Bug size={14} className="text-[#E54937]" />
                                          ) : task.issueType === 'STORY' ? (
                                            <Bookmark size={14} className="text-[#36B37E]" />
                                          ) : task.issueType === 'EPIC' ? (
                                            <Zap size={14} className="text-[#6554C0]" />
                                          ) : (
                                            <CheckSquare size={14} className="text-[#4C9AFF]" />
                                          )}
                                        </div>
                                        <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">{getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[3px] uppercase tracking-wider shrink-0 ${task.issueType === 'BUG' ? 'bg-[#E54937]/15 text-[#E54937]' :
                                          task.issueType === 'STORY' ? 'bg-[#36B37E]/15 text-[#36B37E]' :
                                            task.issueType === 'EPIC' ? 'bg-[#6554C0]/15 text-[#6554C0]' :
                                              'bg-[#4C9AFF]/15 text-[#4C9AFF]'
                                          }`}>
                                          {task.issueType || 'TASK'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {task.priority && (
                                          <div className="text-[13px] font-bold text-[#0B3D91]">
                                            {task.priority.charAt(0)}
                                          </div>
                                        )}
                                        <div className="w-6 h-6 rounded-full bg-[#1F6FEB] border-2 border-white shadow-sm flex items-center justify-center text-[9px] font-black text-white shrink-0">
                                          {member.name.charAt(0)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {colTasks.length === 0 && (
                                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-[#DFE1E6] rounded-xl opacity-20 group-hover/col:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-tighter">Drop Here</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isDetailModalOpen && activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId} projectId={Number(projectId)}
          isOpen={isDetailModalOpen} onClose={() => {
            setIsDetailModalOpen(false);
            if (searchParams.has('selectedIssue')) {
              searchParams.delete('selectedIssue');
              setSearchParams(searchParams);
            }
          }}
          onUpdate={fetchData} onDelete={fetchData}
        />
      )}

      {isIssueModalOpen && activeSprint && (
        <CreateIssueModal
          projectId={Number(projectId)}
          isOpen={isIssueModalOpen}
          onClose={() => { setIsIssueModalOpen(false); setIssueModalStatus(null); }}
          onSuccess={() => {
            setTimeout(() => {
              fetchData();
              setIsIssueModalOpen(false);
              setIssueModalStatus(null);
            }, 500);
          }}
          initialSprintId={activeSprint.id}
          initialStatus={issueModalStatus?.status}
          initialColumnId={issueModalStatus?.columnId}
        />
      )}

      {isTeamModalOpen && project && (
        <TeamMembersModal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          members={getAllMembers()}
          projectName={project.name}
        />
      )}

      {/* Edit Project Modal */}
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

      {/* Board Settings & Access Management Modal */}
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
                    const isMember = project?.teamMembers?.some((m: any) => m.id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleMember(u.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${isMember ? 'border-[#1F6FEB] bg-[#E6EFFC]' : 'border-[#DFE1E6] bg-white hover:border-[#4C9AFF]'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase ${isMember ? 'bg-[#1F6FEB]' : 'bg-[#6B778C]'}`}>{u.name ? u.name.charAt(0) : 'U'}</div>
                          <div className="text-left">
                            <p className={`text-sm font-bold ${isMember ? 'text-[#1F6FEB]' : 'text-[#172B4D]'}`}>{u.name || 'Collaborator'}</p>
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
                    <span className="text-[#172B4D] font-bold">{project?.createdBy?.name || 'Project Manager'}</span>
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

export default SprintBoard;
