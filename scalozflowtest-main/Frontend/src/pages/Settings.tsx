import React, { useState, useEffect } from 'react';
import { Lock, Bell, Moon, ChevronRight, X, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Eye, Search, Settings, Mail, Globe, ListCollapse } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface UserPreference {
  taskCreated: boolean;
  taskAssigned: boolean;
  taskReviewDecision: boolean;
  taskStatusChanged: boolean;
  commentAdded: boolean;
  userMentioned: boolean;
  dueDateReminder: boolean;
  taskOverdue: boolean;
  sprintStarted: boolean;
  sprintCompleted: boolean;
  taskCompleted: boolean;
  taskReopened: boolean;
  projectInvitation: boolean;
  roleChanged: boolean;
}

interface GlobalSetting {
  settingKey: string;
  enabled: boolean;
}

interface EmailLog {
  id: number;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  notificationType: string;
  eventUuid: string;
}

const SettingsPage = () => {
  const { addNotification, notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const { isDarkMode, setTheme } = useTheme();
  const { user } = useAuth();

  const theme = isDarkMode ? 'dark' : 'light';
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'global' | 'logs'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Personal notification preferences
  const [preferences, setPreferences] = useState<UserPreference>({
    taskCreated: true,
    taskAssigned: true,
    taskReviewDecision: true,
    taskStatusChanged: true,
    commentAdded: true,
    userMentioned: true,
    dueDateReminder: true,
    taskOverdue: true,
    sprintStarted: true,
    sprintCompleted: true,
    taskCompleted: true,
    taskReopened: true,
    projectInvitation: true,
    roleChanged: true,
  });

  // Global settings
  const [globalSettings, setGlobalSettings] = useState<GlobalSetting[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Email Logs state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Load preferences
  useEffect(() => {
    fetchUserPreferences();
    if (isAdminOrManager) {
      fetchGlobalSettings();
      fetchEmailLogs();
    }
  }, [isAdminOrManager]);

  const fetchUserPreferences = async () => {
    try {
      const response = await api.get('/notifications/preferences');
      if (response.data) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Failed to load user email preferences', error);
    }
  };

  const fetchGlobalSettings = async () => {
    setGlobalLoading(true);
    try {
      const response = await api.get('/notifications/global');
      if (response.data) {
        setGlobalSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load global notification settings', error);
    } finally {
      setGlobalLoading(false);
    }
  };

  const fetchEmailLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await api.get('/notifications/logs');
      if (response.data) {
        setLogs(response.data);
      }
    } catch (error) {
      console.error('Failed to load email logs', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleTogglePreference = (key: keyof UserPreference) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePreferences = async () => {
    try {
      await api.post('/notifications/preferences', preferences);
      addNotification('Success', 'Your notification preferences have been saved.', 'success');
    } catch (error) {
      addNotification('Error', 'Failed to save preferences.', 'error');
    }
  };

  const handleToggleGlobal = async (setting: GlobalSetting) => {
    const updatedSetting = { ...setting, enabled: !setting.enabled };
    try {
      await api.post('/notifications/global', updatedSetting);
      setGlobalSettings(prev => prev.map(s => s.settingKey === setting.settingKey ? updatedSetting : s));
      addNotification('Global Switch Toggled', `Notification type ${setting.settingKey} updated successfully.`, 'success');
    } catch (error: any) {
      addNotification('Error', error.response?.data || 'Failed to update global switch.', 'error');
    }
  };

  const handleRetryEmail = async (logId: number) => {
    try {
      await api.post(`/notifications/logs/retry/${logId}`);
      addNotification('Success', 'Resend request queued successfully.', 'success');
      fetchEmailLogs();
    } catch (error: any) {
      addNotification('Error', 'Failed to retry email delivery.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      await api.put('/auth/profile-update', {
        password: newPassword
      });
      addNotification('Success', 'Security key updated successfully.', 'success');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Preference details list mapping
  const prefItems: { key: keyof UserPreference; label: string; desc: string; category: string }[] = [
    { key: 'taskCreated', label: 'Task Created & Assigned', desc: 'Notify me immediately when a new task is created and assigned to me.', category: 'Tasks' },
    { key: 'taskAssigned', label: 'Task Reassigned', desc: 'Notify me when ownership of an existing task changes and is assigned to me.', category: 'Tasks' },
    { key: 'taskReviewDecision', label: 'Task Approval Decision', desc: 'Notify me when my review tasks are approved, rejected, or clarify requested.', category: 'Tasks' },
    { key: 'taskStatusChanged', label: 'Task Status Transitioned', desc: 'Notify me when any task I own or watch transitions status columns.', category: 'Tasks' },
    { key: 'taskCompleted', label: 'Task Closed/Completed', desc: 'Notify me when an assigned task is marked completed or Done.', category: 'Tasks' },
    { key: 'taskReopened', label: 'Task Reopened', desc: 'Notify me when a completed task is reopened for active work.', category: 'Tasks' },
    { key: 'dueDateReminder', label: 'Due Date Reminder', desc: 'Send me a reminder email 1 day prior to the task deadline.', category: 'Schedule' },
    { key: 'taskOverdue', label: 'Overdue Task Alert', desc: 'Notify me daily if any assigned task remains incomplete past its due date.', category: 'Schedule' },
    { key: 'commentAdded', label: 'Comment Added', desc: 'Notify me when a new comment is posted on tasks I are assigned or reported.', category: 'Activity' },
    { key: 'userMentioned', label: 'Mentioned in Comment', desc: 'Notify me immediately when I am mentioned using @ in comment fields.', category: 'Activity' },
    { key: 'sprintStarted', label: 'Sprint Cycle Commenced', desc: 'Notify me when a new sprint starts in my active project workspace.', category: 'Sprints' },
    { key: 'sprintCompleted', label: 'Sprint Cycle Completed', desc: 'Send me sprint closure summaries when sprints are completed.', category: 'Sprints' },
    { key: 'projectInvitation', label: 'Project Invitation', desc: 'Notify me when I am added to a new project team member roster.', category: 'Workspace' },
    { key: 'roleChanged', label: 'Role & Permissions Modified', desc: 'Notify me when my system-wide or project permissions are changed.', category: 'Workspace' },
  ];

  // Filtering logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.notificationType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="content-container py-8 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-[#DEEBFF] text-[#1F6FEB] rounded-lg">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="section-title tracking-tight text-3xl font-extrabold text-[#172B4D]">System Settings</h1>
            <p className="text-sm text-[#6B778C]">Configure workspace controls, notification switches, and security parameters.</p>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-[#DFE1E6] mb-8 gap-1 bg-[#FAFBFC] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white text-[#1F6FEB] shadow-sm border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB] hover:bg-[#F4F5F7]'}`}
          >
            <Settings size={16} /> General Preferences
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'notifications' ? 'bg-white text-[#1F6FEB] shadow-sm border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB] hover:bg-[#F4F5F7]'}`}
          >
            <Bell size={16} /> Notification Channels
          </button>
          {isAdminOrManager && (
            <>
              <button
                onClick={() => setActiveTab('global')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-white text-[#1F6FEB] shadow-sm border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB] hover:bg-[#F4F5F7]'}`}
              >
                <Globe size={16} /> Global Switches
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white text-[#1F6FEB] shadow-sm border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB] hover:bg-[#F4F5F7]'}`}
              >
                <Mail size={16} /> Email Logs {logs.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{logs.filter(l => l.status === 'FAILED').length} failed</span>}
              </button>
            </>
          )}
        </div>

        {/* Tab 1: General Preferences */}
        {activeTab === 'general' && (
          <div className="bg-white border border-[#DFE1E6] rounded-xl overflow-hidden shadow-sm space-y-0.5">
            {/* Change Password Trigger */}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between p-6 hover:bg-[#F4F5F7] transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#DEEBFF] text-[#1F6FEB] rounded-xl group-hover:scale-110 transition-transform">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#172B4D]">Change Password</p>
                  <p className="text-xs text-[#6B778C]">Update your security credentials for ScalozFlow access.</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#A5ADBA] group-hover:text-[#1F6FEB] transition-colors" />
            </button>

            <div className="h-[1px] bg-[#DFE1E6] mx-6" />

            {/* General Push Switch */}
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E3FCEF] text-[#006644] rounded-xl">
                  <Bell size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#172B4D]">In-App Push Toast Alerts</p>
                  <p className="text-xs text-[#6B778C]">Manage real-time browser screen activity notifications.</p>
                </div>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${notificationsEnabled ? 'bg-[#36B37E]' : 'bg-[#DFE1E6]'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="h-[1px] bg-[#DFE1E6] mx-6" />

            {/* Theme Switcher */}
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F4F5F7] text-[#42526E] rounded-xl">
                  <Moon size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#172B4D]">Appearance Mode</p>
                  <p className="text-xs text-[#6B778C]">Switch between high-contrast dark and low-light eye-care modes.</p>
                </div>
              </div>
              <div className="flex bg-[#F4F5F7] p-1.5 rounded-lg border border-[#DFE1E6]">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-5 py-1.5 text-xs font-bold rounded-md transition-all ${theme === 'light' ? 'bg-white text-[#1F6FEB] shadow-md border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB]'}`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-5 py-1.5 text-xs font-bold rounded-md transition-all ${theme === 'dark' ? 'bg-white text-[#1F6FEB] shadow-md border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB]'}`}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Notification Channels */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#DFE1E6] rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#172B4D] mb-2">Personal Email Notification Settings</h2>
              <p className="text-xs text-[#6B778C] mb-6">Choose precisely which events trigger automatic emails to your registered address.</p>

              {/* Group items by category */}
              {['Tasks', 'Schedule', 'Activity', 'Sprints', 'Workspace'].map(category => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-xs font-bold text-[#1F6FEB] uppercase tracking-wider mb-3 border-b border-[#DEEBFF] pb-1">{category} Events</h3>
                  <div className="space-y-4">
                    {prefItems.filter(item => item.category === category).map(item => (
                      <div key={item.key} className="flex items-center justify-between py-2 border-b border-[#FAFBFC] last:border-0">
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm text-[#172B4D]">{item.label}</p>
                          <p className="text-xs text-[#6B778C]">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => handleTogglePreference(item.key)}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${preferences[item.key] ? 'bg-[#36B37E]' : 'bg-[#DFE1E6]'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${preferences[item.key] ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSavePreferences}
                className="px-8 py-3 bg-[#1F6FEB] text-white rounded-lg text-sm font-bold hover:bg-[#003484] shadow-md transition-all duration-200"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Global Notification Settings */}
        {activeTab === 'global' && isAdminOrManager && (
          <div className="bg-white border border-[#DFE1E6] rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#DEEBFF] text-[#1F6FEB] rounded-lg">
                <Globe size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172B4D]">Global Administration Notification Settings</h2>
                <p className="text-xs text-[#6B778C]">Administrators can toggle email notification categories project-wide.</p>
              </div>
            </div>

            {globalLoading ? (
              <div className="flex flex-col items-center py-12 text-[#6B778C]">
                <RefreshCw size={36} className="animate-spin text-[#1F6FEB] mb-3" />
                <p className="text-sm">Retrieving global setting parameters...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {globalSettings.map(setting => {
                  const matchedInfo = prefItems.find(p => p.key.toLowerCase() === setting.settingKey.replace(/_/g, '').toLowerCase());
                  return (
                    <div key={setting.settingKey} className="flex items-center justify-between py-3 border-b border-[#F4F5F7] last:border-0">
                      <div>
                        <p className="font-bold text-sm text-[#172B4D] tracking-wide">{setting.settingKey.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-[#6B778C]">{matchedInfo ? matchedInfo.desc : 'Global master setting trigger.'}</p>
                      </div>
                      <button
                        onClick={() => handleToggleGlobal(setting)}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${setting.enabled ? 'bg-[#36B37E]' : 'bg-[#DFE1E6]'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${setting.enabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Email Delivery Logs */}
        {activeTab === 'logs' && isAdminOrManager && (
          <div className="space-y-4">
            <div className="bg-white border border-[#DFE1E6] rounded-xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#172B4D]">Email Notification Log</h2>
                  <p className="text-xs text-[#6B778C]">Audit trail and real-time delivery status tracking for sent emails.</p>
                </div>

                <button
                  onClick={fetchEmailLogs}
                  className="flex items-center gap-2 px-4 py-2 border border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-lg text-sm font-bold text-[#5E6C84] transition-all"
                >
                  <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} /> Refresh Logs
                </button>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-3 text-[#A5ADBA]" />
                  <input
                    type="text"
                    placeholder="Search logs by recipient or subject..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#FAFBFC] border border-[#DFE1E6] focus:border-[#4C9AFF] focus:bg-white rounded-lg outline-none text-sm font-medium transition-all"
                  />
                </div>
                <div className="flex gap-1.5 bg-[#F4F5F7] p-1 rounded-lg border border-[#DFE1E6]">
                  {(['ALL', 'SENT', 'FAILED', 'PENDING'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === f ? 'bg-white text-[#1F6FEB] shadow-sm border border-[#DFE1E6]' : 'text-[#5E6C84] hover:text-[#1F6FEB]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {logsLoading ? (
                <div className="flex flex-col items-center py-16 text-[#6B778C]">
                  <RefreshCw size={36} className="animate-spin text-[#1F6FEB] mb-3" />
                  <p className="text-sm">Loading delivery records...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-16 text-[#6B778C] border border-dashed border-[#DFE1E6] rounded-lg">
                  <Mail size={36} className="mx-auto text-[#A5ADBA] mb-3" />
                  <p className="text-sm font-semibold">No email delivery logs found matching the filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAFBFC] border-b border-[#DFE1E6] text-[#5E6C84] uppercase tracking-wider font-bold">
                        <th className="p-4">Recipient</th>
                        <th className="p-4">Subject</th>
                        <th className="p-4">Event Type</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Retries</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F4F5F7]">
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-[#FAFBFC] transition-colors group">
                          <td className="p-4 font-bold text-[#172B4D]">{log.recipientEmail}</td>
                          <td className="p-4 text-[#5E6C84] max-w-[200px] truncate">{log.subject}</td>
                          <td className="p-4 font-semibold text-[#6B778C]">{log.notificationType}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${log.status === 'SENT' ? 'bg-[#E3FCEF] text-[#006644]' : log.status === 'FAILED' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-yellow-50 text-yellow-600 border border-yellow-100'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-[#5E6C84]">{log.retryCount}/3</td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1.5 text-[#5E6C84] hover:text-[#1F6FEB] hover:bg-[#DEEBFF] rounded-md transition-all"
                              title="View Email Payload"
                            >
                              <Eye size={14} />
                            </button>
                            {(log.status === 'FAILED' || log.status === 'PENDING') && (
                              <button
                                onClick={() => handleRetryEmail(log.id)}
                                className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-md transition-all border border-red-200"
                                title="Retry delivery now"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-[#091E42]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 bg-[#F4F5F7] border-b border-[#DFE1E6] flex justify-between items-center">
              <h3 className="font-bold text-[#172B4D]">Update Security Key</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-[#5E6C84] hover:text-[#172B4D] p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePassword} className="p-8 space-y-6">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} /> {passwordError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">New Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent focus:border-[#4C9AFF] focus:bg-white rounded-[3px] outline-none text-sm font-medium transition-all"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">Confirm New Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent focus:border-[#4C9AFF] focus:bg-white rounded-[3px] outline-none text-sm font-medium transition-all"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-3 bg-[#1F6FEB] text-white rounded-[3px] font-bold text-sm hover:bg-[#003484] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {passwordLoading ? 'Updating Key...' : <>Update Access Key <CheckCircle2 size={16} /></>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Email Payload / Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-[#091E42]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 bg-[#F4F5F7] border-b border-[#DFE1E6] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[#172B4D] text-sm">Delivery Payload: Log #{selectedLog.id}</h3>
                <p className="text-[10px] text-[#6B778C] font-semibold">{selectedLog.eventUuid}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-[#5E6C84] hover:text-[#172B4D] p-1"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">Recipient Email</span>
                  <span className="font-semibold text-[#172B4D]">{selectedLog.recipientEmail}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${selectedLog.status === 'SENT' ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-red-50 text-red-600'}`}>{selectedLog.status}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">Event Type</span>
                  <span className="font-semibold text-[#172B4D]">{selectedLog.notificationType}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">Delivery Attempt Date</span>
                  <span className="font-semibold text-[#172B4D]">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-bold space-y-1">
                  <span className="text-[9px] text-[#6B778C] font-semibold block uppercase">Failure Exception Details</span>
                  <p>{selectedLog.errorMessage}</p>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider block">HTML Content Template Preview</span>
                <div
                  className="p-4 bg-[#FAFBFC] border border-[#DFE1E6] rounded-lg text-xs overflow-x-auto font-mono max-h-[300px] select-all whitespace-pre-wrap"
                >
                  {selectedLog.body}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F4F5F7] border-t border-[#DFE1E6] flex justify-end gap-3">
              {(selectedLog.status === 'FAILED' || selectedLog.status === 'PENDING') && (
                <button
                  onClick={() => {
                    handleRetryEmail(selectedLog.id);
                    setSelectedLog(null);
                  }}
                  className="px-5 py-2 bg-[#1F6FEB] text-white hover:bg-[#003484] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> Retry Dispatch
                </button>
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 border border-[#DFE1E6] text-[#5E6C84] hover:bg-[#F4F5F7] rounded-lg text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
