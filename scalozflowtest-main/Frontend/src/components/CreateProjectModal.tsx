import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ArrowRight } from 'lucide-react';
import api from '../services/api';
import type { Project, User } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectToEdit?: Project | null;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess, projectToEdit }) => {
  const { addNotification } = useNotifications();
  const { user: authUser } = useAuth();
  const [onboardedUsers, setOnboardedUsers] = useState<User[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [deadlineError, setDeadlineError] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    objective: '',
    teamSize: 1,
    deadline: '',
    projectType: 'KANBAN',
    category: 'Software',
    teamMembers: [] as User[]
  });

  const [activeUserIndex, setActiveUserIndex] = useState(0);

  useEffect(() => {
    setActiveUserIndex(0);
  }, [userSearch, isUserDropdownOpen]);
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (projectToEdit) {
        setNewProject({
          name: projectToEdit.name || '',
          description: projectToEdit.description || '',
          objective: projectToEdit.objective || '',
          teamSize: projectToEdit.teamSize || 1,
          deadline: projectToEdit.deadline || '',
          projectType: projectToEdit.projectType || 'KANBAN',
          category: projectToEdit.category || 'Software',
          teamMembers: projectToEdit.teamMembers || []
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, projectToEdit]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/auth/users');
      setOnboardedUsers(data);
    } catch (error) {
      console.error("Error fetching users", error);
    }
  };

  const resetForm = () => {
    setNewProject({ name: '', description: '', objective: '', teamSize: 1, deadline: '', projectType: 'KANBAN', category: 'Software', teamMembers: [] });
    setDeadlineError(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.deadline) {
      setDeadlineError(true);
      addNotification('Error', 'Target deadline is required', 'error');
      return;
    }
    try {
      if (projectToEdit) {
        await api.put(`/projects/${projectToEdit.id}`, {
          ...newProject,
          deadline: newProject.deadline === '' ? null : newProject.deadline,
          teamMembers: newProject.teamMembers.map(member => ({ id: member.id })),
          teamSize: newProject.teamMembers.length + 1
        });
        addNotification('Project Updated', `${newProject.name} configuration saved.`, 'success');
      } else {
        const response = await api.post('/projects', {
          ...newProject,
          teamMembers: newProject.teamMembers.map(member => ({ id: member.id })),
          teamSize: newProject.teamMembers.length + 1
        });
        const createdProject = response.data;
        // Initialize default columns based on project type
        const defaultColumns = newProject.projectType === 'KANBAN'
          ? ['To Do', 'In Progress', 'In Review', 'Done']
          : ['To Do', 'In Progress', 'Done'];

        await Promise.all(defaultColumns.map((name, index) =>
          api.post('/columns', {
            projectId: createdProject.id,
            name: name,
            orderIndex: index
          })
        ));

        addNotification('Project Created', `${newProject.name} is now ready with default workflow.`, 'success');
      }

      onSuccess();
      handleClose();
      if (projectToEdit) {
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error", error);
      const message = error.response?.data?.message || error.message || 'Operation failed';
      addNotification('Error', message, 'error');
    }
  };

  const query = userSearch.toLowerCase().replace(/ee/g, 'i');
  const filteredUsers = onboardedUsers.filter(u =>
    (u.name.toLowerCase().startsWith(query) ||
      u.email.toLowerCase().startsWith(query) ||
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)) &&
    !newProject.teamMembers.find(m => m.id === u.id) &&
    u.id !== authUser?.id
  );
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-[3px] max-w-xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#172B4D]">{projectToEdit ? 'Edit project' : 'Create project'}</h2>
          <button onClick={handleClose} className="p-1 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E] transition-colors"><X size={20} /></button>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar ${isUserDropdownOpen ? 'pb-60' : ''}`}>
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#5E6C84]">Template</label>
            <div className="relative">
              <select
                className="w-full bg-white border-2 border-[#DFE1E6] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] py-3 px-3 text-sm outline-none appearance-none cursor-pointer font-bold text-[#172B4D]"
                value={newProject.projectType}
                onChange={e => setNewProject({ ...newProject, projectType: e.target.value })}
              >
                <option value="KANBAN">Kanban</option>
                <option value="SCRUM">Scrum</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#42526E] pointer-events-none" />
            </div>
            <p className="text-[11px] text-[#5E6C84]">
              {newProject.projectType === 'KANBAN'
                ? 'Visualize and advance your project forward using issues on a kanban board.'
                : 'Plan and deliver work in cycles (sprints) to improve team velocity and focus.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5E6C84]">Project name <span className="text-[#DE350B]">*</span></label>
            <input
              type="text"
              className="w-full bg-white border-2 border-[#DFE1E6] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all"
              placeholder="e.g. My project"
              value={newProject.name}
              onChange={e => setNewProject({ ...newProject, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5E6C84]">Description</label>
            <textarea
              className="w-full bg-white border-2 border-[#DFE1E6] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all h-24 resize-none"
              placeholder="Add a description (optional)"
              value={newProject.description}
              onChange={e => setNewProject({ ...newProject, description: e.target.value })}
            />
          </div>

          <div className="pt-4 border-t border-[#DFE1E6] space-y-6">
            <h3 className="text-sm font-bold text-[#172B4D]">People</h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Project lead <span className="text-[#DE350B]">*</span></label>
                <div className="relative">
                  <div className="w-full bg-white border-2 border-[#DFE1E6] rounded-[3px] py-1.5 px-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#00B3A4] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {projectToEdit?.createdBy?.name 
                        ? projectToEdit.createdBy.name.charAt(0).toUpperCase() 
                        : (authUser?.name ? authUser.name.charAt(0).toUpperCase() : 'A')}
                    </div>
                    <span className="text-sm text-[#172B4D]">
                      {projectToEdit?.createdBy?.name 
                        ? projectToEdit.createdBy.name
                        : (authUser?.name || 'User')}
                    </span>
                  </div>
                </div>
              </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#5E6C84]">Team members</label>
              <div className={`relative ${isUserDropdownOpen ? 'z-[2002]' : ''}`}>
                <div
                  className={`w-full bg-white border-2 ${isUserDropdownOpen ? 'border-[#4C9AFF]' : 'border-[#DFE1E6]'} rounded-[3px] py-1 px-2 flex items-center gap-2 cursor-text transition-all`}
                  onClick={() => setIsUserDropdownOpen(true)}
                >
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[#172B4D] placeholder:text-[#5E6C84] py-1"
                    placeholder={newProject.teamMembers.length === 0 ? "Search for people..." : "Add more people..."}
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setIsUserDropdownOpen(true);
                    }}
                    onFocus={() => setIsUserDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filteredUsers.length > 0) {
                          setActiveUserIndex(prev => {
                            const nextIndex = (prev + 1) % filteredUsers.length;
                            const item = document.getElementById(`dropdown-user-${nextIndex}`);
                            if (item) {
                              item.scrollIntoView({ block: 'nearest' });
                            }
                            return nextIndex;
                          });
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filteredUsers.length > 0) {
                          setActiveUserIndex(prev => {
                            const nextIndex = (prev - 1 + filteredUsers.length) % filteredUsers.length;
                            const item = document.getElementById(`dropdown-user-${nextIndex}`);
                            if (item) {
                              item.scrollIntoView({ block: 'nearest' });
                            }
                            return nextIndex;
                          });
                        }
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredUsers.length > 0 && activeUserIndex >= 0 && activeUserIndex < filteredUsers.length) {
                          const selectedUser = filteredUsers[activeUserIndex];
                          setNewProject({
                            ...newProject,
                            teamMembers: [...newProject.teamMembers, selectedUser]
                          });
                          setUserSearch('');
                          setIsUserDropdownOpen(false);
                        }
                      } else if (e.key === 'Escape') {
                        setIsUserDropdownOpen(false);
                      }
                    }}
                  />
                  <ChevronDown
                    size={14}
                    className={`text-[#42526E] transition-transform cursor-pointer ${isUserDropdownOpen ? 'rotate-180' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsUserDropdownOpen(!isUserDropdownOpen);
                    }}
                  />
                </div>

                {isUserDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[10]" onClick={() => setIsUserDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#4C9AFF] rounded-[3px] shadow-2xl z-[2001] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                      {filteredUsers.map((user, idx) => (
                        <div
                          key={user.id}
                          id={`dropdown-user-${idx}`}
                          className={`px-3 py-2.5 hover:bg-[#DEEBFF] cursor-pointer flex items-center gap-3 border-b border-[#F4F5F7] last:border-none ${activeUserIndex === idx ? 'bg-[#DEEBFF]' : ''
                            }`}
                          onMouseEnter={() => setActiveUserIndex(idx)}
                          onClick={() => {
                            setNewProject({
                              ...newProject,
                              teamMembers: [...newProject.teamMembers, user]
                            });
                            setUserSearch('');
                            setIsUserDropdownOpen(false);
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#1F6FEB] flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm">
                            {user.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-[#172B4D]">{user.name}</span>
                            <span className="text-[11px] text-[#5E6C84]">{user.email}</span>
                          </div>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="p-6 text-center text-[12px] text-[#5E6C84] font-medium">
                          No results found starting with "{userSearch}"
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {newProject.teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {newProject.teamMembers.map(member => (
                    <div key={member.id} className="bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] px-2 py-1 flex items-center gap-2 group transition-all hover:bg-[#EBECF0]">
                      <div className="w-5 h-5 rounded-full bg-[#1F6FEB] flex items-center justify-center text-[8px] font-bold text-white uppercase">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-[11px] font-semibold text-[#172B4D]">{member.name}</span>
                      <X
                        size={12}
                        className="text-[#42526E] cursor-pointer hover:text-[#DE350B]"
                        onClick={() => setNewProject({
                          ...newProject,
                          teamMembers: newProject.teamMembers.filter(m => m.id !== member.id)
                        })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5E6C84]">Target Deadline <span className="text-[#DE350B]">*</span></label>
            <input
              type="date"
              className={`w-full bg-white border-2 ${deadlineError ? 'border-[#DE350B]' : 'border-[#DFE1E6]'} hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] rounded-[3px] py-2 px-3 text-sm outline-none transition-all`}
              value={newProject.deadline}
              onChange={e => {
                setNewProject({ ...newProject, deadline: e.target.value });
                if (e.target.value) setDeadlineError(false);
              }}
            />
            {deadlineError && (
              <p className="text-[11px] text-[#DE350B] font-bold mt-1">Target deadline is required</p>
            )}
          </div>

          <div
            onClick={() => setShowMore(!showMore)}
            className="pt-4 flex items-center gap-2 text-[#1F6FEB] font-bold text-xs cursor-pointer hover:underline group"
          >
            <ArrowRight size={14} className={`transition-transform ${showMore ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
            {showMore ? 'Hide advanced settings' : 'More settings'}
          </div>

          {showMore && (
            <div className="pt-4 space-y-6 animate-in slide-in-from-top-4 duration-300">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Category</label>
                <select
                  className="w-full bg-white border-2 border-[#DFE1E6] rounded-[3px] py-2 px-3 text-sm outline-none"
                  value={newProject.category}
                  onChange={e => setNewProject({ ...newProject, category: e.target.value })}
                >
                  <option value="Software">Software</option>
                  <option value="Business">Business</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#5E6C84]">Strategic Objective</label>
                <textarea
                  className="w-full bg-white border-2 border-[#DFE1E6] rounded-[3px] py-2 px-3 text-sm outline-none h-20 resize-none"
                  value={newProject.objective}
                  onChange={e => setNewProject({ ...newProject, objective: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-white border-t border-[#DFE1E6] flex items-center justify-end shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="px-4 py-2 text-sm font-bold text-[#42526E] hover:bg-[#F4F5F7] rounded-[3px]">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!newProject.name}
              className="bg-[#1F6FEB] text-white px-5 py-2 rounded-[3px] text-sm font-bold shadow-md hover:bg-[#003484] transition-all active:scale-95 disabled:opacity-50"
            >
              {projectToEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
