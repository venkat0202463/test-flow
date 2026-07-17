import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, ChevronDown, Users, Search, Check, Plus, List, ListOrdered, Smile, Paperclip, Trash2, Download, ExternalLink, Bug, Bookmark, CheckSquare } from 'lucide-react';
import api from '../services/api';
import type { Project, Task, User as UserType, Sprint, Version } from '../types';
import RichTextEditor from './RichTextEditor';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import DOMPurify from 'dompurify';

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

const mdToHtml = (md: string) => {
  if (!md) return '';
  let html = md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');

  const lines = html.split('\n');
  let inList = false;
  let listType = '';
  let listHtml = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        if (inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
        listHtml.push('<ul style="list-style-type: disc; padding-left: 20px; margin-bottom: 8px;">');
        inList = true;
        listType = 'ul';
      }
      listHtml.push(`<li>${trimmed.substring(2)}</li>`);
    } else if (trimmed.match(/^\d+\. /)) {
      if (!inList || listType !== 'ol') {
        if (inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
        listHtml.push('<ol style="list-style-type: decimal; padding-left: 20px; margin-bottom: 8px;">');
        inList = true;
        listType = 'ol';
      }
      listHtml.push(`<li>${trimmed.replace(/^\d+\. /, '')}</li>`);
    } else {
      if (inList) {
        listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
      }
      listHtml.push(line + '<br>');
    }
  }
  if (inList) listHtml.push(listType === 'ul' ? '</ul>' : '</ol>');
  return DOMPurify.sanitize(listHtml.join(''));
};

const htmlToMd = (html: string) => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  let md = '';
  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      switch (el.tagName) {
        case 'STRONG':
        case 'B':
          md += '**';
          Array.from(el.childNodes).forEach(processNode);
          md += '**';
          break;
        case 'EM':
        case 'I':
          md += '_';
          Array.from(el.childNodes).forEach(processNode);
          md += '_';
          break;
        case 'UL':
          Array.from(el.childNodes).forEach(child => {
            if ((child as HTMLElement).tagName === 'LI') {
              md += '\n* ';
              Array.from(child.childNodes).forEach(processNode);
            }
          });
          md += '\n';
          break;
        case 'OL': {
          let i = 1;
          Array.from(el.childNodes).forEach(child => {
            if ((child as HTMLElement).tagName === 'LI') {
              md += `\n${i++}. `;
              Array.from(child.childNodes).forEach(processNode);
            }
          });
          md += '\n';
          break;
        }
        case 'LI':
          Array.from(el.childNodes).forEach(processNode);
          break;
        case 'BR':
          md += '\n';
          break;
        case 'DIV':
        case 'P':
          md += '\n';
          Array.from(el.childNodes).forEach(processNode);
          md += '\n';
          break;
        default:
          Array.from(el.childNodes).forEach(processNode);
      }
    }
  };

  Array.from(temp.childNodes).forEach(processNode);
  return md.replace(/\n{3,}/g, '\n\n').trim();
};

interface CreateIssueModalProps {
  projectId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: Task, shouldView?: boolean) => void;
  initialSprintId?: number | null;
  initialStatus?: string | null;
  initialColumnId?: number | null;
  initialIssueType?: string | null;
  initialParentId?: number | null;
}

