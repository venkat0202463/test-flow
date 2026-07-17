import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronDown,
  Trash2,
  Paperclip,
  History,
  Bold,
  Italic,
  Search,
  Check,
  Clock,
  ArrowRight,
  ArrowLeft,
  Download,
  ExternalLink,
  Zap,
  Bookmark,
  Bug,
  CheckSquare,
  Plus,
  MessageSquare,
  Link
} from 'lucide-react';
import api from '../services/api';
import type { User as UserType, Sprint, Task, Comment, WorkLog } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import DOMPurify from 'dompurify';
import RichTextEditor from './RichTextEditor';
import CreateIssueModal from './CreateIssueModal';
import { getTaskCode } from '../services/projectUtils';

const getAttachmentName = (fileStr: string) => {
  if (!fileStr) return 'Attachment';
  if (fileStr.includes('#')) {
    const parts = fileStr.split('#');
    return decodeURIComponent(parts[parts.length - 1]);
  }
  if (fileStr.includes('?name=')) {
    const parts = fileStr.split('?name=');
    return decodeURIComponent(parts[parts.length - 1]);
  }
  return fileStr.split('/').pop() || 'Attachment';
};

const cleanUrl = (url: string) => {
  if (!url) return '';
  const hashIdx = url.indexOf('#');
  if (hashIdx !== -1) {
    return url.substring(0, hashIdx);
  }
  const queryIdx = url.indexOf('?name=');
  if (queryIdx !== -1) {
    return url.substring(0, queryIdx);
  }
  return url;
};

const isImageUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  const name = getAttachmentName(url).toLowerCase();
  return name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.gif') ||
    name.endsWith('.webp') ||
    name.endsWith('.svg');
};

const toSentenceCase = (str: string) => {
  if (!str) return '—';
  const cleaned = str.replace(/_/g, ' ').trim();
  if (cleaned.length === 0) return '—';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

const normalizeStatus = (status?: string, colNames: string[] = []) => {
  if (!status) return '';
  const normalized = status.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const exactMatch = colNames.find(c => c.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);
  return exactMatch || status;
};

interface TaskDetailModalProps {
  taskId: number;
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: number) => void;
  isInline?: boolean;
}

