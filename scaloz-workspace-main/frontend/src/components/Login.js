import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import "./Login.css";
import scalozLogo from "../assets/Scaloz.png";

/* ─── Static feature cards shown when no slides are uploaded ─── */
const FEATURE_CARDS = [
  {
    icon: "🏢",
    title: "Smart Multi-Tenant Enterprise Platform",
    description:
      "Deploy, manage, and scale business-critical modules across multiple products using the unified Scaloz SaaS framework.",
  },
  {
    icon: "🔐",
    title: "Centralized Identity & Access Management",
    description:
      "Single Sign-On across all your Xevyte products. One set of credentials, seamless and secure access everywhere.",
  },
  {
    icon: "⚡",
    title: "Real-Time Sync Across Modules",
    description:
      "Changes propagate instantly across Xev-Hire, XevyTalk, and all integrated products — zero manual coordination.",
  },
  {
    icon: "📊",
    title: "Unified Analytics & Reporting",
    description:
      "Cross-product insights, performance dashboards, and audit trails — all from one intelligent control centre.",
  },
];

function Login({ onLoginSuccess }) {
  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:8085/api";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── Slide state (backend images) ── */
  const [slides, setSlides] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slidesLoaded, setSlidesLoaded] = useState(false);

  /* ── Feature card state (fallback) ── */
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFading, setCardFading] = useState(false);

  /* ── Fetch slides from backend ── */
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/public/slides`);
        if (res.ok) {
          const data = await res.json();
          // Only accept slides that actually have an imageUrl
          const validSlides = Array.isArray(data)
            ? data.filter((s) => s.imageUrl && s.imageUrl.trim() !== "")
            : [];
          setSlides(validSlides);
        }
      } catch (err) {
        // backend unavailable — fall back to feature cards silently
        console.warn("Could not fetch login slides:", err.message);
      } finally {
        setSlidesLoaded(true);
      }
    };
    fetchSlides();
  }, [API_BASE_URL]);

  /* ── Auto-advance backend slides ── */
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides]);

  /* ── Auto-advance feature cards with fade ── */
  useEffect(() => {
    if (slides.length > 0) return; // backend slides take priority
    const timer = setInterval(() => {
      setCardFading(true);
      setTimeout(() => {
        setCardIndex((prev) => (prev + 1) % FEATURE_CARDS.length);
        setCardFading(false);
      }, 400); // fade-out duration
    }, 4000);
    return () => clearInterval(timer);
  }, [slides]);

  /* ── Login submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Invalid credentials");
      const data = await response.json();
      localStorage.setItem("super_admin_token", data.token);
      localStorage.setItem("super_admin_username", data.username);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your backend.");
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────── Left panel content ─────────────── */
  const renderLeftPanel = () => {
    /* Case 1: Backend slides with images loaded */
    if (slidesLoaded && slides.length > 0) {
      const slide = slides[slideIndex];
      return (
        <div className="login-card-module">
          <div className="slide-image-wrapper">
            <img
              key={slideIndex}
              src={slide.imageUrl}
              alt={slide.title || "Slide"}
              className="slide-image slide-img-anim"
            />
          </div>
          {slide.title && (
            <h2 className="slide-title">{slide.title}</h2>
          )}
          {slide.description && (
            <p className="slide-description">{slide.description}</p>
          )}
          {slides.length > 1 && (
            <div className="slide-dots">
              {slides.map((_, idx) => (
                <span
                  key={idx}
                  className={`slide-dot ${idx === slideIndex ? "active" : ""}`}
                  onClick={() => setSlideIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    /* Case 2: No backend slides — animated feature cards */
    const card = FEATURE_CARDS[cardIndex];
    return (
      <div className={`feature-card-module ${cardFading ? "card-fade-out" : "card-fade-in"}`}>
        {/* Decorative background orbs */}
        <div className="fc-orb fc-orb-1" />
        <div className="fc-orb fc-orb-2" />

        {/* Icon */}
        <div className="fc-icon-wrap">
          <span className="fc-icon">{card.icon}</span>
        </div>

        {/* Text */}
        <h2 className="fc-title">{card.title}</h2>
        <p className="fc-desc">{card.description}</p>

        {/* Progress dots */}
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
    );
  };

  /* ─────────────── Render ─────────────── */
  return (
    <div className="login-container">
      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="top-left-logo">
          <img src={scalozLogo} alt="Scaloz Logo" />
        </div>
        <div className="left-panel-inner">{renderLeftPanel()}</div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="login-card">
          <div className="login-header">
            <h2>Sign in to your workspace</h2>
            <p>Enter your credentials to access your workspace</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Login ID</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your employee ID"
                required
              />
            </div>

            <div className="form-group">
              <div className="forgot-row">
                <label htmlFor="password">Password</label>
                <a href="#forgot-password" className="forgot-link">
                  Forgot password?
                </a>
              </div>
              <div className="password-group">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <div className="error-message" style={{ marginTop: "6px" }}>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              <span>{loading ? "Authenticating..." : "Log In"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="global-footer-text">
          <span>© 2026 XevyteHub. Powered by Xevyte Technologies</span>
          <div className="footer-links">
            <a href="#terms">Terms &amp; Conditions</a>
            <span className="separator">|</span>
            <a href="#privacy">Privacy Policy</a>
            <span className="separator">|</span>
            <a href="#cookies">Cookies Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
