import React, { useEffect, useState } from 'react';
import { HelpCircle, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Eye, Edit3, MessageSquare, History, Search, ChevronRight } from 'lucide-react';
import api from '../services/api';
import type { Task } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getTaskCode } from '../services/projectUtils';
import TaskDetailModal from '../components/TaskDetailModal';

type SubmittedTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLARIFY';

interface TaskHistoryItem {
  id: number;
  taskId: number;
  changeType: string;
  fromValue: string;
  toValue: string;
  performedBy: string;
  comment?: string;
  createdAt: string;
}

const MySubmittedTasks: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SubmittedTab>('PENDING');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [historyList, setHistoryList] = useState<TaskHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit states for Awaiting Clarification
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTaskDetailId, setActiveTaskDetailId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchSubmittedTasks();
  }, [user]);

  const fetchSubmittedTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch tasks reported by current user
      const res = await api.get(`/tasks?reporterId=${user.id}`);
      setTasks(res.data || []);
      
      // Keep selected task in sync if it is open
      if (selectedTask) {
        const updatedSelected = (res.data || []).find((t: any) => t.id === selectedTask.id);
        if (updatedSelected) {
          setSelectedTask(updatedSelected);
          fetchHistory(updatedSelected.id);
        }
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to fetch submitted tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (taskId: number) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/tasks/${taskId}/history`);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    fetchHistory(task.id);
  };

  const getStatusMapping = (tab: SubmittedTab) => {
    switch (tab) {
      case 'PENDING': return 'Pending PM Review';
      case 'CLARIFY': return 'Awaiting Clarification';
      case 'REJECTED': return 'Rejected';
      case 'APPROVED': return 'Approved Awaiting Assignment'; // Treat approved as approved & awaiting or active
    }
  };

  const getTabIcon = (tab: SubmittedTab) => {
    switch (tab) {
      case 'PENDING': return <Clock size={14} className="text-blue-500" />;
      case 'CLARIFY': return <HelpCircle size={14} className="text-amber-500" />;
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      case 'APPROVED': return <CheckCircle2 size={14} className="text-green-500" />;
    }
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-100';
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-green-50 text-green-700 border-green-100';
    }
  };

  // Filter reported tasks
  const filteredTasks = tasks.filter(task => {
    // Custom filter for approved tasks (both awaiting assignment or developer ready)
    if (activeTab === 'APPROVED') {
      if (['Pending PM Review', 'Awaiting Clarification', 'Rejected'].includes(task.status || '')) return false;
    } else {
      const targetStatus = getStatusMapping(activeTab);
      if (task.status !== targetStatus) return false;
    }

    if (searchTerm) {
      const taskCode = getTaskCode(task.id, task.project?.name, task.projectSequence).toLowerCase();
      const projName = (task.project?.name || '').toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCode = taskCode.includes(searchTerm.toLowerCase());
      const matchesProj = projName.includes(searchTerm.toLowerCase());
      if (!matchesTitle && !matchesCode && !matchesProj) return false;
    }

    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Submitted Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Track issues and requests you have reported. Provide clarifications or check PM feedback.</p>
        </div>
        <button 
          onClick={fetchSubmittedTasks}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Tabs and Task List */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Search Input */}
            <div className="p-4 border-b border-gray-200 bg-gray-50/70">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by task title, project name, or ID..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-[#1F6FEB] bg-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
              {(['PENDING', 'CLARIFY', 'APPROVED', 'REJECTED'] as SubmittedTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedTask(null);
                  }}
                  className={`px-5 py-3.5 border-b-2 text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? 'border-[#1F6FEB] text-[#1F6FEB]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  {getTabIcon(tab)}
                  {tab === 'PENDING' && 'Pending Review'}
                  {tab === 'CLARIFY' && 'Clarification Needed'}
                  {tab === 'APPROVED' && 'Approved'}
                  {tab === 'REJECTED' && 'Rejected'}

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none ${activeTab === tab ? 'bg-[#1F6FEB]/10 text-[#1F6FEB]' : 'bg-gray-100 text-gray-600'}`}>
                    {tab === 'PENDING' && tasks.filter(t => t.status === 'Pending PM Review').length}
                    {tab === 'CLARIFY' && tasks.filter(t => t.status === 'Awaiting Clarification').length}
                    {tab === 'APPROVED' && tasks.filter(t => !['Pending PM Review', 'Awaiting Clarification', 'Rejected'].includes(t.status || '')).length}
                    {tab === 'REJECTED' && tasks.filter(t => t.status === 'Rejected').length}
                  </span>
                </button>
              ))}
            </div>

            {/* Tasks Queue List */}
            {loading ? (
              <div className="flex justify-center items-center py-20 bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={`p-4 hover:bg-gray-50/50 transition-colors cursor-pointer flex items-center justify-between gap-4 border-l-4 ${selectedTask?.id === task.id ? 'bg-[#1F6FEB]/5 border-[#1F6FEB]' : 'border-transparent'}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{getTaskCode(task.id, task.project?.name, task.projectSequence)}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {task.project?.name || 'Project'}
                        </span>
                      </div>
                      <h4 className="text-[13px] font-bold text-gray-900 truncate">{task.title}</h4>
                      <div className="text-[11px] text-gray-400 flex items-center gap-3">
                        <span>Submitted on {task.createdAt ? new Date(Array.isArray(task.createdAt) ? new Date(task.createdAt[0], task.createdAt[1]-1, task.createdAt[2]) : task.createdAt).toLocaleDateString() : '--'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority || 'MEDIUM'}
                      </span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}

                {filteredTasks.length === 0 && (
                  <div className="py-20 text-center text-gray-400">
                    <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900">No items found</p>
                    <p className="text-xs text-gray-400 mt-1">There are no tasks reported by you in this tab.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detail Panel / History Timeline */}
        <div className="lg:col-span-5">
          {selectedTask ? (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6 sticky top-6 animate-in fade-in duration-300">
              
              {/* Task Title & Project */}
              <div className="border-b border-gray-100 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">TASK-{selectedTask.id}</span>
                  
                  <div className="flex items-center gap-2">
                    {/* Action buttons */}
                    <button
                      onClick={() => {
                        setActiveTaskDetailId(selectedTask.id);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 text-gray-600 font-semibold flex items-center gap-1.5"
                    >
                      <Eye size={12} /> View Details
                    </button>

                    {selectedTask.status === 'Awaiting Clarification' && (
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-2.5 py-1 text-xs bg-[#1F6FEB] hover:bg-[#003484] text-white rounded font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Edit3 size={12} /> Edit & Resubmit
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-gray-900 leading-snug">{selectedTask.title}</h3>
                
                <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{selectedTask.project?.name}</span>
                  <span>Priority: <span className="font-bold text-gray-700">{selectedTask.priority || 'MEDIUM'}</span></span>
                </div>
              </div>

              {/* Banner for Clarification */}
              {selectedTask.status === 'Awaiting Clarification' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-md space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle size={14} className="text-amber-600" />
                    Action Required: Clarification Requested
                  </div>
                  <p className="text-amber-700 leading-relaxed">
                    The PM has requested additional details. Click "Edit & Resubmit" to add comments/description. Saving updates will automatically send it back to the PM review queue.
                  </p>
                </div>
              )}

              {/* Task Description */}
              {selectedTask.description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</h4>
                  <div 
                    className="text-xs text-gray-600 leading-relaxed border border-gray-100 bg-gray-50/50 p-3 rounded-md max-h-40 overflow-y-auto prose custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: selectedTask.description }}
                  />
                </div>
              )}

              {/* Task Approval History Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <History size={13} /> Task Approval History
                </h4>

                {loadingHistory ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1F6FEB]"></div>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-gray-200 pl-4 space-y-6 ml-2 text-xs">
                    {historyList
                      .filter(h => h.changeType === 'STATUS_CHANGE' || h.changeType === 'CREATED' || h.changeType === 'ISSUE_TYPE_CHANGE')
                      .map((history) => {
                        const date = new Date(history.createdAt).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div key={history.id} className="relative space-y-1.5">
                            {/* Circle Node */}
                            <div className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                              history.changeType === 'CREATED' ? 'bg-blue-500' :
                              history.toValue === 'Rejected' ? 'bg-red-500' :
                              history.toValue === 'Awaiting Clarification' ? 'bg-amber-500' :
                              history.toValue === 'Approved Awaiting Assignment' ? 'bg-green-500' :
                              history.toValue === 'Ready for Development' ? 'bg-indigo-600' :
                              'bg-gray-400'
                            }`} />

                            <div className="flex justify-between items-baseline gap-2">
                              <span className="font-bold text-gray-800">
                                {history.changeType === 'CREATED' ? 'Submitted for PM Review' :
                                 history.changeType === 'ISSUE_TYPE_CHANGE' ? `Converted item type to ${history.toValue}` :
                                 `Moved to ${history.toValue}`}
                              </span>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">{date}</span>
                            </div>

                            <p className="text-[11px] text-gray-500 font-medium">Performed By: {history.performedBy}</p>

                            {history.comment && (
                              <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-md text-[11px] text-gray-600 italic mt-1.5 flex gap-1.5 items-start">
                                <MessageSquare size={12} className="text-gray-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-gray-500 not-italic block mb-0.5">PM Feedback:</span>
                                  "{history.comment}"
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {historyList.filter(h => h.changeType === 'STATUS_CHANGE' || h.changeType === 'CREATED' || h.changeType === 'ISSUE_TYPE_CHANGE').length === 0 && (
                      <div className="text-xs text-gray-400 italic py-2">No approval logs found</div>
                    )}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white border border-gray-200 border-dashed rounded-lg p-12 text-center text-gray-400 h-96 flex flex-col justify-center items-center">
              <Eye className="w-12 h-12 text-gray-200 mb-4" />
              <p className="text-sm font-semibold text-gray-900">Select a task</p>
              <p className="text-xs text-gray-400 mt-1">Select any task from the list to view its description, PM reviews, and full approval history.</p>
            </div>
          )}
        </div>

      </div>

      {/* Task Details Modal */}
      {isDetailModalOpen && activeTaskDetailId && (
        <TaskDetailModal
          taskId={activeTaskDetailId}
          projectId={tasks.find(t => t.id === activeTaskDetailId)?.project?.id || 0}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={fetchSubmittedTasks}
          onDelete={fetchSubmittedTasks}
        />
      )}

      {/* Task Edit & Resubmit Modal (Triggered when user clicks Edit on an Awaiting Clarification task) */}
      {isEditModalOpen && selectedTask && (
        <TaskDetailModal
          taskId={selectedTask.id}
          projectId={selectedTask.project?.id || 0}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            fetchSubmittedTasks();
          }}
          onUpdate={() => {
            setIsEditModalOpen(false);
            fetchSubmittedTasks();
            addNotification('Success', 'Clarification details submitted. Task returned to PM Review Queue.', 'success');
          }}
          onDelete={() => {
            setIsEditModalOpen(false);
            fetchSubmittedTasks();
          }}
        />
      )}
    </div>
  );
};

export default MySubmittedTasks;
