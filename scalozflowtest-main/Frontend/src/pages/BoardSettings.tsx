import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  Settings, 
  Layout, 
  Save,
  ArrowLeft,
  Info
} from 'lucide-react';
import api from '../services/api';
import type { Project } from '../types';
import { useNotifications } from '../context/NotificationContext';

const BoardSettings = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('columns');

  useEffect(() => {
    if (projectId) fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (err) {
      addNotification('Error', 'Failed to load project details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-screen bg-white">
      <div className="w-10 h-10 border-4 border-[#1F6FEB] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b border-[#DFE1E6] shrink-0">
        <div className="flex items-center gap-2 project-breadcrumb mb-2">
          <Link to="/dashboard" className="hover:underline">Projects</Link>
          <ChevronRight size={14} />
          <Link to={`/dashboard/project/${projectId}`} className="hover:underline">{project?.name || 'Sample Project'}</Link>
          <ChevronRight size={14} />
          <span>Board settings</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-[#F4F5F7] rounded-[3px] text-[#42526E]"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="section-title">Board settings</h1>
          </div>
          <button className="bg-[#1F6FEB] text-white px-4 py-2 rounded-[3px] text-sm font-bold hover:bg-[#003484] flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>

        {/* Tabs - CLEANED UP: Only essential tabs remain */}
        <div className="flex items-center gap-8 mt-6">
          {['General', 'Columns', 'Card layout'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.toLowerCase().replace(' ', '-')
                  ? 'border-[#1F6FEB] text-[#1F6FEB]'
                  : 'border-transparent text-[#42526E] hover:text-[#172B4D]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#F4F5F7] p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'general' && (
            <div className="bg-white p-8 rounded-[3px] shadow-sm border border-[#DFE1E6]">
              <h2 className="text-lg font-semibold text-[#172B4D] mb-6">General Configuration</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B778C] uppercase mb-2">Board Name</label>
                  <input 
                    type="text" 
                    defaultValue={`${project?.name} Board`}
                    className="w-full bg-[#F4F5F7] border-2 border-transparent focus:border-[#4C9AFF] focus:bg-white rounded-[3px] px-3 py-2 text-sm outline-none transition-all"
                  />
                </div>
                <div>
                   <label className="block text-xs font-bold text-[#6B778C] uppercase mb-2">Manager</label>
                   <div className="flex items-center gap-2 p-3 bg-[#F4F5F7] rounded-[3px]">
                      <div className="w-8 h-8 rounded-full bg-[#1F6FEB] flex items-center justify-center text-white text-xs font-bold">A</div>
                      <span className="text-sm text-[#172B4D]">Project Manager</span>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'columns' && (
            <div className="bg-white p-8 rounded-[3px] shadow-sm border border-[#DFE1E6]">
              <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-lg font-semibold text-[#172B4D]">Columns</h2>
                   <p className="text-sm text-[#5E6C84]">Configure columns and their mapping to statuses.</p>
                </div>
                <button className="bg-[#EBECF0] text-[#172B4D] px-4 py-2 rounded-[3px] text-sm font-bold hover:bg-[#DFE1E6] flex items-center gap-2">
                   <Plus size={16} /> Add Column
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                 {['TO DO', 'IN PROGRESS', 'REVIEW', 'DONE'].map((col) => (
                   <div key={col} className="border-2 border-dashed border-[#DFE1E6] rounded-[3px] p-4 flex flex-col gap-4 bg-[#F4F5F7]/30">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-[#5E6C84] uppercase tracking-wider">{col}</span>
                         <Trash2 size={14} className="text-[#5E6C84] cursor-pointer hover:text-[#BF2600]" />
                      </div>
                      <div className="bg-white border border-[#DFE1E6] rounded-[3px] p-3 text-xs font-bold text-[#1F6FEB] shadow-sm flex items-center justify-between group">
                         {col}
                         <Settings size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                   </div>
                 ))}
                 <div className="border-2 border-dashed border-[#DFE1E6] rounded-[3px] p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#EBECF0] cursor-pointer transition-all">
                    <Plus size={24} className="text-[#5E6C84]" />
                    <span className="text-xs font-bold text-[#5E6C84]">NEW COLUMN</span>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'card-layout' && (
            <div className="bg-white p-8 rounded-[3px] shadow-sm border border-[#DFE1E6]">
               <h2 className="text-lg font-semibold text-[#172B4D] mb-4">Card Layout</h2>
               
               {/* Informational Banner about Card Layout */}
               <div className="bg-[#EFFFFA] border border-[#36B37E]/20 rounded-[3px] p-4 flex items-start gap-4 mb-8">
                  <div className="w-8 h-8 bg-[#36B37E] rounded flex items-center justify-center shrink-0">
                     <Info size={18} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-[#172B4D] mb-1">About Card Layout</h4>
                    <p className="text-sm text-[#5E6C84] leading-relaxed">
                      Customizing the card layout allows you to display crucial data (like <b>Due Dates</b> or <b>Points</b>) directly on the task cards in your Kanban board and Backlog rows. This helps your team see important details at a glance without having to open every ticket.
                    </p>
                  </div>
               </div>

               <p className="text-sm font-bold text-[#6B778C] uppercase mb-4 tracking-tighter">Fields to display on cards</p>
               <div className="space-y-4">
                  {[
                    { name: 'Story Points', desc: 'Display effort weight in the corner' },
                    { name: 'Due Date', desc: 'Show deadlines with color-coded urgency' },
                    { name: 'Tags', desc: 'Display task categorization labels' }
                  ].map((field) => (
                    <div key={field.name} className="flex items-center justify-between p-4 border border-[#DFE1E6] rounded-[3px] hover:bg-[#F4F5F7] transition-colors">
                       <div className="flex items-center gap-4">
                          <Layout size={20} className="text-[#1F6FEB]" />
                          <div>
                            <span className="text-sm font-bold text-[#172B4D] block">{field.name}</span>
                            <span className="text-[12px] text-[#5E6C84]">{field.desc}</span>
                          </div>
                       </div>
                       <input type="checkbox" defaultChecked className="w-4 h-4 rounded-[2px] cursor-pointer" />
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardSettings;
