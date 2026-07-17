import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { Bell, Trash2, CheckCircle2, Search, Inbox, Zap, Layout } from 'lucide-react';
import api from '../services/api';
import type { Task } from '../types';

const Notifications = () => {
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
  } = useNotifications();

  const navigate = useNavigate();

  const handleNotificationClick = async (notif: any) => {
    markAsRead(notif.id);
    try {
      const res = await api.get('/tasks');
      const allTasks: Task[] = res.data;
      const msgLower = notif.message.toLowerCase();
      const sortedTasks = [...allTasks].sort((a, b) => (b.title || '').length - (a.title || '').length);
      const matchedTask = sortedTasks.find(t => {
        if (!t.title) return false;
        return msgLower.includes(t.title.toLowerCase());
      });
      if (matchedTask) {
        const projectId = matchedTask.projectId || matchedTask.project?.id;
        if (projectId) {
          const projRes = await api.get(`/projects/${projectId}`);
          const projectType = projRes.data?.projectType || '';
          if (projectType.toUpperCase() === 'SCRUM') {
            navigate(`/dashboard/sprint-board/${projectId}?selectedIssue=${matchedTask.id}`);
          } else {
            navigate(`/dashboard/kanban-board/${projectId}?selectedIssue=${matchedTask.id}`);
          }
        }
      }
    } catch (err) {
      console.error("Failed to route notification click:", err);
    }
  };

  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotifications = notifications.filter(notif => {
    // Filter by type
    if (filter === 'UNREAD' && notif.read) return false;
    if (filter === 'READ' && !notif.read) return false;

    // Filter by search query
    const matchesSearch = 
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getIcon = (iconId: string) => {
    switch (iconId) {
      case 'zap':
        return <Zap size={16} className="text-[#36B37E]" />;
      case 'clock':
        return <Bell size={16} className="text-[#FF991F]" />;
      default:
        return <Layout size={16} className="text-[#1F6FEB]" />;
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="content-container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="space-y-1">
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">
            Stay updated with recent activities, task assignments, and system events.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E6C84]" size={14} />
          <input 
            type="text" 
            placeholder="Search notifications" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#F4F5F7] border-2 border-transparent focus:bg-white focus:border-[#4C9AFF] rounded-[3px] py-1.5 pl-9 pr-4 text-sm w-full md:w-64 outline-none transition-all" 
          />
        </div>
      </div>

      <div className="bg-white border border-[#DFE1E6] rounded-[3px] overflow-hidden shadow-sm">
        {/* Controls and Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-[#DFE1E6] bg-[#F4F5F7]/30">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[3px] transition-all ${
                filter === 'ALL' 
                  ? 'bg-[#1F6FEB] text-white' 
                  : 'text-[#42526E] hover:bg-[#F4F5F7]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[3px] transition-all ${
                filter === 'UNREAD' 
                  ? 'bg-[#1F6FEB] text-white' 
                  : 'text-[#42526E] hover:bg-[#F4F5F7]'
              }`}
            >
              Unread ({notifications.filter(n => !n.read).length})
            </button>
            <button
              onClick={() => setFilter('READ')}
              className={`px-3 py-1.5 text-xs font-bold rounded-[3px] transition-all ${
                filter === 'READ' 
                  ? 'bg-[#1F6FEB] text-white' 
                  : 'text-[#42526E] hover:bg-[#F4F5F7]'
              }`}
            >
              Read ({notifications.filter(n => n.read).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              disabled={notifications.filter(n => !n.read).length === 0}
              className="px-3 py-1.5 text-xs font-bold text-[#1F6FEB] hover:bg-[#DEEBFF] disabled:opacity-50 disabled:hover:bg-transparent rounded-[3px] transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              Mark all as read
            </button>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="px-3 py-1.5 text-xs font-bold text-[#DE350B] hover:bg-[#FFEBE6] disabled:opacity-50 disabled:hover:bg-transparent rounded-[3px] transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Clear all
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-[#DFE1E6]">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-start gap-4 p-4 hover:bg-[#F4F5F7]/50 transition-colors cursor-pointer group ${
                  !notif.read ? 'bg-[#DEEBFF]/15 border-l-[3px] border-[#1F6FEB] pl-[13px]' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-white border border-[#DFE1E6] flex items-center justify-center shrink-0 shadow-sm group-hover:border-[#1F6FEB] transition-all">
                  {getIcon(notif.iconId)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <h3 className={`text-sm ${!notif.read ? 'font-bold' : 'font-medium'} text-[#172B4D]`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-[#5E6C84] shrink-0 font-medium">
                      {getRelativeTime(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#42526E] leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {!notif.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs font-bold text-[#1F6FEB] hover:underline shrink-0 self-center transition-opacity"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Inbox size={48} className="text-[#5E6C84] mb-4 opacity-30" />
              <h3 className="text-base font-bold text-[#172B4D]">No notifications</h3>
              <p className="text-xs text-[#5E6C84] mt-1 max-w-[280px] mx-auto">
                {searchQuery 
                  ? 'No notifications found matching your search term.' 
                  : filter === 'UNREAD' 
                    ? 'All clean! You have read all notifications.' 
                    : 'No new activity updates at the moment.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
