import { useState, useEffect } from 'react';
import {
  Users,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Settings,
  Info,
  Key,
  Briefcase,
  Hash,
  Contact,
  Pencil,
  Shield,
  User as UserIcon,
  UserCog
} from 'lucide-react';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import type { User } from '../types';

const getDisplayEmployeeId = (id: any) => {
  if (!id) return "";
  if (id.includes('_')) return id.split('_').pop();
  if (id.includes('-')) return id.split('-').pop();
  return id;
};

const ManagementConsole = () => {
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Onboarding State
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    email: '',
    empId: '',
    role: 'USER'
  });

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  // Role is set by the server based on the Scaloz Workspace role — no hardcoded credentials
  const isAdmin = currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === 'MANAGER';
  const hasControlAccess = isAdmin || isManager;

  const canEditUser = (targetUser: User) => {
    if (!currentUser) return false;
    // Admin cannot edit themselves
    if (currentUser.role === 'ADMIN' && currentUser.id === targetUser.id) return false;
    // Managers cannot edit admins
    if (currentUser.role === 'MANAGER' && targetUser.role === 'ADMIN') return false;
    return true;
  };

  const canDeleteUser = (targetUser: User) => {
    if (!currentUser) return false;
    // Users cannot delete themselves (Admin or Manager)
    if (currentUser.id === targetUser.id) return false;
    // Managers cannot delete admins
    if (currentUser.role === 'MANAGER' && targetUser.role === 'ADMIN') return false;
    return true;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      const allUsers = res.data;
      setUsers(allUsers);
    } catch (err) { console.error(err); }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setSuccess(false);
    try {
      if (isEditing && editUserId) {
        await api.put(`/auth/users/${editUserId}`, onboardingData);
        addNotification('Success', 'User record updated successfully.', 'success');
        setIsEditing(false);
        setEditUserId(null);
      } else {
        await api.post('/auth/onboard', onboardingData);
        addNotification('Success', 'User onboarded and credentials sent successfully.', 'success');
        setSuccess(true);
        // Hide success message after 5 seconds
        setTimeout(() => setSuccess(false), 5000);
      }
      setOnboardingData({ name: '', email: '', empId: '', role: 'USER' });
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'onboard'} user.`;
      setFormError(msg);
      addNotification('Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (currentUser?.id === userId) {
      addNotification('Action Blocked', 'You cannot delete your own account.', 'error');
      return;
    }
    if (!window.confirm(`Remove ${userEmail} from the system?`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      addNotification('User Removed', `${userEmail} has been removed.`, 'success');
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to remove user.';
      addNotification('Error', msg, 'error');
    }
  };

  const handleEditClick = (user: User) => {
    setIsEditing(true);
    setEditUserId(user.id);
    setOnboardingData({
      name: user.name,
      email: user.email,
      empId: getDisplayEmployeeId(user.empId) || '',
      role: user.role
    });
    setFormError(null);
    setSuccess(false);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditUserId(null);
    setOnboardingData({ name: '', email: '', empId: '', role: 'USER' });
    setFormError(null);
  };

  return (
    <div className="h-full bg-[#f8fafc] flex flex-col font-sans animate-in fade-in duration-500 overflow-hidden">
      <header className="px-8 py-8 border-b border-[#e2e8f0] bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#00B3A4] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#00B3A4]/20">
                <Settings size={22} />
              </div>
              <h1 className="text-2xl font-black text-[#1e293b] tracking-tight">Management Console</h1>
            </div>
            <p className="text-[15px] text-[#00B3A4] font-normal">Enterprise User Onboarding & Management Workspace</p>
          </div>
          <div className="bg-[#eff6ff] px-4 py-2 rounded-full border border-[#dbeafe]">
            <span className="text-xs font-bold text-[#1d4ed8] flex items-center gap-2">
              <ShieldCheck size={14} />
              {isAdmin ? 'Admin Session' : 'Manager Session'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">

          {/* ONBOARDING FORM SECTION */}
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white p-8 rounded-[24px] border border-[#e2e8f0] shadow-sm sticky top-0">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#f1f5f9] text-[#475569] rounded-xl flex items-center justify-center">
                  {isEditing ? <Pencil size={20} className="text-[#1F6FEB]" /> : <UserPlus size={20} />}
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1e293b]">
                    {isEditing ? 'Update Personnel Record' : 'User Onboarding'}
                  </h3>
                  <p className="text-[13px] text-[#64748b]">
                    {isEditing ? `Modifying details for ${onboardingData.email}` : 'Configure access for new specialists'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleOnboard} className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[15px] font-bold text-[#475569] pl-1">
                    <Contact size={14} className="text-[#1F6FEB]" /> Full Name
                  </label>
                  <input
                    required
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] focus:bg-white focus:border-[#1F6FEB] focus:ring-4 focus:ring-[#1F6FEB]/5 rounded-xl text-[15px] outline-none transition-all placeholder:text-[#94a3b8]"
                    value={onboardingData.name}
                    onChange={e => setOnboardingData({ ...onboardingData, name: e.target.value })}
                  />
                </div>

                {/* Employee ID */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[15px] font-bold text-[#475569] pl-1">
                    <Hash size={14} className="text-[#1F6FEB]" /> Employee ID
                  </label>
                  <input
                    required
                    placeholder="e.g., M123 or R456"
                    className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] focus:bg-white focus:border-[#1F6FEB] focus:ring-4 focus:ring-[#1F6FEB]/5 rounded-xl text-[15px] outline-none transition-all placeholder:text-[#94a3b8]"
                    value={onboardingData.empId}
                    onChange={e => setOnboardingData({ ...onboardingData, empId: e.target.value })}
                  />
                  <p className="flex items-center gap-1.5 text-[13px] text-[#64748b] pl-1 font-medium">
                    <Info size={12} /> Format: One letter followed by numbers
                  </p>
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[15px] font-bold text-[#475569] pl-1">
                    <Mail size={14} className="text-[#1F6FEB]" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isEditing}
                    placeholder="user@company.com"
                    className={`w-full px-4 py-3 border border-[#e2e8f0] focus:ring-4 focus:ring-[#1F6FEB]/5 rounded-xl text-[15px] outline-none transition-all placeholder:text-[#94a3b8] ${isEditing ? 'bg-[#f1f5f9] text-[#64748b] cursor-not-allowed font-medium' : 'bg-[#f8fafc] focus:bg-white focus:border-[#1F6FEB]'}`}
                    value={onboardingData.email}
                    onChange={e => setOnboardingData({ ...onboardingData, email: e.target.value })}
                  />
                  <p className="flex items-center gap-1.5 text-[13px] text-[#64748b] pl-1 font-medium italic">
                    {isEditing ? <ShieldCheck size={12} /> : '🚀'} {isEditing ? 'Email identifier is locked for security' : 'Login credentials will be sent to this email'}
                  </p>
                </div>

                {/* System Role */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[15px] font-bold text-[#475569] pl-1">
                    <Briefcase size={14} className="text-[#1F6FEB]" /> System Role
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] focus:bg-white focus:border-[#1F6FEB] focus:ring-4 focus:ring-[#1F6FEB]/5 rounded-xl text-[15px] outline-none appearance-none transition-all"
                      value={onboardingData.role}
                      onChange={e => setOnboardingData({ ...onboardingData, role: e.target.value })}
                    >
                      {/* ADMIN can assign all three roles; MANAGER can only assign USER */}
                      <option value="USER">User</option>
                      {isAdmin && <option value="MANAGER">Manager</option>}
                      {isAdmin && <option value="ADMIN">Admin</option>}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b]">
                      <Users size={16} />
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-[13px] text-[#64748b] pl-1 font-medium">
                    <ShieldCheck size={12} />
                    {isAdmin
                      ? 'Admin: full access · Manager: onboard users · User: standard access'
                      : 'Managers can only onboard standard Users'}
                  </p>
                </div>

                {/* Auto-gen Password Info */}
                <div className="p-4 bg-[#fff7ed] rounded-xl border border-[#ffedd5] flex gap-3">
                  <Key size={18} className="text-[#f97316] shrink-0 mt-0.5" />
                  <p className="text-[13px] text-[#9a3412] leading-relaxed font-medium">
                    <strong>Auto-Generated Password:</strong> A secure temporary password will be automatically generated and sent via email. The user must change it on first login.
                  </p>
                </div>

                {/* Explicit Success Display */}
                {success && (
                  <div className="p-4 bg-[#f0fdf4] rounded-xl border border-[#dcfce7] flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="w-5 h-5 rounded-full bg-[#22c55e] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck size={12} />
                    </div>
                    <p className="text-[13px] text-[#166534] leading-relaxed font-bold">
                      SUCCESS: Credentials generated and dispatched via secure mail relay.
                    </p>
                  </div>
                )}

                {/* Explicit Error Display */}
                {formError && (
                  <div className="p-4 bg-[#fef2f2] rounded-xl border border-[#fee2e2] flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="w-5 h-5 rounded-full bg-[#ef4444] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Trash2 size={12} />
                    </div>
                    <p className="text-[13px] text-[#991b1b] leading-relaxed font-bold">
                      {formError}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 py-4 bg-[#f1f5f9] text-[#475569] rounded-xl text-[15px] font-black uppercase tracking-widest hover:bg-[#e2e8f0] transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-[2] py-4 rounded-xl text-[15px] font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 ${success
                      ? 'bg-[#22c55e] text-white shadow-[#22c55e]/20'
                      : 'bg-[#1F6FEB] text-white shadow-[#1F6FEB]/20 hover:bg-[#0B3D91]'
                      }`}
                  >
                    {success ? <ShieldCheck size={18} /> : isEditing ? <Pencil size={18} /> : <UserPlus size={18} />}
                    {loading ? (isEditing ? 'Updating Node...' : 'Processing Onboarding...') : success ? 'Action Successful!' : isEditing ? 'Save Personnel Changes' : 'Create User & Send Credentials'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* USER LIST SECTION */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-[24px] overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-black text-[#1e293b]">Active Workspace Personal</h3>
                  <p className="text-[13px] text-[#64748b] font-bold">Current Nodes: {users.length}</p>
                </div>
                <span className="bg-[#eff6ff] text-[#1d4ed8] text-[13px] font-bold px-3 py-1 rounded-full border border-[#dbeafe]">Live Access</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white text-[13px] font-bold text-[#64748b] border-b border-[#f1f5f9]">
                      <th className="px-6 py-4">Collaborator</th>
                      <th className="px-6 py-4">Node ID</th>
                      <th className="px-6 py-4">Permissions</th>
                      <th className="px-6 py-4">Status</th>
                      {hasControlAccess && <th className="px-6 py-4 text-right">Control</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#00B3A4] text-white flex items-center justify-center font-bold text-[13px] shadow-md shadow-[#00B3A4]/15 uppercase transition-transform group-hover:scale-110">{u.name.charAt(0)}</div>
                            <div>
                              <p className="text-[15px] font-bold text-[#1e293b]">{u.name}</p>
                              <p className="text-[13px] text-[#64748b] font-medium">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[15px] font-bold text-[#475569]">
                          {getDisplayEmployeeId(u.empId) || 'FT-NULL'}
                        </td>
                        <td className="px-6 py-4">
                          {u.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-black tracking-wider bg-[#e6f7f6] text-[#00B3A4] ring-1 ring-[#00B3A4]/30">
                              <Shield size={13} strokeWidth={2.5} ></Shield>
                              Admin
                            </span>
                          ) : u.role === 'MANAGER' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-black tracking-wider bg-[#e6f7f6] text-[#00B3A4] ring-1 ring-[#00B3A4]/30">
                              <UserCog size={13} strokeWidth={2.5} />
                              Manager
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-black tracking-wider bg-[#e6f7f6] text-[#00B3A4] ring-1 ring-[#00B3A4]/30">
                              <UserIcon size={13} strokeWidth={2.5} />
                              User
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[15px] font-bold text-[#059669]">Sync'd</span>
                          </div>
                        </td>
                        {hasControlAccess && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEditUser(u) && (
                                <button
                                  onClick={() => handleEditClick(u)}
                                  className="p-2 text-[#94a3b8] hover:text-[#1F6FEB] hover:bg-[#E9F2FF] rounded-lg transition-all"
                                  title="Edit user"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {canDeleteUser(u) && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="p-2 text-[#94a3b8] hover:text-white hover:bg-[#ef4444] rounded-lg transition-all"
                                  title="Revoke access"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>



          </div>

        </div>
      </div>
    </div>
  );
};

export default ManagementConsole;
