import React, { useState, useEffect, useRef } from 'react';
import {
   BarChart2,
   ChevronDown,
   Search,
   Layout,
   Layers,
   Zap,
   Map,
   ExternalLink,
   Settings,
   Menu,
   Bell,
   PlusCircle,
   Home,
   Archive,
   Tag,
   ChevronLeft,
   ChevronRight,
   Compass,
   Loader2
} from 'lucide-react';
import { Link, useLocation, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Project, Task } from '../types';
import CreateIssueModal from '../components/CreateIssueModal';
import CreateProjectModal from '../components/CreateProjectModal';
import TaskDetailModal from '../components/TaskDetailModal';
import { useNotifications } from '../context/NotificationContext';
import Toast from '../components/Toast';
import { getTaskCode } from '../services/projectUtils';
import scalozFlowLogo from '../assets/scaloz-flow-logo.png';


const DashboardLayout: React.FC = () => {
   const { user: authUser, logout } = useAuth();
   const { notifications, activeToast, setActiveToast, markAsRead, markAllAsRead } = useNotifications();
   const unreadCount = notifications.filter(n => !n.read).length;
   const location = useLocation();
   const navigate = useNavigate();
   const params = useParams();

   const handleNotificationClick = async (notif: any) => {
      markAsRead(notif.id);

      setLoadingNotificationId(notif.id);
      try {
         const titleMatch = notif.message.match(/'([^']+)'/);
         let matchedTask = null;

         if (titleMatch && titleMatch[1]) {
            const searchRes = await api.get(`/search?query=${encodeURIComponent(titleMatch[1])}`);
            const tasks = searchRes.data.tasks || [];
            if (tasks.length > 0) {
               matchedTask = tasks[0];
            }
         }

         if (!matchedTask) {
            const res = await api.get('/tasks');
            const allTasks: Task[] = res.data;
            const msgLower = notif.message.toLowerCase();

            const sortedTasks = [...allTasks].sort((a, b) => (b.title || '').length - (a.title || '').length);

            matchedTask = sortedTasks.find(t => {
               if (!t.title) return false;
               const titleLower = t.title.toLowerCase();
               return msgLower.includes(titleLower);
            });
         }

         if (matchedTask) {
            setActiveTaskId(matchedTask.id);
            setActiveTaskProjectId(matchedTask.projectId || matchedTask.project?.id || null);
            setIsDetailModalOpen(true);
            setActiveDropdown(null);
         } else {
            console.log("Could not find task matching message:", notif.message);
            setActiveDropdown(null);
         }
      } catch (err) {
         console.error("Error matching notification to task:", err);
         setActiveDropdown(null);
      } finally {
         setLoadingNotificationId(null);
      }
   };

   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved ? JSON.parse(saved) : false;
   });

   const toggleSidebar = () => {
      setIsSidebarCollapsed((prev: boolean) => {
         const newVal = !prev;
         localStorage.setItem('sidebar-collapsed', JSON.stringify(newVal));
         return newVal;
      });
   };

   const handleSidebarLinkClick = () => {
      if (window.innerWidth < 1024) {
         setIsSidebarCollapsed(true);
      }
   };

   // Global Shift+Z fullscreen shortcut
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         // Ignore if user is typing in an input/textarea/select
         const tag = (e.target as HTMLElement)?.tagName;
         if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
         if (e.shiftKey && e.code === 'KeyZ') {
            if (!document.fullscreenElement) {
               document.documentElement.requestFullscreen().catch(console.error);
            } else {
               document.exitFullscreen();
            }
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);

   const [projects, setProjects] = useState<Project[]>([]);
   const [recentTasks, setRecentTasks] = useState<Task[]>(() => {
      const saved = localStorage.getItem('recent-tasks');
      return saved ? JSON.parse(saved) : [];
   });
   const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
   const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
   const [loadingNotificationId, setLoadingNotificationId] = useState<number | null>(null);
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
   const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
   const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
   const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
   const [activeTaskProjectId, setActiveTaskProjectId] = useState<number | null>(null);

   // Search State
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<{ projects: Project[], tasks: Task[] }>({ projects: [], tasks: [] });
   const [isSearchLoading, setIsSearchLoading] = useState(false);
   const [showSearchResults, setShowSearchResults] = useState(false);

   const leftNavRef = useRef<HTMLDivElement>(null);
   const rightNavRef = useRef<HTMLDivElement>(null);
   const sidebarRef = useRef<HTMLElement>(null);

   useEffect(() => {
      console.log("[DashboardLayout] Current Path:", location.pathname);

      // Safety: If user lands on a project-specific path but no project is found, redirect to projects list
      // But if they are at /dashboard, keep them there (System Overview)
      if (location.pathname.startsWith('/dashboard/project/') && !params.id) {
         navigate('/dashboard/projects');
      }

      fetchData();
      const interval = setInterval(fetchData, 60000); // Poll every 60s (projects only)

      const handleClickOutside = (event: MouseEvent) => {
         const target = event.target as HTMLElement;
         const clickedInsideDropdown = target.closest('.nav-dropdown-container');

         if (!clickedInsideDropdown) {
            setActiveDropdown(null);
            setShowSearchResults(false);
            setSearchQuery('');
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         clearInterval(interval);
      };
   }, []);

   useEffect(() => {
      const delayDebounceFn = setTimeout(() => {
         if (searchQuery.trim().length >= 2) {
            handleSearch();
         } else {
            setSearchResults({ projects: [], tasks: [] });
            setShowSearchResults(false);
         }
      }, 300);

      return () => clearTimeout(delayDebounceFn);
   }, [searchQuery]);

   const handleSearch = async () => {
      setIsSearchLoading(true);
      try {
         let searchUrl = `/search?query=${searchQuery}`;
         if (currentProjectId) {
            searchUrl += `&projectId=${currentProjectId}`;
         }
         const res = await api.get(searchUrl);
         setSearchResults(res.data);
         setShowSearchResults(true);
      } catch (err) {
         console.error("Search error:", err);
      } finally {
         setIsSearchLoading(false);
      }
   };

   useEffect(() => {
      if (authUser?.id) {
         const fetchUserTasks = async () => {
            try {
               const taskRes = await api.get(`/tasks?assigneeId=${authUser.id}`);
               setAssignedTasks(taskRes.data.slice(0, 4));
            } catch (err) {
               console.error("Error fetching user tasks:", err);
            }
         };
         fetchUserTasks();
      }
   }, [authUser]);

   // Track recently viewed tasks
   useEffect(() => {
      if (activeTaskId) {
         const fetchAndStoreTask = async () => {
            try {
               const res = await api.get(`/tasks/${activeTaskId}`);
               const task = res.data;
               if (task) {
                  setRecentTasks(prev => {
                     const filtered = prev.filter(t => t.id !== task.id);
                     const updated = [task, ...filtered].slice(0, 4);
                     localStorage.setItem('recent-tasks', JSON.stringify(updated));
                     return updated;
                  });
               }
            } catch (err) {
               console.warn("Could not load task to store in recent list", err);
            }
         };
         fetchAndStoreTask();
      }
   }, [activeTaskId]);

   useEffect(() => {
      const handleRecentUpdate = () => {
         const saved = localStorage.getItem('recent-tasks');
         if (saved) {
            try {
               setRecentTasks(JSON.parse(saved));
            } catch (e) {
               console.warn("Failed to parse recent-tasks in listener", e);
            }
         }
      };
      window.addEventListener('recent-tasks-updated', handleRecentUpdate);
      return () => window.removeEventListener('recent-tasks-updated', handleRecentUpdate);
   }, []);

   const fetchData = async () => {
      try {
         const projRes = await api.get('/projects');
         setProjects(projRes.data);
      } catch (err) { console.error("Error fetching projects:", err); }
   };



   const currentProjectId = params.id || null;
   const currentProject = projects.find(p => p.id === Number(currentProjectId));

   // Consolidated Navigation Logic
   const getProjectDashboardPath = (p: Project) => {
      return `/dashboard/project-details/${p.id}`;
   };

   const [searchFocusIndex, setSearchFocusIndex] = useState(-1);

   const getSearchItems = () => {
      const items: { type: 'project' | 'task', id: number, item: any }[] = [];
      searchResults.projects.forEach(p => {
         items.push({ type: 'project', id: p.id, item: p });
      });
      searchResults.tasks.forEach(t => {
         items.push({ type: 'task', id: t.id, item: t });
      });
      return items;
   };

   useEffect(() => {
      setSearchFocusIndex(-1);
   }, [searchResults]);

   const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const items = getSearchItems();
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setSearchFocusIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setSearchFocusIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
         e.preventDefault();
         if (searchFocusIndex >= 0 && searchFocusIndex < items.length) {
            const selected = items[searchFocusIndex];
            if (selected.type === 'project') {
               navigate(getProjectDashboardPath(selected.item));
            } else if (selected.type === 'task') {
               setActiveTaskId(selected.item.id);
               setIsDetailModalOpen(true);
            }
            setShowSearchResults(false);
            setSearchQuery('');
         }
      } else if (e.key === 'Escape') {
         e.preventDefault();
         setShowSearchResults(false);
      }
   };

   const navItems = [
      {
         name: 'Your work', id: 'work', sub: recentTasks.map(t => ({
            name: t.title,
            path: t.project ? getProjectDashboardPath(t.project) : `/dashboard/project-details/${t.projectId}`,
            taskId: t.id,
            projectId: t.projectId,
            icon: <Zap size={14} className="text-[#36B37E]" />
         }))
      },
      {
         name: 'Projects',
         id: 'projects',
         sub: [
            ...projects.map(p => ({
               name: p.name,
               path: getProjectDashboardPath(p)
            })),
            { divider: true },
            ...((authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') ? [
               { name: 'Create Project', path: '/dashboard/projects', icon: <PlusCircle size={14} />, special: true }
            ] : []),
            { name: 'View All Projects', path: '/dashboard/projects', icon: <ExternalLink size={14} /> }
         ]
      },
      {
         name: 'Filters',
         id: 'filters',
         sub: [
            { name: 'Open Tasks', path: '/dashboard/my-tasks' },
            { name: 'Completed Tasks', path: '/dashboard/my-tasks?status=DONE' },
            { name: 'Overdue Issues', path: '/dashboard/my-tasks?filter=overdue' },
            { name: 'Open Epics', path: '/dashboard/my-tasks?issueType=EPIC' }
         ]
      },
      { name: 'Dashboards', id: 'dashboards', sub: [{ name: 'System Overview', path: '/dashboard' }] },
   ];

   // Enhanced Context Detection - use startsWith to avoid partial matches (like 'projects' matching 'project')
   const isKanbanRoute = location.pathname.startsWith('/dashboard/project/');
   const isScrumRoute = location.pathname.startsWith('/dashboard/sprint-board/') || location.pathname.startsWith('/dashboard/backlog/');

   const projectTemplate = (currentProject?.projectType || '').toUpperCase().trim() ||
      (isKanbanRoute ? 'KANBAN' :
         isScrumRoute ? 'SCRUM' :
            null);
   return (
      <div className="flex flex-col h-screen overflow-hidden font-sans" style={{ backgroundColor: 'var(--ds-background)' }}>
         {/* Global Top Navigation */}
         <header className="top-navigation flex items-center justify-between px-4 bg-[#0B3D91] h-[48px] shrink-0 z-[5000] border-b border-[#ffffff1a] overflow-visible" style={{ backgroundColor: '#0B3D91' }}>
            <div className="flex items-center gap-2">
               <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white lg:hidden">
                  <Menu size={18} />
               </button>
               <Link to="/dashboard" className="flex items-center px-2 hover:bg-white/10 rounded-md transition-colors py-1 group">
                  <img src={scalozFlowLogo} alt="ScalozFlow Logo" className="h-7 w-auto object-contain" />
               </Link>
            </div>

            <div className="hidden lg:flex items-center gap-0.5 flex-1 px-4 overflow-visible" ref={leftNavRef}>
               {navItems.map(item => (
                  <div key={item.id} className="relative nav-dropdown-container">
                     <button
                        onClick={() => setActiveDropdown(activeDropdown === item.id ? null : item.id)}
                        className={`px-2.5 py-1.5 flex items-center gap-1 text-[15px] font-semibold transition-colors rounded-md ${activeDropdown === item.id ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                     >
                        {item.name} <ChevronDown size={12} className={`transition-transform duration-200 ${activeDropdown === item.id ? 'rotate-180' : ''}`} />
                     </button>

                     {((item.sub && item.sub.length > 0) || item.id === 'work') && activeDropdown === item.id && (
                        <div className="absolute top-[calc(100%+4px)] left-0 w-80 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-2 z-[6000] animate-in fade-in slide-in-from-top-2 duration-200">
                           {item.id === 'work' ? (
                              <div className="py-1">

                                 {/* Recently Viewed */}
                                 <div>
                                    <div className="px-4 py-1 text-[10px] font-bold text-[#6B778C] uppercase tracking-wider mb-1">Recent</div>
                                    {recentTasks.length > 0 ? (
                                       recentTasks.map((t) => (
                                          <button
                                             key={t.id}
                                             onClick={() => {
                                                setActiveTaskId(t.id);
                                                setActiveTaskProjectId(t.project?.id || null);
                                                setIsDetailModalOpen(true);
                                                setActiveDropdown(null);
                                             }}
                                             className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-[#F4F5F7] transition-colors text-left text-[13px] text-[#172B4D]"
                                          >
                                             <Zap size={13} className="text-[#36B37E] shrink-0" />
                                             <span className="truncate flex-1 font-medium">{t.title}</span>
                                          </button>
                                       ))
                                    ) : (
                                       <p className="px-4 py-1 text-xs text-[#6B778C] italic">No recently viewed tasks</p>
                                    )}
                                 </div>
                              </div>
                           ) : (
                              <>
                                 <div className="px-3 py-1 mb-1">
                                    <p className="text-[10px] font-bold text-[#6B778C] uppercase tracking-wider">Explore {item.name}</p>
                                 </div>
                                 {item.sub.map((sub: any, i: number) => {
                                    if (sub.divider) {
                                       return <div key={i} className="my-1 border-t border-[#F4F5F7]" />;
                                    }
                                    if (sub.taskId) {
                                       return (
                                          <button
                                             key={i}
                                             onClick={() => {
                                                setActiveTaskId(sub.taskId);
                                                setActiveTaskProjectId(sub.projectId);
                                                setIsDetailModalOpen(true);
                                                setActiveDropdown(null);
                                             }}
                                             className="w-full flex items-center gap-3 px-4 py-1.5 text-[13px] text-[#172B4D] hover:bg-[#F4F5F7] transition-colors"
                                          >
                                             {sub.icon && <span className="text-[#42526E] shrink-0">{sub.icon}</span>}
                                             <span className="truncate">{sub.name}</span>
                                          </button>
                                       );
                                    }
                                    return (
                                       <Link
                                          key={i}
                                          to={sub.path}
                                          onClick={() => setActiveDropdown(null)}
                                          className={`w-full flex items-center gap-3 px-4 py-1.5 text-[13px] ${sub.special ? 'text-[#1F6FEB] font-bold' : 'text-[#172B4D]'} hover:bg-[#F4F5F7] transition-colors`}
                                       >
                                          {sub.icon && <span className="text-[#42526E] shrink-0">{sub.icon}</span>}
                                          <span className="truncate">{sub.name}</span>
                                       </Link>
                                    );
                                 })}
                              </>
                           )}
                        </div>
                     )}
                  </div>
               ))}
            </div>

            <div className="flex items-center gap-2" ref={rightNavRef}>
               <div className="relative hidden md:flex items-center group nav-dropdown-container">
                  <Search size={14} className="absolute left-3 text-white/50 group-focus-within:text-white transition-colors" />
                  <input
                     className="bg-white/10 border-2 border-transparent focus:bg-white/20 focus:border-white/30 rounded-md py-1 pl-9 pr-4 text-[13px] w-48 lg:w-64 text-white placeholder:text-white/50 transition-all outline-none"
                     placeholder="Search projects or tasks (e.g. FT-9)..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                     onKeyDown={handleSearchKeyDown}
                  />

                  {showSearchResults && (searchQuery.length >= 2) && (
                     <div className="absolute top-[calc(100%+8px)] left-0 w-[350px] bg-white border border-[#DFE1E6] rounded-md shadow-2xl z-[6000] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden text-[#172B4D]">
                        <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                           {isSearchLoading ? (
                              <div className="p-4 text-center text-[12px] text-[#5E6C84] flex items-center justify-center gap-2">
                                 <div className="w-3 h-3 border-2 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div> Searching...
                              </div>
                           ) : (
                              <>
                                 {searchResults.projects.length === 0 && searchResults.tasks.length === 0 ? (
                                    <div className="p-8 text-center">
                                       <Search size={32} className="mx-auto text-[#DFE1E6] mb-2" />
                                       <p className="text-[13px] font-medium text-[#172B4D]">No results found</p>
                                       <p className="text-[11px] text-[#5E6C84]">Try a different keyword or ticket ID</p>
                                    </div>
                                 ) : (
                                    <>
                                       {searchResults.projects.length > 0 && (
                                          <div className="py-2">
                                             <div className="px-4 py-1 text-[10px] font-bold text-[#6B778C] uppercase tracking-wider">Projects</div>
                                             {searchResults.projects.map((p, idx) => {
                                                const isHighlighted = searchFocusIndex === idx;
                                                return (
                                                   <Link
                                                      key={p.id}
                                                      to={getProjectDashboardPath(p)}
                                                      onClick={() => {
                                                         setShowSearchResults(false);
                                                         setSearchQuery('');
                                                      }}
                                                      className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-[#F4F5F7] transition-colors group ${isHighlighted ? 'bg-[#DEEBFF] border-l-4 border-[#1F6FEB] pl-3' : ''}`}
                                                   >
                                                      <div className="w-8 h-8 rounded bg-[#DEEBFF] flex items-center justify-center shrink-0 group-hover:bg-[#B3D4FF] transition-colors">
                                                         <Layout size={14} className="text-[#1F6FEB]" />
                                                      </div>
                                                      <div className="text-left min-w-0">
                                                         <p className="text-[13px] font-semibold text-[#172B4D] truncate">{p.name}</p>
                                                         <p className="text-[11px] text-[#5E6C84] truncate">Software Project</p>
                                                      </div>
                                                   </Link>
                                                );
                                             })}
                                          </div>
                                       )}

                                       {searchResults.tasks.length > 0 && (
                                          <div className="py-2 border-t border-[#F4F5F7]">
                                             <div className="px-4 py-1 text-[10px] font-bold text-[#6B778C] uppercase tracking-wider">Tasks</div>
                                             {searchResults.tasks.map((t, idx) => {
                                                const overallIndex = searchResults.projects.length + idx;
                                                const isHighlighted = searchFocusIndex === overallIndex;
                                                return (
                                                   <button
                                                      key={t.id}
                                                      onClick={() => {
                                                         setActiveTaskId(t.id);
                                                         setIsDetailModalOpen(true);
                                                         setShowSearchResults(false);
                                                         setSearchQuery('');
                                                      }}
                                                      className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-[#F4F5F7] transition-colors group ${isHighlighted ? 'bg-[#DEEBFF] border-l-4 border-[#1F6FEB] pl-3' : ''}`}
                                                   >
                                                      <div className="w-8 h-8 rounded bg-[#E3FCEF] flex items-center justify-center shrink-0 group-hover:bg-[#ABF5D1] transition-colors">
                                                         <Zap size={14} className="text-[#36B37E]" />
                                                      </div>
                                                      <div className="text-left min-w-0">
                                                         <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-[#5E6C84] uppercase">{getTaskCode(t.id, t.project?.name, t.projectSequence)}</span>
                                                            <p className="text-[13px] font-semibold text-[#172B4D] truncate">{t.title}</p>
                                                         </div>
                                                         <p className="text-[11px] text-[#5E6C84] truncate">{t.status?.replace('_', ' ') || 'Backlog'}</p>
                                                      </div>
                                                   </button>
                                                );
                                             })}
                                          </div>
                                       )}
                                    </>
                                 )}
                              </>
                           )}
                        </div>
                        <div className="p-2 bg-[#F4F5F7] border-t border-[#DFE1E6] text-center">
                           <p className="text-[10px] text-[#5E6C84] font-medium italic">Search tip: Use "FT-9" for direct task lookup</p>
                        </div>
                     </div>
                  )}
               </div>

               <div className="relative ml-2 nav-dropdown-container">
                  <button
                     disabled={!(projects.length > 0 || authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN')}
                     title={!(projects.length > 0 || authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') ? "Please join or be onboarded to a project first" : undefined}
                     onClick={() => {
                        if (authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') {
                           setActiveDropdown(activeDropdown === 'create' ? null : 'create');
                        } else {
                           setIsCreateModalOpen(true);
                        }
                     }}
                     className={`bg-white text-[#0B3D91] px-3 py-1 rounded-[3px] font-bold text-[13px] hover:bg-white/90 transition-all flex items-center gap-1 shadow-md active:scale-95 ${!(projects.length > 0 || authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                     Create {(authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') && <ChevronDown size={14} className={`transition-transform ${activeDropdown === 'create' ? 'rotate-180' : ''}`} />}
                  </button>

                  {(activeDropdown === 'create' && (authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN')) && (
                     <div className="absolute top-[calc(100%+8px)] left-0 w-48 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-2 z-[6000] animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                           onClick={() => { setIsCreateModalOpen(true); setActiveDropdown(null); }}
                           className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#172B4D] hover:bg-[#F4F5F7] transition-colors flex items-center gap-2"
                        >
                           <div className="w-5 h-5 rounded bg-[#E3FCEF] flex items-center justify-center shrink-0">
                              <div className="w-2.5 h-2.5 rounded-sm bg-[#36B37E]"></div>
                           </div>
                           Create
                        </button>
                        <button
                           onClick={() => { setIsCreateProjectModalOpen(true); setActiveDropdown(null); }}
                           className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#172B4D] hover:bg-[#F4F5F7] transition-colors flex items-center gap-2"
                        >
                           <div className="w-5 h-5 rounded bg-[#DEEBFF] flex items-center justify-center shrink-0">
                              <Layout size={12} className="text-[#1F6FEB]" />
                           </div>
                           Create Project
                        </button>
                     </div>
                  )}
               </div>

               <div className="relative nav-dropdown-container">
                  <button
                     onClick={() => setActiveDropdown(activeDropdown === 'notifications' ? null : 'notifications')}
                     className={`p-1.5 rounded-md transition-colors text-white relative ml-1 ${activeDropdown === 'notifications' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  >
                     <Bell size={18} />
                     {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DE350B] text-white text-[10px] font-bold rounded-full border-2 border-[#0B3D91] flex items-center justify-center animate-in zoom-in duration-200">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                     )}
                  </button>

                  {activeDropdown === 'notifications' && (
                     <div className="absolute top-[calc(100%+8px)] right-0 w-80 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-0 z-[6000] animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#F4F5F7] bg-[#F4F5F7]/50 flex justify-between items-center">
                           <h3 className="text-[14px] font-bold text-[#172B4D]">Notifications</h3>
                           <button
                              onClick={markAllAsRead}
                              className="text-[11px] font-bold text-[#1F6FEB] hover:underline"
                           >
                              Mark all as read
                           </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                           {notifications.length > 0 ? (
                              notifications.map((notif) => (
                                 <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`px-4 py-3 border-b border-[#F4F5F7] hover:bg-[#F4F5F7] transition-colors cursor-pointer group relative ${!notif.read ? 'bg-[#DEEBFF]/30' : ''}`}
                                 >
                                    <div className="flex gap-3">
                                       <div className={`w-8 h-8 rounded-full bg-white border border-[#DFE1E6] flex items-center justify-center shrink-0 shadow-sm transition-colors ${loadingNotificationId === notif.id ? 'border-[#1F6FEB]' : 'group-hover:border-[#1F6FEB]'}`}>
                                          {loadingNotificationId === notif.id ? (
                                             <Loader2 size={14} className="animate-spin text-[#1F6FEB]" />
                                          ) : notif.iconId === 'zap' ? <Zap size={14} className="text-[#36B37E]" /> :
                                             notif.iconId === 'clock' ? <Bell size={14} className="text-[#FF991F]" /> :
                                                <Layout size={14} className="text-[#1F6FEB]" />}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-baseline mb-0.5">
                                             <p className={`text-[13px] ${!notif.read ? 'font-bold' : 'font-medium'} text-[#172B4D] truncate`}>{notif.title}</p>
                                             <span className="text-[10px] text-[#5E6C84] shrink-0">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                          <p className="text-[12px] text-[#42526E] line-clamp-2 leading-snug">{notif.message}</p>
                                       </div>
                                       {!notif.read && (
                                          <div className="w-2 h-2 bg-[#1F6FEB] rounded-full mt-2 shrink-0"></div>
                                       )}
                                    </div>
                                 </div>
                              ))) : (
                              <div className="py-10 text-center text-[#5E6C84] text-[13px]">
                                 No new notifications
                              </div>
                           )}
                        </div>
                        <div className="border-t border-[#DFE1E6]">
                           <button
                              onClick={() => {
                                 navigate('/dashboard/notifications');
                                 setActiveDropdown(null);
                              }}
                              className="w-full p-3 text-center hover:bg-[#F4F5F7] text-[12px] font-bold text-[#42526E] hover:text-[#172B4D] transition-colors block"
                           >
                              View all notifications
                           </button>
                        </div>
                     </div>
                  )}
               </div>

               <div className="relative ml-1 nav-dropdown-container">
                  <button
                     onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
                     className="w-7 h-7 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[11px] font-bold shadow-sm ring-1 ring-white/20 hover:ring-white/40 transition-all"
                  >
                     {authUser?.name?.charAt(0) || 'U'}
                  </button>

                  {activeDropdown === 'profile' && (
                     <div className="absolute top-[calc(100%+8px)] right-0 w-[240px] bg-white border border-[#DFE1E6] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] py-3 z-[6000] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 px-4 py-2">
                           <div className="w-9 h-9 bg-[#00B3A4] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                              {authUser?.name?.charAt(0) || 'U'}
                           </div>
                           <div className="min-w-0">
                              <p className="text-[14px] font-bold text-[#172B4D] truncate">{authUser?.name}</p>
                              <p className="text-[12px] text-[#6B778C] truncate">{authUser?.email}</p>
                           </div>
                        </div>

                        <div className="h-[1px] bg-[#E6E6E6] my-2" />

                        <Link to="/dashboard/profile" onClick={() => setActiveDropdown(null)} className="block px-4 py-2 text-[14px] text-[#172B4D] hover:bg-[#F4F5F7] transition-colors">Profile</Link>
                        <Link to="/dashboard/settings" onClick={() => setActiveDropdown(null)} className="block px-4 py-2 text-[14px] text-[#172B4D] hover:bg-[#F4F5F7] transition-colors">Settings</Link>

                        <div className="h-[1px] bg-[#E6E6E6] my-2" />

                        <button onClick={() => logout(true)} className="w-full text-left px-4 py-2 text-[14px] text-[#DE350B] font-medium hover:bg-[#F4F5F7] transition-colors">Logout</button>
                     </div>
                  )}
               </div>
            </div>
         </header>

         <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Node */}
            <aside
               ref={sidebarRef}
               className="sidebar-node bg-[#F4F5F7] border-r border-[#DFE1E6] flex flex-col overflow-visible transition-all duration-300 z-10"
               style={{ width: isSidebarCollapsed ? '20px' : '260px' }}
            >
               {/* Floating Toggle Button */}
               <button
                  onClick={toggleSidebar}
                  className="absolute right-[-12px] top-6 w-6 h-6 bg-white border border-[#DFE1E6] rounded-full flex items-center justify-center text-[#42526E] hover:text-[#1F6FEB] hover:bg-[#DEEBFF] hover:border-[#1F6FEB] shadow-md transition-all z-[100] cursor-pointer"
                  title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
               >
                  {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
               </button>

               <div
                  className="flex-1 overflow-y-auto custom-scrollbar p-4 transition-opacity duration-200"
                  style={{
                     opacity: isSidebarCollapsed ? 0 : 1,
                     pointerEvents: isSidebarCollapsed ? 'none' : 'auto'
                  }}
               >


                  <div className="space-y-6">
                     {/* Workspace Section */}
                     <div className="mb-4">
                        <p className="text-[15px] font-bold text-[#1F2937] mb-2 px-3">Workspace</p>
                        <div className="space-y-1">
                           <Link
                              to="/dashboard"
                              className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname === '/dashboard' ? 'active' : ''}`}
                           >
                              <Home size={18} /> Home
                           </Link>
                           <Link
                              to="/dashboard/projects"
                              className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname === '/dashboard/projects' ? 'active' : ''}`}
                           >
                              <Layers size={18} /> Project Portfolio
                           </Link>
                           <Link
                              to="/dashboard/plans"
                              className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/plans') ? 'active' : ''}`}
                           >
                              <Compass size={18} /> Plans
                           </Link>
                           <Link
                              to="/dashboard/my-submitted-tasks"
                              className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname === '/dashboard/my-submitted-tasks' ? 'active' : ''}`}
                           >
                              <Layers size={18} /> My Submitted Tasks
                           </Link>
                        </div>
                     </div>

                     {/* Project Section */}
                     {currentProjectId && (
                        <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
                           <p className="text-[15px] font-bold text-[#1F2937] mb-2 px-3">
                              Project
                           </p>
                           <div className="space-y-1">
                              <Link
                                 to={`/dashboard/roadmap/${currentProjectId}`}
                                 className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/roadmap/') ? 'active' : ''}`}
                              >
                                 <Map size={18} /> Roadmap
                              </Link>

                              {projectTemplate === 'KANBAN' && (
                                 <Link
                                    to={`/dashboard/project/${currentProjectId}`}
                                    className={`sidebar-item flex items-center gap-3 text-[15px] ${(location.pathname.startsWith('/dashboard/project/') && !location.pathname.startsWith('/dashboard/project-details/')) ? 'active' : ''}`}
                                 >
                                    <Layout size={18} /> Board
                                 </Link>
                              )}

                              {projectTemplate === 'SCRUM' && (
                                 <>
                                    <Link
                                       to={`/dashboard/backlog/${currentProjectId}`}
                                       className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/backlog/') ? 'active' : ''}`}
                                    >
                                       <Layers size={18} /> Backlog
                                    </Link>
                                    <Link
                                       to={`/dashboard/sprint-board/${currentProjectId}`}
                                       className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/sprint-board/') ? 'active' : ''}`}
                                    >
                                       <Zap size={18} /> Active Sprint
                                    </Link>
                                    <Link
                                       to={`/dashboard/archived/${currentProjectId}`}
                                       className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/archived/') ? 'active' : ''}`}
                                    >
                                       <Archive size={18} /> Archived
                                    </Link>
                                 </>
                              )}

                              <Link
                                 to={`/dashboard/insights/${currentProjectId}`}
                                 className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname.startsWith('/dashboard/insights/') ? 'active' : ''}`}
                              >
                                 <BarChart2 size={18} /> Insights
                              </Link>
                           </div>
                        </div>
                     )}

                     {/* Administration Section */}
                     {(authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') && (
                        <div className="mb-4">
                           <p className="text-[15px] font-bold text-[#1F2937] mb-2 px-3">Administration</p>
                           <div className="space-y-1">
                              <Link
                                 to="/dashboard/pm-review-queue"
                                 className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname === '/dashboard/pm-review-queue' ? 'active' : ''}`}
                              >
                                 <Compass size={18} /> PM Review Queue
                              </Link>
                              <Link
                                 to="/dashboard/management-console"
                                 className={`sidebar-item flex items-center gap-3 text-[15px] ${location.pathname === '/dashboard/management-console' ? 'active' : ''}`}
                              >
                                 <Settings size={18} /> Management Console
                              </Link>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </aside>

            {/* Main Content Viewport */}
            <main className="main-viewport flex-1 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--ds-background)' }}>
               <Outlet />
            </main>
         </div>

         <CreateIssueModal
            isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}
            projectId={Number(currentProjectId || 1)}
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
               taskId={activeTaskId} projectId={Number(activeTaskProjectId || currentProjectId || 1)}
               isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setActiveTaskProjectId(null); }}
               onUpdate={fetchData} onDelete={fetchData}
            />
         )}

         <CreateProjectModal
            isOpen={isCreateProjectModalOpen}
            onClose={() => setIsCreateProjectModalOpen(false)}
            onSuccess={() => fetchData()}
         />

         {activeToast && (
            <Toast
               title={activeToast.title}
               message={activeToast.message}
               type={activeToast.type}
               onClose={() => setActiveToast(null)}
            />
         )}
      </div>
   );
};

export default DashboardLayout;
