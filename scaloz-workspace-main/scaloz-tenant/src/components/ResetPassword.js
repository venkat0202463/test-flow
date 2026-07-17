import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../api";
import "./LoginPage.css";
import { FiChevronRight, FiEye, FiEyeOff, FiCheckCircle, FiArrowLeft } from "react-icons/fi";
import scalozLogo from "../assets/Scaloz.png";

/* ─── Static feature cards shown when no slides are uploaded ─── */
const FEATURE_CARDS = [
  {
    icon: "🏢",
    title: "Unified Tenant Enterprise Platform",
    description: "Access all your business-critical tools, departments, and workspace modules from a single dashboard.",
  },
  {
    icon: "👥",
    title: "Smart HRMS & Personnel Hub",
    description: "Streamline employee management, attendance tracking, leaves, and core operations with intelligent workflows.",
  },
  {
    icon: "🔐",
    title: "Enterprise-Grade Security & SSO",
    description: "Your session is secured with advanced encryption and centralized single sign-on across the ecosystem.",
  },
  {
    icon: "⚡",
    title: "Seamless Real-Time Collaboration",
    description: "Communicate, manage tasks, and coordinate with team members instantly across modules.",
  }
];

function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ── Slide states ── */
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  /* ── Feature card state (fallback) ── */
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFading, setCardFading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tok = params.get("token");
    if (tok) {
      setToken(tok);
    } else {
      setError("Reset token is missing or invalid. Please check your email link again.");
    }
  }, [location]);

  /* ── Fetch slides from backend ── */
  useEffect(() => {
    api.get("/public/slides")
      .then(res => {
        if (res.data) {
          const validSlides = Array.isArray(res.data)
            ? res.data.filter(s => s.imageUrl && s.imageUrl.trim() !== "")
            : [];
          setSlides(validSlides);
        }
      })
      .catch(err => {
        console.error("Error fetching slides", err);
      });
  }, []);

  /* ── Auto-advance backend slides ── */
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides]);

  /* ── Auto-advance feature cards with fade ── */
  useEffect(() => {
    if (slides.length > 0) return;
    const timer = setInterval(() => {
      setCardFading(true);
      setTimeout(() => {
        setCardIndex((prev) => (prev + 1) % FEATURE_CARDS.length);
        setCardFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides]);

  const getStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };
  const strength = getStrength(newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"][strength];

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\\d]).{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      setError("Password must be at least 8 characters, include uppercase, lowercase, number, and special character.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/reset-password", {
        token,
        newPassword
      });

      if (res.status === 200) {
        setMessage("Password reset successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        setError("Failed to reset password. Try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enterprise-login-container">
      {/* Top Left Global Logo */}
      <div className="top-left-logo">
        <img src={scalozLogo} alt="Scaloz Logo" />
      </div>

      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="left-panel-inner">
          <div className="left-showcase">
            {slides.length > 0 ? (
              <div className="login-card-module">
                <div className="slide-image-wrapper">
                  <img
                    src={slides[currentSlideIndex].imageUrl}
                    alt={slides[currentSlideIndex].title || "Slide"}
                    className="slide-image slide-img-anim"
                    key={currentSlideIndex}
                  />
                </div>
                {slides[currentSlideIndex].title && (
                  <h2 className="slide-title">{slides[currentSlideIndex].title}</h2>
                )}
                {slides[currentSlideIndex].description && (
                  <p className="slide-description">{slides[currentSlideIndex].description}</p>
                )}

                {slides.length > 1 && (
                  <div className="slide-dots" style={{ marginTop: (slides[currentSlideIndex].title || slides[currentSlideIndex].description) ? "0px" : "16px" }}>
                    {slides.map((_, idx) => (
                      <span
                        key={idx}
                        className={`slide-dot ${idx === currentSlideIndex ? 'active' : ''}`}
                        onClick={() => setCurrentSlideIndex(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Fallback feature cards */
              <div className={`feature-card-module ${cardFading ? "card-fade-out" : "card-fade-in"}`}>
                <div className="fc-orb fc-orb-1" />
                <div className="fc-orb fc-orb-2" />
                <div className="fc-icon-wrap">
                  <span className="fc-icon">{FEATURE_CARDS[cardIndex].icon}</span>
                </div>
                <h2 className="fc-title">{FEATURE_CARDS[cardIndex].title}</h2>
                <p className="fc-desc">{FEATURE_CARDS[cardIndex].description}</p>
                <div className="fc-dots">
                  {FEATURE_CARDS.map((_, idx) => (
                    <button
                      key={idx}
                      className={`fc-dot ${idx === cardIndex ? "active" : ""}`}
                      onClick={() => {
                        setCardFading(true);
                        setTimeout(() => {
                          setCardIndex(idx);
                          setCardFading(false);
                        }, 300);
                      }}
                      aria-label={`Feature ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="login-form-card">
          {message ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: 72, height: 72,
                background: "linear-gradient(135deg,#16a34a,#22c55e)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
                margin: "0 auto 24px",
                boxShadow: "0 12px 28px rgba(34,197,94,0.25)"
              }}>
                <FiCheckCircle size={32} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                Password Reset!
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28 }}>
                {message}
              </p>
            </div>
          ) : (
            <>
              <div className="form-card-header">
                <h2>Reset Your Password</h2>
                <p>Choose a secure new password for your account.</p>
              </div>

              <form onSubmit={handleResetPassword} className="enterprise-form">
                {/* New Password */}
                <div className="enterprise-field">
                  <label>New Password</label>
                  <div className="password-field-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); if (error) setError(""); }}
                      required
                      disabled={!token}
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle visibility" disabled={!token}>
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>

                  {/* Password strength bars */}
                  {newPassword && (
                    <div className="pw-strength" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <div className="pw-strength-bars" style={{ display: "flex", gap: 4, flex: 1 }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="pw-bar" style={{ height: 4, flex: 1, borderRadius: 2, background: i <= strength ? strengthColor : "#E5E7EB" }} />
                        ))}
                      </div>
                      <span style={{ color: strengthColor, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="enterprise-field">
                  <label>Confirm Password</label>
                  <div className="password-field-wrap">
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(""); }}
                      required
                      disabled={!token}
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)} aria-label="Toggle visibility" disabled={!token}>
                      {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 500, marginTop: 4, display: "block" }}>Passwords do not match</span>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500, marginTop: 4, display: "block" }}>✓ Passwords match</span>
                  )}
                </div>

                {error && (
                  <div className="enterprise-error" role="alert">{error}</div>
                )}

                <button type="submit" className="enterprise-signin-btn" disabled={loading || !token || !newPassword || newPassword !== confirmPassword}>
                  {loading
                    ? "Updating..."
                    : <><span>Reset Password</span><FiChevronRight size={18} /></>
                  }
                </button>
              </form>

              <Link to="/" className="auth-back-link" style={{ marginTop: "24px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FiArrowLeft size={15} /> Back to Log In
              </Link>
            </>
          )}
        </div>

        <div className="global-footer-text">
          <span>© {new Date().getFullYear()} Scaloz. Powered by Xevyte Technologies</span>
          <div className="footer-links">
            <a href="/policy/terms_and_conditions" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
            <span className="separator">|</span>
            <a href="/policy/privacy_policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <span className="separator">|</span>
            <a href="/policy/cookies_policy" target="_blank" rel="noopener noreferrer">Cookies Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
