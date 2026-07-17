import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, User, Users, Calendar, Edit2, X, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';

const ProfilePage = () => {
  const { user, login } = useAuth();
  const { addNotification } = useNotifications();
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [newDepartment, setNewDepartment] = useState(user?.department || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const { data } = await api.put('/auth/profile-update', { 
        name: newName,
        department: newDepartment
      });
      if (user) {
        login({ ...user, name: data.name, department: data.department });
      }
      addNotification('Success', 'Profile updated successfully.', 'success');
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating profile", error);
      addNotification('Error', 'Failed to update profile.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Active Member'; 
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Active Member';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'Active Member';
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <div className="content-container py-12 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
            <h1 className="section-title">Profile Overview</h1>
            <p className="section-subtitle mt-1">View your profile information.</p>
        </header>

        <div className="bg-white border border-[#DFE1E6] rounded-xl shadow-sm overflow-hidden">
            <div className="p-10">
                <div className="flex items-center gap-8 mb-10">
                    <div className="w-24 h-24 bg-[#265ed7] text-white rounded-full flex items-center justify-center text-4xl font-bold">
                        {user?.name.charAt(0)}
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-[#172B4D]">{user?.name}</h2>
                        <div className="flex items-center gap-2 text-[#5E6C84]">
                            <Mail size={18} />
                            <span className="text-base">{user?.email}</span>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-[#DFE1E6] w-full mb-10" />

                <div className="space-y-8 px-2">
                    <div className="flex items-center gap-8">
                        <div className="w-10 h-10 bg-[#EAE6FF] text-[#403294] rounded-lg flex items-center justify-center shrink-0">
                            <User size={20} />
                        </div>
                        <div className="flex w-full max-w-md">
                            <span className="w-1/2 text-[14px] font-medium text-[#5E6C84]">Role</span>
                            <span className="w-1/2 text-[14px] font-bold text-[#172B4D]">{formatRole(user?.role)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="w-10 h-10 bg-[#E3FCEF] text-[#006644] rounded-lg flex items-center justify-center shrink-0">
                            <Users size={20} />
                        </div>
                        <div className="flex w-full max-w-md">
                            <span className="w-1/2 text-[14px] font-medium text-[#5E6C84]">Team / Department</span>
                            <span className="w-1/2 text-[14px] font-bold text-[#172B4D]">{user?.department || 'Engineering Ops'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="w-10 h-10 bg-[#FFF0B3] text-[#827013] rounded-lg flex items-center justify-center shrink-0">
                            <Calendar size={20} />
                        </div>
                        <div className="flex w-full max-w-md">
                            <span className="w-1/2 text-[14px] font-medium text-[#5E6C84]">Member Since</span>
                            <span className="w-1/2 text-[14px] font-bold text-[#172B4D]">{formatDate(user?.createdAt)}</span>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-[#DFE1E6] w-full mt-10 mb-6" />

                <div className="flex justify-end px-2">
                    <button 
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#1F6FEB] text-white font-bold text-sm rounded-md hover:bg-[#0747A6] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        <Edit2 size={16} /> Edit Profile
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-[#091E42]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 bg-[#F4F5F7] border-b border-[#DFE1E6] flex justify-between items-center">
              <h3 className="font-bold text-[#172B4D]">Edit Profile Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-[#5E6C84] hover:text-[#172B4D] p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">Full Name</label>
                    <input 
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent focus:border-[#4C9AFF] focus:bg-white rounded-[3px] outline-none text-sm font-medium transition-all"
                        placeholder="Your Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">Team / Department</label>
                    <input 
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent focus:border-[#4C9AFF] focus:bg-white rounded-[3px] outline-none text-sm font-medium transition-all"
                        placeholder="e.g. Engineering Ops"
                        value={newDepartment}
                        onChange={e => setNewDepartment(e.target.value)}
                    />
                </div>
                <div className="space-y-2 opacity-60">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">Role</label>
                    <input 
                        type="text"
                        disabled
                        className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent rounded-[3px] outline-none text-sm font-medium cursor-not-allowed"
                        value={formatRole(user?.role)}
                    />
                </div>
                <div className="space-y-2 opacity-60">
                    <label className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-widest">Email Address (Locked)</label>
                    <input 
                        type="email"
                        disabled
                        className="w-full px-4 py-3 bg-[#F4F5F7] border-2 border-transparent rounded-[3px] outline-none text-sm font-medium cursor-not-allowed"
                        value={user?.email}
                    />
                </div>
                <button 
                    type="submit"
                    disabled={isUpdating}
                    className="w-full py-3 bg-[#1F6FEB] text-white rounded-[3px] font-bold text-sm hover:bg-[#003484] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isUpdating ? 'Saving Changes...' : <>Save Changes <CheckCircle2 size={16} /></>}
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
