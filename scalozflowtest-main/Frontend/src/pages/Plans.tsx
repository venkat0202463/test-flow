import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Compass,
  Folder,
  User as UserIcon,
  Layers,
  Bug,
  Bookmark,
  CheckSquare,
  Zap
} from 'lucide-react';
import api from '../services/api';
import type { Project, Task, User } from '../types';
import CreateIssueModal from '../components/CreateIssueModal';
import TaskDetailModal from '../components/TaskDetailModal';
import RichTextEditor from '../components/RichTextEditor';
import { getTaskCode } from '../services/projectUtils';

interface WorkspacePlan {
  id: string;
  name: string;
  description: string;
  projectIds: number[];
  startDate: string;
  targetDate: string;
  status: 'ACTIVE' | 'PLANNING' | 'COMPLETED';
}

const DEFAULT_PLANS: WorkspacePlan[] = [
  {
    id: 'plan-1',
    name: 'Q3 Enterprise Product Roadmap',
    description: 'Strategic alignment and release roadmap across all software engineering workflows.',
    projectIds: [], // will default to all project IDs on first load
    startDate: '2026-06-01',
    targetDate: '2026-09-30',
    status: 'ACTIVE'
  }
];

const Plans = () => {
  // const { user: authUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Local Storage for Plans
  const [plans, setPlans] = useState<WorkspacePlan[]>(() => {
    const saved = localStorage.getItem('workspace-plans');
    return saved ? JSON.parse(saved) : DEFAULT_PLANS;
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');

  // Hierarchical Row Expansion State (default expanded)
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});

  // Modals & Issue Detail state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProjectIdForCreate, setSelectedProjectIdForCreate] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  // Form States for creating a plan
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanStart, setNewPlanStart] = useState('2026-06-01');
  const [newPlanTarget, setNewPlanTarget] = useState('2026-09-30');
  const [newPlanProjects, setNewPlanProjects] = useState<number[]>([]);
  const [newPlanStatus, setNewPlanStatus] = useState<'ACTIVE' | 'PLANNING' | 'COMPLETED'>('ACTIVE');

  // Filter / Toolbar States
  const [issueTypeFilter, setIssueTypeFilter] = useState<'ALL' | 'TASK' | 'EPIC' | 'STORY' | 'BUG'>('ALL');
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({
    status: true,
    assignee: true,
    startDate: true,
    dueDate: true,
    priority: true
  });
  const [showFieldsDropdown, setShowFieldsDropdown] = useState(false);
  const [showWorkItemDropdown, setShowWorkItemDropdown] = useState(false);

  // Bulk Selection States
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'status' | 'priority' | 'assignee' | null>(null);

  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowFieldsDropdown(false);
        setShowWorkItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanTaskForPayload = (task: any) => {
    const cleaned = { ...task };
    delete cleaned.subTasks;
    delete cleaned.parentTask;
    delete cleaned.project;
    delete cleaned.assignee;
    delete cleaned.coAssignee;
    delete cleaned.reporter;
    delete cleaned.sprint;
    return cleaned;
  };

  const handleToggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleToggleProjectSelection = (taskIds: number[], checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => Array.from(new Set([...prev, ...taskIds])));
    } else {
      setSelectedTaskIds(prev => prev.filter(id => !taskIds.includes(id)));
    }
  };

  const handleToggleAllSelection = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(tasks.map(t => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    try {
      setLoading(true);
      const updatePromises = selectedTaskIds.map(id => {
        const originalTask = tasks.find(t => t.id === id);
        if (!originalTask) return Promise.resolve();
        const cleanedTask = cleanTaskForPayload(originalTask);
        cleanedTask.status = newStatus;
        return api.put(`/tasks/${id}`, {
          task: cleanedTask,
          projectId: originalTask.projectId || originalTask.project?.id || null,
          assigneeId: originalTask.assigneeId || originalTask.assignee?.id || null,
          sprintId: originalTask.sprintId || originalTask.sprint?.id || null,
          parentId: originalTask.parentId || originalTask.parentTask?.id || null,
          coAssigneeId: originalTask.coAssigneeId || originalTask.coAssignee?.id || null,
          reporterId: originalTask.reporterId || originalTask.reporter?.id || null
        });
      });
      await Promise.all(updatePromises);
      setSelectedTaskIds([]);
      setOpenDropdown(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to bulk update status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPriorityUpdate = async (newPriority: string) => {
    try {
      setLoading(true);
      const updatePromises = selectedTaskIds.map(id => {
        const originalTask = tasks.find(t => t.id === id);
        if (!originalTask) return Promise.resolve();
        const cleanedTask = cleanTaskForPayload(originalTask);
        cleanedTask.priority = newPriority;
        return api.put(`/tasks/${id}`, {
          task: cleanedTask,
          projectId: originalTask.projectId || originalTask.project?.id || null,
          assigneeId: originalTask.assigneeId || originalTask.assignee?.id || null,
          sprintId: originalTask.sprintId || originalTask.sprint?.id || null,
          parentId: originalTask.parentId || originalTask.parentTask?.id || null,
          coAssigneeId: originalTask.coAssigneeId || originalTask.coAssignee?.id || null,
          reporterId: originalTask.reporterId || originalTask.reporter?.id || null
        });
      });
      await Promise.all(updatePromises);
      setSelectedTaskIds([]);
      setOpenDropdown(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to bulk update priority:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete these ${selectedTaskIds.length} tasks?`)) return;
    try {
      setLoading(true);
      const deletePromises = selectedTaskIds.map(id => api.delete(`/tasks/${id}`));
      await Promise.all(deletePromises);
      setSelectedTaskIds([]);
      await fetchData();
    } catch (err) {
      console.error('Failed to bulk delete tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssigneeUpdate = async (newAssigneeId: number | null) => {
    try {
      setLoading(true);
      const updatePromises = selectedTaskIds.map(id => {
        const originalTask = tasks.find(t => t.id === id);
        if (!originalTask) return Promise.resolve();
        const cleanedTask = cleanTaskForPayload(originalTask);
        return api.put(`/tasks/${id}`, {
          task: cleanedTask,
          projectId: originalTask.projectId || originalTask.project?.id || null,
          assigneeId: newAssigneeId,
          sprintId: originalTask.sprintId || originalTask.sprint?.id || null,
          parentId: originalTask.parentId || originalTask.parentTask?.id || null,
          coAssigneeId: originalTask.coAssigneeId || originalTask.coAssignee?.id || null,
          reporterId: originalTask.reporterId || originalTask.reporter?.id || null
        });
      });
      await Promise.all(updatePromises);
      setSelectedTaskIds([]);
      setOpenDropdown(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to bulk update assignee:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [projRes, tasksRes, usersRes] = await Promise.all([
        api.get('/projects'),
        api.get('/tasks'),
        api.get('/auth/users')
      ]);

      const fetchedProjects = projRes.data || [];
      setProjects(fetchedProjects);
      setTasks(tasksRes.data || []);
      setUsers(usersRes.data || []);

      // Automatically include any new projects in the active plans
      setPlans(prevPlans => {
        const updated = prevPlans.map(p => {
          const missingIds = fetchedProjects
            .map((proj: Project) => proj.id)
            .filter((id: number) => !p.projectIds.includes(id));
          if (missingIds.length > 0) {
            return { ...p, projectIds: [...p.projectIds, ...missingIds] };
          }
          return p;
        });
        return updated;
      });

      // Expand all projects by default
      if (fetchedProjects.length > 0) {
        const initialExpanded: Record<number, boolean> = {};
        fetchedProjects.forEach((p: Project) => {
          initialExpanded[p.id] = true;
        });
        setExpandedProjects(initialExpanded);
      }

    } catch (err) {
      console.error('Error fetching plans data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Save plans to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('workspace-plans', JSON.stringify(plans));
  }, [plans]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.bulk-dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  // Aggregated projects within selected plan
  const planProjects = useMemo(() => {
    if (!selectedPlan) return [];
    return projects.filter(p => selectedPlan.projectIds.includes(p.id));
  }, [projects, selectedPlan]);

  // Expand / Collapse project row
  const toggleProjectExpand = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;

    const newPlan: WorkspacePlan = {
      id: `plan-${Date.now()}`,
      name: newPlanName,
      description: newPlanDesc,
      projectIds: newPlanProjects.length > 0 ? newPlanProjects : projects.map(p => p.id),
      startDate: newPlanStart,
      targetDate: newPlanTarget,
      status: newPlanStatus
    };

    setPlans(prev => [...prev, newPlan]);
    setSelectedPlanId(newPlan.id);
    setShowCreateModal(false);

    // Reset Form
    setNewPlanName('');
    setNewPlanDesc('');
    setNewPlanStart('2026-06-01');
    setNewPlanTarget('2026-09-30');
    setNewPlanProjects([]);
    setNewPlanStatus('ACTIVE');
  };

  // const handleDeletePlan = (id: string) => {
  //   if (plans.length <= 1) {
  //     alert("You must have at least one workspace plan.");
  //     return;
  //   }
  //   if (confirm("Are you sure you want to delete this plan?")) {
  //     const remaining = plans.filter(p => p.id !== id);
  //     setPlans(remaining);
  //     setSelectedPlanId(remaining[0].id);
  //   }
  // };

  const toggleProjectSelectionForCreate = (id: number) => {
    setNewPlanProjects(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const openTaskDetail = (taskId: number) => {
    setActiveTaskId(taskId);
    setIsDetailModalOpen(true);
  };

  const handleCreateWorkItemClick = (projectId: number) => {
    setSelectedProjectIdForCreate(projectId);
    setIsCreateModalOpen(true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
    </div>
  );

  return (
    <div className="content-container animate-in fade-in duration-300">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DFE1E6] mb-8">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-[#5E6C84] mb-3 uppercase font-bold tracking-widest">
            <span>Workspace</span>
            <ChevronRight size={12} />
            <span className="text-[#172B4D]">Plans</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1F6FEB] text-white rounded flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Compass size={20} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="section-title tracking-tight">Enterprise Portfolio Plans</h1>
              </div>
              <p className="section-subtitle tracking-tight mt-1">{selectedPlan?.description || 'Model roadmaps, release schedules, and resource allocations across all engineering nodes.'}</p>
            </div>
          </div>
        </div>

      </div>

      {/* PLAN CONTAINER */}
      {selectedPlan ? (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* JIRA PLANS TABLE LAYOUT */}
          <div className="bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm overflow-hidden text-[#172B4D]">

            {/* TOOLBAR */}
            <div className="flex items-center gap-3 p-3 bg-[#FAFBFC] border-b border-[#DFE1E6] relative z-20" ref={filterDropdownRef}>

              {/* Work Item Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => { setShowWorkItemDropdown(!showWorkItemDropdown); setShowFieldsDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DFE1E6] rounded-[3px] text-[13px] font-semibold text-[#172B4D] hover:bg-[#F4F5F7] cursor-pointer"
                >
                  Work item: {issueTypeFilter === 'ALL' ? 'All Types' : issueTypeFilter} <ChevronDown size={14} />
                </button>
                {showWorkItemDropdown && (
                  <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-[#DFE1E6] rounded shadow-xl py-1 w-40 z-30 animate-in fade-in slide-in-from-top-1 duration-150 text-[13px]">
                    {(['ALL', 'STORY', 'TASK', 'EPIC', 'BUG'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => { setIssueTypeFilter(type); setShowWorkItemDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[#F4F5F7] ${issueTypeFilter === type ? 'font-bold text-[#1F6FEB] bg-[#DEEBFF]/30' : ''}`}
                      >
                        {type === 'ALL' ? 'All Types' : type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Work Item button */}
              <button
                onClick={() => handleCreateWorkItemClick(planProjects[0]?.id || 1)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-[13px] font-semibold text-[#172B4D] cursor-pointer"
              >
                + Create work
              </button>

              {/* Add Fields Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => { setShowFieldsDropdown(!showFieldsDropdown); setShowWorkItemDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DFE1E6] rounded-[3px] text-[13px] font-semibold text-[#172B4D] hover:bg-[#F4F5F7] cursor-pointer"
                >
                  Add Fields <ChevronDown size={14} />
                </button>
                {showFieldsDropdown && (
                  <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-[#DFE1E6] rounded shadow-xl py-2 w-48 z-30 animate-in fade-in slide-in-from-top-1 duration-150 text-[13px]">
                    <div className="px-3 py-1 text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider">Toggle Columns</div>
                    {Object.keys(visibleFields).map(field => (
                      <label
                        key={field}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F4F5F7] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleFields[field]}
                          onChange={() => setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }))}
                          className="rounded border-[#DFE1E6] text-[#1F6FEB] focus:ring-0"
                        />
                        <span className="capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TABLE HEADER RULER */}
            <div className="grid grid-cols-12 bg-[#FAFBFC] border-b border-[#DFE1E6] h-10 items-center text-[12px] font-bold text-[#5E6C84] px-4 select-none">
              <div className="col-span-5 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={tasks.length > 0 && tasks.every(t => selectedTaskIds.includes(t.id))}
                  onChange={(e) => handleToggleAllSelection(e.target.checked)}
                  className="rounded border-[#DFE1E6] text-[#1F6FEB] focus:ring-0 shrink-0 cursor-pointer" 
                />
                <span>#</span>
              </div>
              {visibleFields.status && <div className="col-span-2">Status</div>}
              {visibleFields.assignee && <div className="col-span-1">Assignee</div>}
              {visibleFields.startDate && <div className="col-span-2">Start date</div>}
              {visibleFields.dueDate && <div className="col-span-1">Due date</div>}
              {visibleFields.priority && <div className="col-span-1 text-right">Priority</div>}
            </div>

            {/* HIERARCHICAL ROWS GRID */}
            <div className="divide-y divide-[#DFE1E6] min-h-[300px]">
              {planProjects.map(proj => {
                const isExpanded = !!expandedProjects[proj.id];
                const projTasks = tasks.filter(t => t.projectId === proj.id);
                const filteredTasks = projTasks.filter(t => {
                  if (issueTypeFilter === 'ALL') return true;
                  return t.issueType?.toUpperCase() === issueTypeFilter;
                });

                // Parent statistics calculation
                const completedTasksCount = projTasks.filter(t => t.status?.toUpperCase() === 'DONE' || t.status?.toUpperCase() === 'COMPLETED').length;
                const progressPercent = projTasks.length > 0 ? Math.round((completedTasksCount / projTasks.length) * 100) : 0;

                const startDatesMs = projTasks.map(t => new Date(t.createdAt || Date.now()).getTime());
                const earliestStartMs = startDatesMs.length > 0 ? Math.min(...startDatesMs) : null;
                const earliestStartStr = earliestStartMs ? new Date(earliestStartMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                const dueDatesMs = projTasks.filter(t => t.dueDate).map(t => new Date(t.dueDate!).getTime());
                const latestDueMs = dueDatesMs.length > 0 ? Math.max(...dueDatesMs) : null;
                const latestDueStr = latestDueMs ? new Date(latestDueMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                const highCount = projTasks.filter(t => t.priority?.toUpperCase() === 'HIGH').length;
                const medCount = projTasks.filter(t => t.priority?.toUpperCase() === 'MEDIUM').length;
                const lowCount = projTasks.filter(t => t.priority?.toUpperCase() === 'LOW').length;

                let summaryPriority = '—';
                if (projTasks.length > 0) {
                  if (highCount >= medCount && highCount >= lowCount) {
                    summaryPriority = `${highCount} High`;
                  } else if (medCount >= highCount && medCount >= lowCount) {
                    summaryPriority = `${medCount} Medium`;
                  } else {
                    summaryPriority = `${lowCount} Low`;
                  }
                }

                return (
                  <div key={proj.id} className="flex flex-col">

                    {/* PROJECT PARENT ROW */}
                    <div className="grid grid-cols-12 h-12 items-center px-4 hover:bg-[#F4F5F7]/30 transition-all select-none group border-b border-[#F4F5F7]/50">
                      <div className="col-span-5 flex items-center gap-2 overflow-hidden pr-2">
                        <input 
                          type="checkbox" 
                          checked={filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.includes(t.id))}
                          onChange={(e) => handleToggleProjectSelection(filteredTasks.map(t => t.id), e.target.checked)}
                          className="rounded border-[#DFE1E6] text-[#1F6FEB] focus:ring-0 shrink-0 cursor-pointer" 
                        />
                        <button
                          onClick={() => toggleProjectExpand(proj.id)}
                          className="p-1 hover:bg-[#EBECF0] rounded cursor-pointer shrink-0 transition-transform"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        {/* Project Icon (Yellow / Blue Wallet/Folder style icon) */}
                        <div className="w-5 h-5 rounded-[3px] bg-[#FFAB00] text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Folder size={11} fill="white" />
                        </div>

                        <span className="font-semibold text-[13px] text-[#172B4D] truncate">{proj.name}</span>

                        {/* Create work item quick shortcut */}
                        <button
                          onClick={() => handleCreateWorkItemClick(proj.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#EBECF0] text-[#1F6FEB] rounded shrink-0 transition-all ml-1 cursor-pointer"
                          title="Add Work Item"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Progress Bar for Project Status */}
                      {visibleFields.status && (
                        <div className="col-span-2 pr-6">
                          <div className="w-full h-1.5 bg-[#DFE1E6] rounded-full overflow-hidden" title={`${progressPercent}% Complete`}>
                            <div className="h-full bg-[#1F6FEB] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                        </div>
                      )}

                      {/* Project Lead */}
                      {visibleFields.assignee && (
                        <div className="col-span-1">
                          <div className="w-5 h-5 rounded-full bg-[#1F6FEB]/10 text-[#1F6FEB] border border-[#1F6FEB]/20 flex items-center justify-center text-[10px] font-bold shadow-sm select-none" title={proj.createdBy?.name || 'Lead'}>
                            {proj.createdBy?.name.charAt(0) || <UserIcon size={10} />}
                          </div>
                        </div>
                      )}

                      {/* Earliest start date */}
                      {visibleFields.startDate && (
                        <div className="col-span-2 text-[11px] text-[#5E6C84]">
                          {earliestStartStr && (
                            <span>{earliestStartStr} <strong className="text-[9px] font-black uppercase text-[#6B778C]/70">Earliest</strong></span>
                          )}
                        </div>
                      )}

                      {/* Latest due date */}
                      {visibleFields.dueDate && (
                        <div className="col-span-1 text-[11px] text-[#5E6C84]">
                          {latestDueStr && (
                            <span>{latestDueStr} <strong className="text-[9px] font-black uppercase text-[#6B778C]/70">Latest</strong></span>
                          )}
                        </div>
                      )}

                      {/* Priority placeholder */}
                      {visibleFields.priority && (
                        <div className="col-span-1 text-[11px] text-right font-bold text-[#5E6C84] pr-2">
                          {summaryPriority}
                        </div>
                      )}

                    </div>

                    {/* CHILD WORK ITEMS (TASKS) */}
                    {isExpanded && (
                      <div className="bg-[#FAFBFC]/20 divide-y divide-[#F4F5F7]/30">
                        {filteredTasks.map(task => {
                          const isDone = task.status?.toUpperCase() === 'DONE' || task.status?.toUpperCase() === 'COMPLETED';

                          return (
                            <div key={task.id} className="grid grid-cols-12 h-11 items-center px-4 hover:bg-[#F4F5F7]/50 transition-all select-none">
                              <div className="col-span-5 flex items-center gap-2 pl-9 pr-2 overflow-hidden">
                                <input 
                                  type="checkbox" 
                                  checked={selectedTaskIds.includes(task.id)}
                                  onChange={() => handleToggleTaskSelection(task.id)}
                                  className="rounded border-[#DFE1E6] text-[#1F6FEB] focus:ring-0 shrink-0 cursor-pointer" 
                                />

                                {/* Task Type Icon */}
                                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                                  {task.issueType === 'BUG' ? (
                                    <Bug size={14} className="text-[#FF5630]" />
                                  ) : task.issueType === 'STORY' ? (
                                    <Bookmark size={14} className="text-[#36B37E]" />
                                  ) : task.issueType === 'EPIC' ? (
                                    <Zap size={14} className="text-[#6554C0]" />
                                  ) : (
                                    <CheckSquare size={14} className="text-[#4C9AFF]" />
                                  )}
                                </div>

                                <span className="text-[11px] font-bold text-[#5E6C84] uppercase shrink-0">{getTaskCode(task.id, task.project?.name || proj.name, task.projectSequence)}</span>
                                <span
                                  onClick={() => openTaskDetail(task.id)}
                                  className="text-[13px] font-medium text-[#172B4D] truncate hover:text-[#1F6FEB] hover:underline cursor-pointer"
                                >
                                  {task.title}
                                </span>
                              </div>

                              {/* Status Badge */}
                              {visibleFields.status && (
                                <div className="col-span-2">
                                  <span className={`px-2 py-0.5 rounded-[3px] text-[9px] font-bold uppercase tracking-tight ${isDone ? 'bg-green-50 text-green-600 border border-green-100' : task.status === 'IN PROGRESS' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                                    {task.status?.replace('_', ' ') || 'Backlog'}
                                  </span>
                                </div>
                              )}

                              {/* Assignee Avatar */}
                              {visibleFields.assignee && (
                                <div className="col-span-1">
                                  {task.assignee ? (
                                    <div className="w-5 h-5 rounded-full bg-[#00B3A4] text-white flex items-center justify-center text-[9px] font-bold shadow-sm uppercase select-none" title={task.assignee.name}>
                                      {task.assignee.name.charAt(0)}
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border border-dashed border-[#DFE1E6] flex items-center justify-center text-[#A5ADBA] select-none">
                                      <UserIcon size={10} />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Start Date */}
                              {visibleFields.startDate && (
                                <div className="col-span-2 text-[11px] text-[#5E6C84]">
                                  {formatDate(task.createdAt)}
                                </div>
                              )}

                              {/* Due Date */}
                              {visibleFields.dueDate && (
                                <div className="col-span-1 text-[11px] text-[#5E6C84]">
                                  {formatDate(task.dueDate)}
                                </div>
                              )}

                              {/* Priority badge */}
                              {visibleFields.priority && (
                                <div className="col-span-1 text-right pr-2">
                                  <span className="text-[11px] font-medium text-[#5E6C84] capitalize">
                                    {task.priority?.toLowerCase() || 'medium'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {filteredTasks.length === 0 && (
                          <div className="py-3 pl-12 text-[11px] text-[#5E6C84] italic">
                            No work items found under this project.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center">
          <Layers size={64} className="text-[#DFE1E6] mb-4" />
          <h3 className="text-lg font-bold text-[#172B4D]">No plans configured</h3>
          <p className="text-sm text-[#5E6C84] mt-1">Initiate your first plan to start tracking deliverables.</p>
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#091E42]/60 z-[7000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg w-full max-w-lg border border-[#DFE1E6] shadow-2xl p-6 overflow-hidden">
            <h3 className="text-[18px] font-bold text-[#172B4D] mb-4 border-b border-[#F4F5F7] pb-3">Create Portfolio Plan</h3>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Release Roadmap"
                  className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-[13px] outline-none focus:bg-white focus:border-[#4C9AFF]"
                  value={newPlanName}
                  onChange={e => setNewPlanName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Description</label>
                <RichTextEditor
                  value={newPlanDesc}
                  onChange={(val) => setNewPlanDesc(val)}
                  placeholder="Briefly describe the plan goal..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-[13px] outline-none focus:bg-white focus:border-[#4C9AFF]"
                    value={newPlanStart}
                    onChange={e => setNewPlanStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Target Date</label>
                  <input
                    type="date"
                    className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-[13px] outline-none focus:bg-white focus:border-[#4C9AFF]"
                    value={newPlanTarget}
                    onChange={e => setNewPlanTarget(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1.5">Include Projects</label>
                <div className="max-h-32 overflow-y-auto custom-scrollbar border border-[#DFE1E6] rounded p-2 divide-y divide-[#F4F5F7]">
                  {projects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => toggleProjectSelectionForCreate(p.id)}
                      className="flex items-center gap-2 py-1.5 px-2 hover:bg-[#F4F5F7]/50 cursor-pointer rounded"
                    >
                      <input
                        type="checkbox"
                        checked={newPlanProjects.includes(p.id)}
                        onChange={() => { }} // handled by div click
                        className="rounded text-[#1F6FEB] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[12px] text-[#172B4D]">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Plan Status</label>
                <select
                  className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-[13px] outline-none focus:bg-white focus:border-[#4C9AFF]"
                  value={newPlanStatus}
                  onChange={e => setNewPlanStatus(e.target.value as 'ACTIVE' | 'PLANNING' | 'COMPLETED')}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F4F5F7] mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 hover:bg-[#F4F5F7] text-[#172B4D] rounded font-bold text-[13px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#1F6FEB] hover:bg-[#003484] text-white px-4 py-2 rounded font-bold text-[13px] transition-all shadow-sm"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WORK ITEM MODAL */}
      {isCreateModalOpen && selectedProjectIdForCreate && (
        <CreateIssueModal
          isOpen={isCreateModalOpen}
          onClose={() => { setIsCreateModalOpen(false); setSelectedProjectIdForCreate(null); }}
          projectId={selectedProjectIdForCreate}
          onSuccess={() => {
            fetchData();
            setIsCreateModalOpen(false);
            setSelectedProjectIdForCreate(null);
          }}
        />
      )}

      {/* TASK DETAIL VIEW MODAL */}
      {isDetailModalOpen && activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId}
          projectId={tasks.find(t => t.id === activeTaskId)?.projectId || 1}
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setActiveTaskId(null); }}
          onUpdate={fetchData}
          onDelete={fetchData}
        />
      )}
      {/* BULK ACTION FLOATING BAR */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#091E42] text-white px-6 py-4 rounded-[4px] shadow-2xl flex items-center gap-6 z-50 border border-white/10 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <span className="bg-[#1F6FEB] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              {selectedTaskIds.length} Selected
            </span>
          </div>
          
          <div className="h-4 w-px bg-white/20"></div>

          <div className="flex items-center gap-4">
            {/* Status Dropdown */}
            <div className="relative group bulk-dropdown-container">
              <button 
                onClick={() => setOpenDropdown(prev => prev === 'status' ? null : 'status')}
                className="flex items-center gap-1 text-[13px] font-bold text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                Update Status
              </button>
              <div className={`absolute bottom-[calc(100%+8px)] left-0 bg-white text-[#172B4D] border border-[#DFE1E6] rounded shadow-xl py-1 w-36 ${openDropdown === 'status' ? 'block' : 'hidden'} group-hover:block hover:block text-[12px] font-medium z-[60]`}>
                {['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE', 'UAT'].map(status => (
                  <button 
                    key={status}
                    onClick={() => handleBulkStatusUpdate(status)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F5F7]"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Dropdown */}
            <div className="relative group bulk-dropdown-container">
              <button 
                onClick={() => setOpenDropdown(prev => prev === 'priority' ? null : 'priority')}
                className="flex items-center gap-1 text-[13px] font-bold text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                Update Priority
              </button>
              <div className={`absolute bottom-[calc(100%+8px)] left-0 bg-white text-[#172B4D] border border-[#DFE1E6] rounded shadow-xl py-1 w-36 ${openDropdown === 'priority' ? 'block' : 'hidden'} group-hover:block hover:block text-[12px] font-medium z-[60]`}>
                {['LOW', 'MEDIUM', 'HIGH'].map(priority => (
                  <button 
                    key={priority}
                    onClick={() => handleBulkPriorityUpdate(priority)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F5F7] uppercase"
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee Dropdown */}
            <div className="relative group bulk-dropdown-container">
              <button 
                onClick={() => setOpenDropdown(prev => prev === 'assignee' ? null : 'assignee')}
                className="flex items-center gap-1 text-[13px] font-bold text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                Update Assignee
              </button>
              <div className={`absolute bottom-[calc(100%+8px)] left-0 bg-white text-[#172B4D] border border-[#DFE1E6] rounded shadow-xl py-1 w-44 ${openDropdown === 'assignee' ? 'block' : 'hidden'} group-hover:block hover:block text-[12px] font-medium z-[60] max-h-48 overflow-y-auto custom-scrollbar`}>
                <button 
                  onClick={() => handleBulkAssigneeUpdate(null)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F4F5F7] font-bold text-[#FF5630]"
                >
                  Unassigned
                </button>
                {users.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => handleBulkAssigneeUpdate(u.id)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F5F7]"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Delete Button */}
            <button 
              onClick={handleBulkDelete}
              className="text-[13px] font-bold text-[#FF5630] hover:bg-[#FF5630]/20 px-3 py-1.5 rounded transition-all cursor-pointer"
            >
              Delete Selected
            </button>
          </div>

          <div className="h-4 w-px bg-white/20"></div>

          {/* Cancel */}
          <button 
            onClick={() => setSelectedTaskIds([])}
            className="text-[12px] font-bold text-white/60 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  );
};

export default Plans;
