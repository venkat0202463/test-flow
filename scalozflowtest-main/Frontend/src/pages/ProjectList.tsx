import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder, ArrowRight, Layout, Users, Calendar, Settings } from 'lucide-react';
import api from '../services/api';
import type { Project } from '../types';

import { useAuth } from '../context/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';

const ProjectList = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  const { user: authUser } = useAuth();

  const closeModal = () => {
    setShowModal(false);
    setEditingProjectId(null);
  };

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProjects();
  }, []);



  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F6FEB]"></div>
    </div>
  );

  return (
    <div className="content-container animate-in fade-in duration-500">
      {/* Search and Action Cluster */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DFE1E6]">
        <div className="space-y-1">

          <h1 className="section-title tracking-tight">Project Portfolio</h1>
          <p className="section-subtitle tracking-tight">Track and manage your architectural resource allocations across all active nodes.</p>
        </div>

        <div className="flex items-center gap-3">
          {(authUser?.role?.toUpperCase() === 'MANAGER' || authUser?.role?.toUpperCase() === 'ADMIN') && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#1F6FEB] text-white px-5 py-2 rounded-[3px] text-sm font-bold hover:bg-[#003484] transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Create Project
            </button>
          )}
        </div>
      </div>

      {/* Enterprise Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/dashboard/project-details/${project.id}`}
            className="block h-full"
          >
            <div className="bg-white rounded-[3px] p-5 h-full flex flex-col border border-[#DFE1E6] hover:border-[#4C9AFF] hover:shadow-[0_4px_8px_rgba(9,30,66,0.08)] transition-all group relative">

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[#00B3A4]/10 text-[#00B3A4] rounded flex items-center justify-center shrink-0">
                    <Layout size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-[#172B4D] leading-tight truncate pr-2">{project.name}</h2>
                    <span className="text-[13px] font-bold text-[#5E6C84] capitalize tracking-wider mt-0.5 block">
                      {(project.projectType || 'kanban').toLowerCase()}
                    </span>
                  </div>
                </div>

                {(authUser?.role === 'MANAGER' || authUser?.role === 'ADMIN') && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingProjectId(project.id);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-[#5E6C84] hover:text-[#00B3A4] hover:bg-[#00B3A4]/10 rounded transition-colors z-10 shrink-0"
                    title="Project Settings"
                  >
                    <Settings size={18} />
                  </button>
                )}
              </div>

              <p className="text-[13px] text-[#5E6C84] leading-relaxed line-clamp-2 mb-6 flex-grow">
                {project.description || 'Enterprise architecture workspace.'}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-[#DFE1E6] mt-auto">
                <div className="flex items-center gap-4 text-[15px] font-bold text-[#5E6C84] tracking-tighter">
                  <div className="flex items-center gap-1.5"><Users size={14} className="text-[#00B3A4]" /> {project.teamSize || 0}</div>
                  <div className="flex items-center gap-1.5"><Calendar size={14} className="text-[#00B3A4]" /> {project.deadline ? new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Target'}</div>
                </div>
                <ArrowRight size={16} className="text-[#00B3A4] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center">
          <Folder size={64} className="text-[#DFE1E6] mb-4" />
          <h3 className="text-lg font-bold text-[#172B4D]">Node Environment Empty</h3>
          <p className="text-sm text-[#5E6C84] mt-1">Initiate your first project to begin tracking.</p>
        </div>
      )}

      <CreateProjectModal
        isOpen={showModal}
        onClose={closeModal}
        onSuccess={fetchProjects}
        projectToEdit={editingProjectId ? projects.find(p => p.id === editingProjectId) : null}
      />
    </div>
  );
};

export default ProjectList;
