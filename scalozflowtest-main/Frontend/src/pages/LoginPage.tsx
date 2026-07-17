import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Eye, EyeOff, Calendar, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

import customLogo from '../assets/logo-flowtrack.png';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { identifier, password });
      const { token, id, name, role, email, passwordResetRequired } = response.data;
      login({ token, id, name, email, role, passwordResetRequired });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      <div className="w-full md:w-1/2 bg-[#0B3D91] p-8 md:p-16 flex flex-col justify-between text-white relative">
        <div className="flex items-center gap-3">
          <img src={customLogo} alt="ScalozFlow Logo" className="w-10 h-10" />
          <span className="text-xl font-bold">ScalozFlow</span>
        </div>
        <div className="max-w-md my-auto py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-white">
            Empower Your Team to Achieve More.
          </h1>
          <p className="text-gray-400 text-sm mb-12 leading-relaxed">
            ScalozFlow offers a comprehensive toolkit to streamline project management and foster collaborative growth.
          </p>
          <div className="space-y-4">
            <div className="bg-[#0B3D91] border border-[#1E265C] rounded-[8px] p-4 flex gap-4 items-start">
              <div className="bg-[#0B3D91] p-2.5 rounded-[8px] text-blue-400 flex-shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Agile Roadmap Planning</h3>
                <p className="text-white text-xs leading-relaxed">
                  Align daily tasks with long-term strategic goals and visualize dependencies.
                </p>
              </div>
            </div>
            <div className="bg-[#0B3D91] border border-[#1E265C] rounded-[8px] p-4 flex gap-4 items-start">
              <div className="bg-[#0B3D91] p-2.5 rounded-[8px] text-blue-400 flex-shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Customizable Collaboration</h3>
                <p className="text-white text-xs leading-relaxed">
                  Discussion threads and file sharing right where the work happens, plus flexible views.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-gray-600 text-xs mt-auto pt-8">
          © 2026 ScalozFlow Co. All rights reserved.
        </div>
      </div>

      <div className="w-full md:w-1/2 bg-white p-8 md:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <img src={customLogo} alt="Logo" className="w-14 h-14 mb-4" />
            <h2 className="text-[#0D1543] text-2xl font-bold tracking-tight">ScalozFlow</h2>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-[8px] text-sm mb-6 text-center border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address / EMP ID</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="w-full h-12 bg-[#EBF1FF] border border-[#D9E4FF] rounded-[8px] px-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter your email or Employee ID"
                />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full h-12 bg-[#EBF1FF] border border-[#D9E4FF] rounded-[8px] px-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#0B3D91] hover:bg-[#082E6E] text-white rounded-[8px] font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-[8px] animate-spin" />
              ) : (
                <>
                  Login <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
