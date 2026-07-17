import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Tag,
  Plus,
  Calendar,
  AlertCircle,
  MoreHorizontal,
  Edit2,
  Trash2,
  Archive,
  CheckCircle,
  Play,
  RotateCcw,
  BookOpen,
  ChevronRight,
  Package,
  Layers,
  Bug
} from 'lucide-react';
import api from '../services/api';
import type { Version, Project } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const Releases = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();
  const { user: authUser } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionStats, setVersionStats] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNRELEASED' | 'RELEASED' | 'ARCHIVED'>('ALL');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    releaseDate: '',
    releaseNotes: '',
    color: '#0052CC'
  });

  // Action Menu State
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const isLead = authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, versionsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/versions`)
      ]);
      
      setProject(projRes.data);
      const fetchedVersions: Version[] = versionsRes.data || [];
      setVersions(fetchedVersions);
      
      // Fetch stats for all versions
      const statsMap: Record<number, any> = {};
      await Promise.all(
        fetchedVersions.map(async (v) => {
          try {
            const statsRes = await api.get(`/projects/${projectId}/versions/${v.id}/stats`);
            statsMap[v.id] = statsRes.data;
          } catch (e) {
            console.error(`Failed to fetch stats for version ${v.id}`, e);
          }
        })
      );
      setVersionStats(statsMap);
    } catch (err) {
      console.error('Error fetching releases details:', err);
      addNotification('Error', 'Failed to load releases dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
    
    const handleOutsideClick = () => {
      setMenuOpenId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [projectId]);

  const handleOpenCreateModal = () => {
    if (!isLead) {
      addNotification('Access Denied', 'Only project admins can create versions.', 'warning');
      return;
    }
    setModalMode('CREATE');
    setSelectedVersion(null);
    setFormData({
      name: '',
      description: '',
      startDate: '',
      releaseDate: '',
      releaseNotes: '',
      color: '#0052CC'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (version: Version) => {
    if (!isLead) {
      addNotification('Access Denied', 'Only project admins can edit versions.', 'warning');
      return;
    }
    setModalMode('EDIT');
    setSelectedVersion(version);
    setFormData({
      name: version.name,
      description: version.description || '',
      startDate: version.startDate || '',
      releaseDate: version.releaseDate || '',
      releaseNotes: version.releaseNotes || '',
      color: version.color || '#0052CC'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (modalMode === 'CREATE') {
        await api.post(`/projects/${projectId}/versions`, {
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate || null,
          releaseDate: formData.releaseDate || null,
          releaseNotes: formData.releaseNotes,
          color: formData.color,
          status: 'UNRELEASED'
        });
        addNotification('Created', `Version "${formData.name}" successfully created.`, 'success');
      } else if (modalMode === 'EDIT' && selectedVersion) {
        await api.put(`/projects/${projectId}/versions/${selectedVersion.id}`, {
          ...selectedVersion,
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate || null,
          releaseDate: formData.releaseDate || null,
          releaseNotes: formData.releaseNotes,
          color: formData.color
        });
        addNotification('Updated', `Version details updated.`, 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to save version configuration.', 'error');
    }
  };

  const handleUpdateStatus = async (version: Version, newStatus: 'UNRELEASED' | 'RELEASED' | 'ARCHIVED') => {
    if (!isLead) {
      addNotification('Access Denied', 'Only project admins can update version status.', 'warning');
      return;
    }
    try {
      await api.put(`/projects/${projectId}/versions/${version.id}`, {
        ...version,
        status: newStatus
      });
      addNotification('Success', `Version "${version.name}" is now ${newStatus.toLowerCase()}.`, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to update version status.', 'error');
    }
  };

  const handleDelete = async (version: Version) => {
    if (!isLead) {
      addNotification('Access Denied', 'Only project admins can delete versions.', 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${version.name}"? Linked issues will lose this version context.`)) {
      return;
    }
    try {
      await api.delete(`/projects/${projectId}/versions/${version.id}`);
      addNotification('Deleted', `Version "${version.name}" has been deleted.`, 'info');
      fetchData();
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to delete version.', 'error');
    }
  };

  const filteredVersions = versions.filter((v) => {
    if (activeTab === 'ALL') return true;
    return v.status === activeTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]/30 pb-20 font-sans text-[#172B4D]">
      {/* Sub Header */}
      <div className="bg-white border-b border-[#DFE1E6] px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#5E6C84]">
            <Link to="/dashboard/projects" className="hover:text-[#0052CC] hover:underline">Projects</Link>
            <ChevronRight size={12} className="text-[#C1C7D0]" />
            <Link to={`/dashboard/project-details/${projectId}`} className="hover:text-[#0052CC] hover:underline">{project?.name}</Link>
            <ChevronRight size={12} className="text-[#C1C7D0]" />
            <span className="text-[#172B4D] font-bold">Releases</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 pt-8">
        {/* Header Block */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold text-[#172B4D] tracking-tight flex items-center gap-2">
              <Package className="text-[#0052CC]" size={32} /> Releases & Versions
            </h1>
            <p className="text-[13px] text-[#5E6C84] mt-1">Plan, manage, and monitor software releases and build pipelines</p>
          </div>
          {isLead && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#0052CC] text-white px-4 py-2 rounded font-bold text-sm hover:bg-[#0747A6] transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 active:scale-95 cursor-pointer"
            >
              <Plus size={16} /> Create version
            </button>
          )}
        </div>

        {/* Filters and Tabs */}
        <div className="flex border-b border-[#DFE1E6] mb-6">
          {(['ALL', 'UNRELEASED', 'RELEASED', 'ARCHIVED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-[1px] transition-all cursor-pointer ${
                activeTab === tab
                  ? 'border-[#0052CC] text-[#0052CC]'
                  : 'border-transparent text-[#5E6C84] hover:text-[#172B4D]'
              }`}
            >
              {tab === 'ALL' ? 'All Versions' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Versions List */}
        {filteredVersions.length === 0 ? (
          <div className="bg-white border border-[#DFE1E6] rounded-xl p-12 text-center shadow-sm">
            <Tag size={48} className="mx-auto text-[#DFE1E6] mb-4" />
            <h3 className="text-[16px] font-bold text-[#172B4D] mb-1">No versions found</h3>
            <p className="text-[13px] text-[#5E6C84] mb-6 max-w-md mx-auto">
              Use versions to organize your backlog, plan release packages, and monitor feature progress.
            </p>
            {isLead && (
              <button
                onClick={handleOpenCreateModal}
                className="bg-[#0052CC] text-white px-4 py-2 rounded font-bold text-sm hover:bg-[#0747A6] transition-all cursor-pointer"
              >
                Create your first version
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredVersions.map((version) => {
              const stats = versionStats[version.id] || {
                totalIssues: 0,
                completedIssues: 0,
                remainingIssues: 0,
                progressPercentage: 0,
                openBugs: 0,
                totalStoryPoints: 0,
                completedStoryPoints: 0,
                spProgressPercentage: 0
              };

              return (
                <div
                  key={version.id}
                  className="bg-white border border-[#DFE1E6] hover:border-[#4C9AFF]/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  {/* Left Column: Version Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: version.color || '#0052CC' }}
                      />
                      <h3 className="text-lg font-bold text-[#172B4D] hover:underline cursor-pointer truncate">
                        {version.name}
                      </h3>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                          version.status === 'RELEASED'
                            ? 'bg-[#E3FCEF] text-[#006644] border-[#ABF5D1]'
                            : version.status === 'ARCHIVED'
                            ? 'bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6]'
                            : 'bg-[#FFF0B3] text-[#172B4D] border-[#FFE380]'
                        }`}
                      >
                        {version.status}
                      </span>
                    </div>

                    <p className="text-[13px] text-[#5E6C84] line-clamp-2 mb-4">
                      {version.description || <span className="italic">No description provided.</span>}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs font-bold text-[#6B778C]">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>Start: {version.startDate || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>Release: {version.releaseDate || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Progress and Statistics */}
                  <div className="w-full md:w-64 shrink-0 space-y-3">
                    <div className="flex justify-between items-baseline text-xs font-bold">
                      <span className="text-[#5E6C84]">Release Progress</span>
                      <span className="text-[#172B4D]">{stats.progressPercentage}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-[#F4F5F7] rounded-full overflow-hidden flex shadow-inner">
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${stats.progressPercentage}%`,
                          backgroundColor: version.color || '#0052CC'
                        }}
                      />
                    </div>
                    
                    {/* Counts Row */}
                    <div className="flex justify-between text-[11px] font-bold uppercase text-[#6B778C]">
                      <div className="flex items-center gap-1">
                        <Layers size={11} className="text-[#1F6FEB]" />
                        <span>{stats.completedIssues} / {stats.totalIssues} Issues</span>
                      </div>
                      {stats.totalStoryPoints > 0 && (
                        <span>{stats.completedStoryPoints} / {stats.totalStoryPoints} SP</span>
                      )}
                    </div>

                    {stats.openBugs > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-[#FF5630] font-bold">
                        <Bug size={12} />
                        <span>{stats.openBugs} Open Bugs</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions Menu */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center relative">
                    {isLead && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === version.id ? null : version.id);
                          }}
                          className="p-1.5 hover:bg-[#F4F5F7] rounded border border-[#DFE1E6] text-[#42526E] transition-colors cursor-pointer"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        
                        {menuOpenId === version.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#DFE1E6] rounded-md shadow-2xl py-1 z-[1500] animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={() => handleOpenEditModal(version)}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 size={12} /> Edit version
                            </button>

                            {version.status === 'UNRELEASED' && (
                              <button
                                onClick={() => handleUpdateStatus(version, 'RELEASED')}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-[#006644] hover:bg-[#E3FCEF] flex items-center gap-2 cursor-pointer"
                              >
                                <Play size={12} /> Release version
                              </button>
                            )}

                            {version.status === 'RELEASED' && (
                              <button
                                onClick={() => handleUpdateStatus(version, 'UNRELEASED')}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                              >
                                <RotateCcw size={12} /> Reopen version
                              </button>
                            )}

                            {version.status !== 'ARCHIVED' ? (
                              <button
                                onClick={() => handleUpdateStatus(version, 'ARCHIVED')}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-[#42526E] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                              >
                                <Archive size={12} /> Archive version
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(version, 'UNRELEASED')}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-[#F4F5F7] flex items-center gap-2 cursor-pointer"
                              >
                                <RotateCcw size={12} /> Unarchive version
                              </button>
                            )}

                            <div className="my-1 border-t border-[#DFE1E6]" />
                            
                            <button
                              onClick={() => handleDelete(version)}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-[#DE350B] hover:bg-[#FFEBE6] flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={12} /> Delete version
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#091E42]/60 backdrop-blur-sm flex items-center justify-center z-[2500] p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-[#DFE1E6] bg-[#F4F5F7]/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
                <Tag className="text-[#0052CC]" size={18} />
                {modalMode === 'CREATE' ? 'Create New Version' : 'Edit Version Details'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Version Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider">Version Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.0.0"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border-2 border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#4C9AFF] transition-all"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider">Description</label>
                  <textarea
                    placeholder="Describe version goals, hotfix content, or deliverables..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border-2 border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#4C9AFF] h-20 resize-none transition-all"
                  />
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#4C9AFF] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider">Release Date</label>
                    <input
                      type="date"
                      value={formData.releaseDate}
                      onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#4C9AFF] transition-all"
                    />
                  </div>
                </div>

                {/* Release Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider">Release Notes</label>
                  <textarea
                    placeholder="Write detailed release notes for this version build..."
                    value={formData.releaseNotes}
                    onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border-2 border-[#DFE1E6] rounded hover:bg-[#F4F5F7] focus:bg-white focus:outline-none focus:border-[#4C9AFF] h-20 resize-none transition-all"
                  />
                </div>

                {/* Color Selector */}
                <div className="space-y-1">
                  <label className="block text-xs font-black text-[#5E6C84] uppercase tracking-wider font-bold mb-1">Color Palette Badge</label>
                  <div className="flex gap-2">
                    {['#0052CC', '#36B37E', '#FFAB00', '#FF5630', '#6554C0', '#00875A'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                          formData.color === c ? 'border-[#172B4D] ring-2 ring-blue-500/20' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-[#F4F5F7]/50 border-t border-[#DFE1E6] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded text-sm font-bold text-[#42526E] hover:bg-[#EBECF0] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0052CC] text-white px-5 py-2 rounded text-sm font-bold hover:bg-[#0747A6] transition-all shadow-md shadow-blue-500/10 active:scale-95 cursor-pointer"
                >
                  {modalMode === 'CREATE' ? 'Create' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Releases;
