import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';

interface ToastProps {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ title, message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: { bg: 'bg-[#E3FCEF]', border: 'border-[#36B37E]', text: 'text-[#006644]', icon: <CheckCircle className="text-[#36B37E]" size={20} /> },
    error: { bg: 'bg-[#FFEBE6]', border: 'border-[#BF2600]', text: 'text-[#BF2600]', icon: <AlertCircle className="text-[#BF2600]" size={20} /> },
    warning: { bg: 'bg-[#FFF0B3]', border: 'border-[#FF8B00]', text: 'text-[#854600]', icon: <Zap className="text-[#FF8B00]" size={20} /> },
    info: { bg: 'bg-[#DEEBFF]', border: 'border-[#1F6FEB]', text: 'text-[#0747A6]', icon: <Info className="text-[#1F6FEB]" size={20} /> }
  };

  const style = styles[type] || styles.info;

  return (
    <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-4 p-4 rounded-lg border-l-4 shadow-2xl transition-all duration-300 transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'} ${style.bg} ${style.border} max-w-sm`}>
      <div className="shrink-0">
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-black uppercase tracking-tight ${style.text} mb-0.5`}>{title}</h4>
        <p className="text-[12px] font-medium text-[#172B4D] leading-snug">{message}</p>
      </div>
      <button 
        onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
        className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0"
      >
        <X size={16} className="text-[#6B778C]" />
      </button>
    </div>
  );
};

export default Toast;
