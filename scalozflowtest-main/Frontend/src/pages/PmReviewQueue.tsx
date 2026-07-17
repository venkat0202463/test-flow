import React, { useEffect, useState } from 'react';
import { Check, X, MessageSquare, RefreshCw, UserPlus, Search, AlertCircle, Bookmark, Bug, CheckSquare, Zap, Clock, ThumbsUp, ThumbsDown, HelpCircle, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import type { Task, User as UserType } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { getTaskCode } from '../services/projectUtils';
import TaskDetailModal from '../components/TaskDetailModal';

type PMTab = 'PENDING' | 'CLARIFICATION' | 'REJECTED' | 'APPROVED';

interface ReviewCounts {
  pendingPMReview: number;
  rejected: number;
  awaitingClarification: number;
  approvedAwaitingAssignment: number;
}

const PmReviewQueue: React.FC = () => {
  const { addNotification } = useNotifications();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({
    pendingPMReview: 0,
    rejected: 0,
    awaitingClarification: 0,
    approvedAwaitingAssignment: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PMTab>('PENDING');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Modal States
  const [commentModal, setCommentModal] = useState<{
    isOpen: boolean;
    taskId: number | null;
    action: 'APPROVE' | 'REJECT' | 'CLARIFY' | null;
    comment: string;
  }>({
    isOpen: false,
    taskId: null,
    action: null,
    comment: ''
  });

  const [convertModal, setConvertModal] = useState<{
    isOpen: boolean;
    taskId: number | null;
    currentType: string;
    newType: string;
  }>({
    isOpen: false,
    taskId: null,
    currentType: 'TASK',
    newType: 'TASK'
  });

  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    taskId: number | null;
    taskTitle: string;
    taskCode?: string;
    assigneeId: string;
    coAssigneeId: string;
    assigneeSearch: string;
    coAssigneeSearch: string;
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: '',
    taskCode: '',
    assigneeId: '',
    coAssigneeId: '',
    assigneeSearch: '',
    coAssigneeSearch: ''
  });

  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showCoAssigneeDropdown, setShowCoAssigneeDropdown] = useState(false);
  const [assigneeFocusedIndex, setAssigneeFocusedIndex] = useState(-1);
  const [coAssigneeFocusedIndex, setCoAssigneeFocusedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchQueueData();
    fetchUsers();
  }, []);

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      const [tasksRes, countsRes] = await Promise.all([
        api.get('/tasks/review-queue'),
        api.get('/stats/review-counts')
      ]);

      setTasks(tasksRes.data || []);
      setCounts(countsRes.data || {
        pendingPMReview: 0,
        rejected: 0,
        awaitingClarification: 0,
        approvedAwaitingAssignment: 0
      });

      // Extract projects for filter
      const projs: string[] = Array.from(
        new Set((tasksRes.data || []).map((t: any) => t.project?.name).filter(Boolean))
      );
      setProjectsList(projs);
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to fetch PM review queue data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setAllUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusString = (tab: PMTab) => {
    switch (tab) {
      case 'PENDING': return 'Pending PM Review';
      case 'CLARIFICATION': return 'Awaiting Clarification';
      case 'REJECTED': return 'Rejected';
      case 'APPROVED': return 'Approved Awaiting Assignment';
    }
  };

  const handleActionClick = (taskId: number, action: 'APPROVE' | 'REJECT' | 'CLARIFY') => {
    setCommentModal({
      isOpen: true,
      taskId,
      action,
      comment: ''
    });
  };

  const handleCommentSubmit = async () => {
    const { taskId, action, comment } = commentModal;
    if (!taskId || !action) return;

    setIsSubmitting(true);
    try {
      let endpoint = '';
      let successMsg = '';
      if (action === 'APPROVE') {
        endpoint = `/tasks/${taskId}/approve`;
        successMsg = 'Task approved successfully';
      } else if (action === 'REJECT') {
        endpoint = `/tasks/${taskId}/reject`;
        successMsg = 'Task rejected';
      } else if (action === 'CLARIFY') {
        endpoint = `/tasks/${taskId}/request-clarification`;
        successMsg = 'Clarification requested';
      }

      await api.post(endpoint, { comment });
      addNotification('Success', successMsg, 'success');
      setCommentModal({ isOpen: false, taskId: null, action: null, comment: '' });
      fetchQueueData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Action failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertClick = (taskId: number, currentType: string) => {
    setConvertModal({
      isOpen: true,
      taskId,
      currentType,
      newType: currentType
    });
  };

  const handleConvertSubmit = async () => {
    const { taskId, newType } = convertModal;
    if (!taskId) return;

    try {
      await api.post(`/tasks/${taskId}/convert`, { newType });
      addNotification('Success', `Task type converted to ${newType}`, 'success');
      setConvertModal({ isOpen: false, taskId: null, currentType: 'TASK', newType: 'TASK' });
      fetchQueueData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to convert work item type', 'error');
    }
  };

  const handleAssignClick = (task: Task) => {
    setAssignModal({
      isOpen: true,
      taskId: task.id,
      taskTitle: task.title,
      taskCode: getTaskCode(task.id, task.project?.name, task.projectSequence),
      assigneeId: task.assignee ? String(task.assignee.id) : '',
      coAssigneeId: task.coAssignee ? String(task.coAssignee.id) : '',
      assigneeSearch: task.assignee ? task.assignee.name : '',
      coAssigneeSearch: task.coAssignee ? task.coAssignee.name : ''
    });
    setAssigneeFocusedIndex(-1);
    setCoAssigneeFocusedIndex(-1);
  };

  const handleAssignSubmit = async () => {
    const { taskId, assigneeId, coAssigneeId } = assignModal;
    if (!taskId) return;
    if (!assigneeId) {
      addNotification('Warning', 'Please select a primary assignee', 'warning');
      return;
    }

    try {
      await api.post(`/tasks/${taskId}/assign-developer`, {
        assigneeId: Number(assigneeId),
        coAssigneeId: coAssigneeId ? Number(coAssigneeId) : null
      });
      addNotification('Success', 'Task assigned to developer & moved to board', 'success');
      setAssignModal({
        isOpen: false,
        taskId: null,
        taskTitle: '',
        assigneeId: '',
        coAssigneeId: '',
        assigneeSearch: '',
        coAssigneeSearch: ''
      });
      fetchQueueData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to assign task', 'error');
    }
  };

  // Filter Tasks
  const displayedTasks = tasks.filter(task => {
    // Tab Filter
    const targetStatus = getStatusString(activeTab);
    if (task.status !== targetStatus) return false;

    // Search term
    if (searchTerm) {
      const taskCode = getTaskCode(task.id, task.project?.name, task.projectSequence).toLowerCase();
      const projName = (task.project?.name || '').toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = taskCode.includes(searchTerm.toLowerCase());
      const projMatch = projName.includes(searchTerm.toLowerCase());
      const reporterMatch = task.reporter?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!titleMatch && !idMatch && !projMatch && !reporterMatch) return false;
    }

    // Project Filter
    if (selectedProject !== 'all' && task.project?.name !== selectedProject) return false;

    // Priority Filter
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;

    return true;
  });

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-red-100 text-red-800 flex items-center gap-1 w-fit"><AlertCircle size={10} /> HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit"><Clock size={10} /> MEDIUM</span>;
      case 'LOW':
        return <span className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-green-100 text-green-800 flex items-center gap-1 w-fit"><ChevronRight size={10} /> LOW</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-gray-100 text-gray-800 w-fit">MEDIUM</span>;
    }
  };

  const getIssueTypeIcon = (type?: string) => {
    switch (type) {
      case 'BUG': return <Bug size={14} className="text-red-500" />;
      case 'STORY': return <Bookmark size={14} className="text-green-500" />;
      case 'EPIC': return <Zap size={14} className="text-purple-500" />;
      default: return <CheckSquare size={14} className="text-blue-500" />;
    }
  };

  const filteredAssignees = allUsers.filter(u =>
    u.name.toLowerCase().includes(assignModal.assigneeSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(assignModal.assigneeSearch.toLowerCase())
  );

  const filteredCoAssignees = allUsers.filter(u =>
    u.name.toLowerCase().includes(assignModal.coAssigneeSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(assignModal.coAssigneeSearch.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Project Manager Approvals
          </h1>
          <p className="text-sm text-gray-500 mt-1">Review new requests, handle clarification, and approve ready items for developer assignment.</p>
        </div>
        <button
          onClick={fetchQueueData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Queue
        </button>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        {/* Count 1 */}
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`p-5 rounded-lg border bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${activeTab === 'PENDING' ? 'border-[#1F6FEB] ring-1 ring-[#1F6FEB]' : 'border-gray-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Pending PM Approvals</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md"><HelpCircle size={16} /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{counts.pendingPMReview}</span>
            <span className="text-[11px] text-gray-400 font-medium">In Queue</span>
          </div>
        </div>

        {/* Count 2 */}
        <div
          onClick={() => setActiveTab('CLARIFICATION')}
          className={`p-5 rounded-lg border bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${activeTab === 'CLARIFICATION' ? 'border-[#1F6FEB] ring-1 ring-[#1F6FEB]' : 'border-gray-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Awaiting Clarification</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md"><MessageSquare size={16} /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{counts.awaitingClarification}</span>
            <span className="text-[11px] text-gray-400 font-medium">Outbound</span>
          </div>
        </div>

        {/* Count 3 */}
        <div
          onClick={() => setActiveTab('APPROVED')}
          className={`p-5 rounded-lg border bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${activeTab === 'APPROVED' ? 'border-[#1F6FEB] ring-1 ring-[#1F6FEB]' : 'border-gray-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Approved Awaiting Assign</span>
            <span className="p-1.5 bg-green-50 text-green-600 rounded-md"><ThumbsUp size={16} /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{counts.approvedAwaitingAssignment}</span>
            <span className="text-[11px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">Assign Now</span>
          </div>
        </div>

        {/* Count 4 */}
        <div
          onClick={() => setActiveTab('REJECTED')}
          className={`p-5 rounded-lg border bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${activeTab === 'REJECTED' ? 'border-[#1F6FEB] ring-1 ring-[#1F6FEB]' : 'border-gray-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Rejected Tasks</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-md"><ThumbsDown size={16} /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{counts.rejected}</span>
            <span className="text-[11px] text-gray-400 font-medium">Archived</span>
          </div>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Table Filter Menu */}
        <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by task code, title, project name, or reporter..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-[#1F6FEB] bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1F6FEB]"
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
            >
              <option value="all">All Projects</option>
              {projectsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1F6FEB]"
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 bg-white">
          {(['PENDING', 'CLARIFICATION', 'APPROVED', 'REJECTED'] as PMTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3.5 border-b-2 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === tab ? 'border-[#1F6FEB] text-[#1F6FEB]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              {tab === 'PENDING' && 'Pending PM Approvals'}
              {tab === 'CLARIFICATION' && 'Awaiting Clarification'}
              {tab === 'APPROVED' && 'Approved Awaiting Assignment'}
              {tab === 'REJECTED' && 'Rejected Tasks'}

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none ${activeTab === tab ? 'bg-[#1F6FEB]/10 text-[#1F6FEB]' : 'bg-gray-100 text-gray-600'}`}>
                {tab === 'PENDING' && counts.pendingPMReview}
                {tab === 'CLARIFICATION' && counts.awaitingClarification}
                {tab === 'APPROVED' && counts.approvedAwaitingAssignment}
                {tab === 'REJECTED' && counts.rejected}
              </span>
            </button>
          ))}
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider w-24">Type</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider w-28">Key</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">Summary</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">Reporter</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedTasks.map((task) => {
                  const createdDate = task.createdAt
                    ? new Date(
                      Array.isArray(task.createdAt)
                        ? new Date(task.createdAt[0], task.createdAt[1] - 1, task.createdAt[2])
                        : task.createdAt
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '--';

                  return (
                    <tr key={task.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center w-6 h-6 bg-gray-50 rounded">
                          {getIssueTypeIcon(task.issueType)}
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer hover:underline" onClick={() => { setActiveTaskId(task.id); setIsDetailModalOpen(true); }}>
                        <span className="text-[13px] font-semibold text-[#1F6FEB] uppercase">{getTaskCode(task.id, task.project?.name, task.projectSequence)}</span>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => { setActiveTaskId(task.id); setIsDetailModalOpen(true); }}>
                        <div className="text-[13px] font-bold text-gray-900 max-w-xs truncate hover:text-[#1F6FEB] hover:underline" title={task.title}>{task.title}</div>
                        {task.description && (
                          <div className="text-[11px] text-gray-400 max-w-xs truncate mt-0.5">{task.description.replace(/<[^>]*>/g, '')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-medium text-gray-700">{task.project?.name || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#00B3A4] text-white flex items-center justify-center text-[10px] font-black uppercase">
                            {task.reporter?.name?.charAt(0) || 'U'}
                          </div>
                          <span className="text-[13px] font-semibold text-gray-700">{task.reporter?.name || 'Unreported'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getPriorityBadge(task.priority)}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-gray-500 font-medium">
                        {createdDate}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {activeTab === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleActionClick(task.id, 'APPROVE')}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded border border-gray-200 hover:border-green-300 transition-colors"
                                title="Approve"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => handleActionClick(task.id, 'REJECT')}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded border border-gray-200 hover:border-red-300 transition-colors"
                                title="Reject"
                              >
                                <X size={15} />
                              </button>
                              <button
                                onClick={() => handleActionClick(task.id, 'CLARIFY')}
                                className="p-1.5 hover:bg-amber-50 text-amber-600 rounded border border-gray-200 hover:border-amber-300 transition-colors"
                                title="Request Clarification"
                              >
                                <MessageSquare size={15} />
                              </button>
                              <button
                                onClick={() => handleConvertClick(task.id, task.issueType || 'TASK')}
                                className="p-1.5 hover:bg-purple-50 text-purple-600 rounded border border-gray-200 hover:border-purple-300 transition-colors"
                                title="Convert Work Item Type"
                              >
                                <RefreshCw size={15} />
                              </button>
                            </>
                          )}

                          {activeTab === 'APPROVED' && (
                            <button
                              onClick={() => handleAssignClick(task)}
                              className="px-3 py-1.5 bg-[#1F6FEB] hover:bg-[#003484] text-white rounded text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                              <UserPlus size={12} /> Assign Developer
                            </button>
                          )}

                          {activeTab === 'CLARIFICATION' && (
                            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded">Out for Review</span>
                          )}

                          {activeTab === 'REJECTED' && (
                            <span className="text-xs text-red-600 font-semibold bg-red-50 px-2.5 py-1 rounded">Rejected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {displayedTasks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-20 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <ThumbsUp className="w-12 h-12 text-gray-200 mb-4" />
                        <h4 className="text-base font-bold text-gray-900">All caught up!</h4>
                        <p className="text-sm text-gray-400 mt-1">No tasks in this category matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Approve/Reject/Request Clarification Comment Modal */}
      {commentModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {commentModal.action === 'APPROVE' && 'Approve Task Request'}
                {commentModal.action === 'REJECT' && 'Reject Task Request'}
                {commentModal.action === 'CLARIFY' && 'Request Task Clarification'}
              </h3>
              <button
                onClick={() => setCommentModal({ isOpen: false, taskId: null, action: null, comment: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Comment / Feedback {commentModal.action !== 'APPROVE' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                placeholder={
                  commentModal.action === 'APPROVE' ? 'Add an optional approval comment (e.g. Approved, fits roadmap)' :
                    commentModal.action === 'REJECT' ? 'Provide a reason for rejection (Required)' :
                      'Describe what details require clarification from the reporter (Required)'
                }
                rows={4}
                className="w-full border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:border-[#1F6FEB]"
                value={commentModal.comment}
                onChange={e => setCommentModal(prev => ({ ...prev, comment: e.target.value }))}
                required={commentModal.action !== 'APPROVE'}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setCommentModal({ isOpen: false, taskId: null, action: null, comment: '' })}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting || (commentModal.action !== 'APPROVE' && !commentModal.comment.trim())}
                onClick={handleCommentSubmit}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold text-white transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${commentModal.action === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : commentModal.action === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Convert Work Item Type Modal */}
      {convertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Convert Work Item</h3>
              <button
                onClick={() => setConvertModal({ isOpen: false, taskId: null, currentType: 'TASK', newType: 'TASK' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase">Current Issue Type:</span>
                <span className="ml-2 font-bold text-sm text-gray-800 uppercase">{convertModal.currentType}</span>
              </div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Convert To</label>
              <div className="grid grid-cols-2 gap-2">
                {['TASK', 'BUG', 'STORY', 'EPIC'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConvertModal(prev => ({ ...prev, newType: type }))}
                    className={`p-3 border rounded-md text-sm font-bold flex items-center gap-2 transition-all ${convertModal.newType === type ? 'border-[#1F6FEB] bg-[#1F6FEB]/5 text-[#1F6FEB]' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                  >
                    {getIssueTypeIcon(type)}
                    <span className="capitalize">{type.toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setConvertModal({ isOpen: false, taskId: null, currentType: 'TASK', newType: 'TASK' })}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertSubmit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold shadow-sm active:scale-95"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Task Approved - Assign Developer Modal (Step 3 design) */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-black/55 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 font-sans text-left border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="text-lg font-semibold text-gray-950">Task Approved - Assign Developer</h3>
              <button
                onClick={() => setAssignModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Green alert banner */}
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-start gap-2.5 text-sm">
                <Check className="w-4.5 h-4.5 bg-green-600 text-white rounded-full p-0.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Task Approved by PM!</span>
                  <p className="text-xs text-green-700 mt-0.5">The review cycle is complete. You can now delegate the work to a developer.</p>
                </div>
              </div>

              {/* Task Title preview */}
              <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-md text-sm">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Approved Ticket</span>
                <span className="font-bold text-gray-900 block mt-1">{assignModal.taskCode || `TASK-${assignModal.taskId}`} • {assignModal.taskTitle}</span>
              </div>

              {/* Inputs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Assignee Search Input */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-gray-600 uppercase">Assignee <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search assignee..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-[#1F6FEB]"
                      value={assignModal.assigneeSearch}
                      onChange={e => {
                        setAssignModal(prev => ({ ...prev, assigneeSearch: e.target.value }));
                        setShowAssigneeDropdown(true);
                        setAssigneeFocusedIndex(-1);
                      }}
                      onFocus={() => setShowAssigneeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowAssigneeDropdown(false), 200)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowAssigneeDropdown(true);
                          setAssigneeFocusedIndex(prev => (prev < filteredAssignees.length - 1 ? prev + 1 : prev));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setAssigneeFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (showAssigneeDropdown && assigneeFocusedIndex >= 0 && assigneeFocusedIndex < filteredAssignees.length) {
                            const u = filteredAssignees[assigneeFocusedIndex];
                            setAssignModal(prev => ({ ...prev, assigneeId: String(u.id), assigneeSearch: u.name }));
                            setShowAssigneeDropdown(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowAssigneeDropdown(false);
                        }
                      }}
                    />
                  </div>

                  {/* Dropdown Options */}
                  {showAssigneeDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[100] max-h-40 overflow-y-auto">
                      {filteredAssignees.map((u, index) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAssignModal(prev => ({ ...prev, assigneeId: String(u.id), assigneeSearch: u.name }));
                            setShowAssigneeDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${assignModal.assigneeId === String(u.id) ? 'bg-[#1F6FEB]/5 font-bold text-[#1F6FEB]' : 'text-gray-700'} ${index === assigneeFocusedIndex ? 'bg-gray-100 ring-1 ring-inset ring-gray-300' : ''}`}
                        >
                          <div className="w-5 h-5 rounded-full bg-[#00B3A4] text-white flex items-center justify-center text-[9px] uppercase font-bold">{u.name.charAt(0)}</div>
                          {u.name} ({u.email})
                        </button>
                      ))}
                      {filteredAssignees.length === 0 && (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">No users found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Co-Assignee Search Input */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-gray-600 uppercase">Co-Assignee (Partner)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search co-assignee..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-[#1F6FEB]"
                      value={assignModal.coAssigneeSearch}
                      onChange={e => {
                        setAssignModal(prev => ({ ...prev, coAssigneeSearch: e.target.value }));
                        setShowCoAssigneeDropdown(true);
                        setCoAssigneeFocusedIndex(-1);
                      }}
                      onFocus={() => setShowCoAssigneeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCoAssigneeDropdown(false), 200)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowCoAssigneeDropdown(true);
                          setCoAssigneeFocusedIndex(prev => (prev < filteredCoAssignees.length ? prev + 1 : prev));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setCoAssigneeFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (showCoAssigneeDropdown && coAssigneeFocusedIndex >= 0) {
                            if (coAssigneeFocusedIndex === 0) {
                              setAssignModal(prev => ({ ...prev, coAssigneeId: '', coAssigneeSearch: '' }));
                              setShowCoAssigneeDropdown(false);
                            } else if (coAssigneeFocusedIndex - 1 < filteredCoAssignees.length) {
                              const u = filteredCoAssignees[coAssigneeFocusedIndex - 1];
                              setAssignModal(prev => ({ ...prev, coAssigneeId: String(u.id), coAssigneeSearch: u.name }));
                              setShowCoAssigneeDropdown(false);
                            }
                          }
                        } else if (e.key === 'Escape') {
                          setShowCoAssigneeDropdown(false);
                        }
                      }}
                    />
                  </div>

                  {/* Dropdown Options */}
                  {showCoAssigneeDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[100] max-h-40 overflow-y-auto">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setAssignModal(prev => ({ ...prev, coAssigneeId: '', coAssigneeSearch: '' }));
                          setShowCoAssigneeDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-red-500 font-semibold ${coAssigneeFocusedIndex === 0 ? 'bg-gray-100 ring-1 ring-inset ring-gray-300' : ''}`}
                      >
                        Clear partner
                      </button>
                      {filteredCoAssignees.map((u, index) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAssignModal(prev => ({ ...prev, coAssigneeId: String(u.id), coAssigneeSearch: u.name }));
                            setShowCoAssigneeDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${assignModal.coAssigneeId === String(u.id) ? 'bg-[#1F6FEB]/5 font-bold text-[#1F6FEB]' : 'text-gray-700'} ${index + 1 === coAssigneeFocusedIndex ? 'bg-gray-100 ring-1 ring-inset ring-gray-300' : ''}`}
                        >
                          <div className="w-5 h-5 rounded-full bg-[#00B3A4] text-white flex items-center justify-center text-[9px] uppercase font-bold">{u.name.charAt(0)}</div>
                          {u.name} ({u.email})
                        </button>
                      ))}
                      {filteredCoAssignees.length === 0 && (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">No users found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase">Status</label>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 rounded border border-green-200">
                    Approved - Awaiting Assignment
                  </span>
                  <span className="text-xs text-gray-400 italic">(Read-only)</span>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3.5 rounded-md flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p>After clicking Assign, the assignee is assigned, and the task status automatically transitions to <span className="font-bold">"TO DO"</span>, rendering it visible on developer Kanban/sprint boards.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setAssignModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                className="px-5 py-2 bg-[#1F6FEB] hover:bg-[#003484] text-white rounded-md text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
      {isDetailModalOpen && activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId}
          projectId={tasks.find(t => t.id === activeTaskId)?.project?.id || 0}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={fetchQueueData}
          onDelete={fetchQueueData}
        />
      )}
    </div>
  );
};

export default PmReviewQueue;
