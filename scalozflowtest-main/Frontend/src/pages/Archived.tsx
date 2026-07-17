import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  Archive,
  Layout,
  Layers,
  History,
  Zap
} from 'lucide-react';
import api from '../services/api';
import type { Task, Sprint, Project } from '../types';
import { useNotifications } from '../context/NotificationContext';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTaskCode } from '../services/projectUtils';

const Archived = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSprintIds, setExpandedSprintIds] = useState<Set<number>>(new Set());
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<number>>(new Set());
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projRes, tasksRes, sprintsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/tasks?projectId=${projectId}`),
        api.get(`/projects/${projectId}/sprints`)
      ]);
      setProject(projRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setSprints(Array.isArray(sprintsRes.data) ? sprintsRes.data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      addNotification('Error', 'Failed to load archived data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const completedSprints = sprints.filter(s => s.status?.toUpperCase() === 'COMPLETED');
  const archivedEpics = tasks.filter(t => t.issueType === 'EPIC' && t.status?.toUpperCase() === 'DONE');

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-10 h-10 border-4 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const renderIssueRow = (task: Task) => (
    <div
      key={task.id}
      onClick={(e) => { e.stopPropagation(); setActiveTaskId(task.id); setIsDetailModalOpen(true); }}
      className="flex items-center gap-4 px-4 py-2 bg-white border-b border-[#DFE1E6] hover:bg-[#F4F5F7] transition-all cursor-pointer group"
    >
      <span className="text-[11px] font-semibold text-[#42526E] min-w-[80px] uppercase">{getTaskCode(task.id, task.project?.name || project?.name, task.projectSequence)}</span>
      <span className="text-[13px] font-medium text-[#172B4D] flex-1 truncate">{task.title}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-[#006644] uppercase tracking-tighter bg-[#E3FCEF] px-2 py-0.5 rounded">Archived</span>
        <div className="w-6 h-6 rounded-full bg-[#00B3A4] flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">
          {task.assignee?.name.charAt(0) || 'U'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white font-sans text-sm overflow-y-auto custom-scrollbar-wide">
      <div className="px-10 pb-20 pt-8">
        <div className="flex items-center gap-2 project-breadcrumb mb-3">
          <Link to="/dashboard/projects" className="hover:text-[#172B4D]">Workspace</Link>
          <ChevronRight size={14} />
          <Link to={`/dashboard/project-details/${projectId}`} className="hover:text-[#172B4D]">{project?.name || 'Project'}</Link>
          <ChevronRight size={14} />
          <span>Archive</span>
        </div>

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="section-title tracking-tighter flex items-center gap-3">
              Project Archive
            </h1>
            <p className="section-subtitle mt-1">Historical records of completed cycles and strategic epics.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-[#5E6C84] uppercase tracking-widest">Project Health</p>
              <p className="text-sm font-bold text-[#36B37E]">{completedSprints.length} Cycles Completed</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-12">

          {/* Cycle History Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-[#DFE1E6] pb-4">
              <div className="w-10 h-10 bg-[#E6F8F6] rounded-lg flex items-center justify-center text-[#00B3A4]">
                <History size={20} />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#172B4D]">Cycle History</h2>
                <p className="text-[12px] text-[#5E6C84]">All completed sprint and kanban intervals.</p>
              </div>
            </div>

            <div className="space-y-4">
              {completedSprints.length > 0 ? completedSprints.map(sprint => {
                const isExpanded = expandedSprintIds.has(sprint.id);
                const sprintTasks = tasks.filter(t => t.sprintId === sprint.id || (t.sprint && t.sprint.id === sprint.id));

                return (
                  <div key={sprint.id} className="border border-[#DFE1E6] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                    <div
                      onClick={() => {
                        const next = new Set(expandedSprintIds);
                        if (next.has(sprint.id)) next.delete(sprint.id);
                        else next.add(sprint.id);
                        setExpandedSprintIds(next);
                      }}
                      className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#F4F5F7]/50"
                    >
                      <div className="flex items-center gap-4">
                        <ChevronRight size={18} className={`text-[#42526E] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <div className="w-8 h-8 rounded bg-[#E3FCEF] flex items-center justify-center text-[#00875A]">
                          <Zap size={16} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold text-[#172B4D]">{sprint.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-widest flex items-center gap-1">
                              <Clock size={10} /> {sprint.startDate && sprint.endDate ? `${sprint.startDate} - ${sprint.endDate}` : 'No timeframe defined'}
                            </span>
                            <span className="text-[10px] font-black text-[#00875A] bg-[#E3FCEF] px-1.5 py-0.5 rounded uppercase">Success</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-[#172B4D]">{sprintTasks.length} Tickets</p>
                        <p className="text-[10px] text-[#5E6C84] uppercase font-black tracking-tighter">Archived</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#DFE1E6] bg-[#F4F5F7]/20">
                        {sprintTasks.map(renderIssueRow)}
                        {sprintTasks.length === 0 && (
                          <div className="p-8 text-center text-xs text-[#5E6C84] italic">No issues recorded in this cycle.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="py-12 border-2 border-dashed border-[#DFE1E6] rounded-xl flex flex-col items-center justify-center text-[#5E6C84] bg-[#F4F5F7]/30">
                  <Layers size={32} className="mb-3 opacity-20" />
                  <p className="font-semibold">No completed cycles found.</p>
                </div>
              )}
            </div>
          </section>

          {/* Epic History Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-[#DFE1E6] pb-4">
              <div className="w-10 h-10 bg-[#E6F8F6] rounded-lg flex items-center justify-center text-[#00B3A4]">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#172B4D]">Strategic Epics</h2>
                <p className="text-[12px] text-[#5E6C84]">Archived epics with all requirements fulfilled.</p>
              </div>
            </div>

            <div className="space-y-4">
              {archivedEpics.length > 0 ? archivedEpics.map(epic => {
                const isExpanded = expandedEpicIds.has(epic.id);
                const children = tasks.filter(t => t.parentId === epic.id || (t.parentTask && t.parentTask.id === epic.id));
                const epicColor = (epic as any).epicColor || '#6554C0';

                return (
                  <div key={epic.id} className="border border-[#DFE1E6] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                    <div
                      onClick={() => {
                        const next = new Set(expandedEpicIds);
                        if (next.has(epic.id)) next.delete(epic.id);
                        else next.add(epic.id);
                        setExpandedEpicIds(next);
                      }}
                      className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#F4F5F7]/50"
                    >
                      <div className="flex items-center gap-4">
                        <ChevronRight size={18} className={`text-[#42526E] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <div
                          className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setActiveTaskId(epic.id); setIsDetailModalOpen(true); }}
                        >
                          <div className="w-2 h-6 rounded-sm" style={{ backgroundColor: epicColor }} />
                          <div>
                            <h3 className="text-[15px] font-bold text-[#172B4D] hover:text-[#1F6FEB] transition-colors">{epic.title}</h3>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] font-black text-[#5E6C84] uppercase tracking-widest">Strategic Asset</span>
                              <span className="text-[10px] font-black text-[#006644] bg-[#E3FCEF] px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                <CheckCircle size={10} /> All Requirements Met
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-[#172B4D]">{children.length} Components</p>
                        <p className="text-[10px] text-[#5E6C84] uppercase font-black tracking-tighter">Archived</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#DFE1E6] bg-[#F4F5F7]/20">
                        {children.map(renderIssueRow)}
                        {children.length === 0 && (
                          <div className="p-8 text-center text-xs text-[#5E6C84] italic">No sub-tasks were associated with this epic.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="py-12 border-2 border-dashed border-[#DFE1E6] rounded-xl flex flex-col items-center justify-center text-[#5E6C84] bg-[#F4F5F7]/30">
                  <Layout size={32} className="mb-3 opacity-20" />
                  <p className="font-semibold">No archived epics found.</p>
                </div>
              )}
            </div>
          </section>

        </div>

        {isDetailModalOpen && activeTaskId && (
          <TaskDetailModal
            taskId={activeTaskId}
            projectId={Number(projectId)}
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            onUpdate={fetchData}
            onDelete={fetchData}
          />
        )}
      </div>
    </div>
  );
};

export default Archived;
