import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { getTenantSubdomain } from "../utils/tenant";
import "./LoginPage.css";
import { FiArrowLeft, FiChevronRight, FiCheckCircle } from "react-icons/fi";
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

function ForgotPassword() {
  const [employeeId, setEmployeeId] = useState("");
  const [tenantInfo, setTenantInfo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /* ── Slide states ── */
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  /* ── Feature card state (fallback) ── */
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFading, setCardFading] = useState(false);

  useEffect(() => {
    const sub = getTenantSubdomain();
    if (sub && sub !== "www" && sub !== "scaloz") {
      api.get(`/public/tenant-info/subdomain/${sub}`)
        .then(res => setTenantInfo(res.data))
        .catch(err => console.error("Subdomain lookup failed:", err));
    }
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let finalId = employeeId.trim();
      if (tenantInfo?.code && !finalId.includes('@')) {
        if (!finalId.startsWith(tenantInfo.code + "_")) {
          finalId = `${tenantInfo.code}_${finalId}`;
        }
      }
      const res = await api.post("/auth/forgot-password", {
        employeeId: finalId
      });
      if (res.status === 200) {
        setSuccess(true);
      } else {
        setError("Something went wrong. Try again.");
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Invalid Employee ID or Email. Please try again.");
      } else {
        setError(err.response?.data?.message || "Server error. Try again later.");
      }
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
          {success ? (
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
                Request Received
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, lineHeight: "1.6" }}>
                If an account exists for this Employee ID, a password reset link has been sent.
              </p>
              <Link to="/" className="auth-back-link" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                <FiArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="form-card-header">
                <h2>Forgot Password?</h2>
                <p>Enter your employee ID or email and we'll send a password reset link to your registered work email.</p>
              </div>

              <form onSubmit={handleSubmit} className="enterprise-form">
                <div className="enterprise-field">
                  <label htmlFor="empId">Employee ID or Work Email</label>
                  <input
                    id="empId"
                    type="text"
                    placeholder="Enter employee ID or email"
                    value={employeeId}
                    onChange={(e) => { setEmployeeId(e.target.value); if (error) setError(""); }}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="enterprise-error" role="alert">{error}</div>
                )}

                <button type="submit" className="enterprise-signin-btn" disabled={loading || !employeeId}>
                  {loading
                    ? "Sending..."
                    : <><span>Send Reset Link</span><FiChevronRight size={18} /></>
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

export default ForgotPassword;