const CreateIssueModal = ({ projectId, isOpen, onClose, onSuccess, initialSprintId = null, initialStatus = null, initialColumnId = null, initialIssueType = null, initialParentId = null }: CreateIssueModalProps) => {
  const { addNotification } = useNotifications();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [users, setUsers] = useState<UserType[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Task[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<number | undefined>(projectId);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isCoAssigneeOpen, setIsCoAssigneeOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isEpicTypeOpen, setIsEpicTypeOpen] = useState(false);
  const [isParentEpicOpen, setIsParentEpicOpen] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  const [isEpicColorOpen, setIsEpicColorOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [isReporterOpen, setIsReporterOpen] = useState(false);
  const [isIssueTypeOpen, setIsIssueTypeOpen] = useState(false);
  const [isParentTaskOpen, setIsParentTaskOpen] = useState(false);


  const closeAllDropdowns = () => {
    setIsProjectOpen(false);
    setIsAssigneeOpen(false);
    setIsCoAssigneeOpen(false);
    setIsPriorityOpen(false);
    setIsEpicTypeOpen(false);
    setIsParentEpicOpen(false);
    setIsLabelsOpen(false);
    setIsEpicColorOpen(false);
    setIsEmojiOpen(false);
    setIsSprintOpen(false);
    setIsReporterOpen(false);
    setIsIssueTypeOpen(false);
    setIsParentTaskOpen(false);
    setAssigneeFocusIndex(-1);
    setCoAssigneeFocusIndex(-1);
    setLabelsSearchTerm('');
  };

  const toggleDropdown = (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    if (!current) closeAllDropdowns();
    setter(!current);
  };

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  const [searchTerm, setSearchTerm] = useState('');
  const [labelsSearchTerm, setLabelsSearchTerm] = useState('');
  const [coAssigneeSearchTerm, setCoAssigneeSearchTerm] = useState('');
  const [assigneeFocusIndex, setAssigneeFocusIndex] = useState(-1);
  const [coAssigneeFocusIndex, setCoAssigneeFocusIndex] = useState(-1);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issueType: initialIssueType || 'TASK',
    priority: 'LOW',
    assigneeId: '',
    coAssigneeId: '',
    sprintId: initialSprintId || '',
    storyPoints: 0,
    dueDate: '',
    labels: '',
    attachments: [] as string[],
    status: initialStatus || 'Todo',
    columnId: initialColumnId || null,
    parentId: initialParentId || null,
    reporterId: currentUser.id || '',
    epicColor: '#6554C0',
    epicType: 'Standard',
    startDate: '',
    originalEstimate: ''
  });

  const currentProject = projects.find(p => p.id === Number(activeProjectId));
  const isKanban = (currentProject?.projectType || currentProject?.type || '').toUpperCase().trim() === 'KANBAN';
  const handleCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      const updatedMd = htmlToMd(editorRef.current.innerHTML);
      setFormData(prev => ({ ...prev, description: updatedMd }));
    }
  };

  const insertEmoji = (emoji: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, emoji);
      const updatedMd = htmlToMd(editorRef.current.innerHTML);
      setFormData(prev => ({ ...prev, description: updatedMd }));
      setIsEmojiOpen(false);
    }
  };

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (htmlToMd(editorRef.current.innerHTML) !== formData.description) {
        editorRef.current.innerHTML = mdToHtml(formData.description);
      }
    }
  }, [formData.description]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers(projectId); // Fetch users for the current project context

      if (projectId) {
        setActiveProjectId(projectId);
        fetchData(projectId, true);
      } else {
        fetchAllProjectsAndDefault();
      }

      setFormData({
        title: '',
        description: '',
        issueType: initialIssueType || 'TASK',
        priority: 'LOW',
        assigneeId: '',
        coAssigneeId: '',
        sprintId: initialSprintId || '',
        storyPoints: 0,
        dueDate: '',
        labels: '',
        attachments: [],
        status: initialStatus || 'Todo',
        columnId: initialColumnId || null,
        parentId: initialParentId || null,
        reporterId: currentUser.id || '',
        epicColor: '#6554C0',
        epicType: 'Standard',
        startDate: '',
        originalEstimate: ''
      });

      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPreviewUrl(null);
      setSearchTerm('');
      setCoAssigneeSearchTerm('');
      closeAllDropdowns();
    }
  }, [isOpen, initialSprintId, initialStatus, initialColumnId, initialIssueType, initialParentId, projectId]);

  const fetchUsers = async (pid?: number) => {
    try {
      const res = await api.get(`/auth/users${pid ? `?projectId=${pid}` : ''}`);
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchAllProjectsAndDefault = async () => {
    setIsFetchingProjects(true);
    try {
      const projectsRes = await api.get('/projects');
      setProjects(projectsRes.data);
      if (projectsRes.data.length > 0) {
        const firstId = projectsRes.data[0].id;
        setActiveProjectId(firstId);
        fetchData(firstId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const fetchData = async (pid: number, forceFetchProjects = false) => {
    try {
      const [sprintsRes, tasksRes] = await Promise.all([
        api.get(`/projects/${pid}/sprints`),
        api.get(`/tasks?projectId=${pid}`)
      ]);
      const sprintsData = sprintsRes.data || [];
      setSprints(sprintsData);
      setEpics((tasksRes.data || []).filter((t: any) => t.issueType === 'EPIC'));
      setTasks((tasksRes.data || []).filter((t: any) => t.issueType === 'STORY' || t.issueType === 'TASK'));

      // Auto-select the active sprint if no sprint is currently selected
      const activeSprint = sprintsData.find((s: any) => s.status?.toUpperCase() === 'ACTIVE');
      if (activeSprint) {
        setFormData(prev => {
          if (!prev.sprintId) {
            return { ...prev, sprintId: String(activeSprint.id) };
          }
          return prev;
        });
      }

      // If we don't have projects yet (e.g. from projectId prop) or force-fetching, fetch them
      if (projects.length === 0 || forceFetchProjects) {
        const projectsRes = await api.get('/projects');
        setProjects(projectsRes.data);
      }
    } catch (err) { console.error(err); }
  };

  const handleProjectChange = (pid: number) => {
    setActiveProjectId(pid);
    setIsProjectOpen(false);
    setFormData(prev => ({ ...prev, sprintId: '' }));
    fetchData(pid);
    fetchUsers(pid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeProjectId || projects.length === 0 || !projects.find(p => p.id === activeProjectId)) {
      addNotification('Error', 'Project is mandatory', 'error');
      return;
    }

    if (!formData.title.trim()) return;

    if (!formData.startDate || !formData.dueDate) {
      addNotification('Error', 'Start date and due date are mandatory fields', 'error');
      return;
    }

    if (new Date(formData.dueDate) < new Date(formData.startDate)) {
      addNotification('Error', 'Due date cannot be before start date', 'error');
      return;
    }

    if (formData.originalEstimate) {
      const estimateTrimmed = formData.originalEstimate.trim().toLowerCase();
      const hoursMatch = estimateTrimmed.match(/(\d+)h/);
      const minutesMatch = estimateTrimmed.match(/(\d+)m/);
      
      if (hoursMatch && parseInt(hoursMatch[1], 10) >= 24) {
        addNotification('Error', 'Hours must be less than 24', 'error');
        return;
      }
      if (minutesMatch && parseInt(minutesMatch[1], 10) >= 60) {
        addNotification('Error', 'Minutes must be less than 60', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.post('/tasks', {
        task: {
          title: formData.title,
          description: formData.description,
          issueType: formData.issueType,
          priority: formData.priority,
          storyPoints: (formData.storyPoints as any) === '' || formData.storyPoints === undefined || formData.storyPoints === null ? 0 : Number(formData.storyPoints),
          tags: formData.labels.split(',').map(s => s.trim()).filter(s => s),
          attachments: formData.attachments,
          status: formData.status || 'Todo',
          columnId: formData.columnId,
          environment: isKanban ? 'BOARD' : (formData.sprintId ? 'SPRINT' : 'BACKLOG'),
          epicColor: formData.epicColor,
          startDate: formData.startDate || null,
          dueDate: formData.dueDate || null,
          originalEstimate: formData.originalEstimate || null
        },
        projectId: activeProjectId,
        assigneeId: formData.assigneeId ? Number(formData.assigneeId) : null,
        coAssigneeId: formData.coAssigneeId ? Number(formData.coAssigneeId) : null,
        reporterId: formData.reporterId ? Number(formData.reporterId) : null,
        sprintId: formData.sprintId ? Number(formData.sprintId) : null,
        parentId: formData.parentId ? Number(formData.parentId) : null
      });
      const isPendingApproval = res.data?.status === 'Pending PM Review';
      const successMessage = isPendingApproval
        ? 'Task created successfully and sent for Manager Approval.'
        : `${formData.issueType === 'EPIC' ? 'Epic' : 'Task'} created`;
      addNotification('Success', successMessage, 'success');
      onSuccess(res.data, false);
      onClose();

      setFormData({
        title: '',
        description: '',
        issueType: 'TASK',
        priority: 'LOW',
        assigneeId: '',
        coAssigneeId: '',
        sprintId: '',
        storyPoints: 0,
        dueDate: '',
        labels: '',
        attachments: [],
        status: 'Todo',
        columnId: null,
        parentId: null,
        reporterId: currentUser.id || '',
        epicColor: '#6554C0',
        epicType: 'Standard',
        startDate: '',
        originalEstimate: ''
      });
      if (editorRef.current) editorRef.current.innerHTML = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      addNotification('Error', 'Failed to create task', 'error');
    } finally {
      setLoading(false);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (modalRef.current && !modalRef.current.contains(target)) return;

      if (!(target as HTMLElement).closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredEpics = epics.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAssignees = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCoAssignees = users.filter(u =>
    u.name.toLowerCase().includes(coAssigneeSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(coAssigneeSearchTerm.toLowerCase())
  );
  const selectedParentEpic = epics.find(e => e.id === Number(formData.parentId));
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="fixed inset-0 bg-[#091E42]/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3px] shadow-2xl overflow-hidden flex flex-col font-sans max-h-[90vh]" ref={modalRef}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-white shrink-0">
          <h2 className="text-[20px] font-semibold text-[#172B4D]">Create {formData.issueType.toLowerCase()}</h2>
          <div className="flex items-center gap-4 text-[#42526E]">
            <button type="button" onClick={onClose} className="hover:bg-[#F4F5F7] p-1 rounded transition-colors"><X size={20} /></button>
          </div>
        </div>

        {/* Body */}
        <form id="create-issue-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          <div className="space-y-1 dropdown-container relative">
            <label className="text-[12px] font-bold text-[#44546F]">Project <span className="text-[#DE350B]">*</span></label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsProjectOpen, isProjectOpen); }}
                className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] bg-[#F4F5F7] text-sm text-[#172B4D] font-medium flex items-center gap-2 hover:bg-[#EBECF0] transition-colors h-10"
              >
                <div className="w-5 h-5 bg-[#0B3D91] rounded-[2px] flex items-center justify-center shrink-0 shadow-sm">
                  <Zap size={12} className="text-white" fill="white" />
                </div>
                {activeProject?.name || (isFetchingProjects ? 'Loading project...' : 'No projects assigned')}
                <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isProjectOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProjectOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2100] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                  {projects.length > 0 ? projects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProjectChange(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] transition-colors flex items-center gap-2 ${p.id === activeProjectId ? 'bg-[#E9F2FF] text-[#1F6FEB] font-bold' : 'text-[#172B4D]'}`}
                    >
                      <div className="w-4 h-4 bg-[#0B3D91] rounded-[1px] flex items-center justify-center shrink-0">
                        <Zap size={10} className="text-white" fill="white" />
                      </div>
                      {p.name}
                    </button>
                  )) : (
                    <div className="px-3 py-3 text-sm text-[#5E6C84] text-center italic">
                      No projects available
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Issue Type Selector */}
          <div className="space-y-1 dropdown-container relative">
            <label className="text-[12px] font-bold text-[#44546F]">Issue Type <span className="text-[#DE350B]">*</span></label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsIssueTypeOpen, isIssueTypeOpen); }}
                className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] bg-white text-sm text-[#172B4D] font-medium flex items-center gap-2 hover:bg-[#F4F5F7] transition-colors h-10 cursor-pointer"
              >
                {formData.issueType === 'BUG' ? (
                  <Bug size={16} className="text-[#FF5630] shrink-0" />
                ) : formData.issueType === 'EPIC' ? (
                  <Zap size={16} className="text-[#6554C0] shrink-0" />
                ) : formData.issueType === 'STORY' ? (
                  <Bookmark size={16} className="text-[#36B37E] shrink-0" />
                ) : (
                  <CheckSquare size={16} className="text-[#4C9AFF] shrink-0" />
                )}
                <span className="capitalize">{formData.issueType.toLowerCase()}</span>
                <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isIssueTypeOpen ? 'rotate-180' : ''}`} />
              </button>

              {isIssueTypeOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2100] py-1 animate-in fade-in slide-in-from-top-1 duration-200">
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
                        setFormData(prev => ({ ...prev, issueType: type.value }));
                        setIsIssueTypeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] transition-colors flex items-center gap-2 cursor-pointer ${formData.issueType === type.value ? 'bg-[#E9F2FF] text-[#1F6FEB] font-bold' : 'text-[#172B4D]'}`}
                    >
                      <type.icon size={14} className={`${type.color} shrink-0`} />
                      {type.label}
                      {formData.issueType === type.value && <Check size={14} className="ml-auto text-[#1F6FEB]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-bold text-[#44546F]">{formData.issueType === 'EPIC' ? 'Epic name' : 'Summary'} <span className="text-[#DE350B]">*</span></label>
            <input
              autoFocus
              required
              maxLength={255}
              placeholder={formData.issueType === 'EPIC' ? 'Enter epic name' : 'What needs to be done?'}
              className="w-full p-2.5 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
            <div className="text-right text-[11px] text-[#5E6C84] mt-1">
              {formData.title.length}/255
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[12px] font-bold text-[#44546F]">Description</label>
              <RichTextEditor
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                placeholder="Add a description..."
                draftKey={`create_issue_${activeProjectId}`}
                projectId={activeProjectId}
              />
              {formData.attachments.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {formData.attachments.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => setPreviewUrl(file)}
                      className="relative group w-20 h-20 rounded-[4px] border-2 border-[#DFE1E6] hover:border-[#1F6FEB] overflow-hidden bg-[#F4F5F7] flex items-center justify-center shadow-sm cursor-pointer transition-all duration-200"
                    >
                      {file.startsWith('blob:') || file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={cleanUrl(file)} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <Paperclip size={24} className="text-[#42526E]" />
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all opacity-90 z-10 hover:scale-110"
                        title="Remove attachment"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <style>{`
                      .prose ul { list-style-type: disc !important; padding-left: 20px !important; margin-top: 8px !important; }
                      .prose ol { list-style-type: decimal !important; padding-left: 20px !important; margin-top: 8px !important; }
                      .prose li { display: list-item !important; margin-bottom: 4px !important; }
                      .editor-placeholder:empty:before { content: attr(data-placeholder); color: #A5ADBA; pointer-events: none; display: block; }
                   `}</style>
            </div>

            {formData.issueType === 'BUG' && (
              <div className="space-y-1 dropdown-container relative">
                <label className="text-[12px] font-bold text-[#44546F]">Link To (Story/Task) <span className="text-[#DE350B]">*</span></label>
                <div className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsParentTaskOpen, isParentTaskOpen); }} className="w-full p-2 border-2 border-[#DFE1E6] rounded-[3px] bg-white text-sm text-[#172B4D] font-medium flex items-center gap-2 hover:bg-[#F4F5F7] transition-all h-10">
                    {formData.parentId ? (() => {
                      const t = tasks.find(x => x.id === Number(formData.parentId));
                      return t ? `${t.issueType === 'STORY' ? 'Story' : 'Task'} - ${t.title}` : 'Select Story/Task';
                    })() : 'Select Story/Task'}
                    <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isParentTaskOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isParentTaskOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2200] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                      {tasks.length > 0 ? tasks.map(t => (
                        <button key={t.id} type="button" onClick={() => { setFormData({ ...formData, parentId: t.id }); setIsParentTaskOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2 ${Number(formData.parentId) === t.id ? 'bg-[#E9F2FF] text-[#1F6FEB] font-bold' : 'text-[#172B4D]'}`}>
                          <div className="flex items-center justify-center w-4 h-4">
                            {t.issueType === 'STORY' ? <Bookmark size={12} className="text-[#36B37E]" /> : <CheckSquare size={12} className="text-[#4C9AFF]" />}
                          </div>
                          {t.title}
                          {Number(formData.parentId) === t.id && <Check size={14} className="ml-auto text-[#1F6FEB]" />}
                        </button>
                      )) : (
                        <div className="px-3 py-3 text-sm text-[#5E6C84] text-center italic">No stories or tasks available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.issueType === 'EPIC' && (
              <div className="space-y-1 dropdown-container relative">
                <label className="text-[12px] font-bold text-[#44546F]">Epic color</label>
                <div className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsEpicColorOpen, isEpicColorOpen); }} className="w-16 h-10 border-2 border-[#DFE1E6] rounded-[3px] flex items-center justify-center gap-2 hover:bg-[#F4F5F7] transition-all"><div className="w-5 h-5 rounded-[2px]" style={{ backgroundColor: formData.epicColor }} /><ChevronDown size={12} className="text-[#42526E]" /></button>
                  {isEpicColorOpen && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2200] grid grid-cols-4 gap-2">
                      {['#6554C0', '#36B37E', '#FF991F', '#E54937', '#1F6FEB', '#00B3A4', '#7A869A', '#DE350B'].map(c => (
                        <button key={c} type="button" onClick={() => { setFormData({ ...formData, epicColor: c }); setIsEpicColorOpen(false); }} className="w-6 h-6 rounded-[2px] hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Attributes Grid */}
          <div className="pt-6 border-t border-[#DFE1E6] grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1 dropdown-container relative">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-[#44546F]">{formData.issueType === 'EPIC' ? 'Epic type' : 'Assignee'}</label>
                {formData.issueType !== 'EPIC' && authUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, assigneeId: String(authUser.id) });
                      setIsAssigneeOpen(false);
                    }}
                    className="text-[10px] font-bold text-[#1F6FEB] hover:underline cursor-pointer"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              {formData.issueType === 'EPIC' ? (
                <div className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsEpicTypeOpen, isEpicTypeOpen); }} className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] bg-white text-sm text-[#172B4D] font-medium flex items-center gap-2 h-10 transition-all"><div className="w-5 h-5 rounded-[2px] flex items-center justify-center" style={{ backgroundColor: formData.epicColor }}><Zap size={10} fill="white" className="text-white" /></div>{formData.epicType}<ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isEpicTypeOpen ? 'rotate-180' : ''}`} /></button>
                  {isEpicTypeOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-xl z-[2100] py-1">
                      {['Standard', 'Strategic', 'Operational'].map(type => (
                        <button key={type} type="button" onClick={() => { setFormData({ ...formData, epicType: type }); setIsEpicTypeOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2"><div className="w-5 h-5 rounded-[2px] flex items-center justify-center" style={{ backgroundColor: formData.epicColor }}><Zap size={10} fill="white" className="text-white" /></div>{type}{formData.epicType === type && <Check size={14} className="ml-auto text-[#1F6FEB]" />}</button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {isAssigneeOpen || !formData.assigneeId ? (
                    <div className="relative w-full flex items-center">
                      <Search size={14} className="absolute left-3 text-[#5E6C84]" />
                      <input
                        autoFocus={isAssigneeOpen}
                        type="text"
                        placeholder="Search assignee..."
                        className="w-full pl-9 pr-8 py-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10 font-medium"
                        value={searchTerm}
                        onChange={e => {
                          setSearchTerm(e.target.value);
                          setAssigneeFocusIndex(-1);
                          if (!isAssigneeOpen) {
                            closeAllDropdowns();
                            setIsAssigneeOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (!isAssigneeOpen) {
                            closeAllDropdowns();
                            setIsAssigneeOpen(true);
                            setAssigneeFocusIndex(-1);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isAssigneeOpen) {
                            closeAllDropdowns();
                            setIsAssigneeOpen(true);
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
                              setFormData({ ...formData, assigneeId: '' });
                              setIsAssigneeOpen(false);
                            } else if (assigneeFocusIndex > 0 && assigneeFocusIndex <= filteredAssignees.length) {
                              const selectedUser = filteredAssignees[assigneeFocusIndex - 1];
                              setFormData({ ...formData, assigneeId: String(selectedUser.id) });
                              setIsAssigneeOpen(false);
                            } else {
                              if (filteredAssignees.length > 0) {
                                setFormData({ ...formData, assigneeId: String(filteredAssignees[0].id) });
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
                        closeAllDropdowns();
                        setIsAssigneeOpen(true);
                        setSearchTerm('');
                        setAssigneeFocusIndex(-1);
                      }}
                      className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {users.find(u => u.id === Number(formData.assigneeId))?.name.charAt(0)}
                      </div>
                      <span className="font-medium">
                        {users.find(u => u.id === Number(formData.assigneeId))?.name}
                      </span>
                      <ChevronDown size={14} className="ml-auto text-[#42526E]" />
                    </button>
                  )}

                  {isAssigneeOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                        <button
                          type="button"
                          onClick={() => { setFormData({ ...formData, assigneeId: '' }); setIsAssigneeOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] border-2 rounded-[3px] transition-all ${assigneeFocusIndex === 0 ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                        >
                          Unassigned
                        </button>
                        {filteredAssignees.map((u, idx) => {
                          const optionIndex = idx + 1;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setFormData({ ...formData, assigneeId: String(u.id) }); setIsAssigneeOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex flex-col font-bold border-2 rounded-[3px] transition-all group ${assigneeFocusIndex === optionIndex ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                  {u.name.charAt(0)}
                                </div>
                                <span className="flex-1 truncate">{u.name}</span>
                                {formData.assigneeId === String(u.id) && <Check size={14} className="text-[#1F6FEB] shrink-0" />}
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
              )}
            </div>

            {formData.issueType !== 'EPIC' && (
              <div className="space-y-1 dropdown-container relative">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-[#44546F]">Co-Assignee (Partner)</label>
                </div>
                <div className="relative">
                  {isCoAssigneeOpen || !formData.coAssigneeId ? (
                    <div className="relative w-full flex items-center">
                      <Search size={14} className="absolute left-3 text-[#5E6C84]" />
                      <input
                        autoFocus={isCoAssigneeOpen}
                        type="text"
                        placeholder="Search co-assignee..."
                        className="w-full pl-9 pr-8 py-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10 font-medium"
                        value={coAssigneeSearchTerm}
                        onChange={e => {
                          setCoAssigneeSearchTerm(e.target.value);
                          setCoAssigneeFocusIndex(-1);
                          if (!isCoAssigneeOpen) {
                            closeAllDropdowns();
                            setIsCoAssigneeOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (!isCoAssigneeOpen) {
                            closeAllDropdowns();
                            setIsCoAssigneeOpen(true);
                            setCoAssigneeFocusIndex(-1);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCoAssigneeOpen) {
                            closeAllDropdowns();
                            setIsCoAssigneeOpen(true);
                            setCoAssigneeFocusIndex(-1);
                          }
                        }}
                        onKeyDown={e => {
                          const totalOptions = filteredCoAssignees.length + 1; // 1 for No Partner
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setCoAssigneeFocusIndex(prev => (prev + 1) % totalOptions);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setCoAssigneeFocusIndex(prev => (prev - 1 + totalOptions) % totalOptions);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (coAssigneeFocusIndex === 0) {
                              setFormData({ ...formData, coAssigneeId: '' });
                              setIsCoAssigneeOpen(false);
                            } else if (coAssigneeFocusIndex > 0 && coAssigneeFocusIndex <= filteredCoAssignees.length) {
                              const selectedUser = filteredCoAssignees[coAssigneeFocusIndex - 1];
                              setFormData({ ...formData, coAssigneeId: String(selectedUser.id) });
                              setIsCoAssigneeOpen(false);
                            } else {
                              if (filteredCoAssignees.length > 0) {
                                setFormData({ ...formData, coAssigneeId: String(filteredCoAssignees[0].id) });
                                setIsCoAssigneeOpen(false);
                              }
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsCoAssigneeOpen(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIsCoAssigneeOpen(!isCoAssigneeOpen);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] hover:text-[#172B4D] focus:outline-none z-10 flex items-center justify-center cursor-pointer"
                      >
                        <ChevronDown size={14} className={`transition-transform ${isCoAssigneeOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeAllDropdowns();
                        setIsCoAssigneeOpen(true);
                        setCoAssigneeSearchTerm('');
                        setCoAssigneeFocusIndex(-1);
                      }}
                      className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {users.find(u => u.id === Number(formData.coAssigneeId))?.name.charAt(0)}
                      </div>
                      <span className="font-medium">
                        {users.find(u => u.id === Number(formData.coAssigneeId))?.name}
                      </span>
                      <ChevronDown size={14} className="ml-auto text-[#42526E]" />
                    </button>
                  )}

                  {isCoAssigneeOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                        <button
                          type="button"
                          onClick={() => { setFormData({ ...formData, coAssigneeId: '' }); setIsCoAssigneeOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] border-2 rounded-[3px] transition-all ${coAssigneeFocusIndex === 0 ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                        >
                          No Partner / Co-Assignee
                        </button>
                        {filteredCoAssignees.map((u, idx) => {
                          const optionIndex = idx + 1;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setFormData({ ...formData, coAssigneeId: String(u.id) }); setIsCoAssigneeOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex flex-col font-bold border-2 rounded-[3px] transition-all group ${coAssigneeFocusIndex === optionIndex ? 'bg-[#DEEBFF]/30 border-[#4C9AFF]' : 'border-transparent'}`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                  {u.name.charAt(0)}
                                </div>
                                <span className="flex-1 truncate">{u.name}</span>
                                {formData.coAssigneeId === String(u.id) && <Check size={14} className="text-[#1F6FEB] shrink-0" />}
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
                        {filteredCoAssignees.length === 0 && (
                          <div className="px-3 py-3 text-sm text-[#5E6C84] text-center italic">
                            No matching users
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1 dropdown-container relative">
              <label className="text-[12px] font-bold text-[#44546F]">Priority</label>
              <div className="relative">
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsPriorityOpen, isPriorityOpen); }} className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10"><div className={`w-2 h-2 rounded-full ${formData.priority === 'HIGH' ? 'bg-[#DE350B]' : formData.priority === 'MEDIUM' ? 'bg-[#FF991F]' : 'bg-[#00875A]'}`} /><span className="font-medium">{formData.priority}</span><ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isPriorityOpen ? 'rotate-180' : ''}`} /></button>
                {isPriorityOpen && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] py-1">
                    {['HIGH', 'MEDIUM', 'LOW'].map(p => (
                      <button key={p} type="button" onClick={() => { setFormData({ ...formData, priority: p }); setIsPriorityOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${p === 'HIGH' ? 'bg-[#DE350B]' : p === 'MEDIUM' ? 'bg-[#FF991F]' : p === 'LOW' ? 'bg-[#00875A]' : 'bg-[#00875A]'}`} />{p}{formData.priority === p && <Check size={14} className="ml-auto text-[#1F6FEB]" />}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 dropdown-container relative">
              <label className="text-[12px] font-bold text-[#44546F]">Reporter <span className="text-[#DE350B]">*</span></label>
              <div className="relative">
                <button
                  type="button"
                  disabled={true}
                  className="w-full p-2 border-2 border-[#DFE1E6] bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 transition-all h-10 cursor-not-allowed opacity-80"
                >{formData.reporterId ? (<div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold shrink-0">{users.find(u => u.id === Number(formData.reporterId))?.name.charAt(0)}</div>) : (<Users size={14} className="text-[#5E6C84]" />)}<span className="font-medium">{users.find(u => u.id === Number(formData.reporterId))?.name || 'Select Reporter'}</span><ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isReporterOpen ? 'rotate-180' : ''}`} /></button>
                {isReporterOpen && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] max-h-48 overflow-y-auto custom-scrollbar">
                    {users.map(u => (
                      <button key={u.id} type="button" onClick={() => { setFormData({ ...formData, reporterId: String(u.id) }); setIsReporterOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-[9px] font-bold">{u.name.charAt(0)}</div>{u.name}{formData.reporterId === String(u.id) && <Check size={14} className="ml-auto text-[#1F6FEB]" />}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {formData.issueType !== 'EPIC' && (
              <div className="space-y-1 dropdown-container relative">
                <label className="text-[12px] font-bold text-[#44546F]">Epic</label>
                <div className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsParentEpicOpen, isParentEpicOpen); setSearchTerm(''); }} className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10 font-medium">
                    {selectedParentEpic ? (<div className="flex items-center gap-2"><div className="w-4 h-4 bg-[#6554C0] rounded-[1px] flex items-center justify-center shrink-0"><Zap size={10} fill="white" className="text-white" /></div><span>{selectedParentEpic.title}</span></div>) : (<span className="text-[#A5ADBA]">Select epic</span>)}
                    <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isParentEpicOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isParentEpicOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-[#DFE1E6]"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" /><input autoFocus type="text" placeholder="Search epics..." className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#388BFF] rounded-[3px] outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClick={e => e.stopPropagation()} /></div></div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar py-1"><button type="button" onClick={() => { setFormData({ ...formData, parentId: null }); setIsParentEpicOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7]">None</button>
                        {filteredEpics.map(e => (
                          <button key={e.id} type="button" onClick={() => { setFormData({ ...formData, parentId: e.id }); setIsParentEpicOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2"><div className="w-4 h-4 bg-[#6554C0] rounded-[1px] flex items-center justify-center shrink-0"><Zap size={10} fill="white" className="text-white" /></div><span className="truncate">{e.title}</span>{formData.parentId === e.id && <Check size={14} className="ml-auto text-[#1F6FEB]" />}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.issueType !== 'EPIC' && (
              <div className="space-y-1 dropdown-container relative">
                <label className="text-[12px] font-bold text-[#44546F]">Sprint</label>
                <div className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsSprintOpen, isSprintOpen); }} className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10 font-medium">
                    <span className={formData.sprintId ? 'text-[#172B4D]' : 'text-[#A5ADBA]'}>{sprints.find(s => s.id === Number(formData.sprintId))?.name || 'No Sprint'}</span>
                    <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isSprintOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isSprintOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] py-1 max-h-48 overflow-y-auto custom-scrollbar">
                      <button type="button" onClick={() => { setFormData({ ...formData, sprintId: '' }); setIsSprintOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7]">No Sprint</button>
                      {sprints.map(s => (
                        <button key={s.id} type="button" onClick={() => { setFormData({ ...formData, sprintId: String(s.id) }); setIsSprintOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center justify-center gap-2 justify-start">{s.name}{formData.sprintId === String(s.id) && <Check size={14} className="ml-auto text-[#1F6FEB]" />}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1 dropdown-container relative">
              <label className="text-[12px] font-bold text-[#44546F]">Labels</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleDropdown(setIsLabelsOpen, isLabelsOpen); }}
                  className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-sm text-[#172B4D] flex items-center gap-2 bg-white transition-all h-10 font-medium"
                >
                  {formData.labels ? (
                    <div className="flex flex-wrap gap-1">
                      {formData.labels.split(',').map(l => l.trim()).filter(Boolean).map(l => (
                        <span
                          key={l}
                          className="px-1.5 py-0.5 bg-[#EBECF0] text-[#44546F] text-[11px] rounded-[3px] font-bold uppercase flex items-center gap-1"
                        >
                          {l}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = formData.labels ? formData.labels.split(',').map(tag => tag.trim()).filter(Boolean) : [];
                              const updated = current.filter(tag => tag !== l);
                              setFormData({ ...formData, labels: updated.join(', ') });
                            }}
                            className="cursor-pointer text-[#6B778C] hover:text-[#DE350B] font-bold ml-1 text-xs"
                          >
                            &times;
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#A5ADBA]">Select or create labels</span>
                  )}
                  <ChevronDown size={14} className={`ml-auto text-[#42526E] transition-transform ${isLabelsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLabelsOpen && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#DFE1E6] rounded-[3px] shadow-2xl z-[2100] flex flex-col">
                    <div className="p-2 border-b border-[#DFE1E6]">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Find labels..."
                        className="w-full px-3 py-1.5 text-sm border border-[#388BFF] rounded-[3px] outline-none"
                        value={labelsSearchTerm}
                        onChange={e => setLabelsSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && labelsSearchTerm.trim()) {
                            e.preventDefault();
                            const current = formData.labels ? formData.labels.split(',').map(l => l.trim()).filter(Boolean) : [];
                            if (!current.includes(labelsSearchTerm.trim())) {
                              setFormData({ ...formData, labels: [...current, labelsSearchTerm.trim()].join(', ') });
                            }
                            setLabelsSearchTerm('');
                          }
                        }}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                      {labelsSearchTerm.trim() && !(formData.labels ? formData.labels.split(',').map(l => l.trim()).includes(labelsSearchTerm.trim()) : false) && (
                        <button
                          type="button"
                          onClick={() => {
                            const current = formData.labels ? formData.labels.split(',').map(l => l.trim()).filter(Boolean) : [];
                            setFormData({ ...formData, labels: [...current, labelsSearchTerm.trim()].join(', ') });
                            setLabelsSearchTerm('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center gap-2 text-[#1F6FEB]"
                        >
                          <Plus size={14} />
                          Create "{labelsSearchTerm}"
                        </button>
                      )}
                      <div className="px-3 py-2 text-[11px] font-bold text-[#5E6C84] uppercase">Suggested labels</div>
                      {['frontend', 'backend'].map(labelName => {
                        const current = formData.labels ? formData.labels.split(',').map(l => l.trim()).filter(Boolean) : [];
                        const isSelected = current.includes(labelName);
                        return (
                          <button
                            key={labelName}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormData({ ...formData, labels: current.filter(l => l !== labelName).join(', ') });
                              } else {
                                setFormData({ ...formData, labels: [...current, labelName].join(', ') });
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F5F7] flex items-center justify-between"
                          >
                            <span>{labelName}</span>
                            {isSelected && <Check size={14} className="text-[#1F6FEB]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-[#44546F]">Story points</label>
              <input
                type="number"
                min="0"
                className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10 font-medium"
                value={formData.storyPoints === null || formData.storyPoints === undefined || (formData.storyPoints as any) === '' ? '' : formData.storyPoints}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, storyPoints: val === '' ? '' as any : parseInt(val) || 0 });
                }}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-[#44546F]">Original estimate</label>
              <input
                type="text"
                className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10 font-medium"
                value={formData.originalEstimate}
                onChange={e => setFormData({ ...formData, originalEstimate: e.target.value })}
                placeholder="e.g. 2d 4h 30m"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-[#44546F]">Start date <span className="text-[#DE350B]">*</span></label>
              <input
                type="date"
                className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10"
                value={formData.startDate}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold text-[#44546F]">Due date <span className="text-[#DE350B]">*</span></label>
              <input
                type="date"
                className="w-full p-2 border-2 border-[#DFE1E6] hover:bg-[#F4F5F7] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] text-sm text-[#172B4D] outline-none transition-all h-10"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DFE1E6] flex items-center justify-end shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onClose} className="text-sm font-bold text-[#1F6FEB] hover:underline transition-all">Cancel</button>
            <button type="submit" form="create-issue-form" disabled={loading || !formData.title.trim()} className="px-4 py-2 bg-[#1F6FEB] text-white text-sm font-bold rounded hover:bg-[#003484] disabled:opacity-50 transition-all shadow-sm active:scale-95">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
        multiple
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const validFiles: File[] = [];
            const invalidFiles: string[] = [];
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

            Array.from(files).forEach(f => {
              const ext = f.name.split('.').pop()?.toLowerCase();
              if (ext && allowedExtensions.includes(ext)) {
                validFiles.push(f);
              } else {
                invalidFiles.push(f.name);
              }
            });

            if (invalidFiles.length > 0) {
              addNotification('Error', `Skipped invalid file(s): ${invalidFiles.join(', ')}. Only images (.jpg, .png, .gif, .webp) are allowed.`, 'error');
            }

            if (validFiles.length > 0) {
              const blobUrls = validFiles.map(f => {
                const url = URL.createObjectURL(f);
                return `${url}#${encodeURIComponent(f.name)}`;
              });
              setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...blobUrls] }));
              addNotification('Success', `${validFiles.length} image(s) attached.`, 'success');
            }
          }
          e.target.value = '';
        }}
      />

      {/* Lightbox Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-10 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors animate-in fade-in"
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
              <p className="text-white font-medium text-lg bg-black/50 px-4 py-2 rounded-full border border-white/10">
                {getAttachmentName(previewUrl)}
              </p>
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
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-[#DE350B] text-white rounded-[3px] font-bold hover:bg-[#BF2600] transition-colors shadow-lg"
                onClick={() => {
                  setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a !== previewUrl) }));
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
    </div>
  );
};

export default CreateIssueModal;
