import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  ClipboardList,
  FolderKanban,
  Plus,
  Settings,
  BarChart3,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CreateIssueModal from '../components/CreateIssueModal';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [_projects, _setProjects] = useState<any[]>([]);
  const [selectedProjectId] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Z') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        _setProjects(response.data);
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [projectId, selectedProjectId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const activeId = projectId || (selectedProjectId !== 'all' ? selectedProjectId : null);
      const url = activeId ? `/stats/project/${activeId}` : '/stats/summary';
      const response = await api.get(url);
      setStats(response.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };


  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const maxTasks = Math.max(...(stats?.workloadDistribution?.map((w: any) => w.taskCount) || [1]));

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Professional Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DFE1E6] pb-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">{stats?.projectName || 'System Overview'}</span>
          </div>
          <h1 className="section-title tracking-tight">
            {getGreeting()}, {user?.name}
          </h1>
          <p className="section-subtitle mt-1">
            {projectId ? `Working on ${stats?.projectName}` : (stats?.activeProjects > 0 ? "Here's what's happening across your projects today." : "Welcome to ScalozFlow! Get started by exploring your workspace.")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center h-8 w-8 mr-6 text-[#42526E] hover:text-[#172B4D] bg-white hover:bg-[#F4F5F7] border border-[#DFE1E6] rounded-md transition-all shadow-sm active:scale-95 cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (Shift+Z)" : "Enter Fullscreen (Shift+Z)"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {!projectId && (user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
            <Link to="/dashboard/projects" className="flex items-center gap-2 text-[14px] font-bold text-white bg-[#1F6FEB] hover:bg-[#0B3D91] px-4 py-2 rounded-md transition-colors shadow-sm whitespace-nowrap">
              Manage Projects <ArrowUpRight size={16} />
            </Link>
          )}
          {!projectId && (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') && (
            <Link to="/dashboard/projects" className="flex items-center gap-2 text-[14px] font-bold text-white bg-[#1F6FEB] hover:bg-[#0B3D91] px-4 py-2 rounded-md transition-colors shadow-sm whitespace-nowrap">
              View My Projects <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>

      {/* SYSTEM OVERVIEW MODE (6 Cards Row) */}
      {!projectId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <Link to="/dashboard/my-tasks" className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-[#DEEBFF] rounded-lg flex items-center justify-center text-[#1F6FEB] mb-4 group-hover:scale-110 transition-transform">
              <ClipboardList size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Open Tasks</p>
            <h2 className="text-[28px] font-black text-[#172B4D] mb-1">{stats?.openTasks || 0}</h2>
          </Link>

          <Link to="/dashboard/my-tasks?status=DONE" className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-[#E3FCEF] rounded-lg flex items-center justify-center text-[#00875A] mb-4 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Completed Tasks</p>
            <h2 className="text-[28px] font-black text-[#172B4D] mb-1">{stats?.tasksCompleted || stats?.completedTasks || 0}</h2>
          </Link>

          <Link to="/dashboard/projects" className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-[#EAE6FF] rounded-lg flex items-center justify-center text-[#403294] mb-4 group-hover:scale-110 transition-transform">
              <FolderKanban size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">
              {selectedProjectId !== 'all' || projectId ? 'Team Members' : 'Active Projects'}
            </p>
            <h2 className="text-[28px] font-black text-[#172B4D] mb-1">
              {selectedProjectId !== 'all' || projectId ? (stats?.memberCount || 0) : (stats?.activeProjects || 0)}
            </h2>
          </Link>

          <Link
            to={stats?.activeSprint?.projectId ? `/dashboard/sprint-board/${stats.activeSprint.projectId}` : "#"}
            className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center"
          >
            <div className="w-10 h-10 bg-[#FFF0B3] rounded-lg flex items-center justify-center text-[#FF8B00] mb-4 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Active Sprint</p>
            <h2 className={`font-black text-[#172B4D] mb-1 ${stats?.activeSprint ? 'text-[28px]' : 'text-[24px]'}`}>
              {stats?.activeSprint ? stats.activeSprint.name : 'No Sprint'}
            </h2>
          </Link>

          <Link to="/dashboard/my-tasks?filter=overdue" className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-[#FFEBE6] rounded-lg flex items-center justify-center text-[#BF2600] mb-4 group-hover:scale-110 transition-transform">
              <AlertCircle size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Overdue Issues</p>
            <h2 className="text-[28px] font-black text-[#172B4D] mb-1">{stats?.overdueTasks || 0}</h2>
          </Link>

          <Link to="/dashboard/my-tasks?issueType=EPIC" className="stats-card bg-white border border-[#DFE1E6] p-5 rounded-[8px] shadow-sm hover:shadow-md hover:border-[#1F6FEB]/30 transition-all group flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-[#E6FCFF] rounded-lg flex items-center justify-center text-[#00B3A4] mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Open Epics</p>
            <h2 className="text-[28px] font-black text-[#172B4D] mb-1">{stats?.totalEpics || 0}</h2>
          </Link>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Stats & Workload */}
        <div className="lg:col-span-8 space-y-8">

          {/* PROJECT-SPECIFIC MODE STATS */}
          {projectId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link to="/dashboard/my-tasks" className="bg-white border border-[#DFE1E6] p-6 rounded-[8px] hover:shadow-xl hover:border-[#1F6FEB]/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Clock size={80} className="text-[#1F6FEB]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">My Open Tasks</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-[#172B4D]">{stats?.myOpenTasks || 0}</span>
                    <span className="text-[11px] font-bold text-[#00875A] bg-[#E3FCEF] px-2 py-0.5 rounded uppercase">{stats?.highPriorityTasks || 0} High Priority</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#1F6FEB]">
                    View Tasks <ChevronRight size={14} />
                  </div>
                </div>
              </Link>

              <Link to={`/dashboard/insights/${projectId}`} className="bg-white border border-[#DFE1E6] p-6 rounded-[8px] relative overflow-hidden hover:shadow-xl hover:border-[#1F6FEB]/30 transition-all group">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <span className="text-[12px] font-bold text-[#6B778C] uppercase tracking-wider mb-2">Project Progress</span>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-black text-[#172B4D]">{stats?.completionRate || 0}%</span>
                      <span className="text-[11px] font-bold text-[#5E6C84] bg-[#F4F5F7] px-2 py-0.5 rounded uppercase">{stats?.completedTasks || 0}/{stats?.totalTasks || 0} Done</span>
                    </div>
                    <div className="w-full h-3 bg-[#EBECF0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#36B37E] rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(54,179,126,0.3)]"
                        style={{ width: `${stats?.completionRate || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#1F6FEB]">
                    View Insights <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Team Workload Distribution (Replaces Recent Activity) */}
          <div className="bg-white border border-[#DFE1E6] rounded-[8px] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F4F5F7] flex items-center justify-between bg-[#F4F5F7]/30">
              <h3 className="text-[15px] font-bold text-[#172B4D] flex items-center gap-2">
                <BarChart3 size={18} className="text-[#1F6FEB]" />
                Team Workload Distribution
              </h3>
              <button onClick={fetchStats} className="p-1.5 hover:bg-white rounded transition-colors text-[#5E6C84]">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {(stats?.workloadDistribution || []).length > 0 ? stats.workloadDistribution.map((item: any, i: number) => (
                <div
                  key={item.name}
                  className={`space-y-2 group ${user?.role === 'ADMIN' || user?.role === 'MANAGER' ? 'cursor-pointer hover:bg-[#F4F5F7] p-2 rounded transition-colors -mx-2' : ''}`}
                  onClick={() => {
                    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
                      navigate(`/dashboard/my-tasks?assigneeName=${encodeURIComponent(item.name)}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm transition-transform group-hover:scale-110 bg-[#00B3A4]">
                        {item.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-bold text-[#42526E] group-hover:text-[#172B4D] transition-colors">{item.name}</span>
                    </div>
                    <span className="text-[13px] font-black text-[#172B4D]">{item.taskCount} Tasks</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#EBECF0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm bg-[#00B3A4]"
                      style={{ width: `${(item.taskCount / maxTasks) * 100}%` }}
                    />
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center text-[#5E6C84] text-[13px]">No workload data available.</div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Quick Ops & Team */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#0B3D91] text-white p-6 rounded-[8px] shadow-xl shadow-blue-900/20 relative overflow-hidden">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
              Quick Operations
            </h3>
            <div className="grid grid-cols-1 gap-3 relative z-10">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!(_projects.length > 0 || !!projectId)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all group text-left border border-white/10 ${!(_projects.length > 0 || !!projectId) ? 'opacity-40 cursor-not-allowed bg-white/5' : 'bg-white/10 hover:bg-white/20'}`}
                title={!(_projects.length > 0 || !!projectId) ? "Please join or be onboarded to a project first" : "Create a task in this project"}
              >
                <div className={`w-8 h-8 bg-white/20 rounded-md flex items-center justify-center ${(_projects.length > 0 || !!projectId) ? 'group-hover:scale-110' : ''} transition-transform`}><Plus size={18} /></div>
                <div>
                  <p className="text-[13px] font-bold">New Task</p>
                  <p className="text-[10px] text-white/60">{!(_projects.length > 0 || !!projectId) ? "Join a project to create tasks" : "Create a task in this project"}</p>
                </div>
              </button>
              <button
                onClick={() => {
                  const activeId = projectId || (selectedProjectId !== 'all' ? selectedProjectId : null);
                  navigate(activeId ? `/dashboard/project-details/${activeId}` : '/dashboard/settings');
                }}
                className="flex items-center gap-3 w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all group text-left border border-white/10"
              >
                <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform"><Settings size={18} /></div>
                <div>
                  <p className="text-[13px] font-bold">System Settings</p>
                  <p className="text-[10px] text-white/60">Manage keys and members</p>
                </div>
              </button>
            </div>
          </div>

        </div>

      </div>

      {isCreateModalOpen && (
        <CreateIssueModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchStats();
          }}
          projectId={projectId ? parseInt(projectId) : (selectedProjectId !== 'all' ? parseInt(selectedProjectId) : undefined)}
        />
      )}

    </div>
  );
};

export default Dashboard;
