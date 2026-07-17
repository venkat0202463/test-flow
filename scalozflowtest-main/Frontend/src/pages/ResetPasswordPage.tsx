import React from 'react';

/*
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ShieldAlert, CheckCircle2, ArrowRight, Eye, EyeOff, Calendar, Users, ArrowLeft } from 'lucide-react';

// Asset Imports (Logo of the application)
import customLogo from '../assets/logo-flowtrack.png';

 * ResetPasswordPage Component
 * Handles the password update operation. 
 * Supports two distinct user flows:
 * 
 * 1. Recovery Flow: The user navigated here via a password-reset email containing a 'token' query param.
 * 2. Onboarding/First-Login Flow: The user is logged in, but their account flag `passwordResetRequired` is true.
 *    In this case, they must update their default password before navigating the rest of the application.

const ResetPasswordPageOriginal = () => {
    // State for the new password input field
    const [newPassword, setNewPassword] = useState('');
    
    // State for the confirm password input field (to check for match validation)
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // State for holding any API error messages or verification failure warnings
    const [error, setError] = useState('');
    
    // State to show loading spinner state during network updates
    const [isLoading, setIsLoading] = useState(false);
    
    // State indicating if the password was successfully reset/updated
    const [isSuccess, setIsSuccess] = useState(false);
    
    // Toggle flags for showing/hiding password characters in the fields
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Hook to access query parameters from the active URL (e.g. ?token=...)
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    // Hook to pull current user session context
    const { user, login } = useAuth();
    
    // Hook to redirect programmatically
    const navigate = useNavigate();

    // Effect: Enforce authorization. If there is neither a logged-in user session 
    // nor a security token in the URL, redirect user to the homepage immediately.
    useEffect(() => {
        if (!user && !token) {
            navigate('/');
        }
    }, [user, token, navigate]);

    // handleReset
    // Form submission handler. Validates passwords match, calls the correct endpoint
    // depending on the active flow, and handles successful completion.
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Front-end confirmation match check
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (token) {
                // Flow 1: Public reset flow using the URL query token
                await api.post('/auth/reset-password', {
                    token,
                    newPassword
                });
            } else if (user) {
                // Flow 2: In-session onboarding profile update
                await api.put('/auth/profile-update', {
                    password: newPassword,
                    passwordResetRequired: false
                });
                
                // Update local Context details to clear the passwordResetRequired flag
                login({ ...user, passwordResetRequired: false });
            }

            // Flag success state to render confirmation graphics
            setIsSuccess(true);
            
            // Redirect page after a brief 3-second delay so user can read success feedback
            setTimeout(() => {
                navigate(user ? '/dashboard' : '/', { replace: true });
            }, 3000);
        } catch (err: any) {
            // Set error details
            setError(err.response?.data?.message || 'Failed to update password');
        } finally {
            // Clear loading spinner
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">

            {/* Left Side - Dark Blue with Features (Same as Login) * /}
            <div className="w-full md:w-1/2 bg-[#0B3D91] p-8 md:p-16 flex flex-col justify-between text-white relative">

                {/* Logo and Branding * /}
                <div className="flex items-center gap-3">
                    <img src={customLogo} alt="ScalozFlow Logo" className="w-10 h-10" />
                    <span className="text-xl font-bold">ScalozFlow</span>
                </div>

                {/* Hero Section * /}
                <div className="max-w-md my-auto py-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-white">
                        Empower Your Team to Achieve More.
                    </h1>
                    <p className="text-gray-400 text-sm mb-12 leading-relaxed">
                        ScalozFlow offers a comprehensive toolkit to streamline project management and foster collaborative growth.
                    </p>

                    {/* Feature Boxes * /}
                    <div className="space-y-4">
                        {/* Feature 1 * /}
                        <div className="bg-[#0B3D91] border border-[#1E265C] rounded-xl p-4 flex gap-4 items-start">
                            <div className="bg-[#0B3D91] p-2.5 rounded-lg text-blue-400 flex-shrink-0">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm mb-1">Agile Roadmap Planning</h3>
                                <p className="text-white text-xs leading-relaxed">
                                    Align daily tasks with long-term strategic goals and visualize dependencies.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 * /}
                        <div className="bg-[#0B3D91] border border-[#1E265C] rounded-xl p-4 flex gap-4 items-start">
                            <div className="bg-[#0B3D91] p-2.5 rounded-lg text-blue-400 flex-shrink-0">
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

                {/* Footer * /}
                <div className="text-gray-600 text-xs mt-auto pt-8">
                    © 2026 ScalozFlow Co. All rights reserved.
                </div>
            </div>

            {/* Right Side - Form * /}
            <div className="w-full md:w-1/2 bg-white p-8 md:p-16 flex flex-col justify-center items-center">

                <div className="w-full max-w-sm">
                  {/* Form Logo & Header * /}
                  <div className="flex flex-col items-center mb-10">
                      <img src={customLogo} alt="Logo" className="w-14 h-14 mb-4" />
                      <h2 className="text-[#0D1543] text-2xl font-bold tracking-tight">ScalozFlow</h2>
                      {!isSuccess && (
                          <p className="text-gray-500 text-sm mt-2 text-center">
                              {token ? 'Enter your new security key' : 'Establish your permanent access key'}
                          </p>
                      )}
                  </div>

                  {isSuccess ? (
                      <div className="text-center space-y-6">
                          <div className="flex justify-center">
                              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100">
                                  <CheckCircle2 className="text-green-500" size={32} />
                              </div>
                          </div>
                          <div className="space-y-2">
                              <h3 className="text-lg font-bold text-[#0D1543]">Security Updated</h3>
                              <p className="text-sm text-gray-500 leading-relaxed">
                                  Your password has been successfully reset. Redirecting you...
                              </p>
                          </div>
                      </div>
                  ) : (
                      <>
                          {error && (
                              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 text-center border border-red-100 flex items-center justify-center gap-2">
                                  <ShieldAlert size={16} /> {error}
                              </div>
                          )}

                          <div className="text-center mb-6">
                              <h3 className="text-lg font-bold text-[#0D1543]">
                                  {token ? 'Reset Password' : 'Secure Your Account'}
                              </h3>
                          </div>

                          <form onSubmit={handleReset} className="space-y-6">
                              {/* New Password Field * /}
                              <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Password</label>
                                  <div className="relative">
                                      <input
                                          type={showNewPassword ? "text" : "password"}
                                          required
                                          className="w-full h-12 bg-[#EBF1FF] border border-[#D9E4FF] rounded-lg px-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                          value={newPassword}
                                          onChange={e => setNewPassword(e.target.value)}
                                          placeholder="••••••••"
                                      />
                                      <button
                                          type="button"
                                          onClick={() => setShowNewPassword(!showNewPassword)}
                                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                      >
                                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                      </button>
                                  </div>
                              </div>

                              {/* Confirm Password Field * /}
                              <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm Password</label>
                                  <div className="relative">
                                      <input
                                          type={showConfirmPassword ? "text" : "password"}
                                          required
                                          className="w-full h-12 bg-[#EBF1FF] border border-[#D9E4FF] rounded-lg px-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                          value={confirmPassword}
                                          onChange={e => setConfirmPassword(e.target.value)}
                                          placeholder="••••••••"
                                      />
                                      <button
                                          type="button"
                                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                      >
                                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                      </button>
                                  </div>
                              </div>

                              {/* Submit Button * /}
                              <button
                                  type="submit"
                                  disabled={isLoading}
                                  className="w-full h-12 bg-[#0B3D91] hover:bg-[#082E6E] text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
                              >
                                  {isLoading ? (
                                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                      <>
                                          {token ? 'Reset Password' : 'Initialize Access'} <ArrowRight size={16} />
                                      </>
                                  )}
                              </button>

                              {/* Back to Login (Only if via token reset) * /}
                              {token && (
                                  <div className="text-center mt-6">
                                      <Link
                                          to="/"
                                          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                                      >
                                          <ArrowLeft size={16} />
                                          Back to Login
                                      </Link>
                                  </div>
                              )}
                          </form>
                      </>
                  )}
                </div>
            </div>
        </div>
    );
};
*/

const ResetPasswordPage = () => {
  React.useEffect(() => {
    const { protocol, hostname } = window.location;
    let targetHost = hostname;
    let portSuffix = '';
    
    // Parse tenant from subdomain if present (e.g. company.scalozflowtest.scaloz.com or company.localhost)
    let tenantSubdomain = '';
    const parts = hostname.split('.');
    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      portSuffix = ':3001';
      if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
        tenantSubdomain = parts[0];
      }
      if (tenantSubdomain) {
        targetHost = `${tenantSubdomain}.localhost`;
      }
    } else {
      // Replaces 'scalozflowtest' with 'workspacetest' in production
      targetHost = hostname.replace(/\bscalozflowtest\b/gi, 'workspacetest');
    }
    
    window.location.replace(`${protocol}//${targetHost}${portSuffix}/`);
  }, []);

  return null;
};

export default ResetPasswordPage;