const TaskDetailModal = ({ taskId, projectId, isOpen, onClose, onUpdate, onDelete, isInline = false }: TaskDetailModalProps) => {
  void onDelete;
  const { user: authUser } = useAuth();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [projectMetadataLoaded, setProjectMetadataLoaded] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<{ id: number; title: string; code: string; x: number; y: number } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isCoAssigneeOpen, setIsCoAssigneeOpen] = useState(false);
  const [isIssueTypeOpen, setIsIssueTypeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [coAssigneeSearch, setCoAssigneeSearch] = useState('');
  const [assigneeFocusIndex, setAssigneeFocusIndex] = useState(-1);
  const [coAssigneeFocusIndex, setCoAssigneeFocusIndex] = useState(-1);
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Task[]>([]);
  const [boardColumns, setBoardColumns] = useState<{ id: number; name: string }[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState<'view' | 'edit' | 'preview'>('view');
  const [activeTab, setActiveTab] = useState<'activity' | 'history' | 'worklog'>('activity');
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [isLogWorkOpen, setIsLogWorkOpen] = useState(false);
  const [logWorkForm, setLogWorkForm] = useState({
    id: undefined as number | undefined,
    timeSpent: '',
    workDate: new Date().toISOString().split('T')[0],
    comment: ''
  });
  const descriptionEditorRef = React.useRef<HTMLDivElement>(null);
  const commentEditorRef = React.useRef<HTMLDivElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [originalTask, setOriginalTask] = useState<Task | null>(null);

  // Mention State
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredMentionUsers = React.useMemo(() => {
    if (mentionSearch === null) return [];
    return users.filter(u =>
      u.name.toLowerCase().includes(mentionSearch) ||
      u.email.toLowerCase().includes(mentionSearch)
    );
  }, [mentionSearch, users]);

  const handleMentionSelect = (userName: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const offset = range.startOffset;
      const beforeCaret = text.slice(0, offset);
      const match = beforeCaret.match(/(?:^|\s)@([^\s]*)$/);
      if (match) {
        const start = offset - match[1].length - 1; // including @
        const newText = text.slice(0, start) + `@${userName} ` + text.slice(offset);
        node.textContent = newText;

        // move caret
        const newRange = document.createRange();
        newRange.setStart(node, start + userName.length + 2);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Trigger save
        if (commentEditorRef.current) {
          const md = htmlToMd(commentEditorRef.current.innerHTML || '');
          setCommentContent(md);
        }
      }
    }
    setMentionSearch(null);
    commentEditorRef.current?.focus();
  };

  const [currentTaskId, setCurrentTaskId] = useState(taskId);
  const [navigationHistory, setNavigationHistory] = useState<number[]>([]);
  const [isCreateSubtaskOpen, setIsCreateSubtaskOpen] = useState(false);
  const [isAddingLinkedWorkItem, setIsAddingLinkedWorkItem] = useState(false);
  const [linkRelationshipType, setLinkRelationshipType] = useState('is blocked by');
  const [linkSearchText, setLinkSearchText] = useState('');
  const [isLinkSearchOpen, setIsLinkSearchOpen] = useState(false);
  const [allProjectTasks, setAllProjectTasks] = useState<Task[]>([]);
  const [selectedLinkTaskId, setSelectedLinkTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentTaskId(taskId);
      setNavigationHistory([]);
      setProjectMetadataLoaded(false);
      setTask(null);
    }
  }, [taskId, isOpen]);

  const navigateToTask = (newTaskId: number) => {
    setHoveredTask(null);
    if (navigationHistory.includes(newTaskId)) {
      const idx = navigationHistory.indexOf(newTaskId);
      setNavigationHistory(navigationHistory.slice(0, idx));
    } else {
      setNavigationHistory(prev => [...prev, currentTaskId]);
    }
    setCurrentTaskId(newTaskId);
  };

  const handleCloseOrBack = () => {
    if (navigationHistory.length > 0) {
      const prevTaskId = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setCurrentTaskId(prevTaskId);
    } else {
      onClose();
    }
  };

  const isManagerOrAdmin = authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN';
  const canReassign = true;
  const canAssignToMe = !!authUser;

  // Sync editors with state only when necessary (prevents cursor jump)
  useEffect(() => {
    if (descriptionEditorRef.current && descriptionMode === 'edit') {
      const currentHtml = descriptionEditorRef.current.innerHTML;
      if (htmlToMd(currentHtml) !== (task?.description || '')) {
        descriptionEditorRef.current.innerHTML = mdToHtml(task?.description || '');
      }
    }
  }, [task?.description, descriptionMode]);

  useEffect(() => {
    if (commentEditorRef.current) {
      const currentHtml = commentEditorRef.current.innerHTML;
      if (htmlToMd(currentHtml) !== commentContent) {
        commentEditorRef.current.innerHTML = mdToHtml(commentContent);
      }
    }
  }, [commentContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!(target as HTMLElement).closest('.dropdown-container')) {
        setIsAssigneeOpen(false);
        setIsCoAssigneeOpen(false);
        setIsIssueTypeOpen(false);
        setIsLinkSearchOpen(false);
        setAssigneeFocusIndex(-1);
        setCoAssigneeFocusIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to convert Markdown to HTML for the rich editor
  const mdToHtml = (md: string) => {
    if (!md) return '';
    const rawHtml = md
      .replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return DOMPurify.sanitize(rawHtml, { ADD_TAGS: ['img'], ADD_ATTR: ['src', 'style'] });
  };

  // Helper to convert HTML back to Markdown for storage
  const htmlToMd = (html: string) => {
    return html
      .replace(/<img[^>]*src="([^"]+)"[^>]*>/g, '![image]($1)')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '_$1_')
      .replace(/<i>(.*?)<\/i>/g, '_$1_')
      .replace(/<br>/g, '\n')
      .replace(/<div>(.*?)<\/div>/g, '\n$1')
      .replace(/<[^>]*>/g, ''); // Strip any other tags
  };

  const handleCommand = (target: 'description' | 'comment', command: string) => {
    document.execCommand(command, false);
    if (target === 'description' && descriptionEditorRef.current) {
      setTask(prev => prev ? { ...prev, description: htmlToMd(descriptionEditorRef.current!.innerHTML) } : null);
    } else if (target === 'comment' && commentEditorRef.current) {
      setCommentContent(htmlToMd(commentEditorRef.current!.innerHTML));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>, target: 'description' | 'comment') => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        hasImage = true;
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const imgHtml = `<img src="${event.target.result}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
              document.execCommand('insertHTML', false, imgHtml);

              // Trigger state update
              if (target === 'description' && descriptionEditorRef.current) {
                const md = htmlToMd(descriptionEditorRef.current.innerHTML || '');
                setTask(prev => prev ? { ...prev, description: md } : null);
              } else if (target === 'comment' && commentEditorRef.current) {
                const md = htmlToMd(commentEditorRef.current.innerHTML || '');
                setCommentContent(md);
              }
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (isOpen && currentTaskId) {
      fetchTaskData();
      setIsEditingTitle(false);
    }
  }, [isOpen, currentTaskId]);

  const fetchWorkLogs = async () => {
    if (!currentTaskId) return;
    try {
      const res = await api.get(`/tasks/${currentTaskId}/work-logs`);
      setWorkLogs(res.data || []);
    } catch (err) {
      console.error("Could not fetch work logs", err);
    }
  };

  const handleLogWorkSubmit = async () => {
    if (!logWorkForm.timeSpent.trim()) {
      addNotification('Error', 'Time spent is required', 'error');
      return;
    }

    const timeSpentTrimmed = logWorkForm.timeSpent.trim().toLowerCase();
    const hoursMatch = timeSpentTrimmed.match(/(\d+)h/);
    const minutesMatch = timeSpentTrimmed.match(/(\d+)m/);
    
    if (hoursMatch && parseInt(hoursMatch[1], 10) >= 24) {
      addNotification('Error', 'Hours must be less than 24', 'error');
      return;
    }
    if (minutesMatch && parseInt(minutesMatch[1], 10) >= 60) {
      addNotification('Error', 'Minutes must be less than 60', 'error');
      return;
    }

    try {
      if (logWorkForm.id) {
        await api.put(`/work-logs/${logWorkForm.id}`, {
          timeSpent: logWorkForm.timeSpent,
          workDate: logWorkForm.workDate,
          comment: logWorkForm.comment
        });
        addNotification('Success', 'Work log updated', 'success');
      } else {
        await api.post(`/tasks/${currentTaskId}/work-logs`, {
          timeSpent: logWorkForm.timeSpent,
          workDate: logWorkForm.workDate,
          comment: logWorkForm.comment
        });
        addNotification('Success', 'Work logged successfully', 'success');
      }
      setIsLogWorkOpen(false);
      setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
      fetchWorkLogs();
      fetchTaskData();
    } catch (err: any) {
      addNotification('Error', err.response?.data?.message || 'Failed to log work', 'error');
    }
  };

  const handleDeleteWorkLog = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this work log?')) return;
    try {
      await api.delete(`/work-logs/${id}`);
      addNotification('Success', 'Work log deleted', 'success');
      fetchWorkLogs();
      fetchTaskData();
    } catch (err: any) {
      addNotification('Error', err.response?.data?.message || 'Failed to delete work log', 'error');
    }
  };

  const canModifyWorkLog = (logUserEmpId?: string) => {
    if (authUser?.role === 'ADMIN' || authUser?.role === 'MANAGER') return true;
    if (task?.assignee?.empId === authUser?.empId) return true;
    if (logUserEmpId === authUser?.empId) return true;
    return false;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const days = Math.floor(seconds / (8 * 3600));
    const remaining = seconds % (8 * 3600);
    const hours = Math.floor(remaining / 3600);
    const remainingMins = remaining % 3600;
    const minutes = Math.round(remainingMins / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
  };

  const getProgressPercentage = () => {
    const spent = task?.timeSpentSeconds || 0;
    const remaining = task?.remainingEstimateSeconds || 0;
    const total = spent + remaining;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((spent / total) * 100));
  };

  const fetchTaskHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/tasks/${currentTaskId}/history`);
      setTaskHistory(res.data || []);
    } catch (err) {
      console.warn('Could not fetch task history', err);
      setTaskHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchTaskData = async () => { console.log('FlickerTest fetchTaskData called:', currentTaskId);
    const isFirstLoad = !task;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setInlineLoading(true);
    }
    try {
      const taskRes = await api.get(`/tasks/${currentTaskId}`);
      
      setTask(taskRes.data);
      setOriginalTask(taskRes.data);
      
      if (taskRes.data) {
        try {
          const saved = localStorage.getItem('recent-tasks');
          const prevList = saved ? JSON.parse(saved) : [];
          const filtered = prevList.filter((t: any) => t.id !== taskRes.data.id);
          const updated = [taskRes.data, ...filtered].slice(0, 4);
          localStorage.setItem('recent-tasks', JSON.stringify(updated));
          window.dispatchEvent(new Event('recent-tasks-updated'));
        } catch (e) {
          console.warn("Could not save to recent-tasks in local storage", e);
        }
      }

      // Stop the main loading spinner immediately so the user can see the task
      setLoading(false);
      setInlineLoading(false);

      if (!projectMetadataLoaded) {
        const actualProjectId = taskRes.data.project?.id || taskRes.data.projectId || projectId;
        
        // Fetch secondary metadata in the background
        Promise.all([
          api.get(`/auth/users?projectId=${actualProjectId}`),
          api.get(`/projects/${actualProjectId}/sprints`),
          api.get(`/tasks?projectId=${actualProjectId}`),
          api.get(`/columns?projectId=${actualProjectId}`)
        ]).then(([usersRes, sprintsRes, allTasksRes, colRes]) => {
          setUsers(usersRes.data);
          setSprints(sprintsRes.data);
          const allTasks = allTasksRes.data || [];
          setAllProjectTasks(allTasks);
          setEpics(allTasks.filter((t: any) => t.issueType === 'EPIC'));
          if (colRes.data?.length > 0) {
            setBoardColumns(colRes.data);
          } else {
            setBoardColumns([
              { id: 1, name: 'To Do' },
              { id: 2, name: 'In Progress' },
              { id: 3, name: 'Done' },
            ]);
          }
          setProjectMetadataLoaded(true);
        }).catch(err => {
          console.warn("Could not load secondary project metadata", err);
        });
      }

      // Fetch other data in the background
      api.get(`/comments/task/${currentTaskId}`)
        .then(res => setComments(res.data || []))
        .catch(err => console.warn('Could not fetch comments', err));

      fetchTaskHistory();
      fetchWorkLogs();
    } catch (err) {
      addNotification('Error', 'Failed to retrieve issue data', 'error');
      onClose();
      setLoading(false);
      setInlineLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedLinkTaskId || !task) return;
    setLoading(true);
    try {
      const selectedTask = allProjectTasks.find(t => t.id === selectedLinkTaskId);
      let childId = selectedLinkTaskId;
      let parentId = task.id;

      // Ensure appropriate parent-child relationship based on issue types
      if (task.issueType === 'BUG' && selectedTask?.issueType !== 'BUG') {
        childId = task.id;
        parentId = selectedLinkTaskId;
      } else if (selectedTask?.issueType === 'EPIC') {
        childId = task.id;
        parentId = selectedLinkTaskId;
      }

      // Fetch the child task to preserve its existing data (since backend nullifies omitted fields)
      const targetTaskRes = await api.get(`/tasks/${childId}`);
      const targetTask = targetTaskRes.data;

      // Prevent circular dependency if they are already related
      if (childId === task.parentId || childId === task.parentTask?.id || parentId === selectedTask?.parentTask?.id || parentId === selectedTask?.parentId) {
        parentId = targetTask.parentId || targetTask.parentTask?.id || null;
      }

      const newTags = [...(targetTask.tags || [])];
      if (!newTags.includes('_link')) {
        newTags.push('_link');
      }

      const payload = {
        task: {
          title: targetTask.title,
          description: targetTask.description,
          issueType: targetTask.issueType,
          status: targetTask.status,
          priority: targetTask.priority,
          storyPoints: targetTask.storyPoints,
          tags: newTags,
        },
        assigneeId: targetTask.assignee?.id,
        coAssigneeId: targetTask.coAssignee?.id,
        reporterId: targetTask.reporter?.id,
        sprintId: targetTask.sprint?.id,
        parentId: parentId
      };

      await api.put(`/tasks/${childId}`, payload);
      addNotification('Success', 'Work item linked successfully', 'success');

      setIsAddingLinkedWorkItem(false);
      setLinkSearchText('');
      setSelectedLinkTaskId(null);
      fetchTaskData();
    } catch (err) {
      addNotification('Error', 'Failed to link work item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (updates: Partial<Task> | any) => {
    if (!task) return;
    if (updates.status && updates.status !== task.status) {
      if (originalTask?.status?.toUpperCase() === 'DONE') {
        addNotification('Error', 'This issue is completed and cannot be transitioned back to active columns.', 'error');
        return;
      }
    }

    let resolvedAssignee = task.assignee;
    if (updates.assigneeId !== undefined) {
      resolvedAssignee = users.find(u => u.id === updates.assigneeId) || undefined;
    }
    let resolvedCoAssignee = task.coAssignee;
    if (updates.coAssigneeId !== undefined) {
      resolvedCoAssignee = users.find(u => u.id === updates.coAssigneeId) || undefined;
    }
    let resolvedReporter = task.reporter;
    if (updates.reporterId !== undefined) {
      resolvedReporter = users.find(u => u.id === updates.reporterId) || undefined;
    }
    let resolvedSprint = task.sprint;
    if (updates.sprintId !== undefined) {
      resolvedSprint = sprints.find(s => s.id === updates.sprintId) || undefined;
    }
    let resolvedParent = task.parentTask;
    if (updates.parentId !== undefined) {
      resolvedParent = allProjectTasks.find(t => t.id === updates.parentId) || undefined;
    }

    setTask(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates,
        assignee: resolvedAssignee,
        coAssignee: resolvedCoAssignee,
        reporter: resolvedReporter,
        sprint: resolvedSprint,
        parentTask: resolvedParent
      };
    });
  };

  const handleSaveAndClose = async () => {
    if (!task) {
      handleCloseOrBack();
      return;
    }

    // Check if task status has changed to DONE and verify if subtasks are completed.
    if (task.status !== originalTask?.status && task.status?.toUpperCase() === 'DONE') {
      const children = allProjectTasks.filter(t => t.parentId === task.id || (t.parentTask && t.parentTask.id === task.id));
      const hasIncomplete = children.some(child => child.status?.toUpperCase() !== 'DONE');
      if (hasIncomplete) {
        addNotification('Error', 'Cannot complete task because there are uncompleted subtasks', 'error');
        return;
      }
    }

    try {
      const payload = {
        task: { ...task },
        projectId: projectId,
        assigneeId: task.assignee?.id || null,
        coAssigneeId: task.coAssignee?.id || null,
        reporterId: task.reporter?.id || null,
        sprintId: task.sprint?.id || null,
        parentId: task.parentTask?.id || null
      };

      // Clean up the task object before sending to avoid circular refs if any
      if (payload.task.subTasks) delete payload.task.subTasks;
      if (payload.task.parentTask) delete payload.task.parentTask;
      if (payload.task.project) delete payload.task.project;
      if (payload.task.assignee) delete payload.task.assignee;
      if (payload.task.coAssignee) delete payload.task.coAssignee;
      if (payload.task.reporter) delete payload.task.reporter;
      if (payload.task.sprint) delete payload.task.sprint;

      if (task.sprint?.id !== undefined) {
        payload.task.environment = task.sprint?.id ? 'SPRINT' : 'BACKLOG';
      }

      const res = await api.put(`/tasks/${currentTaskId}`, payload);
      setTask(res.data);
      setOriginalTask(res.data);
      if (onUpdate) onUpdate(res.data);
      addNotification('Success', 'Issue updated', 'success');
      handleCloseOrBack();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response?.data : 'Failed to update issue');
      addNotification('Error', errorMessage, 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    try {
      await api.delete(`/tasks/${currentTaskId}`);
      onDelete(currentTaskId);
      addNotification('Deleted', 'Issue removed', 'info');
      handleCloseOrBack();
    } catch (err) {
      addNotification('Error', 'Failed to delete issue', 'error');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const currentTags = task?.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        const updatedTags = [...currentTags, newTag.trim()];
        handleUpdate({ tags: updatedTags });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!task) return;
    const updatedTags = (task.tags || []).filter(t => t !== tagToRemove);
    handleUpdate({ tags: updatedTags });
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentContent.trim() || !authUser || !currentTaskId) return;

    setSubmittingComment(true);
    try {
      const res = await api.post('/comments', {
        content: commentContent,
        taskId: currentTaskId,
        userId: authUser.id
      });
      setComments([res.data, ...comments]);
      setCommentContent('');
      addNotification('Success', 'Comment added', 'success');
    } catch (err) {
      addNotification('Error', 'Failed to add comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredAssignees = users.filter(u =>
    u.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );
  const filteredCoAssignees = users.filter(u =>
    u.name.toLowerCase().includes(coAssigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(coAssigneeSearch.toLowerCase())
  );

  if (!task) {
    const skeletonLayout = (
      <div className={isInline ? "bg-white w-full h-full flex flex-col font-sans animate-in fade-in duration-200" : "bg-white w-full max-w-5xl h-[85vh] rounded-[3px] shadow-2xl overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in-[0.98] duration-200"}>
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#DFE1E6] flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="w-32 h-3 bg-gray-200 animate-pulse rounded mb-2"></div>
              <div className="w-64 h-7 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start -mt-1.5 shrink-0">
            {!isInline && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E] flex items-center justify-center"
                title="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content & Sidebar Grid */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Left Pane - Content & Activity */}
          <div className="flex-[7] min-w-0 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white">
            <div className="space-y-3">
              <div className="w-20 h-4 bg-gray-200 animate-pulse rounded"></div>
              <div className="w-full h-40 bg-gray-100 animate-pulse rounded-md border border-[#DFE1E6]"></div>
            </div>
            <div className="space-y-4 pt-6 border-t border-[#DFE1E6]">
              <div className="w-32 h-4 bg-gray-200 animate-pulse rounded"></div>
              <div className="w-full. h-12 bg-gray-100 animate-pulse rounded-md"></div>
            </div>
          </div>

          {/* Right Pane - Attributes & Metadata */}
          <div className="flex-[4.5] min-w-0 bg-[#FAFBFC] overflow-y-auto p-10 space-y-8 border-l border-[#DFE1E6]">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="w-24 h-3 bg-gray-200 animate-pulse rounded"></div>
                <div className="w-full h-9 bg-gray-100 animate-pulse rounded-md"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    return isInline ? skeletonLayout : createPortal(
      <div className="fixed inset-0 bg-[#091E42]/50 z-[2000] flex items-center justify-center p-4">
        {skeletonLayout}
      </div>,
      document.body
    );
  }

  const linkedIssues = task?.subTasks?.filter(s =>
    s.issueType === 'BUG' || s.issueType === 'EPIC' || s.issueType === 'STORY' || (s.tags && s.tags.includes('_link'))
  ) || [];

  const displaySubTasks = task?.subTasks?.filter(s =>
    s.issueType === 'TASK' && (!s.tags || !s.tags.includes('_link'))
  ) || [];

  const getTaskLink = () => {
    if (!task) return '#';
    const code = getTaskCode(task.id, task.project?.name, task.projectSequence);
    return `${window.location.origin}/dashboard/task/${code}`;
  };

  const modalContent = (
    <>
      <div className={isInline ? "bg-white w-full h-full flex flex-col font-sans animate-in fade-in duration-200" : "bg-white w-full max-w-5xl h-[85vh] rounded-[3px] shadow-2xl overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in-[0.98] duration-200"}>
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#DFE1E6] flex items-center justify-between relative">
          {inlineLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DEEBFF] overflow-hidden">
              <div className="h-full bg-[#1F6FEB] animate-progress-slide"></div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-xs text-[#5E6C84] mb-1 font-medium select-none">
                <span className="truncate max-w-[150px]">{task?.project?.name || 'Project'}</span>
                {task?.parentTask && (
                  <>
                    <span className="text-[#DFE1E6]">/</span>
                    <span
                      onClick={() => navigateToTask(task.parentTask!.id)}
                      className="hover:underline hover:text-[#1F6FEB] cursor-pointer"
                      title={task.parentTask.title}
                    >
                      {getTaskCode(task.parentTask.id, task.parentTask.project?.name || task.project?.name, task.parentTask.projectSequence)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#5E6C84]">
                {task?.issueType === 'BUG' ? (
                  <Bug size={14} className="text-[#FF5630] shrink-0" />
                ) : task?.issueType === 'EPIC' ? (
                  <Zap size={14} className="text-[#6554C0] shrink-0" />
                ) : task?.issueType === 'STORY' ? (
                  <Bookmark size={14} className="text-[#36B37E] shrink-0" />
                ) : (
                  <CheckSquare size={14} className="text-[#4C9AFF] shrink-0" />
                )}
                <span className="text-xs font-black uppercase tracking-wider">
                  {task?.parentTask || task?.parentId ? 'SUB-TASK' : (task?.issueType || 'TASK')}
                </span>
                <span className="text-[#DFE1E6]">•</span>
                <a
                  href={getTaskLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-[#1F6FEB] flex items-center gap-1 uppercase font-bold"
                  title="Open task in new tab"
                >
                  {getTaskCode(currentTaskId, task?.project?.name, task?.projectSequence)}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getTaskLink());
                    addNotification('Success', 'Link copied to clipboard', 'success');
                  }}
                  className="flex items-center justify-center p-1 hover:bg-[#F4F5F7] rounded-[3px] transition-colors group"
                  title="Copy link"
                >
                  <Link size={14} className="text-[#5E6C84] group-hover:text-[#1F6FEB]" />
                </button>
              </div>
              {isEditingTitle ? (
                <textarea
                  autoFocus
                  className="text-xl font-semibold text-[#172B4D] mt-1 p-1 w-full border-2 border-[#4C9AFF] rounded outline-none resize-none overflow-hidden font-sans"
                  rows={Math.max(2, Math.ceil(editedTitle.length / 50))}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    if (editedTitle.trim() && editedTitle.trim() !== task?.title) {
                      handleUpdate({ title: editedTitle.trim() });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setIsEditingTitle(false);
                      if (editedTitle.trim() && editedTitle.trim() !== task?.title) {
                        handleUpdate({ title: editedTitle.trim() });
                      }
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                      setEditedTitle(task?.title || '');
                    }
                  }}
                />
              ) : (
                <h2
                  className="text-2xl font-bold text-[#172B4D] mt-1 p-1 -ml-1 rounded cursor-pointer hover:bg-[#F4F5F7] transition-all"
                  onClick={() => {
                    setEditedTitle(task?.title || '');
                    setIsEditingTitle(true);
                  }}
                  title="Click to edit"
                >
                  {task?.title || 'Loading...'}
                </h2>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start -mt-1.5 shrink-0">
            {(authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') && (
              <button
                onClick={handleDelete}
                className="p-2 text-[#DE350B] hover:bg-[#FFEBE6] hover:text-[#DE350B] rounded-[3px] transition-colors"
                title="Delete Task"
              >
                <Trash2 size={20} />
              </button>
            )}
            {!isInline && (
              navigationHistory.length > 0 ? (
                <button
                  onClick={handleCloseOrBack}
                  className="px-2.5 py-1 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E] text-sm font-semibold transition-all animate-in fade-in duration-200"
                  title="Go back"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={handleCloseOrBack}
                  className="p-2 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E] flex items-center justify-center animate-in fade-in duration-200"
                  title="Close"
                >
                  <X size={20} />
                </button>
              )
            )}
          </div>
        </div>

        {/* Attachment Preview Lightbox */}
        {previewUrl && (
          <div
            className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-10 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X size={32} strokeWidth={3} />
            </button>

            <div className="max-w-5xl max-h-full flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
              {isImageUrl(previewUrl) ? (
                <img
                  src={cleanUrl(previewUrl)}
                  alt="Attachment Preview"
                  className="max-w-full max-h-[70vh] rounded shadow-2xl object-contain border-4 border-white/10"
                  onError={(e) => {
                    (e.target as any).src = 'https://via.placeholder.com/800x600?text=Preview+Not+Available';
                  }}
                />
              ) : (
                <div className="bg-white/10 backdrop-blur-md p-16 rounded-[4px] border border-white/10 flex flex-col items-center gap-6 text-white min-w-[320px]">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Paperclip size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold">{getAttachmentName(previewUrl)}</h3>
                    <p className="text-white/60 text-xs mt-1">Preview not available for this file type</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <p className="text-white font-medium text-lg bg-black/50 px-4 py-2 rounded-full border border-white/10">{getAttachmentName(previewUrl)}</p>
                <a
                  href={cleanUrl(previewUrl)}
                  download={getAttachmentName(previewUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1F6FEB] text-white rounded-[3px] font-bold hover:bg-[#0047B3] transition-colors shadow-lg"
                >
                  <Download size={16} />
                  Download
                </a>
                <a
                  href={cleanUrl(previewUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-[3px] font-bold hover:bg-white/30 transition-colors shadow-lg border border-white/20"
                >
                  <ExternalLink size={16} />
                  View
                </a>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-[#DE350B] text-white rounded-[3px] font-bold hover:bg-[#BF2600] transition-colors shadow-lg"
                  onClick={() => {
                    const newAttachments = task?.attachments?.filter(a => a !== previewUrl);
                    handleUpdate({ attachments: newAttachments });
                    setPreviewUrl(null);
                    addNotification('Info', 'Attachment deleted', 'info');
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`flex-1 flex overflow-hidden min-w-0 transition-opacity duration-200 ${inlineLoading ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Left Pane - Content & Activity */}
          <div className="flex-[7] min-w-0 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-white">
            {/* Breadcrumb / Hierarchy */}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-[#172B4D]">Description</label>
                {descriptionMode === 'view' && (
                  <button
                    onClick={() => setDescriptionMode('edit')}
                    className="text-[13px] font-bold text-[#1F6FEB] hover:underline"
                  >
                    Edit description
                  </button>
                )}
              </div>

              {descriptionMode === 'edit' ? (
                <div className="space-y-3">
                  <RichTextEditor
                    value={task?.description || ''}
                    onChange={(val) => setTask(prev => prev ? { ...prev, description: val } : null)}
                    placeholder="Add a description..."
                    draftKey={`task_desc_${currentTaskId}`}
                    projectId={projectId}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setDescriptionMode('view');
                        if (originalTask) {
                          setTask(prev => prev ? { ...prev, description: originalTask.description } : null);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-[#42526E] hover:bg-[#EBECF0] rounded border border-[#DFE1E6] bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { handleUpdate({ description: task?.description }); setDescriptionMode('view'); }}
                      className="px-3 py-1.5 text-xs font-bold bg-[#0052CC] text-white rounded hover:bg-[#0747A6]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="border border-[#DFE1E6] hover:bg-[#FAFBFC] rounded-md p-4 min-h-[160px] cursor-pointer prose prose-sm max-w-none"
                  onClick={() => setDescriptionMode('edit')}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      task?.description || '<span class="text-[#A5ADBA] italic font-normal">No description provided. Click to add one.</span>'
                    )
                  }}
                />
              )}
            </div>
            {/* Child Issues / Subtasks */}
            {!(task?.parentTask || task?.parentId) && (
              <>
                {/* Regular Subtasks */}
                <div className="space-y-4 pt-6 border-t border-[#DFE1E6]">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-[#172B4D]">
                      {task?.issueType === 'EPIC' ? 'Issues in this epic' : 'Subtasks'}
                    </label>
                    <div className="flex items-center gap-2">
                      {displaySubTasks.length > 0 && (
                        <span className="text-[11px] font-bold text-[#172B4D]/70 bg-[#EBECF0] px-2 py-0.5 rounded">
                          {displaySubTasks.length} {displaySubTasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsCreateSubtaskOpen(true)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#1F6FEB] hover:bg-[#DEEBFF] px-2.5 py-1 rounded transition-colors"
                      >
                        <Plus size={12} />
                        {task?.issueType === 'EPIC' ? 'Create issue' : 'Create subtask'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {displaySubTasks.length > 0 ? (
                      displaySubTasks.map(sub => (
                        <div
                          key={sub.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToTask(sub.id);
                          }}
                          onMouseEnter={(e) => {
                            setHoveredTask({
                              id: sub.id,
                              title: sub.title,
                              code: getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence),
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          onMouseMove={(e) => {
                            setHoveredTask(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                          }}
                          onMouseLeave={() => setHoveredTask(null)}
                          className="flex items-center justify-between p-3 bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] group hover:bg-white hover:border-[#1F6FEB] transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="flex items-center justify-center w-3 h-3">
                              {sub.issueType === 'BUG' ? (
                                <Bug size={12} className="text-[#FF5630]" />
                              ) : sub.issueType === 'EPIC' ? (
                                <Zap size={12} className="text-[#6554C0]" />
                              ) : sub.issueType === 'STORY' ? (
                                <Bookmark size={12} className="text-[#36B37E]" />
                              ) : (
                                <CheckSquare size={12} className="text-[#4C9AFF]" />
                              )}
                            </div>
                            <a
                              href={`/dashboard/task/${getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => { e.stopPropagation(); setHoveredTask(null); }}
                              className="text-[12px] font-bold text-[#5E6C84] hover:text-[#1F6FEB] hover:underline uppercase min-w-[60px]"
                            >
                              {getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence)}
                            </a>
                            <span className="text-[13px] text-[#172B4D] font-medium truncate group-hover:text-[#1F6FEB] group-hover:underline">{sub.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${sub.status === 'DONE' ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-[#EAE6FF] text-[#403294]'}`}>
                              {sub.status || 'Todo'}
                            </span>
                            <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm" title={sub.assignee?.name || 'Unassigned'}>
                              {sub.assignee?.name?.charAt(0) || '?'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[13px] text-[#5E6C84] bg-[#F4F5F7] p-3 rounded-[3px] border border-dashed border-[#DFE1E6] text-center">
                        No subtasks added yet
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Linked Issues (Styled as Linked work items) */}
            {task?.issueType !== 'EPIC' && (
              <div className="space-y-4 pt-6 border-t border-[#DFE1E6]">
                <h3 className="text-[16px] font-bold text-[#172B4D]">Linked work items</h3>

                {/* List of existing linked items */}
                <div className="space-y-2">
                  {linkedIssues.length > 0 && (
                    linkedIssues.map(sub => (
                      <div
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToTask(sub.id);
                        }}
                        onMouseEnter={(e) => {
                          setHoveredTask({
                            id: sub.id,
                            title: sub.title,
                            code: getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence),
                            x: e.clientX,
                            y: e.clientY
                          });
                        }}
                        onMouseMove={(e) => {
                          setHoveredTask(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                        }}
                        onMouseLeave={() => setHoveredTask(null)}
                        className="flex items-center justify-between p-3 bg-white border border-[#DFE1E6] rounded-[3px] group hover:border-[#FF5630] transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="flex items-center justify-center w-4 h-4">
                            {sub.issueType === 'BUG' ? (
                              <Bug size={14} className="text-[#FF5630]" />
                            ) : sub.issueType === 'EPIC' ? (
                              <Zap size={14} className="text-[#6554C0]" />
                            ) : sub.issueType === 'STORY' ? (
                              <Bookmark size={14} className="text-[#36B37E]" />
                            ) : (
                              <CheckSquare size={14} className="text-[#4C9AFF]" />
                            )}
                          </div>
                          <a
                            href={`/dashboard/task/${getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => { e.stopPropagation(); setHoveredTask(null); }}
                            className="text-[12px] font-bold text-[#1F6FEB] hover:underline uppercase min-w-[60px]"
                          >
                            {getTaskCode(sub.id, sub.project?.name || task?.project?.name, sub.projectSequence)}
                          </a>
                          <span className="text-[13px] text-[#172B4D] font-medium truncate">{sub.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${sub.status === 'DONE' ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-[#EAE6FF] text-[#403294]'}`}>
                            {sub.status || 'Todo'}
                          </span>
                          <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm" title={sub.assignee?.name || 'Unassigned'}>
                            {sub.assignee?.name?.charAt(0) || '?'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Linked Work Item Section */}
                {!isAddingLinkedWorkItem ? (
                  <button onClick={() => setIsAddingLinkedWorkItem(true)} className="text-[14px] text-[#5E6C84] hover:text-[#172B4D] hover:underline cursor-pointer">
                    Add linked work item
                  </button>
                ) : (
                  <div className="space-y-4 mt-4">


                    <div className="flex items-center gap-2">
                      <div className="w-1/3 relative">
                        <select
                          value={linkRelationshipType}
                          onChange={(e) => setLinkRelationshipType(e.target.value)}
                          className="w-full p-2 border border-[#DFE1E6] rounded-[3px] text-[14px] text-[#172B4D] appearance-none bg-white hover:bg-[#F4F5F7] focus:border-[#4C9AFF] focus:border-2 outline-none cursor-pointer"
                        >
                          <option value="is blocked by">is blocked by</option>
                          <option value="relates to">relates to</option>
                          <option value="duplicates">duplicates</option>
                          <option value="blocks">blocks</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
                      </div>
                      <div className="flex-1 relative dropdown-container">
                        <input
                          type="text"
                          value={linkSearchText}
                          onChange={(e) => {
                            setLinkSearchText(e.target.value);
                            setSelectedLinkTaskId(null);
                          }}
                          onFocus={() => setIsLinkSearchOpen(true)}
                          placeholder="Type, search or paste URL"
                          className="w-full p-2 border border-[#DFE1E6] rounded-[3px] text-[14px] text-[#172B4D] focus:border-[#4C9AFF] focus:border-2 outline-none"
                        />
                        {isLinkSearchOpen && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2200] max-h-64 overflow-y-auto py-2 flex flex-col custom-scrollbar">
                            <div className="px-3 py-1 text-[12px] font-bold text-[#5E6C84]">Recently viewed</div>
                            {allProjectTasks.filter(t => t.id !== task?.id && (t.title.toLowerCase().includes(linkSearchText.toLowerCase()) || getTaskCode(t.id, task?.project?.name, t.projectSequence).toLowerCase().includes(linkSearchText.toLowerCase()))).slice(0, 10).map(t => (
                              <button
                                key={t.id}
                                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[14px] hover:bg-[#F4F5F7] group transition-colors"
                                onClick={() => {
                                  setLinkSearchText(getTaskCode(t.id, task?.project?.name, t.projectSequence) + ' ' + t.title);
                                  setSelectedLinkTaskId(t.id);
                                  setIsLinkSearchOpen(false);
                                }}
                              >
                                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                                  {t.issueType === 'BUG' ? (
                                    <Bug size={14} className="text-[#FF5630]" />
                                  ) : t.issueType === 'EPIC' ? (
                                    <Zap size={14} className="text-[#6554C0]" />
                                  ) : t.issueType === 'STORY' ? (
                                    <Bookmark size={14} className="text-[#36B37E]" />
                                  ) : (
                                    <CheckSquare size={14} className="text-[#4C9AFF]" />
                                  )}
                                </div>
                                <span className="text-[#172B4D] truncate flex items-center gap-1.5"><span className="text-[#5E6C84] group-hover:text-[#172B4D] transition-colors">{getTaskCode(t.id, task?.project?.name, t.projectSequence)}</span> {t.title}</span>
                              </button>
                            ))}
                            {allProjectTasks.filter(t => t.id !== task?.id && (t.title.toLowerCase().includes(linkSearchText.toLowerCase()) || getTaskCode(t.id, task?.project?.name, t.projectSequence).toLowerCase().includes(linkSearchText.toLowerCase()))).length === 0 && <div className="px-3 py-2 text-[13px] text-[#5E6C84]">No items found</div>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button onClick={() => setIsCreateSubtaskOpen(true)} className="flex items-center gap-1 text-[14px] font-medium text-[#5E6C84] hover:text-[#172B4D] hover:underline">
                        <Plus size={16} /> Create linked work item
                      </button>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 rounded-[3px] font-medium text-[#172B4D] hover:bg-[#F4F5F7]" onClick={() => { setIsAddingLinkedWorkItem(false); setLinkSearchText(''); setSelectedLinkTaskId(null); }}>Cancel</button>
                        <button
                          className={`px-3 py-1.5 rounded-[3px] font-medium transition-colors ${selectedLinkTaskId ? 'bg-[#1F6FEB] text-white hover:bg-[#0047B3] cursor-pointer' : 'bg-[#F4F5F7] text-[#A5ADBA] cursor-not-allowed'}`}
                          disabled={!selectedLinkTaskId}
                          onClick={handleCreateLink}
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-[#DFE1E6]">
              <label className="text-[13px] font-bold text-[#172B4D]">Attachments</label>
              {task?.attachments && task.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {task.attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] group hover:bg-white hover:shadow-md hover:border-[#1F6FEB] transition-all cursor-pointer"
                      onClick={() => setPreviewUrl(file)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Paperclip size={14} className="text-[#42526E] shrink-0" />
                        <span className="text-[13px] text-[#1F6FEB] truncate font-medium hover:underline">{getAttachmentName(file)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newAttachments = task.attachments?.filter((_, i) => i !== idx);
                          handleUpdate({ attachments: newAttachments });
                          addNotification('Info', 'Attachment removed', 'info');
                        }}
                        className="p-1.5 text-[#6B778C] hover:bg-[#FFEBE6] hover:text-[#DE350B] rounded transition-all ml-2"
                        title="Remove attachment"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-10 border-2 border-dashed border-[#DFE1E6] rounded-[3px] flex flex-col items-center justify-center gap-3 bg-[#F4F5F7]/30 group hover:border-[#4C9AFF] hover:bg-white transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-[#5E6C84] group-hover:text-[#1F6FEB] transition-colors">
                  <Paperclip size={20} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-[#172B4D]">Attach files by dragging & dropping</p>
                  <p className="text-xs text-[#5E6C84] mt-1">Select files from your device</p>
                </div>
              </div>
            </div>

            {/* Activity / History Section */}
            <div className="space-y-6 pt-10 border-t border-[#DFE1E6]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-[3px] text-sm font-black uppercase tracking-tight transition-all border-b-2 ${activeTab === 'activity'
                    ? 'text-[#1F6FEB] border-[#1F6FEB] bg-[#DEEBFF]/40'
                    : 'text-[#42526E] border-transparent hover:text-[#172B4D] hover:bg-[#F4F5F7]'
                    }`}
                >
                  <History size={16} />
                  Activity stream
                </button>
                <button
                  onClick={() => { setActiveTab('history'); fetchTaskHistory(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-[3px] text-sm font-black uppercase tracking-tight transition-all border-b-2 ${activeTab === 'history'
                    ? 'text-[#1F6FEB] border-[#1F6FEB] bg-[#DEEBFF]/40'
                    : 'text-[#42526E] border-transparent hover:text-[#172B4D] hover:bg-[#F4F5F7]'
                    }`}
                >
                  <Clock size={16} />
                  History
                </button>
                <button
                  onClick={() => { setActiveTab('worklog'); fetchWorkLogs(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-[3px] text-sm font-black uppercase tracking-tight transition-all border-b-2 ${activeTab === 'worklog'
                    ? 'text-[#1F6FEB] border-[#1F6FEB] bg-[#DEEBFF]/40'
                    : 'text-[#42526E] border-transparent hover:text-[#172B4D] hover:bg-[#F4F5F7]'
                    }`}
                >
                  <Clock size={16} />
                  Work logs
                </button>
              </div>

              {activeTab === 'activity' && (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[13px] font-black shrink-0 shadow-lg shadow-cyan-500/20">
                      {authUser?.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <RichTextEditor
                        value={commentContent}
                        onChange={(val) => setCommentContent(val)}
                        placeholder="Add a thought or update..."
                        projectId={projectId}
                      />
                      {commentContent.trim() && (
                        <div className="flex gap-2 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                          <button
                            onClick={() => handleAddComment()}
                            disabled={submittingComment}
                            className="bg-[#1F6FEB] text-white px-5 py-2 rounded-[3px] text-[13px] font-black hover:bg-[#003484] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                          >
                            {submittingComment ? 'Posting...' : 'Post Comment'}
                          </button>
                          <button
                            onClick={() => setCommentContent('')}
                            className="text-[#42526E] px-4 py-2 rounded-[3px] text-[13px] font-black hover:bg-[#EBECF0] transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment Feed */}
                  <div className="space-y-8 pt-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-10 h-10 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#172B4D] text-[13px] font-black shrink-0 border border-[#DFE1E6]">
                          {comment.user?.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-[14px] font-black text-[#172B4D]">{comment.user?.name}</span>
                            <span className="text-[11px] font-bold text-[#5E6C84] uppercase tracking-widest">{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div
                            className="text-[14px] text-[#172B4D] leading-relaxed bg-[#F4F5F7]/50 p-4 rounded-[3px] border border-[#DFE1E6]/30 group-hover:bg-white group-hover:border-[#DFE1E6] transition-all markdown-content"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content || '') }}
                          />
                          <div className="flex gap-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-[11px] font-black text-[#5E6C84] hover:text-[#1F6FEB] uppercase tracking-tighter">Edit</button>
                            <button className="text-[11px] font-black text-[#5E6C84] hover:text-[#DE350B] uppercase tracking-tighter">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'history' && (
                <div className="space-y-1 pt-2">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-3 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : taskHistory.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock size={32} className="mx-auto text-[#A5ADBA] mb-3" />
                      <p className="text-sm font-medium text-[#5E6C84]">No history recorded yet</p>
                      <p className="text-xs text-[#8993A4] mt-1 italic">Changes to this task will appear here.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#1F6FEB]/30" />
                      {taskHistory.map((entry, idx) => {
                        const changeLabels: Record<string, string> = {
                          CREATED: 'Task created',
                          STATUS_CHANGE: 'Status changed',
                          ASSIGNEE_CHANGE: 'Assignee changed',
                          CO_ASSIGNEE_CHANGE: 'Partner changed',
                          PRIORITY_CHANGE: 'Priority changed',
                          ISSUE_TYPE_CHANGE: 'Work type changed',
                          DUE_DATE_CHANGE: 'Due date changed',
                          TITLE_CHANGE: 'Title changed',
                          DESCRIPTION_CHANGE: 'Description changed',
                        };
                        const label = changeLabels[entry.changeType] || toSentenceCase(entry.changeType);
                        const date = new Date(entry.createdAt);

                        // Custom formatter for the performer's name
                        const performer = toSentenceCase(entry.performedBy || 'System');
                        const fromVal = toSentenceCase(entry.fromValue);
                        const toVal = toSentenceCase(entry.toValue);

                        return (
                          <div key={entry.id || idx} className="relative flex items-start gap-4 pb-6 pl-12 group">
                            {/* Timeline dot */}
                            <div className="absolute left-3 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-[#0B3D91]" />

                            <div className="flex-1 bg-white rounded-[3px] p-4 border border-[#DFE1E6] group-hover:border-[#1F6FEB] group-hover:shadow-md transition-all">
                              <div className="flex items-center justify-between mb-2 text-[13px] text-[#172B4D]">
                                <span className="font-black text-[#0B3D91]">
                                  {label} <span className="text-[#172B4D] font-normal">by {performer}</span>
                                </span>
                                <span className="font-normal text-[#172B4D]/70">
                                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {entry.changeType === 'CREATED' ? (
                                <p className="text-[13px] text-[#172B4D]">
                                  Task was created with status <span className="font-bold text-[#1F6FEB]">{toVal}</span>
                                </p>
                              ) : (
                                <div className="flex items-center gap-2 text-[13px] text-[#172B4D]">
                                  <span className="px-2 py-0.5 bg-[#1F6FEB]/10 rounded text-[13px] font-bold text-[#0B3D91]">{fromVal}</span>
                                  <ArrowRight size={14} className="text-[#172B4D]/60 shrink-0" />
                                  <span className="px-2 py-0.5 bg-[#1F6FEB]/20 rounded text-[13px] font-bold text-[#1F6FEB]">{toVal}</span>
                                </div>
                              )}
                              {entry.comment && (
                                <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-[3px] text-[11px] text-[#5E6C84] italic mt-3 flex gap-2 items-start">
                                  <MessageSquare size={12} className="text-[#5E6C84]/65 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold text-gray-500 not-italic block mb-0.5">PM Feedback:</span>
                                    "{entry.comment}"
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'worklog' && (
                <div className="space-y-4 pt-2 font-sans">
                  {workLogs.length === 0 ? (
                    <div className="py-12 text-center bg-white border border-[#DFE1E6] rounded-[3px]">
                      <Clock size={32} className="mx-auto text-[#A5ADBA] mb-3" />
                      <p className="text-sm font-medium text-[#5E6C84]">No work logged yet</p>
                      <button
                        onClick={() => {
                          setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
                          setIsLogWorkOpen(true);
                        }}
                        className="mt-4 px-4 py-2 bg-[#1F6FEB] hover:bg-[#003484] text-white rounded-[3px] text-xs font-black shadow-lg shadow-blue-500/20 cursor-pointer"
                      >
                        Log Work
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-[#FAFBFC] p-3 border border-[#DFE1E6] rounded-[3px]">
                        <span className="text-xs font-bold text-[#6B778C]">
                          Total effort logged: <span className="text-[#172B4D]">{formatTime(task?.timeSpentSeconds || 0)}</span>
                        </span>
                        <button
                          onClick={() => {
                            setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
                            setIsLogWorkOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#1F6FEB] hover:bg-[#003484] text-white rounded-[3px] text-xs font-black cursor-pointer shadow-sm"
                        >
                          Log Work
                        </button>
                      </div>
                      <div className="space-y-3">
                        {workLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-4 p-4 bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm hover:shadow-md transition-shadow group">
                            <div className="w-10 h-10 rounded-full bg-[#1F6FEB] text-white flex items-center justify-center font-bold text-[13px] shrink-0">
                              {log.user?.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-bold text-[#172B4D]">{log.user?.name}</span>
                                  <span className="text-[10px] text-[#6B778C] font-bold uppercase tracking-wider bg-[#EBECF0] px-1.5 py-0.5 rounded">{log.timeSpent}</span>
                                </div>
                                <span className="text-[11px] text-[#5E6C84]">{new Date(log.workDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                              {log.comment ? (
                                <p className="text-xs text-[#172B4D] mt-2 whitespace-pre-wrap leading-relaxed">{log.comment}</p>
                              ) : (
                                <p className="text-xs text-[#8993A4] mt-2 italic">No description provided</p>
                              )}
                              {canModifyWorkLog(log.user?.empId) && (
                                <div className="flex gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setLogWorkForm({
                                        id: log.id,
                                        timeSpent: log.timeSpent,
                                        workDate: log.workDate,
                                        comment: log.comment || ''
                                      });
                                      setIsLogWorkOpen(true);
                                    }}
                                    className="text-[10px] font-bold text-[#5E6C84] hover:text-[#1F6FEB] uppercase cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWorkLog(log.id)}
                                    className="text-[10px] font-bold text-[#5E6C84] hover:text-[#DE350B] uppercase cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane - Attributes & Metadata */}
          <div className="flex-[4.5] min-w-0 bg-[#FAFBFC] overflow-y-auto p-10 space-y-10 border-l border-[#DFE1E6]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Current status</label>
                <div className="relative">
                  <select
                    disabled={originalTask?.status?.toUpperCase() === 'DONE'}
                    className={`w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] appearance-none outline-none focus:border-[#4C9AFF] transition-all pr-10 ${originalTask?.status?.toUpperCase() === 'DONE' ? 'bg-[#FAFBFC] cursor-not-allowed text-gray-500' : 'cursor-pointer'}`}
                    value={normalizeStatus(task?.status, boardColumns.map(c => c.name)) || ''}
                    onChange={(e) => handleUpdate({ status: e.target.value })}
                  >
                    {boardColumns.length === 0 && task?.status && (
                      <option value={task.status}>{task.status.replace(/_/g, ' ')}</option>
                    )}
                    {boardColumns.map(col => (
                      <option key={col.id} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Work type</label>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setIsIssueTypeOpen(!isIssueTypeOpen)}
                    className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-bold text-[#172B4D] flex items-center gap-2 transition-all cursor-pointer text-left"
                  >
                    {task?.issueType === 'BUG' ? (
                      <Bug size={16} className="text-[#FF5630] shrink-0" />
                    ) : task?.issueType === 'EPIC' ? (
                      <Zap size={16} className="text-[#6554C0] shrink-0" />
                    ) : task?.issueType === 'STORY' ? (
                      <Bookmark size={16} className="text-[#36B37E] shrink-0" />
                    ) : (
                      <CheckSquare size={16} className="text-[#4C9AFF] shrink-0" />
                    )}
                    <span className="capitalize">{task?.issueType?.toLowerCase() || 'task'}</span>
                    <ChevronDown size={14} className="ml-auto text-[#42526E]" />
                  </button>

                  {isIssueTypeOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      {([
                        { value: 'STORY', label: 'Story', color: 'text-[#36B37E]', icon: Bookmark },
                        { value: 'BUG', label: 'Bug', color: 'text-[#FF5630]', icon: Bug },
                        { value: 'TASK', label: 'Task', color: 'text-[#4C9AFF]', icon: CheckSquare },
                        { value: 'EPIC', label: 'Epic', color: 'text-[#6554C0]', icon: Zap }
                      ]).map(type => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            handleUpdate({ issueType: type.value });
                            setIsIssueTypeOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] transition-colors flex items-center gap-2 cursor-pointer ${task?.issueType === type.value ? 'bg-[#E9F2FF] text-[#1F6FEB] font-bold' : 'text-[#172B4D]'}`}
                        >
                          <type.icon size={14} className={`${type.color} shrink-0`} />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 dropdown-container relative">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-bold text-[#172B4D]">Assignee</label>
                  {canAssignToMe && (
                    <button
                      type="button"
                      onClick={() => handleUpdate({ assigneeId: authUser.id })}
                      className="text-[13px] font-bold text-[#1F6FEB] hover:underline cursor-pointer"
                    >
                      Assign to me
                    </button>
                  )}
                </div>
                <div className="relative">
                  {!canReassign ? (
                    <div className="w-full p-2 border border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-[#F4F5F7]/50 h-10 font-bold">
                      <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {task?.assignee?.name ? task.assignee.name.charAt(0) : 'U'}
                      </div>
                      <span>
                        {task?.assignee?.name || 'Unassigned'}
                      </span>
                    </div>
                  ) : isAssigneeOpen || !task?.assignee ? (
                    <div className="relative w-full flex items-center">
                      <Search size={14} className="absolute left-3 text-[#5E6C84]" />
                      <input
                        autoFocus={isAssigneeOpen}
                        type="text"
                        placeholder="Search assignee..."
                        className="w-full pl-9 pr-8 py-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10 font-bold"
                        value={assigneeSearch}
                        onChange={e => {
                          setAssigneeSearch(e.target.value);
                          setAssigneeFocusIndex(-1);
                          if (!isAssigneeOpen) {
                            setIsAssigneeOpen(true);
                            setIsCoAssigneeOpen(false);
                          }
                        }}
                        onFocus={() => {
                          if (!isAssigneeOpen) {
                            setIsAssigneeOpen(true);
                            setIsCoAssigneeOpen(false);
                            setAssigneeFocusIndex(-1);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isAssigneeOpen) {
                            setIsAssigneeOpen(true);
                            setIsCoAssigneeOpen(false);
                            setAssigneeFocusIndex(-1);
                          }
                        }}
                        onKeyDown={e => {
                          const totalOptions = filteredAssignees.length + 1; // 1 for Unassigned
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setAssigneeFocusIndex(prev => (prev + 1) % totalOptions);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setAssigneeFocusIndex(prev => (prev - 1 + totalOptions) % totalOptions);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (assigneeFocusIndex === 0) {
                              handleUpdate({ assigneeId: null });
                              setIsAssigneeOpen(false);
                            } else if (assigneeFocusIndex > 0 && assigneeFocusIndex <= filteredAssignees.length) {
                              const selectedUser = filteredAssignees[assigneeFocusIndex - 1];
                              handleUpdate({ assigneeId: selectedUser.id });
                              setIsAssigneeOpen(false);
                            } else {
                              if (filteredAssignees.length > 0) {
                                handleUpdate({ assigneeId: filteredAssignees[0].id });
                                setIsAssigneeOpen(false);
                              }
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsAssigneeOpen(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsAssigneeOpen(!isAssigneeOpen);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] hover:text-[#172B4D] focus:outline-none z-10 flex items-center justify-center cursor-pointer"
                      >
                        <ChevronDown size={14} className={`transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAssigneeOpen(true);
                        setIsCoAssigneeOpen(false);
                        setAssigneeSearch('');
                        setAssigneeFocusIndex(-1);
                      }}
                      className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10 text-left font-bold"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {task.assignee.name.charAt(0)}
                      </div>
                      <span>
                        {task.assignee.name}
                      </span>
                      <ChevronDown size={14} className="ml-auto text-[#42526E]" />
                    </button>
                  )}

                  {canReassign && isAssigneeOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdate({ assigneeId: null });
                            setIsAssigneeOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] font-semibold text-[#5E6C84] border-2 rounded-[3px] transition-all ${assigneeFocusIndex === 0 ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                        >
                          Unassigned
                        </button>
                        {filteredAssignees.map((u, idx) => {
                          const optionIndex = idx + 1;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                handleUpdate({ assigneeId: u.id });
                                setIsAssigneeOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex flex-col font-bold border-2 rounded-[3px] transition-all group ${assigneeFocusIndex === optionIndex ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                  {u.name.charAt(0)}
                                </div>
                                <span className="flex-1 truncate">{u.name}</span>
                                {task?.assignee?.id === u.id && <Check size={14} className="text-[#1F6FEB] shrink-0" />}
                              </div>
                              <div className="hidden group-hover:flex flex-col pl-7 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                <span className="text-[11px] font-normal text-[#5E6C84] truncate">{u.email}</span>
                                <div className="flex gap-1 mt-1">
                                  <span className="text-[9px] font-black uppercase tracking-wider bg-[#E9F2FF] text-[#1F6FEB] px-1.5 py-0.5 rounded-[3px]">
                                    {u.role || 'USER'}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {filteredAssignees.length === 0 && (
                          <div className="px-3 py-3 text-sm text-[#5E6C84] text-center italic">
                            No matching users
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Co assignee</label>
                <div className="w-full p-2 border border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-[#F4F5F7]/50 h-10 font-bold">
                  <div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {task?.coAssignee?.name ? task.coAssignee.name.charAt(0) : 'U'}
                  </div>
                  <span>
                    {task?.coAssignee?.name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Reporter</label>
                <div className="w-full p-2 border border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-[#F4F5F7]/50 h-10 font-bold">
                  <div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {task?.reporter?.name ? task.reporter.name.charAt(0) : 'U'}
                  </div>
                  <span>
                    {task?.reporter?.name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Due date</label>
                <input
                  type="date"
                  className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] outline-none focus:border-[#4C9AFF] transition-all h-10 cursor-pointer"
                  value={task?.dueDate || ''}
                  onChange={(e) => handleUpdate({ dueDate: e.target.value || null })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Sprint</label>
                <div className="relative">
                  <select
                    className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] appearance-none outline-none focus:border-[#4C9AFF] transition-all cursor-pointer pr-10"
                    value={task?.sprint?.id || ''}
                    onChange={(e) => handleUpdate({ sprintId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">None</option>
                    {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
                </div>
              </div>

              {task?.issueType !== 'EPIC' && (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#172B4D]">Parent epic</label>
                  <div className="relative">
                    <select
                      className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] appearance-none outline-none focus:border-[#4C9AFF] transition-all cursor-pointer pr-10"
                      value={task?.parentTask?.id || ''}
                      onChange={(e) => handleUpdate({ parentId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">None</option>
                      {epics.length === 0 && task?.parentTask && (
                        <option value={task.parentTask.id}>{task.parentTask.title}</option>
                      )}
                      {epics.filter(e => e.id !== task?.id).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Priority</label>
                <div className="relative">
                  <select
                    className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] appearance-none outline-none focus:border-[#4C9AFF] transition-all cursor-pointer pr-10"
                    value={task?.priority || ''}
                    onChange={(e) => handleUpdate({ priority: e.target.value })}
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#172B4D]">Story points</label>
                <input
                  type="number"
                  className="w-full p-2.5 bg-white border-2 border-[#DFE1E6] rounded-[3px] text-sm font-black text-[#172B4D] outline-none focus:border-[#4C9AFF] transition-all"
                  value={task?.storyPoints === null || task?.storyPoints === undefined || (task?.storyPoints as any) === '' ? '' : task.storyPoints}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTask(prev => prev ? { ...prev, storyPoints: val === '' ? '' as any : Number(val) } : null);
                  }}
                  onBlur={() => handleUpdate({ storyPoints: (task?.storyPoints as any) === '' || task?.storyPoints === undefined || task?.storyPoints === null ? 0 : Number(task.storyPoints) })}
                />
              </div>
            </div>

            {/* Time Tracking Section */}
            <div className="pt-6 border-t border-[#DFE1E6] space-y-4">
              <label className="text-[13px] font-bold text-[#172B4D] block">Time tracking</label>

              <div className="space-y-3 bg-white border border-[#DFE1E6] p-4 rounded-[3px] shadow-sm">
                {/* Original Estimate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6B778C]">Original Estimate</span>
                    <input
                      type="text"
                      className="w-24 px-2 py-1 text-right text-xs font-bold border-b border-[#DFE1E6] hover:border-[#1F6FEB] focus:border-[#1F6FEB] focus:outline-none transition-all"
                      placeholder="e.g. 2d 8h"
                      value={task?.originalEstimate || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTask(prev => prev ? { ...prev, originalEstimate: val } : null);
                      }}
                      onBlur={() => handleUpdate({ originalEstimate: task?.originalEstimate || '' })}
                    />
                  </div>
                </div>

                {/* Time Spent & Remaining */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <span className="text-[#6B778C] block mb-1">Time Spent</span>
                    <span className="text-[#172B4D]">{formatTime(task?.timeSpentSeconds || 0)}</span>
                  </div>
                  <div>
                    <span className="text-[#6B778C] block mb-1">Remaining Estimate</span>
                    <span className="text-[#172B4D]">{formatTime(task?.remainingEstimateSeconds || 0)}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-2">
                  <div className="w-full h-2 bg-[#EBECF0] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#36B37E] transition-all duration-500 shadow-sm"
                      style={{ width: `${getProgressPercentage()}%` }}
                      title={`${getProgressPercentage()}% Spent`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-[#6B778C]">
                    <span>{getProgressPercentage()}% logged</span>
                    <span>{formatTime(task?.remainingEstimateSeconds || 0)} remaining</span>
                  </div>
                </div>

                {/* Log Work Button */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
                      setIsLogWorkOpen(true);
                    }}
                    className="w-full py-2 bg-[#FAFBFC] hover:bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] text-xs font-bold text-[#42526E] hover:text-[#172B4D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Clock size={12} />
                    Log Work
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-[#DFE1E6] space-y-6">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-[#172B4D]">Labels</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(task?.tags || []).filter(t => t !== '_link').map((tag, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EBECF0] text-[11px] font-black text-[#172B4D] rounded-[3px] border border-[#DFE1E6]">
                      {tag}
                      <X size={12} className="cursor-pointer hover:text-[#DE350B] transition-colors" onClick={() => handleRemoveTag(tag)} />
                    </span>
                  ))}
                  <input
                    className="text-[11px] font-bold outline-none bg-transparent py-1 px-2 focus:bg-white rounded transition-colors"
                    placeholder="+ Add Label"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleAddTag}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 text-[11px] font-bold text-[#6B778C] uppercase tracking-wider">
                <div className="flex justify-between items-center bg-[#F4F5F7] p-3 rounded-[3px]">
                  <span>Created</span>
                  <span className="text-[#172B4D]">{task?.createdAt ? new Date(task.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-3">
                  <span>Due Date</span>
                  <span className="text-[#172B4D]">{task?.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center bg-[#F4F5F7]/50 p-3 rounded-[3px]">
                  <span>Last Updated</span>
                  <span className="text-[#172B4D]">{task?.updatedAt ? new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleSaveAndClose}
                className="w-full py-3 bg-[#172B4D] text-white rounded-[3px] text-sm font-black hover:bg-black transition-all shadow-lg active:scale-95"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const blobUrls = Array.from(files).map(f => {
              const url = URL.createObjectURL(f);
              return `${url}#${encodeURIComponent(f.name)}`;
            });
            handleUpdate({ attachments: [...(task?.attachments || []), ...blobUrls] });
            addNotification('Success', `${files.length} file(s) attached. Click to preview.`, 'success');
          }
          e.target.value = '';
        }}
      />

      {isCreateSubtaskOpen && (
        <CreateIssueModal
          isOpen={isCreateSubtaskOpen}
          onClose={() => setIsCreateSubtaskOpen(false)}
          projectId={projectId}
          initialParentId={currentTaskId}
          initialSprintId={task?.sprintId || (task?.sprint ? task.sprint.id : null)}
          onSuccess={() => {
            setIsCreateSubtaskOpen(false);
            fetchTaskData();
            if (onUpdate && task) onUpdate(task);
          }}
        />
      )}
      {isLogWorkOpen && (
        <div className="fixed inset-0 bg-[#091E42]/50 z-[2500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3px] shadow-2xl overflow-hidden flex flex-col font-sans border border-[#DFE1E6] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-[#DFE1E6]">
              <h3 className="text-md font-bold text-[#172B4D]">
                {logWorkForm.id ? 'Edit Work Log' : 'Log Work'}
              </h3>
              <button
                onClick={() => {
                  setIsLogWorkOpen(false);
                  setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
                }}
                className="text-[#42526E] hover:text-[#DE350B] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-[#44546F]">Time Spent <span className="text-[#DE350B]">*</span></label>
                <input
                  type="text"
                  className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] outline-none hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF]"
                  placeholder="e.g. 2h 30m, 1d"
                  value={logWorkForm.timeSpent}
                  onChange={e => setLogWorkForm({ ...logWorkForm, timeSpent: e.target.value })}
                />
                <span className="text-[10px] text-[#6B778C] block">Use format: 2d (days), 3h (hours), 30m (minutes). E.g., 8h, 2d 4h 30m.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-[#44546F]">Work Date <span className="text-[#DE350B]">*</span></label>
                <input
                  type="date"
                  className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] outline-none hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF]"
                  value={logWorkForm.workDate}
                  onChange={e => setLogWorkForm({ ...logWorkForm, workDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-[#44546F]">Comment</label>
                <textarea
                  className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] text-sm text-[#172B4D] outline-none hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF]"
                  rows={3}
                  placeholder="What did you work on?"
                  value={logWorkForm.comment}
                  onChange={e => setLogWorkForm({ ...logWorkForm, comment: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1E6]">
              <button
                onClick={handleLogWorkSubmit}
                className="bg-[#1F6FEB] hover:bg-[#003484] text-white px-4 py-2 rounded-[3px] text-xs font-bold transition-all cursor-pointer"
              >
                {logWorkForm.id ? 'Save Changes' : 'Log'}
              </button>
              <button
                onClick={() => {
                  setIsLogWorkOpen(false);
                  setLogWorkForm({ id: undefined, timeSpent: '', workDate: new Date().toISOString().split('T')[0], comment: '' });
                }}
                className="text-[#42526E] hover:bg-[#EBECF0] px-4 py-2 rounded-[3px] text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {hoveredTask && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredTask.x}px`,
            top: `${hoveredTask.y}px`,
            transform: hoveredTask.y > 100 ? 'translate(12px, -100%)' : 'translate(12px, 15px)',
            zIndex: 999999,
          }}
          className="bg-[#172B4D] text-white text-[12px] px-3 py-2 rounded shadow-2xl pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95 max-w-[320px] break-words border border-[#44546F]"
        >
          <div className="font-bold text-[#4C9AFF] mb-0.5">{hoveredTask.code}</div>
          <div className="font-semibold leading-normal">{hoveredTask.title}</div>
        </div>
      )}
    </>
  );

  if (isInline) {
    return modalContent;
  }

  return createPortal(
    <div className="fixed inset-0 bg-[#091E42]/50 z-[2000] flex items-center justify-center p-4">
      {modalContent}
    </div>,
    document.body
  );
};

export default TaskDetailModal;

