import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { getTenantSubdomain } from "../utils/tenant";
import "./LoginPage.css";
import { FiEye, FiEyeOff, FiChevronRight, FiMail, FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import scalozLogo from "../assets/Scaloz.png";

/* ─────────────────────────────────────────────────────────────
   Helper: debounce
───────────────────────────────────────────────────────────── */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─────────────────────────────────────────────────────────────
   Small product badge icon
───────────────────────────────────────────────────────────── */
function ProductBadge({ product }) {
  const name = (product.productName || "").toLowerCase();
  const colorMap = {
    hrms: { bg: "#EEF2FF", color: "#4338CA", label: "HR" },
    mail: { bg: "#EFF6FF", color: "#1D4ED8", label: "✉" },
    chat: { bg: "#F0FDF4", color: "#15803D", label: "💬" },
    project: { bg: "#FFFBEB", color: "#B45309", label: "📋" },
    crm: { bg: "#FDF4FF", color: "#7E22CE", label: "CRM" },
    calendar: { bg: "#FFF7ED", color: "#C2410C", label: "📅" },
  };
  const matched = Object.entries(colorMap).find(([k]) => name.includes(k));
  const style = matched ? matched[1] : { bg: "#F3F4F6", color: "#374151", label: "◆" };

  return (
    <span
      className="product-badge"
      style={{ background: style.bg, color: style.color }}
      title={product.productName}
    >
      <span className="product-badge-icon">{style.label}</span>
      <span className="product-badge-name">{product.productName}</span>
    </span>
  );
}

const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/uploads") || url.startsWith("uploads/")) {
    const cleanPath = url.startsWith("/") ? url : `/${url}`;
    const baseURL = api.defaults.baseURL || "";
    const serverBase = baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
    return `${serverBase}${cleanPath}`;
  }
  const lower = url.toLowerCase().trim();
  const isLegacy = lower.endsWith(".png") ||
                   lower.endsWith(".jpg") ||
                   lower.endsWith(".jpeg") ||
                   lower.endsWith(".gif") ||
                   lower.endsWith(".svg") ||
                   lower.includes("/") ||
                   lower.includes("\\");
  if (isLegacy) {
    const cleanPath = url.startsWith("uploads/") ? `/${url}` : `/uploads/logos/${url}`;
    const baseURL = api.defaults.baseURL || "";
    const serverBase = baseURL.endsWith("/api") ? baseURL.slice(0, -4) : baseURL;
    return `${serverBase}${cleanPath}`;
  }
  return `data:image/png;base64,${url}`;
};

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

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────── */
function LoginPage() {
  const navigate = useNavigate();

  /* ── SSO: Read redirect_to from URL query params ── */
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isLogout = params.get('logout') === 'true' || params.get('action') === 'logout';
    if (isLogout) {
      sessionStorage.clear();
      localStorage.clear();
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const rt = params.get('redirect_to');
    if (rt) {
      console.log('[SSO] Login request came from:', rt);
      setRedirectTo(rt);

      // Clean redirect_to from the URL bar so the user sees a clean URL
      params.delete('redirect_to');
      const newSearch = params.toString();
      const cleanURL = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, document.title, cleanURL);
    }
  }, []);
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      const params = new URLSearchParams(window.location.search);
      const rt = params.get('redirect_to') || redirectTo;
      if (rt) {
        console.log('[SSO] Active token found, auto-redirecting to:', rt);
        const separator = rt.includes('?') ? '&' : '?';
        window.location.href = `${rt}${separator}scaloz_token=${encodeURIComponent(token)}`;
      } else {
        navigate("/Home");
      }
    }
  }, [navigate, redirectTo]);
  /* Step: "email" | "password" */
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  /* ── Feature card state (fallback) ── */
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFading, setCardFading] = useState(false);

  /* Subdomain detection */
  const [subdomain, setSubdomain] = useState(null);

  const isAccessDenied = error && (
    error.toLowerCase().includes("access") || 
    error.toLowerCase().includes("inactive") || 
    error.toLowerCase().includes("administrator")
  );

  const getWorkspaceUrl = (tenant) => {
    // Use sanitized tenant name as the primary identifier for the URL
    const nameSlug = (tenant.tenantName || "").toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Fallback to existing code/domain if name is missing
    const identifier = nameSlug || (tenant.code || tenant.domain || "").split('.')[0].toLowerCase();

    const { hostname, port, protocol } = window.location;
    const mainDomain = process.env.REACT_APP_MAIN_DOMAIN || 'scaloz.com';
    const workspacePrefix = process.env.REACT_APP_WORKSPACE_PREFIX || 'workspace';

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      const portStr = port ? `:${port}` : '';
      return `${protocol}//${identifier}.localhost${portStr}`;
    }
    return `https://${identifier}.${workspacePrefix}.${mainDomain}`;
  };

  const getWorkspaceDisplayUrl = (tenant) => {
    const nameSlug = (tenant.tenantName || "").toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const identifier = nameSlug || (tenant.code || tenant.domain || "").split('.')[0].toLowerCase();

    const { hostname, port } = window.location;
    const mainDomain = process.env.REACT_APP_MAIN_DOMAIN || 'scaloz.com';
    const workspacePrefix = process.env.REACT_APP_WORKSPACE_PREFIX || 'workspace';

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      const portStr = port ? `:${port}` : '';
      return `${identifier}.localhost${portStr}`;
    }
    return `${identifier}.${workspacePrefix}.${mainDomain}`;
  };

  useEffect(() => {
    api.get("/public/slides")
      .then(res => {
        if (res.data) {
          // Filter out slides that have empty or invalid imageUrl
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

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
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

  /* Lookup state */
  const [lookupState, setLookupState] = useState("idle"); // "idle"|"loading"|"found"|"notfound"
  const [tenantInfo, setTenantInfo] = useState(null);   // { tenantName, domain, logo, products }

  const debouncedEmail = useDebounce(email, 600);
  const pwRef = useRef(null);

  /* Subdomain effect: run on mount to detect tenant */
  useEffect(() => {
    const sub = getTenantSubdomain();
    if (sub) {
      setSubdomain(sub);
      setLoading(true);
      api.get(`/auth/lookup?code=${encodeURIComponent(sub)}`)
        .then(res => {
          if (res.data && res.data.inactive) {
            setError(res.data.message || "You don't have access for this. Please contact your administrator.");
            setLookupState("notfound");
            return;
          }
          if (res.data && res.data.found) {
            setTenantInfo(res.data);
            setLookupState("found");
            // Do NOT prefill — user should enter their own Emp ID or email
            setEmail("");
            setStep("password");
          } else {
            setError(`Workspace "${sub}" not found.`);
            setLookupState("notfound");
          }
        })
        .catch((err) => {
          const msg = err.response?.data?.message || `Workspace "${sub}" not found or cannot be reached.`;
          setError(msg);
          setLookupState("notfound");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  /* ── Lookup: fires after debounce whenever email looks valid (only if not on subdomain) ── */
  useEffect(() => {
    if (subdomain) return;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(debouncedEmail);
    if (!isEmail) {
      setLookupState("idle");
      setTenantInfo(null);
      return;
    }
    let cancelled = false;
    setLookupState("loading");
    setTenantInfo(null);

    api.get(`/auth/lookup?email=${encodeURIComponent(debouncedEmail)}`)
      .then(res => {
        if (cancelled) return;
        if (res.data && res.data.inactive) {
          setError(res.data.message || "You don't have access for this. Please contact your administrator.");
          setLookupState("notfound");
          return;
        }
        if (res.data && res.data.found) {
          setTenantInfo(res.data);
          setLookupState("found");
        } else {
          setLookupState("notfound");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err.response?.data?.message || "No workspace for this domain";
          setError(msg);
          setLookupState("notfound");
        }
      });

    return () => { cancelled = true; };
  }, [debouncedEmail, subdomain]);

  /* ── Redirect to tenant workspace ── */
  const handleContinue = (e) => {
    e.preventDefault();
    if (lookupState !== "found" || !tenantInfo) return;
    setError("");
    let targetUrl = getWorkspaceUrl(tenantInfo);
    if (redirectTo) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}redirect_to=${encodeURIComponent(redirectTo)}`;
    }
    window.location.href = targetUrl;
  };

  /* ── Final login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let loginId = email;
      if (tenantInfo?.code && !loginId.includes('@')) {
        if (!loginId.startsWith(tenantInfo.code + "_")) {
          loginId = `${tenantInfo.code}_${loginId}`;
        }
      }
      const payload = { email: loginId, password };
      if (tenantInfo?.code) payload.tenantCode = tenantInfo.code;
      const res = await api.post("/auth/login", payload);
      if (res.status === 200) {
        const d = res.data;
        if (d.mustChangePassword) {
          console.log("[Login] mustChangePassword is true, redirecting to change password page");
          navigate("/change-password", {
            state: {
              employeeId: d.employeeId || loginId,
              email: d.email || loginId,
              tempPassword: password,
              tenantCode: d.tenantCode || tenantInfo?.code
            }
          });
          return;
        }

        if (d.token) {
          const token = d.token;
          sessionStorage.setItem("token", token);
          sessionStorage.setItem("tenantId", d.tenant?.id ?? "");
          sessionStorage.setItem("tenantCode", d.tenant?.code ?? "");
          sessionStorage.setItem("tenantName", d.tenant?.name ?? "");
          sessionStorage.setItem("userName", d.user?.name || (d.user?.firstName ? `${d.user.firstName} ${d.user.lastName || ""}`.trim() : "Admin"));
          sessionStorage.setItem("userRole", d.user?.role ?? "Admin");
          sessionStorage.setItem("isSubAdmin", d.user?.isSubAdmin ? "true" : "false");
          sessionStorage.setItem("products", JSON.stringify(d.products || []));

          if (redirectTo) {
            console.log('[SSO] Redirecting back to:', redirectTo, 'with token');
            const separator = redirectTo.includes('?') ? '&' : '?';
            window.location.href = `${redirectTo}${separator}scaloz_token=${encodeURIComponent(token)}`;
            return;
          }

          navigate("/Home");
        } else {
          setError("Invalid credentials. Please try again.");
        }
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError(err.response?.data?.message || "Wrong Emp ID / email or password.");
      } else if (!err.response) {
        setError("Cannot reach the server. Make sure the backend is running.");
      } else {
        setError(err.response?.data?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Back to email step ── */
  const handleBack = () => {
    setStep("email");
    setPassword("");
    setError("");
  };

  /* ── Lookup status indicator label ── */
  const lookupLabel = () => {
    if (isAccessDenied) return null;
    if (lookupState === "loading") return <span className="lookup-status loading"><span className="spin-icon">⟳</span> Looking up workspace…</span>;
    if (lookupState === "found") return <span className="lookup-status found"><FiCheckCircle size={13} /> Workspace found</span>;
    if (lookupState === "notfound") return <span className="lookup-status notfound">⚠ No workspace for this domain</span>;
    return null;
  };

  return (
    <div className="enterprise-login-container">
      {/* Logo */}
      <div className="top-left-logo">
        <img src={scalozLogo} alt="Scaloz Logo" />
      </div>

      <div className="left-panel">
        <div className="left-panel-inner">
          <div className="left-showcase">
            {/* Dynamic left panel: show tenant branding if found, unless on a subdomain */}
            {tenantInfo && lookupState === "found" && !subdomain ? (
              <div className="tenant-showcase" key={tenantInfo.domain}>
                {tenantInfo.logo
                  ? <img src={getImageUrl(tenantInfo.logo)} alt="Logo" className="tenant-showcase-logo" />
                  : <div className="tenant-showcase-initial">{(tenantInfo.tenantName || "?")[0].toUpperCase()}</div>
                }
                <h2 className="tenant-showcase-name">{tenantInfo.tenantName}</h2>
                <div className="tenant-showcase-website">
                  <p className="showcase-website-label">Workspace URL</p>
                  <a
                    href={getWorkspaceUrl(tenantInfo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tenant-showcase-website-link"
                  >
                    <span>{getWorkspaceDisplayUrl(tenantInfo)}</span>
                    <span className="external-link-icon">↗</span>
                  </a>
                </div>
              </div>
            ) : (
              /* If on subdomain or default, show either slide images or fallback cards */
              slides.length > 0 ? (
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
              )
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="right-panel">
        <div className="login-form-card">
          <>
              {/* ─── STEP 1: Email ─── */}
              {step === "email" && (
                <>
                  <div className="form-card-header">
                    <h2>Sign in to your workspace</h2>
                    <p>Enter your work email — we'll find your domain's workspace instantly</p>
                  </div>

                  <form onSubmit={handleContinue} className="enterprise-form" noValidate>
                    <div className="enterprise-field" title={isAccessDenied ? error : ""}>
                      <label htmlFor="email">Work Email</label>
                      <div className="input-with-icon" style={isAccessDenied ? { cursor: "not-allowed" } : {}}>
                        <FiMail size={16} className="field-icon" />
                        <input
                          id="email"
                          type="email"
                          placeholder="Type here..."
                          value={email}
                          onChange={e => { if (!isAccessDenied) { setEmail(e.target.value); setError(""); } }}
                          disabled={isAccessDenied}
                          title={isAccessDenied ? error : ""}
                          style={isAccessDenied ? { cursor: "not-allowed", backgroundColor: "#E5E7EB", color: "#9CA3AF" } : {}}
                          autoFocus={!isAccessDenied}
                          autoComplete="email"
                        />
                      </div>
                      {lookupLabel()}
                    </div>

                    {/* Tenant found card */}
                    {lookupState === "found" && tenantInfo && (
                      <div className="tenant-found-card">
                        {/* Row 1: tenant identity */}
                        <div className="tenant-found-header">
                          {tenantInfo.logo
                            ? <img src={getImageUrl(tenantInfo.logo)} alt="" className="tenant-found-logo" />
                            : <div className="tenant-found-initial">{(tenantInfo.tenantName || "?")[0].toUpperCase()}</div>
                          }
                          <div className="tenant-found-info">
                            <span className="tenant-found-name">{tenantInfo.tenantName}</span>
                          </div>
                        </div>

                        {/* Row 2: email being used */}
                        <div className="tenant-found-email-row">
                          <FiMail size={12} style={{ flexShrink: 0 }} />
                          <span>{email}</span>
                        </div>

                        {/* Dedicated workspace URL section */}
                        <div className="tenant-workspace-url-section">
                          <span className="tenant-found-products-label">
                            Dedicated workspace link
                          </span>
                          <a
                            href={getWorkspaceUrl(tenantInfo)}
                            className="tenant-workspace-url-link"
                          >
                            {getWorkspaceDisplayUrl(tenantInfo)}
                          </a>
                        </div>
                      </div>
                    )}

                    {error && <div className="enterprise-error" role="alert">{error}</div>}

                    <button
                      type="submit"
                      className="enterprise-signin-btn"
                      disabled={lookupState !== "found" || isAccessDenied}
                    >
                      <span>{lookupState === "found" ? "Go to Workspace" : "Continue"}</span>
                      <FiChevronRight size={18} />
                    </button>
                  </form>
                </>
              )}

              {/* ─── STEP 2 & 3: Password / Login ─── */}
              {step === "password" && (
                <>
                  {/* Back button — only if not on subdomain */}
                  {!subdomain && (
                    <button className="back-btn" onClick={handleBack} type="button">
                      <FiArrowLeft size={15} /> Back
                    </button>
                  )}

                  {/* Compact tenant summary — only if not on subdomain */}
                  {tenantInfo && !subdomain && (
                    <div className="step2-tenant-summary">
                      {tenantInfo.logo
                        ? <img src={getImageUrl(tenantInfo.logo)} alt="" className="step2-logo" />
                        : <div className="step2-initial">{(tenantInfo.tenantName || "?")[0].toUpperCase()}</div>
                      }
                      <div>
                        <div className="step2-tenant-name">{tenantInfo.tenantName}</div>
                        <div className="step2-email">{email}</div>
                      </div>
                    </div>
                  )}

                  <div className="form-card-header" style={{ marginTop: (!subdomain && tenantInfo) ? "20px" : "0px" }}>
                    {subdomain && tenantInfo && (
                      <div style={{ textAlign: "center", marginBottom: "12px" }}>
                        {tenantInfo.logo ? (
                          <img
                            src={getImageUrl(tenantInfo.logo)}
                            alt={tenantInfo.tenantName}
                            style={{ height: "56px", maxWidth: "180px", objectFit: "contain", display: "block", margin: "0 auto" }}
                          />
                        ) : (
                          <div style={{
                            width: 56, height: 56,
                            background: "linear-gradient(135deg, #0f172a, #1e40af)",
                            borderRadius: "12px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 22, fontWeight: 800,
                            margin: "0 auto"
                          }}>
                            {(tenantInfo.tenantName || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    {!subdomain && <h2>Enter your password</h2>}
                    <p>{subdomain ? "Enter your credentials to access your workspace" : <>Sign in to <strong>{tenantInfo?.tenantName || "your workspace"}</strong></>}</p>
                  </div>

                  <form onSubmit={handleLogin} className="enterprise-form">
                    {/* Emp ID / Mail ID field (only shown on subdomain/tenant login) */}
                    {subdomain && (
                      <div className="enterprise-field">
                        <label htmlFor="email">Emp ID / Mail ID</label>
                        <div className="input-with-icon">
                          <FiMail size={16} className="field-icon" />
                          <input
                            id="email"
                            type="text"
                            placeholder="Enter your Emp ID or Email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(""); }}
                            required
                            autoComplete="username"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    <div className="enterprise-field">
                      <div className="field-label-row">
                        <label htmlFor="password">Password</label>
                        <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                      </div>
                      <div className="password-field-wrap">
                        <input
                          id="password"
                          ref={pwRef}
                          type={showPw ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={e => { setPassword(e.target.value); setError(""); }}
                          required
                          autoComplete="current-password"
                          autoFocus={false}
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">
                          {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                        </button>
                      </div>
                    </div>

                    {error && <div className="enterprise-error" role="alert">{error}</div>}

                    <button type="submit" className="enterprise-signin-btn" disabled={loading || !password}>
                      {loading ? "Signing in…" : <><span>{subdomain ? "Log In" : "Sign In"}</span><FiChevronRight size={18} /></>}
                    </button>
                  </form>
                </>
              )}
            </>
        </div>

        {/* Footer */}
        <div className="global-footer-text">
          <span>
            {subdomain && tenantInfo ? (
              `© ${new Date().getFullYear()} ${tenantInfo.tenantName ? tenantInfo.tenantName.split(' ')[0] + 'Hub' : 'XevyteHub'}. Powered by Xevyte Technologies`
            ) : (
              `© ${new Date().getFullYear()} Scaloz. Powered by Xevyte Technologies`
            )}
          </span>
          <div className="footer-links">
            <a href="/policy/terms_and_conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
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

export default LoginPage;
