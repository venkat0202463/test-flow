import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Users,
  Zap,
  CheckCircle,
  Bug,
  Bookmark,
  CheckSquare,
  Layers,
  X,
  List,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar
} from 'lucide-react';
import api from '../services/api';
import type { Task, Project, User } from '../types';
import CreateIssueModal from '../components/CreateIssueModal';
import TaskDetailModal from '../components/TaskDetailModal';

const STATUS_COLORS: Record<string, string> = {
  'TODO': '#5E6C84',
  'TO DO': '#5E6C84',
  'BACKLOG': '#5E6C84',
  'IN PROGRESS': '#FF8B00',
  'IN REVIEW': '#4C9AFF',
  'DONE': '#36B37E',
  'IN DEVELOPMENT': '#1F6FEB',
  'IN DESIGN': '#6554C0',
  'REJECTED': '#5E6C84'
};

const getTaskCalendarDate = (task: Task): Date => {
  if (!task || !task.createdAt) return new Date();
  
  if (Array.isArray(task.createdAt)) {
    const [year, month, day] = task.createdAt;
    return new Date(year, month - 1, day);
  }
  
  if (typeof task.createdAt === 'string') {
    const match = task.createdAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    return new Date(task.createdAt);
  }
  
  return new Date(task.createdAt);
};

