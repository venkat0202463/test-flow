import React from 'react';

/*
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Calendar, Users, ArrowRight } from 'lucide-react';
import api from '../services/api';

// Asset Imports (Logo of the application)
import customLogo from '../assets/logo-flowtrack.png';

 * ForgotPasswordPage Component
 * Provides a user interface for users who have forgotten their password.
 * Users submit their email address to receive a secure password reset link.
 * 
 * Features:
 * - Responsive split layout (identical marketing sidebar to LoginPage).
 * - Async submission with validation and visual success feedback.

const ForgotPasswordPageOriginal = () => {
  // State for holding the user's email input
  const [email, setEmail] = useState('');
  
  // State for success messaging returned from the API
  const [message, setMessage] = useState('');
  
  // State for tracking and showing any errors during submission
  const [error, setError] = useState('');
  
  // State to show a loading/busy indicator during the API call
  const [isLoading, setIsLoading] = useState(false);
  
  // State indicating if the reset email link has been sent successfully
  const [isSent, setIsSent] = useState(false);

  // handleSubmit
  // Submits the user's email to the backend auth endpoint to request a reset link.
  // On success, shows a confirmation message. On failure, shows an error notification.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      // Send a POST request containing the email address to initiate the reset workflow
      const response = await api.post('/auth/forgot-password', { email });
      
      // Store backend's success message
      setMessage(response.data.message);
      
      // Update state to show the email sent success UI screen
      setIsSent(true);
    } catch (err: any) {
      // Capture and show API errors or fallback message
      setError(err.response?.data?.message || 'Failed to send reset link');
    } finally {
      // Clear loading state
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

        <div className="w-full max-sm:w-full max-w-sm">
          {/* Form Logo & Header * /}
          <div className="flex flex-col items-center mb-10">
            <img src={customLogo} alt="Logo" className="w-14 h-14 mb-4" />
            <h2 className="text-[#0D1543] text-2xl font-bold tracking-tight">ScalozFlow</h2>
            {isSent ? null : (
              <p className="text-gray-500 text-sm mt-2 text-center">
                Enter your email to reset your password
              </p>
            )}
          </div>

          {isSent ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100">
                  <CheckCircle className="text-green-500" size={32} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#0D1543]">Check your email</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {message || "We've sent a password reset link to your email address."}
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline mt-4"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 text-center border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field * /}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      className="w-full h-12 bg-[#EBF1FF] border border-[#D9E4FF] rounded-lg px-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 outline-none transition-all"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Enter Email"
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                      Send Reset Link <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Back to Login * /}
                <div className="text-center mt-6">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
*/

const ForgotPasswordPage = () => {
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

export default ForgotPasswordPage;
