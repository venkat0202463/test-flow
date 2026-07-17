import { X, Mail, Shield, User } from 'lucide-react';
import type { User as UserType } from '../types';

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: UserType[];
  projectName: string;
}

const TeamMembersModal = ({ isOpen, onClose, members, projectName }: TeamMembersModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091E42]/50 z-[3000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DFE1E6] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-[#172B4D]">Team Members</h2>
            <p className="text-[12px] text-[#5E6C84] font-medium">{projectName}</p>
          </div>
          <button 
            onClick={onClose} 
            className="hover:bg-[#F4F5F7] p-2 rounded-full text-[#42526E] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 custom-scrollbar">
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center gap-4 p-3 bg-white border border-[#DFE1E6] rounded-lg hover:border-[#1F6FEB] hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1F6FEB] flex items-center justify-center text-sm font-black text-white uppercase shadow-sm shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-[#172B4D] truncate group-hover:text-[#1F6FEB] transition-colors">
                        {member.name}
                      </h3>
                      {member.role?.toUpperCase() === 'MANAGER' && (
                        <span className="px-1.5 py-0.5 bg-[#EAE6FF] text-[#403294] text-[9px] rounded font-bold uppercase border border-[#D1CAFF]">
                          Lead
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[11px] text-[#5E6C84] font-medium">
                        <Mail size={10} />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#5E6C84] font-medium uppercase tracking-wider">
                        <Shield size={10} />
                        <span>{member.role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-[#F4F5F7] rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-[#A5ADBA]" />
              </div>
              <p className="text-[#5E6C84] font-medium">No team members assigned yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DFE1E6] flex items-center justify-end bg-[#F4F5F7]/50">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-white border border-[#DFE1E6] text-[#172B4D] text-sm font-bold rounded hover:bg-[#EBECF0] transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamMembersModal;