const RoadmapPage = () => {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  // Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [createType, setCreateType] = useState<'EPIC' | 'TASK'>('TASK');
  const [createParentId, setCreateParentId] = useState<number | null>(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAllInPanel, setShowAllInPanel] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [calendarWidth, setCalendarWidth] = useState(66.66);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = calendarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
      setCalendarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const formatDateForSidePanel = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toString().includes(searchQuery);

      const normalizedTaskStatus = (task.status || 'TODO').toUpperCase().replace(/_|\s/g, '');
      const normalizedFilterStatus = statusFilter.toUpperCase().replace(/_|\s/g, '');
      const matchesStatus = statusFilter === 'ALL' || normalizedTaskStatus === normalizedFilterStatus;

      const matchesAssignee = assigneeFilter === 'ALL' || task.assignee?.id.toString() === assigneeFilter;
      return matchesSearch && matchesStatus && matchesAssignee;
    });
  }, [tasks, searchQuery, statusFilter, assigneeFilter]);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [projRes, taskRes, usersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks?projectId=${id}`),
        api.get(`/auth/users?projectId=${id}`)
      ]);
      setProject(projRes.data);
      setTasks(taskRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error("Error fetching roadmap data", error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (taskId: number) => {
    setActiveTaskId(taskId);
    setIsDetailModalOpen(true);
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days = [];

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1),
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month padding to complete the last row
    const totalCells = days.length > 35 ? 42 : 35;
    const paddingEnd = totalCells - days.length;

    for (let i = 1; i <= paddingEnd; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      {/* Project Level Header (Strategic Roadmap) */}
      <div className="bg-white border-b border-[#DFE1E6] shrink-0">
        <div className="flex items-center justify-between px-10 py-6">
          <div>
            <div className="flex items-center text-[11px] font-black text-[#5E6C84] uppercase tracking-widest mb-4">
              <Link to="/projects" className="hover:text-[#172B4D] hover:underline">Projects</Link>
              <ChevronRight size={12} className="mx-2" />
              <Link to={`/dashboard/project/${id}`} className="hover:text-[#172B4D] hover:underline">{project?.name?.toUpperCase() || 'PROJECT'}</Link>
              <ChevronRight size={12} className="mx-2" />
              <span className="text-[#172B4D]">Roadmap</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[#172B4D]">Strategic Roadmap</h1>
                <p className="text-[13px] text-[#36B37E] mt-1">Plan and track high-level project deliverables.</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setCreateType('TASK'); setCreateParentId(null); setIsCreateModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F6FEB] text-white rounded-md text-[13px] font-bold hover:bg-[#0047B3] transition-colors shadow-sm"
          >
            <Plus size={16} /> Create Task
          </button>
        </div>

        <div className="flex items-start justify-between px-10 py-4 bg-white border-t border-[#F4F5F7]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="relative w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E6C84]" />
                <input
                  type="text"
                  placeholder="Search roadmap..."
                  className="w-full bg-[#F4F5F7] border-2 border-transparent rounded-md pl-8 pr-3 py-1 text-[12px] outline-none focus:bg-white focus:border-[#1F6FEB] transition-colors placeholder:text-[#5E6C84]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="bg-white border-2 border-[#DFE1E6] rounded-md px-2 py-1 text-[11px] font-bold text-[#172B4D] outline-none hover:bg-[#F4F5F7] transition-colors"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="TODO">To Do</option>
                  <option value="IN PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>

                <select
                  className="bg-white border-2 border-[#DFE1E6] rounded-md px-2 py-1 text-[11px] font-bold text-[#172B4D] outline-none hover:bg-[#F4F5F7] transition-colors"
                  value={assigneeFilter}
                  onChange={e => setAssigneeFilter(e.target.value)}
                >
                  <option value="ALL">All Assignees</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 ml-2">
              <div className="flex items-center gap-1.5">
                <div className="w-[6px] h-[6px] rounded-full bg-[#5E6C84] ring-[2px] ring-[#5E6C84]/20"></div>
                <span className="text-[11px] font-bold text-[#172B4D]">To Do</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[6px] h-[6px] rounded-full bg-[#FF8B00] ring-[2px] ring-[#FF8B00]/20"></div>
                <span className="text-[11px] font-bold text-[#172B4D]">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[6px] h-[6px] rounded-full bg-[#4C9AFF] ring-[2px] ring-[#4C9AFF]/20"></div>
                <span className="text-[11px] font-bold text-[#172B4D]">In Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[6px] h-[6px] rounded-full bg-[#36B37E] ring-[2px] ring-[#36B37E]/20"></div>
                <span className="text-[11px] font-bold text-[#172B4D]">Done</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[#F4F5F7] p-0.5 rounded-md">
              <button
                onClick={() => { setShowCalendar(false); setSelectedDate(null); }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${!showCalendar ? 'bg-white text-[#172B4D] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
              >
                List View
              </button>
              <button
                onClick={() => setShowCalendar(true)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${showCalendar ? 'bg-white text-[#172B4D] shadow-sm' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
              >
                Calendar View
              </button>
            </div>
            {showCalendar && (
              <div className="flex items-center bg-white border border-[#DFE1E6] rounded-md shadow-sm">
                <button onClick={prevMonth} className="px-2 py-1 hover:bg-[#F4F5F7] text-[#42526E] transition-colors rounded-l-md border-r border-[#DFE1E6]">
                  <ChevronLeft size={14} />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                    className="flex items-center justify-between gap-2 px-2 py-1 text-[12px] font-bold text-[#172B4D] hover:bg-[#F4F5F7] transition-colors min-w-[100px]"
                  >
                    <span>{months[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                    <ChevronDown size={14} className="text-[#5E6C84]" />
                  </button>

                  {showMonthPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMonthPicker(false)}
                      />
                      <div className="absolute top-full right-0 mt-1 bg-white border border-[#DFE1E6] rounded-md shadow-lg p-2 z-50 w-[220px]">
                        <div className="grid grid-cols-4 gap-1">
                          {months.map((m, idx) => (
                            <button
                              key={m}
                              onClick={() => {
                                const newDate = new Date(currentDate);
                                newDate.setMonth(idx);
                                setCurrentDate(newDate);
                                setShowMonthPicker(false);
                              }}
                              className={`px-1 py-1.5 text-[11px] font-bold rounded-md transition-colors ${currentDate.getMonth() === idx ? 'bg-[#1F6FEB] text-white' : 'text-[#172B4D] hover:bg-[#F4F5F7]'}`}
                            >
                              {m.substring(0, 3)}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#DFE1E6]">
                          <button
                            onClick={() => {
                              const newDate = new Date(currentDate);
                              newDate.setFullYear(currentDate.getFullYear() - 1);
                              setCurrentDate(newDate);
                            }}
                            className="p-1 hover:bg-[#F4F5F7] rounded text-[#42526E]"
                          ><ChevronLeft size={14} /></button>
                          <span className="text-[12px] font-bold text-[#172B4D]">{currentDate.getFullYear()}</span>
                          <button
                            onClick={() => {
                              const newDate = new Date(currentDate);
                              newDate.setFullYear(currentDate.getFullYear() + 1);
                              setCurrentDate(newDate);
                            }}
                            className="p-1 hover:bg-[#F4F5F7] rounded text-[#42526E]"
                          ><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button onClick={nextMonth} className="px-2 py-1 hover:bg-[#F4F5F7] text-[#42526E] transition-colors rounded-r-md border-l border-[#DFE1E6]">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Task List */}
        {!showCalendar && (
          <div className="w-full border-r border-[#DFE1E6] flex flex-col shrink-0 bg-white">
            {selectedDate && (
              <div className="h-10 bg-[#E3FCEF] flex items-center justify-between px-6 shrink-0 border-b border-[#DFE1E6]">
                <span className="text-[12px] font-bold text-[#006644]">Showing tasks for {formatDateForSidePanel(selectedDate)}</span>
                <button onClick={() => setSelectedDate(null)} className="text-[#006644] hover:underline text-[12px] font-bold">Clear Filter</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="sticky top-0 z-10 bg-white h-12 flex items-center px-6 border-b border-[#DFE1E6] text-[10px] font-black text-[#5E6C84] uppercase tracking-widest shrink-0">
                <div className="w-40">Type</div>
                <div className="flex-1">Summary</div>
                <div className="w-32 text-center">Priority</div>
                <div className="w-32 text-center">Assignee</div>
                <div className="w-32 text-center">Status</div>
                <div className="w-32 text-center">Due Date</div>
              </div>
              {filteredTasks.filter(task => {
                if (!selectedDate) return true;
                const d = getTaskCalendarDate(task);
                return d.getDate() === selectedDate.getDate() &&
                  d.getMonth() === selectedDate.getMonth() &&
                  d.getFullYear() === selectedDate.getFullYear();
              }).map(task => {
                const iconColor = task.issueType === 'BUG' ? '#FF5630' : task.issueType === 'EPIC' ? '#6554C0' : task.issueType === 'STORY' ? '#36B37E' : '#4C9AFF';
                return (
                  <div key={task.id} className="h-16 flex items-center px-6 border-b border-[#F4F5F7] hover:bg-[#F4F5F7]/50 transition-colors">
                    <div className="w-40 flex items-center shrink-0">
                      {task.issueType === 'BUG' ? (
                        <Bug size={16} className="text-[#FF5630]" />
                      ) : task.issueType === 'EPIC' ? (
                        <Zap size={16} className="text-[#6554C0]" />
                      ) : task.issueType === 'STORY' ? (
                        <Bookmark size={16} className="text-[#36B37E]" />
                      ) : (
                        <CheckSquare size={16} className="text-[#4C9AFF]" />
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-3 overflow-hidden pr-2">
                      <span
                        onClick={() => openDetail(task.id)}
                        className="text-[14px] font-medium text-[#1F6FEB] truncate cursor-pointer hover:underline"
                      >
                        {task.title}
                      </span>
                    </div>
                    <div className="w-32 flex justify-center shrink-0">
                      {(() => {
                        const priorityColor = task.priority === 'HIGH' ? '#FF5630' : task.priority === 'LOW' ? '#006644' : task.priority === 'MEDIUM' ? '#FFAB00' : '#5E6C84';
                        const bgColor = task.priority === 'HIGH' ? '#FFEBE6' : task.priority === 'LOW' ? '#E3FCEF' : task.priority === 'MEDIUM' ? '#FFFAE6' : '#F4F5F7';
                        return (
                          <div
                            className="px-2 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-tighter w-16 text-center"
                            style={{ backgroundColor: bgColor, color: priorityColor }}
                          >
                            {task.priority || 'NONE'}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="w-32 flex justify-center shrink-0">
                      {task.assignee ? (
                        <div className="w-6 h-6 rounded-full bg-[#36B37E] flex items-center justify-center text-[10px] font-bold text-white uppercase" title={task.assignee.name}>
                          {task.assignee?.name?.charAt(0) || 'U'}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-dashed border-[#DFE1E6] flex items-center justify-center text-[#A5ADBA]">
                          <Users size={12} />
                        </div>
                      )}
                    </div>
                    <div className="w-32 flex justify-center shrink-0">
                      <span
                        className="px-2 py-1 rounded-[4px] text-[9px] font-black uppercase tracking-tighter"
                        style={{
                          backgroundColor: `${STATUS_COLORS[task.status?.toUpperCase() || 'TODO']}15`,
                          color: STATUS_COLORS[task.status?.toUpperCase() || 'TODO']
                        }}
                      >
                        {task.status || 'To Do'}
                      </span>
                    </div>
                    <div className="w-32 flex items-center justify-center gap-1.5 shrink-0 text-[#5E6C84]">
                      <Calendar size={14} className="opacity-70" />
                      <span className="text-[12px] font-medium">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '--'}</span>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => { setCreateType('TASK'); setCreateParentId(null); setIsCreateModalOpen(true); }}
                className="h-16 flex items-center px-6 text-[#1F6FEB] text-[13px] font-bold hover:bg-[#F4F5F7] w-full transition-colors border-b border-[#F4F5F7]"
              >
                <Plus size={16} className="mr-3" /> Add new task
              </button>
            </div>
          </div>
        )}





        {/* Right Section - Calendar Grid */}
        {showCalendar && (
          <div className="flex-1 flex overflow-hidden bg-white" ref={containerRef}>
            <div style={{ width: `${calendarWidth}%` }} className="flex flex-col overflow-hidden border-r border-[#DFE1E6] shrink-0">
              {/* Days of week header */}
              <div className="h-12 border-b border-[#DFE1E6] grid grid-cols-7 shrink-0">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="flex items-center justify-center text-[11px] font-black text-[#5E6C84] uppercase tracking-widest">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Cells */}
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <div className="grid grid-cols-7 min-h-full" style={{ gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(120px, 1fr))` }}>
                  {calendarDays.map((dayObj, i) => {
                    // Map tasks to this day based on createdAt (the date they were created)
                    const dayTasks = filteredTasks.filter(t => {
                      const d = getTaskCalendarDate(t);
                      return d.getDate() === dayObj.date.getDate() &&
                        d.getMonth() === dayObj.date.getMonth() &&
                        d.getFullYear() === dayObj.date.getFullYear();
                    });

                    const isToday = new Date().toDateString() === dayObj.date.toDateString();

                    return (
                      <div key={i} className="border-r border-b border-[#F4F5F7] p-2 flex flex-col gap-1.5 overflow-hidden">
                        <div className="flex justify-center mb-1 shrink-0">
                          {isToday ? (
                            <div className="w-7 h-7 rounded-full bg-[#172B4D] text-white flex items-center justify-center text-[12px] font-bold shadow-sm">
                              {dayObj.date.getDate()}
                            </div>
                          ) : (
                            <div className={`text-[12px] font-bold flex items-center justify-center w-7 h-7 ${dayObj.isCurrentMonth ? 'text-[#172B4D]' : 'text-[#A5ADBA]'}`}>
                              {dayObj.date.getDate()}
                            </div>
                          )}
                        </div>

                        {/* Task Pills in Calendar */}
                        <div className="flex-1 overflow-hidden flex flex-col gap-1.5 custom-scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          {dayTasks.slice(0, 1).map(task => {
                            const color = STATUS_COLORS[task.status?.toUpperCase() || 'TODO'] || '#5E6C84';
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetail(task.id);
                                }}
                                className="h-7 rounded-[8px] px-2.5 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all shrink-0 border border-transparent hover:border-black/5"
                                style={{ backgroundColor: `${color}15` }}
                              >
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-[11px] font-bold truncate" style={{ color }}>{task.title}</span>
                              </div>
                            );
                          })}
                          {dayTasks.length > 1 && (
                            <div
                              className="text-[11px] font-bold text-[#1F6FEB] mt-1 hover:underline text-center shrink-0 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(dayObj.date);
                                setShowAllInPanel(false);
                              }}
                            >
                              +{dayTasks.length - 1} More
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drag Handle */}
            <div
              onMouseDown={startResize}
              className="w-1 cursor-col-resize bg-transparent hover:bg-[#1F6FEB] active:bg-[#1F6FEB] shrink-0 transition-colors z-10"
              style={{ marginLeft: '-2px', marginRight: '-2px', position: 'relative' }}
            />

            {/* Right Side - Selected Date Tasks or Blank (Resizable) */}
            <div className="flex-1 bg-[#F4F5F7]/30 flex flex-col overflow-hidden">
              {selectedDate ? (
                <div className="flex-1 flex flex-col overflow-hidden p-6">
                  <div className="flex-1 bg-white border border-[#DFE1E6] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col overflow-hidden">
                    <div className="h-16 flex items-center justify-between px-6 shrink-0 border-b border-[#DFE1E6]">
                      <div className="flex items-center gap-3">
                        <h2 className="text-[15px] font-bold text-[#172B4D]">Tasks on {formatDateForSidePanel(selectedDate)}</h2>
                        <span className="px-2.5 py-1 rounded-full bg-[#E6EFFC] text-[#1F6FEB] text-[11px] font-bold">
                          {filteredTasks.filter(t => {
                            const d = getTaskCalendarDate(t);
                            return d.getDate() === selectedDate.getDate() &&
                              d.getMonth() === selectedDate.getMonth() &&
                              d.getFullYear() === selectedDate.getFullYear();
                          }).length} Tasks
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedDate(null)}
                        className="p-1.5 rounded-md hover:bg-[#F4F5F7] text-[#5E6C84] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col custom-scrollbar">
                      {filteredTasks.filter(t => {
                        const d = getTaskCalendarDate(t);
                        return d.getDate() === selectedDate.getDate() &&
                          d.getMonth() === selectedDate.getMonth() &&
                          d.getFullYear() === selectedDate.getFullYear();
                      }).map(task => {
                        const color = STATUS_COLORS[task.status?.toUpperCase() || 'TODO'] || '#5E6C84';
                        return (
                          <div
                            key={task.id}
                            onClick={() => openDetail(task.id)}
                            className="flex items-center justify-between py-3.5 border-b border-[#F4F5F7] cursor-pointer group hover:bg-[#F4F5F7]/30 transition-colors px-4 -mx-4 rounded-md"
                          >
                            <div className="flex items-center gap-3 overflow-hidden pr-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-[13px] font-bold text-[#5E6C84] group-hover:text-[#172B4D] truncate">{task.title}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {task.assignee ? (
                                <div className="w-6 h-6 rounded-full bg-[#36B37E] flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm" title={task.assignee.name}>
                                  {task.assignee?.name?.charAt(0) || 'U'}
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-dashed border-[#DFE1E6] flex items-center justify-center text-[#A5ADBA]">
                                  <Users size={12} />
                                </div>
                              )}
                              <span
                                className="px-2 py-1 rounded-[4px] text-[9px] font-black uppercase tracking-tighter w-20 text-center"
                                style={{
                                  backgroundColor: `${color}15`,
                                  color: color
                                }}
                              >
                                {task.status || 'To Do'}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {filteredTasks.filter(t => {
                        const d = getTaskCalendarDate(t);
                        return d.getDate() === selectedDate.getDate() &&
                          d.getMonth() === selectedDate.getMonth() &&
                          d.getFullYear() === selectedDate.getFullYear();
                      }).length === 0 && (
                          <div className="text-center text-[#5E6C84] text-[13px] font-medium py-8">
                            No tasks scheduled for this day.
                          </div>
                        )}
                    </div>

                    {filteredTasks.filter(t => {
                      const d = getTaskCalendarDate(t);
                      return d.getDate() === selectedDate.getDate() &&
                        d.getMonth() === selectedDate.getMonth() &&
                        d.getFullYear() === selectedDate.getFullYear();
                    }).length > 0 && (
                        <div className="p-4 border-t border-[#DFE1E6] bg-[#F4F5F7]/30">
                          <button
                            onClick={() => { setShowCalendar(false); setSelectedDate(null); }}
                            className="w-full py-2.5 flex items-center justify-center gap-2 bg-white border border-[#DFE1E6] rounded-md text-[13px] font-bold text-[#1F6FEB] hover:bg-[#F4F5F7] transition-colors shadow-sm"
                          >
                            <List size={16} /> View All Tasks in List
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-[#A5ADBA] font-medium text-[14px]">
                  {/* Blank Half Screen */}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={Number(id)}
        initialStatus="To Do"
        initialIssueType={createType}
        initialParentId={createParentId}
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
          taskId={activeTaskId}
          projectId={Number(id)}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdate={fetchData}
          onDelete={fetchData}
        />
      )}
    </div>
  );
};

export default RoadmapPage;
