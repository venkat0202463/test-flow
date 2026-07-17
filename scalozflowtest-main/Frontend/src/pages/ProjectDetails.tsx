import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
   Activity,
   Monitor,
   Layout,
   ListTodo,
   Map,
   BarChart3,
   GitPullRequest
} from 'lucide-react';
import api from '../services/api';
import type { Project } from '../types';

const formatProjectName = (name: string) => {
   if (!name) return '';
   if (name === name.toUpperCase()) {
      return name
         .toLowerCase()
         .split(' ')
         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
         .join(' ');
   }
   return name;
};

const formatRelativeTime = (dateString: string | undefined) => {
   if (!dateString) return 'recently';
   try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      // Handle potential timezone offset differences or clock drift
      if (diffMs < 0) return 'just now';

      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
   } catch (e) {
      return 'recently';
   }
};

const ProjectDetails = () => {
   const { id } = useParams<{ id: string }>();
   const [project, setProject] = useState<Project | null>(null);
   const [stats, setStats] = useState<any>(null);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const fetchProjectAndStats = async () => {
         try {
            const [projRes, statsRes] = await Promise.all([
               api.get('/projects'),
               api.get(`/stats/project/${id}`).catch(() => ({ data: null }))
            ]);
            const proj = projRes.data.find((p: Project) => p.id === Number(id));
            setProject(proj);
            setStats(statsRes.data);
         } catch (error) {
            console.error("Project fetch failure:", error);
         } finally {
            setLoading(false);
         }
      };
      fetchProjectAndStats();
   }, [id]);

   if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-white">
         <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-royal-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Project Details...</span>
         </div>
      </div>
   );

   if (!project) return (
      <div className="min-h-screen flex items-center justify-center bg-white">
         <div className="text-center">
            <h2 className="text-2xl font-black text-navy-900 mb-2">Project Not Found</h2>
            <p className="text-slate-500 mb-6">The requested project ID does not exist in your workspace.</p>
            <Link to="/dashboard/projects" className="btn-primary px-6 py-2">Return to Projects</Link>
         </div>
      </div>
   );

   const isScrum = project.projectType?.toUpperCase() === 'SCRUM';

   return (
      <div className="content-container animate-in fade-in duration-500 max-w-5xl mx-auto py-8">
         {/* HEADER */}
         <div className="flex flex-col gap-2 pb-6 border-b border-[#DFE1E6]">
            <div className="flex items-center gap-2 project-breadcrumb mb-1">
               <Link to="/dashboard/projects" className="hover:text-[#1F6FEB] transition-colors">Workspace</Link>
               <span className="text-[#DFE1E6]">/</span>
               <span>Project Details</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2">
               <div className="space-y-2">
                  <div className="flex items-center gap-3 project-meta mb-2">
                     <span>{project.projectType} PROJECT</span>
                     <span>•</span>
                     <span>{isScrum ? (stats?.activeSprint ? 'ACTIVE SPRINT' : 'NO ACTIVE SPRINT') : 'ACTIVE BOARD'}</span>
                     <span>•</span>
                     <span>{project.teamSize || stats?.memberCount || 2} MEMBERS</span>
                  </div>
                  <h1 className="project-title tracking-tight">
                     {formatProjectName(project.name)}
                  </h1>
                  <div className="flex items-center gap-3 project-subtitle">
                     <span>Created by {project.createdBy?.name || 'Project Manager'}</span>
                     <span>•</span>
                     <span>Last updated {formatRelativeTime(project.updatedAt || project.createdAt)}</span>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  {isScrum ? (
                     <Link to={`/dashboard/backlog/${project.id}`} className="atlassian-btn-custom px-4 py-2 rounded-[3px] text-sm font-bold flex items-center gap-2 shadow-sm">
                        <ListTodo size={16} /> <span>Backlog</span>
                     </Link>
                  ) : (
                     <Link to={`/dashboard/roadmap/${project.id}`} className="atlassian-btn-custom px-4 py-2 rounded-[3px] text-sm font-bold flex items-center gap-2 shadow-sm">
                        <Map size={16} /> <span>Roadmap</span>
                     </Link>
                  )}
                  <Link to={`/dashboard/insights/${project.id}`} className="atlassian-btn-custom px-4 py-2 rounded-[3px] text-sm font-bold flex items-center gap-2 shadow-sm">
                     <BarChart3 size={16} /> <span>Reports</span>
                  </Link>
                  <Link
                     to={isScrum ? `/dashboard/sprint-board/${project.id}` : `/dashboard/project/${project.id}`}
                     className="atlassian-btn-custom px-4 py-2 rounded-[3px] text-sm font-bold flex items-center gap-2 shadow-sm"
                  >
                     <Monitor size={16} /> <span>Open Board</span>
                  </Link>
               </div>
            </div>
         </div>

         {/* PROJECT NAVIGATION */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Link to={isScrum ? `/dashboard/sprint-board/${project.id}` : `/dashboard/project/${project.id}`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
               <Layout size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
               <h4 className="text-sm font-bold text-[#172B4D] mb-1">Board</h4>
               <p className="text-[10px] text-[#5E6C84] uppercase">Open active board</p>
            </Link>

            {isScrum ? (
               <Link to={`/dashboard/backlog/${project.id}`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <ListTodo size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Backlog</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">Manage sprint tasks</p>
               </Link>
            ) : (
               <Link to={`/dashboard/roadmap/${project.id}`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <Map size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Roadmap</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">View milestones</p>
               </Link>
            )}

            {!isScrum && (
               <Link to={`/dashboard/insights/${project.id}?tab=Cycle Time`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <GitPullRequest size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Delivery Flow</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">Track delivery</p>
               </Link>
            )}

            {isScrum && (
               <Link to={`/dashboard/roadmap/${project.id}`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <Map size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Roadmap</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">View milestones</p>
               </Link>
            )}


            {isScrum ? (
               <Link to={`/dashboard/insights/${project.id}?tab=Burndown`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <BarChart3 size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Reports</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">Sprint analytics</p>
               </Link>
            ) : (
               <Link to={`/dashboard/insights/${project.id}?tab=Burndown`} className="bg-white border border-[#DFE1E6] p-4 rounded-lg hover:shadow-md hover:border-[#1F6FEB] transition-all group">
                  <BarChart3 size={20} className="text-[#00B3A4] mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-bold text-[#172B4D] mb-1">Reports</h4>
                  <p className="text-[10px] text-[#5E6C84] uppercase">Kanban analytics</p>
               </Link>
            )}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* MAIN CONTENT (ABOUT & TEAM) */}
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white p-6 rounded-lg border border-[#DFE1E6] shadow-sm">
                  <h3 className="text-sm font-bold text-[#172B4D] mb-4">About Project</h3>
                  <p className="text-[13px] text-[#42526E] leading-relaxed">
                     {project.description || project.objective || 'This project focuses on workflow automation and sprint-based delivery management. It provides a structured environment for tracking tasks and milestones.'}
                  </p>
               </div>

               {/* COMPACT METADATA */}
               <div className="bg-white p-6 rounded-lg border border-[#DFE1E6] shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     <div>
                        <p className="text-[15px] font-bold text-[#5E6C84] mb-1">Category</p>
                        <p className="text-[13px] font-bold text-[#172B4D]">{project.category || 'Software'}</p>
                     </div>
                     <div>
                        <p className="text-[15px] font-bold text-[#5E6C84] mb-1">Deadline</p>
                        <p className="text-[13px] font-bold text-[#172B4D]">{project.deadline ? new Date(project.deadline).toLocaleDateString() : '30/4/2026'}</p>
                     </div>
                     <div>
                        <p className="text-[15px] font-bold text-[#5E6C84] mb-1">Team Size</p>
                        <p className="text-[13px] font-bold text-[#172B4D]">{project.teamSize || stats?.memberCount || 2} Members</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* SIDEBAR (SPRINT PROGRESS & OWNERSHIP) */}
            <div className="space-y-6">
               <div className="bg-[#1F6FEB] text-white p-6 rounded-lg relative overflow-hidden shadow-md">
                  <div className="relative z-10">
                     <h3 className="text-sm font-bold mb-4">{isScrum ? (stats?.activeSprint ? stats.activeSprint.name : 'Sprint Progress') : 'Flow Progress'}</h3>
                     <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-black">{stats?.completionRate || 0}%</span>
                        <span className="text-xs font-bold opacity-80">Complete</span>
                     </div>
                     <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${stats?.completionRate || 0}%` }} />
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs opacity-90">{stats?.completedTasks || 0}/{stats?.totalTasks || 0} tasks done</p>
                        {isScrum && (
                           <p className="text-xs opacity-90">
                              {stats?.activeSprint?.endDate ?
                                 `${Math.max(0, Math.ceil((new Date(stats.activeSprint.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} days remaining` :
                                 'Ongoing'}
                           </p>
                        )}
                     </div>
                  </div>
               </div>

               <div className="bg-white border border-[#DFE1E6] p-6 rounded-lg shadow-sm">
                  <h3 className="text-sm font-bold text-[#172B4D] mb-4">Project Lead</h3>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-[#00B3A4] flex items-center justify-center text-white font-bold shadow-sm">
                        {project.createdBy?.name?.charAt(0) || 'P'}
                     </div>
                     <div>
                        <p className="text-[13px] font-bold text-[#172B4D]">{project.createdBy?.name || 'Project Manager'}</p>
                        <p className="text-[13px] text-[#5E6C84]">{project.createdBy?.email || 'admin@example.com'}</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ProjectDetails;
