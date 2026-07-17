import React, { useState, useEffect } from "react";
import {
  Globe, LayoutDashboard, Users, CreditCard, Layers,
  BarChart3, Settings, Plus, LogOut, Search, Trash2, Edit2,
  ExternalLink, Upload, X, Shield, ArrowRight, HelpCircle,
  Building, Menu, MoreVertical, MessageSquare, Folder, ChevronDown, Mail,
  Calendar, Bell, TrendingUp, Activity, RefreshCw
} from "lucide-react";
import "./Dashboard.css";
import scalozLogo from "../assets/Scaloz.png";

function Dashboard({ onLogout }) {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [products, setProducts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Product Drawer State
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodName, setProdName] = useState("");
  const [prodCode, setProdCode] = useState("");
  const [prodUrl, setProdUrl] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodIcon, setProdIcon] = useState("");
  const [prodStatus, setProdStatus] = useState("Active");
  const [prodFormError, setProdFormError] = useState("");
  const [prodFormLoading, setProdFormLoading] = useState(false);
  const [prodApiKey, setProdApiKey] = useState("");

  // Modules State
  const [modules, setModules] = useState([]);
  const [isModuleDrawerOpen, setIsModuleDrawerOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [modName, setModName] = useState("");
  const [modCode, setModCode] = useState("");
  const [modProductId, setModProductId] = useState("");
  const [modFormError, setModFormError] = useState("");
  const [modFormLoading, setModFormLoading] = useState(false);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [isSubDrawerOpen, setIsSubDrawerOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [subPlanName, setSubPlanName] = useState("");
  const [subUserLimit, setSubUserLimit] = useState(100);
  const [subTenantId, setSubTenantId] = useState("");
  const [subFormError, setSubFormError] = useState("");
  const [subFormLoading, setSubFormLoading] = useState(false);

  // Tenant Onboarding Wizard State
  const [isOnboardingMode, setIsOnboardingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [tenantName, setTenantName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [logoFileName, setLogoFileName] = useState("");

  // Step 2: Admin details
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminEmployeeId, setAdminEmployeeId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");

  // Step 3 & 4: Products/Modules selection
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);

  // Tenant Edit Drawer State
  const [isTenantDrawerOpen, setIsTenantDrawerOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editSelectedProducts, setEditSelectedProducts] = useState([]);
  const [editSelectedModules, setEditSelectedModules] = useState([]);
  const [tenantFormError, setTenantFormError] = useState("");
  const [tenantFormLoading, setTenantFormLoading] = useState(false);

  // Step 4: Subscription Plan
  const [subscriptionPlan, setSubscriptionPlan] = useState("Growth");
  const [userLimit, setUserLimit] = useState(100);
  const [tenantStatus, setTenantStatus] = useState("Active");
  const [productStatuses, setProductStatuses] = useState({});

  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Slides States
  const [slides, setSlides] = useState([]);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [draftSlides, setDraftSlides] = useState([]);
  const [settingsSlideUploadError, setSettingsSlideUploadError] = useState("");

  // HRMS Migration States
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  const calculateRevenue = () => {
    let rev = 0;
    subscriptions.forEach(s => {
      const plan = (s.planName || "").toLowerCase();
      if (plan.includes("starter")) rev += 5000;
      else if (plan.includes("growth")) rev += 15000;
      else if (plan.includes("enterprise")) rev += 50000;
      else rev += 10000;
    });
    return rev;
  };

  const getProductDistribution = () => {
    if (modules.length === 0) {
      return [
        { name: "HRMS", percent: 35, color: "#6366F1" },
        { name: "Mail", percent: 25, color: "#3B82F6" },
        { name: "Chat", percent: 15, color: "#10B981" },
        { name: "Projects", percent: 10, color: "#F59E0B" },
        { name: "CRM", percent: 10, color: "#EC4899" },
        { name: "Others", percent: 5, color: "#8B5CF6" }
      ];
    }

    const counts = {};
    modules.forEach(m => {
      const name = m.product ? m.product.name : "Others";
      counts[name] = (counts[name] || 0) + 1;
    });

    const total = modules.length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = ["#6366F1", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];

    let mapped = sorted.map(([name, count], index) => ({
      name,
      percent: Math.round((count / total) * 100),
      color: colors[index % colors.length]
    }));

    const sum = mapped.reduce((acc, m) => acc + m.percent, 0);
    if (sum !== 100 && mapped.length > 0) {
      mapped[0].percent += (100 - sum);
    }
    return mapped;
  };

  const getChartPoints = (currentVal) => {
    const val = currentVal || 0;
    return [
      Math.round(val * 0.65),
      Math.round(val * 0.75),
      Math.round(val * 0.8),
      Math.round(val * 0.88),
      Math.round(val * 0.94),
      val
    ];
  };

  const getPathData = (points, maxVal) => {
    if (maxVal === 0) maxVal = 1;
    const xCoords = [50, 130, 210, 290, 370, 450];
    const coords = points.map((p, i) => {
      const x = xCoords[i];
      const y = 170 - ((p / maxVal) * 140);
      return { x, y };
    });
    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  };

  const getHeaders = () => {
    const token = localStorage.getItem("super_admin_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8085/api";

  const getImageUrl = (url) => {
    if (!url || typeof url !== 'string') return "";
    if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("/uploads") || url.startsWith("uploads/")) {
      const cleanPath = url.startsWith("/") ? url : `/${url}`;
      const serverBase = API_BASE_URL.endsWith("/api") ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
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
      const serverBase = API_BASE_URL.endsWith("/api") ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
      return `${serverBase}${cleanPath}`;
    }
    return `data:image/png;base64,${url}`;
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: getHeaders(),
      });
      if (response.status === 401 || response.status === 403) {
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tenants`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(data);
      }
    } catch (err) {
      console.error("Error fetching tenants", err);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/modules`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setModules(data);
      }
    } catch (err) {
      console.error("Error fetching modules", err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/subscriptions`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error("Error fetching subscriptions", err);
    }
  };

  const fetchSlides = async () => {
    setSlidesLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/settings/slides`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSlides(data);
      }
    } catch (err) {
      console.error("Error fetching slides", err);
    } finally {
      setSlidesLoading(false);
    }
  };

  const handleDeleteSlide = async (id) => {
    if (!window.confirm("Are you sure you want to delete this slide?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/settings/slides/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (response.ok) {
        fetchSlides();
      } else {
        alert("Failed to delete slide.");
      }
    } catch (err) {
      console.error("Error deleting slide", err);
    }
  };

  const handleMigrateFromHrms = async () => {
    if (!window.confirm("Are you sure you want to migrate all employees from HRMS to Scaloz? This will sync existing employee data.")) return;
    setMigrationLoading(true);
    setMigrationResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tenant-users/migrate-from-hrms`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setMigrationResult(data);
        alert(`Migration completed!\n\nTotal: ${data.totalEmployees}\nSuccess: ${data.successCount}\nSkipped: ${data.skipCount}\nFailed: ${data.failureCount}`);
      } else {
        alert("Migration failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error during migration:", err);
      alert("Migration failed: " + err.message);
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!modName || !modCode || !modProductId) {
      setModFormError("All fields marked with * are required.");
      return;
    }
    setModFormLoading(true);
    setModFormError("");
    try {
      const url = `${API_BASE_URL}/modules`;
      const payload = {
        name: modName,
        code: modCode,
        productId: Number(modProductId)
      };

      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsModuleDrawerOpen(false);
        setModName("");
        setModCode("");
        setModProductId("");
        fetchModules();
      } else {
        const txt = await response.text();
        setModFormError(txt || "Failed to save module.");
      }
    } catch (err) {
      setModFormError("Network error. Please try again.");
    } finally {
      setModFormLoading(false);
    }
  };

  const handleDeleteModule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this module?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/modules/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (response.ok) {
        fetchModules();
      }
    } catch (err) {
      alert("Error deleting module.");
    }
  };

  const handleSaveSubscription = async (e) => {
    e.preventDefault();
    if (!subPlanName || !subUserLimit || !subTenantId) {
      setSubFormError("All fields marked with * are required.");
      return;
    }
    setSubFormLoading(true);
    setSubFormError("");
    try {
      const url = `${API_BASE_URL}/subscriptions`;
      const payload = {
        planName: subPlanName,
        userLimit: Number(subUserLimit),
        tenantId: Number(subTenantId),
        status: "Active"
      };

      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsSubDrawerOpen(false);
        setSubPlanName("");
        setSubUserLimit(100);
        setSubTenantId("");
        fetchSubscriptions();
        fetchTenants();
      } else {
        const txt = await response.text();
        setSubFormError(txt || "Failed to save subscription.");
      }
    } catch (err) {
      setSubFormError("Network error. Please try again.");
    } finally {
      setSubFormLoading(false);
    }
  };

  const handleDeleteSubscription = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subscription?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/subscriptions/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (response.ok) {
        fetchSubscriptions();
        fetchTenants();
      }
    } catch (err) {
      alert("Error deleting subscription.");
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchTenants(), fetchModules(), fetchSubscriptions(), fetchSlides()]);
      setLoading(false);
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Filtered lists
  const filteredProducts = products.filter(p =>
  (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTenants = tenants.filter(t =>
  (t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Drawer handlers
  const openAddProduct = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCode("");
    setProdUrl("");
    setProdDesc("");
    setProdIcon("");
    setProdStatus("Active");
    setProdApiKey("");
    setProdFormError("");
    setIsProductDrawerOpen(true);
  };

  const openEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdName(prod.name || "");
    setProdCode(prod.code || "");
    setProdUrl(prod.url || "");
    setProdDesc(prod.content || "");
    setProdIcon(prod.icon || "");
    setProdStatus(prod.status || "Active");
    setProdApiKey(prod.apiKey || "");
    setProdFormError("");
    setIsProductDrawerOpen(true);
  };

  const handleProductIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProdFormError("Icon file must be smaller than 2MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/products/upload-icon`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("super_admin_token")}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      // Store only the URL path returned from the server
      setProdIcon(data.iconUrl);
    } catch (err) {
      console.error("Icon upload error:", err);
      // Fallback: local preview via base64
      const reader = new FileReader();
      reader.onloadend = () => setProdIcon(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setProdFormError("");
    setProdFormLoading(true);

    const payload = {
      name: prodName,
      code: prodCode,
      url: prodUrl,
      icon: prodIcon,
      content: prodDesc,
      status: prodStatus,
      apiKey: prodApiKey,
    };

    try {
      let response;
      if (editingProduct) {
        response = await fetch(`${API_BASE_URL}/products/${editingProduct.id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/products`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        setIsProductDrawerOpen(false);
        fetchProducts();
      } else {
        const errorText = await response.text();
        setProdFormError(errorText || "Failed to save product details");
      }
    } catch (err) {
      setProdFormError("Failed to make request. Check backend logs.");
    } finally {
      setProdFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (response.ok) {
        fetchProducts();
      }
    } catch (err) {
      alert("Error deleting product");
    }
  };

  // Tenants onboarding handlers
  const handleTenantLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOnboardingError("");
    if (file.size > 2 * 1024 * 1024) {
      setOnboardingError("Logo file must be smaller than 2MB");
      return;
    }
    setLogoFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/tenants/upload-logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("super_admin_token")}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      // Store only the URL path returned from the server
      setCompanyLogo(data.logoUrl);
    } catch (err) {
      console.error("Logo upload error:", err);
      // Fallback: read as base64 for local preview only (won't be saved to server)
      const reader = new FileReader();
      reader.onloadend = () => setCompanyLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleStepNext = () => {
    setOnboardingError("");
    if (currentStep === 1) {
      if (!tenantName || !tenantCode || !companyEmail) {
        setOnboardingError("Please fill out all required fields marked with *");
        return;
      }
      const codeRegex = /^[a-z0-9-]+$/;
      if (!codeRegex.test(tenantCode)) {
        setOnboardingError("Tenant code can only contain lowercase letters, numbers, and hyphens");
        return;
      }
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(companyEmail)) {
        setOnboardingError("Company Email is invalid. Must be in email format (containing @ and domain).");
        return;
      }
      if (companyPhone && !/^\d{10}$/.test(companyPhone)) {
        setOnboardingError("Company Phone must be a 10-digit number.");
        return;
      }
    } else if (currentStep === 2) {
      if (!adminEmail) {
        setOnboardingError("Please enter admin email");
        return;
      }
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(adminEmail)) {
        setOnboardingError("Admin Email is invalid. Must be in email format (containing @ and domain).");
        return;
      }
    } else if (currentStep === 3) {
      if (selectedProducts.length === 0) {
        setOnboardingError("Please select at least one product platform");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const toggleProductSelect = (code) => {
    if (selectedProducts.includes(code)) {
      setSelectedProducts(selectedProducts.filter(c => c !== code));
      const updated = { ...productStatuses };
      delete updated[code];
      setProductStatuses(updated);
    } else {
      setSelectedProducts([...selectedProducts, code]);
      setProductStatuses({
        ...productStatuses,
        [code]: "Active"
      });
    }
  };

  const toggleModuleSelect = (moduleName) => {
    if (selectedModules.includes(moduleName)) {
      setSelectedModules(selectedModules.filter(m => m !== moduleName));
    } else {
      setSelectedModules([...selectedModules, moduleName]);
    }
  };

  const resetOnboardingForm = () => {
    setIsOnboardingMode(false);
    setCurrentStep(1);
    setTenantName("");
    setTenantCode("");
    setCompanyEmail("");
    setCompanyPhone("");
    setCompanyWebsite("");
    setCompanySize("");
    setCompanyAddress("");
    setCompanyLogo("");
    setLogoFileName("");
    setAdminUsername("");
    setAdminEmail("");
    setAdminEmployeeId("");
    setAdminPassword("");
    setAdminConfirmPassword("");
    setSelectedProducts([]);
    setSelectedModules([]);
    setSubscriptionPlan("Growth");
    setUserLimit(100);
    setTenantStatus("Active");
    setProductStatuses({});
    setOnboardingError("");
    setEditingTenant(null);
  };

  const handleSaveTenant = async () => {
    setOnboardingError("");
    setOnboardingLoading(true);

    const payload = {
      name: tenantName,
      code: tenantCode,
      email: companyEmail,
      phone: companyPhone,
      website: companyWebsite,
      companySize,
      address: companyAddress,
      logo: companyLogo,
      adminEmail,
      selectedProducts: selectedProducts.map(code => `${code}:${productStatuses[code] || "Active"}`).join(","),
      selectedModules: selectedModules.join(","),
      subscriptionPlan,
      status: tenantStatus,
    };

    try {
      const url = editingTenant
        ? `${API_BASE_URL}/tenants/${editingTenant.id}`
        : `${API_BASE_URL}/tenants`;
      const method = editingTenant ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        resetOnboardingForm();
        fetchTenants();
      } else {
        const errText = await response.text();
        setOnboardingError(errText || `Error ${editingTenant ? "updating" : "onboarding"} tenant`);
      }
    } catch (err) {
      setOnboardingError("Failed to contact the backend server.");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleDeleteTenant = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tenant?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tenants/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (response.ok) {
        fetchTenants();
      }
    } catch (err) {
      alert("Error deleting tenant");
    }
  };

  const handleEditTenant = (t) => {
    setEditingTenant(t);
    setTenantName(t.name || "");
    setTenantCode(t.code || "");
    setCompanyEmail(t.email || "");
    setCompanyPhone(t.phone || "");
    setCompanyWebsite(t.website || "");
    setCompanySize(t.companySize || "");
    setCompanyAddress(t.address || "");
    setCompanyLogo(t.logo || "");
    if (t.logo) {
      setLogoFileName("Uploaded Logo");
    } else {
      setLogoFileName("");
    }

    setAdminUsername(t.adminUsername || "");
    setAdminEmail(t.adminEmail || "");
    // If admin employee ID has prefix like code_empId, strip it for editing view
    const rawEmpId = t.adminEmployeeId || "";
    const cleanEmpId = rawEmpId.includes("_") ? rawEmpId.substring(rawEmpId.indexOf("_") + 1) : rawEmpId;
    setAdminEmployeeId(cleanEmpId);

    setAdminPassword(t.adminPassword || "");
    setAdminConfirmPassword(t.adminPassword || "");

    setTenantStatus(t.status || "Active");
    const selectedProds = [];
    const prodStatuses = {};
    if (t.selectedProducts) {
      t.selectedProducts.split(",").forEach(item => {
        const trimmed = item.trim();
        if (!trimmed) return;
        if (trimmed.includes(":")) {
          const [code, status] = trimmed.split(":");
          selectedProds.push(code.trim());
          prodStatuses[code.trim()] = status.trim();
        } else {
          selectedProds.push(trimmed);
          prodStatuses[trimmed] = "Active";
        }
      });
    }
    const selectedMods = t.selectedModules
      ? t.selectedModules.split(",").map(m => m.trim()).filter(Boolean)
      : [];
    setSelectedProducts(selectedProds);
    setProductStatuses(prodStatuses);
    setSelectedModules(selectedMods);

    setSubscriptionPlan(t.subscriptionPlan || "Growth");
    let limit = 100;
    if (t.subscriptionPlan === "Starter") limit = 10;
    else if (t.subscriptionPlan === "Enterprise") limit = 10000;
    setUserLimit(limit);

    setOnboardingError("");
    setCurrentStep(1);
    setIsOnboardingMode(true);
  };

  const toggleEditProductSelect = (code) => {
    if (editSelectedProducts.includes(code)) {
      setEditSelectedProducts(editSelectedProducts.filter(c => c !== code));
      // Also unselect modules belonging to this product
      const productModules = modules.filter(m => m.product && m.product.code === code).map(m => m.name);
      setEditSelectedModules(editSelectedModules.filter(mName => !productModules.includes(mName)));
    } else {
      setEditSelectedProducts([...editSelectedProducts, code]);
      // Auto-select all modules belonging to this product
      const productModules = modules.filter(m => m.product && m.product.code === code).map(m => m.name);
      setEditSelectedModules([...editSelectedModules, ...productModules]);
    }
  };

  const toggleEditModuleSelect = (name) => {
    if (editSelectedModules.includes(name)) {
      setEditSelectedModules(editSelectedModules.filter(m => m !== name));
    } else {
      setEditSelectedModules([...editSelectedModules, name]);
    }
  };

  const handleSaveTenantEdit = async (e) => {
    e.preventDefault();
    setTenantFormLoading(true);
    setTenantFormError("");
    try {
      const payload = {
        ...editingTenant,
        selectedProducts: editSelectedProducts.join(","),
        selectedModules: editSelectedModules.join(",")
      };

      const response = await fetch(`${API_BASE_URL}/tenants/${editingTenant.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsTenantDrawerOpen(false);
        fetchTenants();
      } else {
        const txt = await response.text();
        setTenantFormError(txt || "Failed to update tenant products/modules.");
      }
    } catch (err) {
      setTenantFormError("Network error. Please try again.");
    } finally {
      setTenantFormLoading(false);
    }
  };

  const modulesByProduct = {};
  modules.forEach(m => {
    const pCode = m.product?.code || "DEFAULT";
    if (!modulesByProduct[pCode]) {
      modulesByProduct[pCode] = [];
    }
    if (!modulesByProduct[pCode].includes(m.name)) {
      modulesByProduct[pCode].push(m.name);
    }
  });

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={scalozLogo} alt="Scaloz Logo" style={{ height: "46px", objectFit: "contain" }} />
            </div>
          </div>
          <div className="sidebar-role">SUPER ADMIN</div>
          <ul className="sidebar-menu">
            <li>
              <button
                className={`menu-item ${activeMenu === "Dashboard" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Dashboard"); setIsOnboardingMode(false); }}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button
                className={`menu-item ${activeMenu === "Tenants" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Tenants"); setIsOnboardingMode(false); }}
              >
                <Building size={16} />
                <span>Tenants</span>
              </button>
            </li>
            <li>
              <button
                className={`menu-item ${activeMenu === "Products" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Products"); setIsOnboardingMode(false); }}
              >
                <Globe size={16} />
                <span>Products</span>
              </button>
            </li>
            {/* <li>
              <button
                className={`menu-item ${activeMenu === "Modules" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Modules"); setIsOnboardingMode(false); }}
              >
                <Layers size={16} />
                <span>Modules</span>
              </button>
            </li> */}
            <li>
              <button
                className={`menu-item ${activeMenu === "Subscriptions" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Subscriptions"); setIsOnboardingMode(false); }}
              >
                <CreditCard size={16} />
                <span>Subscriptions</span>
              </button>
            </li>
            <li>
              <button
                className={`menu-item ${activeMenu === "Reports" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Reports"); setIsOnboardingMode(false); }}
              >
                <BarChart3 size={16} />
                <span>Reports</span>
              </button>
            </li>
            <li>
              <button
                className={`menu-item ${activeMenu === "Settings" ? "active" : ""}`}
                onClick={() => { setActiveMenu("Settings"); setIsOnboardingMode(false); }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">SA</div>
            <div className="user-info">
              <span className="user-name">Super Administrator</span>
              <span className="user-role">admin@scaloz.com</span>
            </div>
          </div>
          <button className="menu-item" onClick={onLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className="content-area">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh", color: "#9CA3AF" }}>
            Loading dashboard data from database...
          </div>
        ) : (
          <>
            {/* View 1: DASHBOARD HOME OVERVIEW */}
            {activeMenu === "Dashboard" && (
              (() => {
                const dist = getProductDistribution();
                let accumulatedPercent = 0;
                const slices = dist.map(item => {
                  const dashArray = `${(item.percent / 100) * 314.16} 314.16`;
                  const dashOffset = `${-(accumulatedPercent / 100) * 314.16}`;
                  accumulatedPercent += item.percent;
                  return { ...item, dashArray, dashOffset };
                });

                return (
                  <div>
                    {/* Upper Header Row */}
                    <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                      <div className="header-title">
                        <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827" }}>Dashboard</h2>
                        <p style={{ fontSize: "14px", color: "#6B7280" }}>Welcome back, Super Admin! Here's what's happening with your platform.</p>
                      </div>
                    </div>

                    {/* Stats Cards Grid */}
                    <div className="stats-grid-mockup">
                      {/* Card 1: Total Tenants */}
                      <div className="stat-card-mockup">
                        <div className="stat-icon-wrap" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                          <Building size={22} />
                        </div>
                        <div className="stat-content">
                          <span className="stat-lbl">Total Tenants</span>
                          <span className="stat-val">{tenants.length}</span>
                          <div className="stat-trend up">
                            <TrendingUp size={12} />
                            <span>12.5% from last month</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Total Products */}
                      <div className="stat-card-mockup">
                        <div className="stat-icon-wrap" style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                          <Globe size={22} />
                        </div>
                        <div className="stat-content">
                          <span className="stat-lbl">Total Products</span>
                          <span className="stat-val">{products.length}</span>
                          <div className="stat-trend up">
                            <TrendingUp size={12} />
                            <span>7.1% from last month</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Active Subscriptions */}
                      <div className="stat-card-mockup">
                        <div className="stat-icon-wrap" style={{ background: "#FFFBEB", color: "#D97706" }}>
                          <CreditCard size={22} />
                        </div>
                        <div className="stat-content">
                          <span className="stat-lbl">Active Subscriptions</span>
                          <span className="stat-val">{subscriptions.filter(s => (s.status || "").toLowerCase() === "active").length}</span>
                          <div className="stat-trend up">
                            <TrendingUp size={12} />
                            <span>11.2% from last month</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Charts Row */}
                    <div className="dashboard-row-middle">
                      {/* Left: Platform Overview */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <h3 className="chart-title">Platform Overview</h3>
                          <select className="chart-dropdown" defaultValue="Monthly">
                            <option>Monthly</option>
                            <option>Weekly</option>
                            <option>Yearly</option>
                          </select>
                        </div>
                        <div className="chart-legend">
                          <div className="legend-item">
                            <div className="legend-dot" style={{ background: "#6366F1" }}></div>
                            <span>Tenants</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-dot" style={{ background: "#3B82F6" }}></div>
                            <span>Active Users</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-dot" style={{ background: "#10B981" }}></div>
                            <span>Subscriptions</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-dot" style={{ background: "#F59E0B" }}></div>
                            <span>Revenue (₹)</span>
                          </div>
                        </div>

                        <div style={{ position: "relative", width: "100%", height: "220px" }}>
                          <svg viewBox="0 0 500 200" style={{ width: "100%", height: "100%" }}>
                            <defs>
                              <linearGradient id="grad-tenants" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="grad-users" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="grad-subs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            <line x1="50" y1="30" x2="450" y2="30" stroke="#F3F4F6" strokeWidth="1" />
                            <line x1="50" y1="65" x2="450" y2="65" stroke="#F3F4F6" strokeWidth="1" />
                            <line x1="50" y1="100" x2="450" y2="100" stroke="#F3F4F6" strokeWidth="1" />
                            <line x1="50" y1="135" x2="450" y2="135" stroke="#F3F4F6" strokeWidth="1" />
                            <line x1="50" y1="170" x2="450" y2="170" stroke="#E5E7EB" strokeWidth="1.5" />

                            {/* X Axis Labels */}
                            <text x="50" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">Dec '23</text>
                            <text x="130" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">Jan '24</text>
                            <text x="210" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">Feb '24</text>
                            <text x="290" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">Mar '24</text>
                            <text x="370" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">Apr '24</text>
                            <text x="450" y="190" fill="#9CA3AF" fontSize="10" textAnchor="middle" fontWeight="600">May '24</text>

                            {/* Y Axis Labels */}
                            <text x="35" y="34" fill="#9CA3AF" fontSize="10" textAnchor="end" fontWeight="600">200</text>
                            <text x="35" y="69" fill="#9CA3AF" fontSize="10" textAnchor="end" fontWeight="600">150</text>
                            <text x="35" y="104" fill="#9CA3AF" fontSize="10" textAnchor="end" fontWeight="600">100</text>
                            <text x="35" y="139" fill="#9CA3AF" fontSize="10" textAnchor="end" fontWeight="600">50</text>
                            <text x="35" y="174" fill="#9CA3AF" fontSize="10" textAnchor="end" fontWeight="600">0</text>

                            {/* 1. Tenants Line */}
                            <path d={getPathData(getChartPoints(tenants.length), 200)} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
                            <path d={`${getPathData(getChartPoints(tenants.length), 200)} L 450 170 L 50 170 Z`} fill="url(#grad-tenants)" />

                            {/* 2. Active Users Line */}
                            <path d={getPathData(getChartPoints(subscriptions.reduce((s, x) => s + (x.userLimit || 0), 0)), 200)} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
                            <path d={`${getPathData(getChartPoints(subscriptions.reduce((s, x) => s + (x.userLimit || 0), 0)), 200)} L 450 170 L 50 170 Z`} fill="url(#grad-users)" />

                            {/* 3. Subscriptions Line */}
                            <path d={getPathData(getChartPoints(subscriptions.length), 200)} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                            <path d={`${getPathData(getChartPoints(subscriptions.length), 200)} L 450 170 L 50 170 Z`} fill="url(#grad-subs)" />

                            {/* 4. Revenue Line */}
                            <path d={getPathData(getChartPoints(calculateRevenue() ? 120 : 0, 200), 200)} fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                            <path d={`${getPathData(getChartPoints(calculateRevenue() ? 120 : 0, 200), 200)} L 450 170 L 50 170 Z`} fill="url(#grad-rev)" />
                          </svg>
                        </div>
                      </div>

                      {/* Right: Product Distribution */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <h3 className="chart-title">Product Distribution</h3>
                          <span className="view-all-link" onClick={() => setActiveMenu("Products")}>View All</span>
                        </div>

                        <div style={{ display: "flex", gap: "20px", alignItems: "center", flex: 1 }}>
                          <div style={{ width: "130px", height: "130px", position: "relative" }}>
                            <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                              {slices.map((slice, i) => (
                                <circle
                                  key={i}
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke={slice.color}
                                  strokeWidth="15"
                                  strokeDasharray={slice.dashArray}
                                  strokeDashoffset={slice.dashOffset}
                                />
                              ))}
                            </svg>
                          </div>

                          <div className="donut-legend-list" style={{ flex: 1 }}>
                            {slices.map((slice, i) => (
                              <div className="donut-legend-item" key={i}>
                                <div className="donut-legend-label">
                                  <div className="legend-dot" style={{ background: slice.color }}></div>
                                  <span>{slice.name}</span>
                                </div>
                                <span className="donut-legend-percent">{slice.percent}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3 Lists Row */}
                    <div className="dashboard-row-lists">
                      {/* List 1: Recent Tenants */}
                      <div className="list-card">
                        <div className="list-header">
                          <h3 className="list-title">Recent Tenants</h3>
                          <span className="view-all-link" onClick={() => setActiveMenu("Tenants")}>View All</span>
                        </div>
                        <div className="list-items-container">
                          {tenants.length === 0 ? (
                            <div style={{ color: "#9CA3AF", fontSize: "13px" }}>No onboarded tenants. Navigate to the Tenants page to onboard one.</div>
                          ) : (
                            tenants.slice(-5).reverse().map(t => (
                              <div className="list-item-row" key={t.id}>
                                <div className="list-item-left">
                                  <div className="list-item-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                                    {t.logo ? <img src={getImageUrl(t.logo)} alt="" style={{ width: "100%", height: "100%", borderRadius: "8px", objectFit: "contain", background: "#FFFFFF", padding: "2px" }} /> : <Building size={16} />}
                                  </div>
                                  <div className="list-item-meta">
                                    <span className="list-item-name">{t.name}</span>
                                    <span className="list-item-sub">{t.website || `${t.code}.scaloz.com`}</span>
                                  </div>
                                </div>
                                <span className="status-pill active" style={{ textTransform: "capitalize" }}>{t.status || "Active"}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* List 2: Recent Subscriptions */}
                      <div className="list-card">
                        <div className="list-header">
                          <h3 className="list-title">Recent Subscriptions</h3>
                          <span className="view-all-link" onClick={() => setActiveMenu("Subscriptions")}>View All</span>
                        </div>
                        <div className="list-items-container">
                          {subscriptions.length === 0 ? (
                            <div style={{ color: "#9CA3AF", fontSize: "13px" }}>No active subscriptions found.</div>
                          ) : (
                            subscriptions.slice(-5).reverse().map(s => (
                              <div className="list-item-row" key={s.id}>
                                <div className="list-item-left">
                                  <div className="list-item-icon" style={{ background: "#F5F3FF", color: "#8B5CF6" }}><CreditCard size={16} /></div>
                                  <div className="list-item-meta">
                                    <span className="list-item-name">{s.tenant ? s.tenant.name : "System Subscription"}</span>
                                    <span className="list-item-sub">{s.planName} • {s.userLimit} Users</span>
                                  </div>
                                </div>
                                <div className="list-item-right">
                                  <span className={`status-pill ${s.status === 'Active' ? 'active' : 'inactive'}`} style={{ textTransform: "capitalize" }}>{s.status}</span>
                                  <span className="list-item-date">31 May 2025</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="quick-actions-bar">
                      <h3 className="quick-actions-title">Quick Actions</h3>
                      <div className="quick-actions-buttons">
                        <button className="quick-action-btn" onClick={() => { setActiveMenu("Tenants"); setIsOnboardingMode(true); }}>
                          <Plus size={14} />
                          <span>Add Tenant</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => { setActiveMenu("Products"); setIsProductDrawerOpen(true); }}>
                          <Plus size={14} />
                          <span>Add Product</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => { setActiveMenu("Modules"); setIsModuleDrawerOpen(true); }}>
                          <Plus size={14} />
                          <span>Add Module</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => { setActiveMenu("Subscriptions"); setIsSubDrawerOpen(true); }}>
                          <Plus size={14} />
                          <span>Add Subscription</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => setActiveMenu("Reports")}>
                          <BarChart3 size={14} />
                          <span>View Reports</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* View 2: TENANTS LIST / MULTI-STEP ONBOARDING */}
            {activeMenu === "Tenants" && (
              <div>
                {!isOnboardingMode ? (
                  <>
                    <div className="page-header">
                      <div className="header-title">
                        <h2>Tenants</h2>
                        <p>Manage all company tenants and details</p>
                      </div>
                      <div className="header-actions">
                        <div className="search-container">
                          <Search size={15} className="search-icon" />
                          <input
                            type="text"
                            placeholder="Search tenants..."
                            className="search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <button className="btn-primary" onClick={() => setIsOnboardingMode(true)}>
                          <Plus size={15} />
                          <span>Onboard Tenant</span>
                        </button>
                      </div>
                    </div>

                    <div className="table-card">
                      {filteredTenants.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "50px 20px", color: "#9CA3AF" }}>
                          <Building size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
                          <h3>No Tenants Onboarded</h3>
                          <p style={{ marginTop: "6px", fontSize: "13px" }}>Click the button above to start the tenant onboarding step-by-step wizard.</p>
                        </div>
                      ) : (
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Tenant Name</th>
                              <th>Tenant Code</th>
                              <th>Company Email</th>
                              <th>Phone</th>
                              <th>Selected Products</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTenants.map(t => (
                              <tr key={t.id}>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {t.logo ? (
                                      <img src={getImageUrl(t.logo)} alt="" style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "contain", background: "#FFFFFF", border: "1px solid #E5E7EB", padding: "2px" }} />
                                    ) : (
                                      <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #BFDBFE" }}>
                                        <Building size={14} style={{ color: "#2563EB" }} />
                                      </div>
                                    )}
                                    <div className="product-info-cell">
                                      <span className="name" title={t.name}>{t.name}</span>
                                      <span className="sub-desc" title={t.website || "No Website"}>{t.website || "No Website"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="nowrap-cell"><code>{t.code}</code></td>
                                <td>{t.email}</td>
                                <td className="nowrap-cell">{t.phone || "-"}</td>
                                <td>
                                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                    {t.selectedProducts ? t.selectedProducts.split(",").map(p => (
                                      <span key={p} style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: "4px", fontSize: "10px", fontWeight: "600" }}>{p}</span>
                                    )) : <span style={{ color: "#9CA3AF", fontSize: "11px" }}>None</span>}
                                  </div>
                                </td>
                                <td className="nowrap-cell">
                                  <span className={`status-pill ${t.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active'}`}>
                                    {t.status || "Active"}
                                  </span>
                                </td>
                                <td>
                                  <div className="actions-cell">
                                    <button className="action-btn edit" onClick={() => handleEditTenant(t)} style={{ color: "var(--primary-color)" }} title="Edit Products/Modules">
                                      <Edit2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : (
                  // Multi-Step Onboard Form Wizard View
                  <div>
                    <div className="page-header">
                      <div className="header-title">
                        <h2>{editingTenant ? "Edit Tenant Workspace" : "Onboard New Tenant"}</h2>
                        <p>{editingTenant ? "Modify the step-by-step details to update the tenant workspace" : "Complete the step-by-step wizard to register a new tenant workspace"}</p>
                      </div>
                      <button className="btn-secondary" onClick={resetOnboardingForm}>
                        {editingTenant ? "Cancel Editing" : "Cancel Onboarding"}
                      </button>
                    </div>

                    {/* Progress indicator */}
                    <div className="onboarding-steps">
                      <div className={`step-indicator ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}>
                        <div className="step-number">1</div>
                        <span>Company Details</span>
                      </div>
                      <div className="step-divider"></div>
                      <div className={`step-indicator ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}>
                        <div className="step-number">2</div>
                        <span>Admin User</span>
                      </div>
                      <div className="step-divider"></div>
                      <div className={`step-indicator ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}>
                        <div className="step-number">3</div>
                        <span>Select Products</span>
                      </div>
                      <div className="step-divider"></div>
                      <div className={`step-indicator ${currentStep === 4 ? "active" : currentStep > 4 ? "completed" : ""}`}>
                        <div className="step-number">4</div>
                        <span>Subscription</span>
                      </div>
                      <div className="step-divider"></div>
                      <div className={`step-indicator ${currentStep === 5 ? "active" : currentStep > 5 ? "completed" : ""}`}>
                        <div className="step-number">5</div>
                        <span>Review & Confirm</span>
                      </div>
                    </div>

                    {onboardingError && (
                      <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--danger-color)", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                        {onboardingError}
                      </div>
                    )}

                    {/* Main Layout containing form & preview column */}
                    <div className="onboarding-layout">
                      {/* Left: Step Form Screens */}
                      <div className="onboarding-main-form">

                        {/* Step 1: Company Details Form */}
                        {currentStep === 1 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Company Information</h3>
                            <div className="form-row-2">
                              <div>
                                <label className="input-label">Tenant Name <span>*</span></label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Enter company / tenant name"
                                  value={tenantName}
                                  onChange={(e) => setTenantName(e.target.value)}
                                  maxLength={100}
                                  required
                                />
                                <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                  {(tenantName || "").length}/100
                                </div>
                              </div>
                              <div>
                                <label className="input-label">Tenant Code <span>*</span></label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Enter unique tenant code"
                                  value={tenantCode}
                                  onChange={(e) => setTenantCode(e.target.value.toLowerCase())}
                                  maxLength={50}
                                  required
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                  <span>Only lowercase letters, numbers and hyphens allowed</span>
                                  <span>{(tenantCode || "").length}/50</span>
                                </div>
                              </div>
                            </div>

                            <div className="form-row-2">
                              <div>
                                <label className="input-label">Company Email <span>*</span></label>
                                <input
                                  type="email"
                                  className="form-input"
                                  placeholder="Enter official company email"
                                  value={companyEmail}
                                  onChange={(e) => setCompanyEmail(e.target.value)}
                                  maxLength={50}
                                  required
                                />
                                <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                  {(companyEmail || "").length}/50
                                </div>
                              </div>
                              <div>
                                <label className="input-label">Company Phone <span>*</span></label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Enter phone number"
                                  value={companyPhone}
                                  onChange={(e) => setCompanyPhone(e.target.value.replace(/\D/g, ''))}
                                  maxLength={10}
                                  required
                                />
                                <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                  {(companyPhone || "").length}/10
                                </div>
                              </div>
                            </div>

                            <div className="form-row-2">
                              <div>
                                <label className="input-label">Company Website</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="https://"
                                  value={companyWebsite}
                                  onChange={(e) => setCompanyWebsite(e.target.value)}
                                  maxLength={100}
                                />
                                <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                  {(companyWebsite || "").length}/100
                                </div>
                              </div>
                              <div>
                                <label className="input-label">Company Size</label>
                                <select className="form-input" value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                                  <option value="">Select company size</option>
                                  <option value="1-10">1-10 employees</option>
                                  <option value="11-50">11-50 employees</option>
                                  <option value="51-200">51-200 employees</option>
                                  <option value="201-500">201-500 employees</option>
                                  <option value="500+">500+ employees</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-row-2">
                              <div>
                                <label className="input-label">Company Logo</label>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                  <label style={{ height: "36px", display: "flex", alignItems: "center", gap: "6px", background: "white", border: "1px solid #E5E7EB", padding: "0 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                                    <Upload size={14} />
                                    <span>Upload Logo</span>
                                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleTenantLogoUpload} />
                                  </label>
                                  {companyLogo && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <img src={getImageUrl(companyLogo)} alt="" style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "contain", background: "#FFFFFF", border: "1px solid #E5E7EB", padding: "2px" }} />
                                      <span style={{ fontSize: "12px", color: "#4B5563", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={logoFileName || "Uploaded Logo"}>
                                        {logoFileName || "Uploaded Logo"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="input-label">Tenant Status</label>
                                <select className="form-input" value={tenantStatus} onChange={(e) => setTenantStatus(e.target.value)}>
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="input-label">Company Address</label>
                              <textarea
                                className="form-textarea"
                                placeholder="Enter complete company address"
                                value={companyAddress}
                                onChange={(e) => setCompanyAddress(e.target.value)}
                                maxLength={255}
                              />
                              <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                {(companyAddress || "").length}/255
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step 2: Admin User Setup */}
                        {currentStep === 2 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Tenant Administrator Access</h3>
                            <p style={{ fontSize: "13px", color: "#6B7280" }}>Specify the email address for the initial Tenant Admin who will configure workspace modules.</p>

                            <div>
                              <label className="input-label">Admin Email <span>*</span></label>
                              <input
                                type="email"
                                className="form-input"
                                placeholder="admin@tenantdomain.com"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                maxLength={50}
                                required
                              />
                              <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                                {(adminEmail || "").length}/50
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Select Products */}
                        {currentStep === 3 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Select Available Products</h3>
                            <p style={{ fontSize: "13px", color: "#6B7280" }}>Choose which Scaloz workspace application platforms will be initialized for this tenant.</p>

                            <div className="grid-select-cards">
                              {products.map(p => {
                                return (
                                  <div
                                    key={p.code}
                                    className={`select-card ${selectedProducts.includes(p.code) ? "selected" : ""}`}
                                    onClick={() => toggleProductSelect(p.code)}
                                  >
                                    <div className="select-card-icon" style={{ backgroundColor: "var(--primary-color)", color: "#FFFFFF" }}>
                                      {p.icon ? (
                                        <img src={getImageUrl(p.icon)} alt="" />
                                      ) : (
                                        <>
                                          {p.name?.toLowerCase().includes("hrms") && <Users size={16} />}
                                          {p.name?.toLowerCase().includes("mail") && <Mail size={16} />}
                                          {p.name?.toLowerCase().includes("chat") && <MessageSquare size={16} />}
                                          {p.name?.toLowerCase().includes("project") && <Folder size={16} />}
                                          {!["hrms", "mail", "chat", "project"].some(k => p.name?.toLowerCase().includes(k)) && <Globe size={16} />}
                                        </>
                                      )}
                                    </div>
                                    <span className="select-card-title">{p.name}</span>
                                    <span className="select-card-code">{p.code}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {selectedProducts.length > 0 && (
                              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid #E5E7EB", paddingTop: "16px" }}>
                                <h4 style={{ fontSize: "13px", fontWeight: "700" }}>Configure Product Statuses</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  {selectedProducts.map(code => {
                                    const p = products.find(prod => prod.code === code);
                                    return (
                                      <div key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F9FAFB", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E5E7EB", gap: "10px" }}>
                                        <span style={{ fontSize: "13px", fontWeight: "600", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", minWidth: 0, flex: 1 }} title={`${p ? p.name : code} (${code})`}>
                                          {p ? p.name : code} ({code})
                                        </span>
                                        <select
                                          className="form-input"
                                          style={{ width: "120px", height: "32px" }}
                                          value={productStatuses[code] || "Active"}
                                          onChange={(e) => setProductStatuses({
                                            ...productStatuses,
                                            [code]: e.target.value
                                          })}
                                        >
                                          <option value="Active">Active</option>
                                          <option value="Inactive">Inactive</option>
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 4: Subscriptions configuration */}
                        {currentStep === 4 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Configure Subscription</h3>
                            <p style={{ fontSize: "13px", color: "#6B7280" }}>Select the tier limits for this onboarded enterprise workspace.</p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                              {["Starter", "Growth", "Enterprise"].map(plan => (
                                <div
                                  key={plan}
                                  className={`select-card ${subscriptionPlan === plan ? "selected" : ""}`}
                                  onClick={() => setSubscriptionPlan(plan)}
                                >
                                  <CreditCard size={20} style={{ color: "#4B5563" }} />
                                  <span className="select-card-title">{plan} Tier</span>
                                  <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
                                    {plan === "Starter" ? "Up to 10 Users" : plan === "Growth" ? "Up to 100 Users" : "Unlimited Access"}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div style={{ marginTop: "8px" }}>
                              <label className="input-label">User Limit</label>
                              <input
                                type="number"
                                className="form-input"
                                value={userLimit}
                                onChange={(e) => setUserLimit(parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        )}

                        {/* Step 5: Review and Submit Onboarding */}
                        {currentStep === 5 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Review & Confirm Onboarding Details</h3>
                            <p style={{ fontSize: "13px", color: "#6B7280" }}>Verify all options are correct before finalizing database onboarding.</p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#F9FAFB", padding: "16px", borderRadius: "6px", border: "1px solid #E5E7EB" }}>
                              <div>
                                <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "6px" }}>Company Details</h4>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Name:</strong> {tenantName}</p>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Code:</strong> <code>{tenantCode}</code></p>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Email:</strong> {companyEmail}</p>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Phone:</strong> {countryCode} {companyPhone}</p>
                              </div>
                              <div>
                                <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "6px" }}>Admin Credentials</h4>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Admin Email:</strong> {adminEmail}</p>
                              </div>
                              <div style={{ gridColumn: "span 2" }}>
                                <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "6px" }}>Provisioning Selection</h4>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Plan:</strong> {subscriptionPlan} (Limit: {userLimit} users)</p>
                                <p style={{ fontSize: "13px", marginBottom: "3px" }}><strong>Selected Apps:</strong> {selectedProducts.join(", ") || "None"}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Onboarding Wizard footer navigation buttons */}
                        <div className="onboarding-footer">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 1 || onboardingLoading}
                          >
                            Back
                          </button>
                          {currentStep < 5 ? (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleStepNext}
                            >
                              <span>Next</span>
                              <ArrowRight size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleSaveTenant}
                              disabled={onboardingLoading}
                            >
                              {onboardingLoading
                                ? (editingTenant ? "Saving Changes..." : "Onboarding Tenant...")
                                : (editingTenant ? "Save Changes" : "Complete Onboarding")}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right sidebars: Onboard Preview & Info boxes */}
                      <div className="onboarding-sidebar-widgets">
                        <div className="preview-widget">
                          <h3 className="preview-title">Tenant Preview</h3>
                          <div className="preview-logo-placeholder" style={{ borderRadius: "8px", background: "#FFFFFF" }}>
                            {companyLogo ? (
                              <img src={getImageUrl(companyLogo)} alt="" style={{ width: "100%", height: "100%", borderRadius: "8px", objectFit: "contain", padding: "4px" }} />
                            ) : (
                              <Building size={24} style={{ color: "var(--primary-color)" }} />
                            )}
                          </div>
                          <div style={{ textAlign: "center", marginBottom: "16px" }}>
                            <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{tenantName || "-"}</h4>
                            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{tenantCode ? `${tenantCode}.scaloz.com` : "-"}</span>
                          </div>

                          <div className="preview-details">
                            <div className="preview-detail-row">
                              <span className="label">Tenant Name</span>
                              <span className="value">{tenantName || "-"}</span>
                            </div>
                            <div className="preview-detail-row">
                              <span className="label">Tenant Code</span>
                              <span className="value">{tenantCode || "-"}</span>
                            </div>
                            <div className="preview-detail-row">
                              <span className="label">Email</span>
                              <span className="value">{companyEmail || "-"}</span>
                            </div>
                            <div className="preview-detail-row">
                              <span className="label">Phone</span>
                              <span className="value">{companyPhone ? `${countryCode} ${companyPhone}` : "-"}</span>
                            </div>
                            <div className="preview-detail-row">
                              <span className="label">Size</span>
                              <span className="value">{companySize || "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="info-widget">
                          <h4>What's Next?</h4>
                          <ul className="info-list">
                            <li className="info-item">
                              <div className="info-item-number">1</div>
                              <span>Add admin user who will manage this tenant</span>
                            </li>
                            <li className="info-item">
                              <div className="info-item-number">2</div>
                              <span>Select products that will be available for this tenant</span>
                            </li>
                            <li className="info-item">
                              <div className="info-item-number">3</div>
                              <span>Choose specific modules for each product</span>
                            </li>
                            <li className="info-item">
                              <div className="info-item-number">4</div>
                              <span>Set subscription plan and user limits</span>
                            </li>
                            <li className="info-item">
                              <div className="info-item-number">5</div>
                              <span>Review all details and complete onboarding</span>
                            </li>
                          </ul>
                        </div>


                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* View 3: PRODUCTS PAGE */}
            {activeMenu === "Products" && (
              <div>
                <div className="page-header">
                  <div className="header-title">
                    <h2>Products</h2>
                    <p>Manage all platform products and their details</p>
                  </div>
                  <div className="header-actions">
                    <div className="search-container">
                      <Search size={15} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search products..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" onClick={openAddProduct}>
                      <Plus size={15} />
                      <span>Add Product</span>
                    </button>
                  </div>
                </div>

                <div className="table-card">
                  {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 20px", color: "#9CA3AF" }}>
                      <Globe size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
                      <h3>No Products Registered</h3>
                      <p style={{ marginTop: "6px", fontSize: "13px" }}>Click the "Add Product" button to add a new dynamic launcher card.</p>
                    </div>
                  ) : (
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Icon</th>
                          <th>Product Name</th>
                          <th>Product Code</th>
                          <th>Description</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map(p => {
                          return (
                            <tr key={p.id}>
                              <td>
                                {p.icon ? (
                                  <div className="table-icon-container">
                                    <img src={getImageUrl(p.icon)} alt="" />
                                  </div>
                                ) : (
                                  <div className="table-icon-container" style={{ backgroundColor: "var(--primary-color)", color: "#FFFFFF" }}>
                                    {p.name?.toLowerCase().includes("hrms") && <Users size={16} />}
                                    {p.name?.toLowerCase().includes("mail") && <Mail size={16} />}
                                    {p.name?.toLowerCase().includes("chat") && <MessageSquare size={16} />}
                                    {p.name?.toLowerCase().includes("project") && <Folder size={16} />}
                                    {!["hrms", "mail", "chat", "project"].some(k => p.name?.toLowerCase().includes(k)) && <Globe size={16} />}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="product-info-cell">
                                  <span className="name">{p.name}</span>
                                </div>
                              </td>
                              <td>{p.code || p.name?.toUpperCase().slice(0, 4)}</td>
                              <td>{p.content}</td>
                              <td>
                                <div className="actions-cell">
                                  <button className="action-btn" onClick={() => openEditProduct(p)} title="Edit Product">
                                    <Edit2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>



                {/* Right Drawer: Add Product Form */}
                {isProductDrawerOpen && (
                  <div className="drawer-overlay" onClick={() => setIsProductDrawerOpen(false)}>
                    <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
                      <div className="drawer-header">
                        <h3>{editingProduct ? "Edit Product" : "Add Product"}</h3>
                        <button className="action-btn" onClick={() => setIsProductDrawerOpen(false)}>
                          <X size={18} />
                        </button>
                      </div>

                      {prodFormError && (
                        <div style={{ margin: "14px 20px 0 20px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--danger-color)", borderRadius: "6px", fontSize: "12px" }}>
                          {prodFormError}
                        </div>
                      )}

                      <form onSubmit={handleSaveProduct} style={{ display: "flex", flexDirection: "column", height: "calc(100% - 60px)" }}>
                        <div className="drawer-body">
                          <div>
                            <label className="input-label">Product Icon</label>
                            <div className="upload-box-custom">
                              <input type="file" accept="image/*" onChange={handleProductIconUpload} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                              {prodIcon ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" }}>
                                  <img src={getImageUrl(prodIcon)} alt="" style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "contain", background: "#FFFFFF", padding: "2px", border: "1px solid #E5E7EB" }} />
                                  <span style={{ fontSize: "11px", color: "#6B7280" }}>Click to replace</span>
                                </div>
                              ) : (
                                <>
                                  <div className="upload-box-icon">
                                    <Upload size={16} />
                                  </div>
                                  <span style={{ fontSize: "12px", color: "#4B5563", fontWeight: "600" }}>Upload Icon</span>
                                  <span style={{ fontSize: "11px", color: "#9CA3AF" }}>SVG, PNG (Max. 2MB)</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Product Name <span>*</span></label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Enter product name"
                              value={prodName}
                              onChange={(e) => setProdName(e.target.value)}
                              maxLength={100}
                              required
                            />
                            <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                              {(prodName || "").length}/100
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Product Code <span>*</span></label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Enter product code"
                              value={prodCode}
                              onChange={(e) => setProdCode(e.target.value.toUpperCase())}
                              maxLength={50}
                              required
                            />
                            <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                              {(prodCode || "").length}/50
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Product Description <span>*</span></label>
                            <textarea
                              className="form-textarea"
                              placeholder="Enter product description"
                              value={prodDesc}
                              onChange={(e) => setProdDesc(e.target.value)}
                              maxLength={500}
                              required
                            />
                            <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                              {(prodDesc || "").length}/500
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Base URL <span>*</span></label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="https://"
                              value={prodUrl}
                              onChange={(e) => setProdUrl(e.target.value)}
                              maxLength={100}
                              required
                            />
                            <div style={{ textAlign: "right", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                              {(prodUrl || "").length}/100
                            </div>
                          </div>


                        </div>

                        <div className="drawer-footer">
                          <button type="button" className="btn-secondary" onClick={() => setIsProductDrawerOpen(false)} disabled={prodFormLoading}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-primary" disabled={prodFormLoading}>
                            {prodFormLoading ? "Saving..." : "Save Product"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View 4: MODULES PAGE */}
            {activeMenu === "Modules" && (
              <div>
                <div className="page-header">
                  <div className="header-title">
                    <h2>Modules</h2>
                    <p>Manage all product modules and their details</p>
                  </div>
                  <div className="header-actions">
                    <div className="search-container">
                      <Search size={15} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search modules..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" onClick={() => {
                      setEditingModule(null);
                      setModName("");
                      setModCode("");
                      setModProductId(products[0]?.id || "");
                      setModFormError("");
                      setIsModuleDrawerOpen(true);
                    }}>
                      <Plus size={15} />
                      <span>Add Module</span>
                    </button>
                  </div>
                </div>

                <div className="table-card">
                  {modules.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 20px", color: "#9CA3AF" }}>
                      <Layers size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
                      <h3>No Modules Configured</h3>
                      <p style={{ marginTop: "6px", fontSize: "13px" }}>Click the button above to add a new module to a product.</p>
                    </div>
                  ) : (
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Icon</th>
                          <th>Module Name</th>
                          <th>Module Code</th>
                          <th>Associated Product</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modules
                          .filter(m =>
                            m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map(m => {
                            return (
                              <tr key={m.id}>
                                <td>
                                  <div className="table-icon-container" style={{ backgroundColor: "var(--primary-color)", color: "#FFFFFF" }}>
                                    {m.product?.name?.toLowerCase().includes("hrms") && <Users size={16} />}
                                    {m.product?.name?.toLowerCase().includes("mail") && <Mail size={16} />}
                                    {m.product?.name?.toLowerCase().includes("chat") && <MessageSquare size={16} />}
                                    {m.product?.name?.toLowerCase().includes("project") && <Folder size={16} />}
                                    {!["hrms", "mail", "chat", "project"].some(k => m.product?.name?.toLowerCase().includes(k)) && <Globe size={16} />}
                                  </div>
                                </td>
                                <td>
                                  <div className="product-info-cell">
                                    <span className="name">{m.name}</span>
                                    <span className="sub-desc">Active module</span>
                                  </div>
                                </td>
                                <td><code>{m.code}</code></td>
                                <td>
                                  <span style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                                    {m.product?.name} ({m.product?.code})
                                  </span>
                                </td>
                                <td>
                                  <div className="actions-cell">
                                    <button className="action-btn delete" onClick={() => handleDeleteModule(m.id)}>
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Right Drawer: Add/Edit Module Form */}
                {isModuleDrawerOpen && (
                  <div className="drawer-overlay" onClick={() => setIsModuleDrawerOpen(false)}>
                    <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
                      <div className="drawer-header">
                        <h3>{editingModule ? "Edit Module" : "Add Module"}</h3>
                        <button className="action-btn" onClick={() => setIsModuleDrawerOpen(false)}>
                          <X size={18} />
                        </button>
                      </div>

                      {modFormError && (
                        <div style={{ margin: "14px 20px 0 20px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--danger-color)", borderRadius: "6px", fontSize: "12px" }}>
                          {modFormError}
                        </div>
                      )}

                      <form onSubmit={handleSaveModule} style={{ display: "flex", flexDirection: "column", height: "calc(100% - 60px)" }}>
                        <div className="drawer-body">
                          <div>
                            <label className="input-label">Product <span>*</span></label>
                            <div style={{ position: "relative" }}>
                              <select className="form-input" value={modProductId} onChange={(e) => setModProductId(e.target.value)} style={{ appearance: "none", width: "100%" }}>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                              </select>
                              <ChevronDown size={14} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none" }} />
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Module Name <span>*</span></label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Enter module name"
                              value={modName}
                              onChange={(e) => setModName(e.target.value)}
                              required
                            />
                          </div>

                          <div>
                            <label className="input-label">Module Code <span>*</span></label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Enter module code"
                              value={modCode}
                              onChange={(e) => setModCode(e.target.value.toUpperCase())}
                              required
                            />
                          </div>
                        </div>

                        <div className="drawer-footer">
                          <button type="button" className="btn-secondary" onClick={() => setIsModuleDrawerOpen(false)} disabled={modFormLoading}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-primary" disabled={modFormLoading}>
                            {modFormLoading ? "Saving..." : "Save Module"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View 5: SUBSCRIPTIONS PAGE */}
            {activeMenu === "Subscriptions" && (
              <div>
                <div className="page-header">
                  <div className="header-title">
                    <h2>Subscriptions</h2>
                    <p>Manage all company subscriptions and workspace user limits</p>
                  </div>
                  <div className="header-actions">
                    <div className="search-container">
                      <Search size={15} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search subscriptions..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => searchQuery(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" onClick={() => {
                      setEditingSub(null);
                      setSubPlanName("Growth");
                      setSubUserLimit(100);
                      setSubTenantId(tenants[0]?.id || "");
                      setSubFormError("");
                      setIsSubDrawerOpen(true);
                    }}>
                      <Plus size={15} />
                      <span>Add Subscription</span>
                    </button>
                  </div>
                </div>

                <div className="table-card">
                  {subscriptions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 20px", color: "#9CA3AF" }}>
                      <CreditCard size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
                      <h3>No Subscriptions Active</h3>
                      <p style={{ marginTop: "6px", fontSize: "13px" }}>Click the button above to add a subscription to a tenant.</p>
                    </div>
                  ) : (
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Tenant Workspace</th>
                          <th>Subscription Plan</th>
                          <th>User Limit</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions
                          .filter(s =>
                            s.planName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map(s => (
                            <tr key={s.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #BFDBFE" }}>
                                    <Building size={14} style={{ color: "#2563EB" }} />
                                  </div>
                                  <div className="product-info-cell">
                                    <span className="name">{s.tenant?.name}</span>
                                    <span className="sub-desc">Workspace: {s.tenant?.code}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: "700", color: "#1F2937" }}>
                                  {s.planName} Plan
                                </span>
                              </td>
                              <td>
                                <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                                  {s.userLimit} Users Max
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill ${s.status?.toLowerCase() === "active" ? "active" : "inactive"}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td>
                                <div className="actions-cell">
                                  <button className="action-btn delete" onClick={() => handleDeleteSubscription(s.id)}>
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Right Drawer: Add/Edit Subscription Form */}
                {isSubDrawerOpen && (
                  <div className="drawer-overlay" onClick={() => setIsSubDrawerOpen(false)}>
                    <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
                      <div className="drawer-header">
                        <h3>{editingSub ? "Edit Subscription" : "Add Subscription"}</h3>
                        <button className="action-btn" onClick={() => setIsSubDrawerOpen(false)}>
                          <X size={18} />
                        </button>
                      </div>

                      {subFormError && (
                        <div style={{ margin: "14px 20px 0 20px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "var(--danger-color)", borderRadius: "6px", fontSize: "12px" }}>
                          {subFormError}
                        </div>
                      )}

                      <form onSubmit={handleSaveSubscription} style={{ display: "flex", flexDirection: "column", height: "calc(100% - 60px)" }}>
                        <div className="drawer-body">
                          <div>
                            <label className="input-label">Tenant Workspace <span>*</span></label>
                            <div style={{ position: "relative" }}>
                              <select className="form-input" value={subTenantId} onChange={(e) => setSubTenantId(e.target.value)} style={{ appearance: "none", width: "100%" }}>
                                <option value="">-- Select Workspace --</option>
                                {tenants.map(t => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                                ))}
                              </select>
                              <ChevronDown size={14} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none" }} />
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Plan Tier <span>*</span></label>
                            <div style={{ position: "relative" }}>
                              <select className="form-input" value={subPlanName} onChange={(e) => setSubPlanName(e.target.value)} style={{ appearance: "none", width: "100%" }}>
                                <option value="Starter">Starter Plan</option>
                                <option value="Growth">Growth Plan</option>
                                <option value="Enterprise">Enterprise Plan</option>
                              </select>
                              <ChevronDown size={14} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none" }} />
                            </div>
                          </div>

                          <div>
                            <label className="input-label">User Limit <span>*</span></label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="100"
                              value={subUserLimit}
                              onChange={(e) => setSubUserLimit(parseInt(e.target.value))}
                              required
                            />
                          </div>
                        </div>

                        <div className="drawer-footer">
                          <button type="button" className="btn-secondary" onClick={() => setIsSubDrawerOpen(false)} disabled={subFormLoading}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-primary" disabled={subFormLoading}>
                            {subFormLoading ? "Saving..." : "Save Subscription"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View 6: REPORTS Placeholder layout */}
            {activeMenu === "Reports" && (
              <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "32px", textAlign: "center" }}>
                <Shield size={40} style={{ color: "var(--primary-color)", marginBottom: "12px", opacity: 0.8 }} />
                <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Reports Management</h3>
                <p style={{ color: "#9CA3AF", fontSize: "13px", marginTop: "6px", maxWidth: "400px", margin: "6px auto 0 auto", lineHeight: "1.5" }}>
                  This panel provides standard enterprise Super Admin utility hooks to control reports configuration settings.
                </p>
              </div>
            )}

            {/* View 7: GENERAL SETTINGS CONFIGURATION */}
            {activeMenu === "Settings" && (
              <div className="settings-container-panel" style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F3F4F6", paddingBottom: "16px", marginBottom: "24px" }}>
                  <div>
                    <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#1F2937" }}>General Settings Configuration</h2>
                    <p style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>Configure slides/cards for the login screens left-side showcase module.</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={handleMigrateFromHrms}
                      disabled={migrationLoading}
                      style={{
                        background: migrationLoading ? "#F3F4F6" : "var(--primary-color)",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: migrationLoading ? "#9CA3AF" : "white",
                        cursor: migrationLoading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      <RefreshCw size={16} className={migrationLoading ? "spin" : ""} />
                      {migrationLoading ? "Syncing..." : "Sync HRMS Employees"}
                    </button>
                    <button
                      onClick={() => setActiveMenu("Dashboard")}
                      style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4B5563" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Add New Slide */}
                <div style={{ marginBottom: "32px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1F2937", marginBottom: "16px" }}>Add New Slide</h3>

                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#4B5563", letterSpacing: "0.05em", marginBottom: "8px" }}>MEDIA UPLOAD (SELECT MULTIPLE IMAGES/GIFS)</div>

                  {/* File Selector Cloud Area */}
                  <div
                    onClick={() => document.getElementById("slide-file-input").click()}
                    style={{
                      border: "2px dashed #E5E7EB",
                      borderRadius: "8px",
                      padding: "32px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      cursor: "pointer",
                      background: "#FAFAFA",
                      transition: "border-color 0.2s",
                      marginBottom: "16px"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary-color)"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
                  >
                    <Upload size={32} style={{ color: "#9CA3AF" }} />
                    <button
                      type="button"
                      style={{
                        background: "white",
                        border: "1px solid #D1D5DB",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#374151",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      SELECT MULTIPLE FILES
                    </button>
                    <input
                      id="slide-file-input"
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        const newDrafts = [];
                        for (let file of files) {
                          const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(file);
                          });
                          newDrafts.push({
                            id: Date.now() + Math.random(),
                            imageBytes: base64,
                            title: "",
                            description: ""
                          });
                        }
                        setDraftSlides((prev) => [...prev, ...newDrafts]);
                        e.target.value = null; // reset
                      }}
                    />
                  </div>

                  {/* Draft Slides List */}
                  {draftSlides.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Selected Slides Drafts</h4>
                      {draftSlides.map((draft, idx) => (
                        <div
                          key={draft.id}
                          style={{
                            display: "flex",
                            gap: "16px",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                            padding: "16px",
                            background: "#FFFFFF",
                            position: "relative"
                          }}
                        >
                          <img
                            src={draft.imageBytes}
                            alt="Preview"
                            style={{ width: "90px", height: "90px", objectFit: "contain", borderRadius: "6px", background: "#F9FAFB", border: "1px solid #E5E7EB" }}
                          />
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div>
                              <label style={{ fontSize: "12px", fontWeight: "600", color: "#4B5563" }}>Slide Title / Matter</label>
                              <input
                                type="text"
                                placeholder="Enter title (e.g. One Platform. Every HR Need.)"
                                value={draft.title}
                                onChange={(e) => {
                                  const updated = [...draftSlides];
                                  updated[idx].title = e.target.value;
                                  setDraftSlides(updated);
                                }}
                                style={{ width: "100%", padding: "6px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D1D5DB", marginTop: "4px" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "12px", fontWeight: "600", color: "#4B5563" }}>Slide Description / Matter</label>
                              <textarea
                                placeholder="Enter description text..."
                                value={draft.description}
                                onChange={(e) => {
                                  const updated = [...draftSlides];
                                  updated[idx].description = e.target.value;
                                  setDraftSlides(updated);
                                }}
                                rows={2}
                                style={{ width: "100%", padding: "6px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid #D1D5DB", marginTop: "4px", resize: "vertical" }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setDraftSlides((prev) => prev.filter((d) => d.id !== draft.id))}
                            style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      {settingsSlideUploadError && (
                        <div style={{ color: "#EF4444", fontSize: "13px" }}>{settingsSlideUploadError}</div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={async () => {
                            setSettingsSlideUploadError("");
                            try {
                              for (let draft of draftSlides) {
                                const response = await fetch(`${API_BASE_URL}/settings/slides`, {
                                  method: "POST",
                                  headers: getHeaders(),
                                  body: JSON.stringify({
                                    imageUrl: draft.imageBytes,
                                    title: draft.title,
                                    description: draft.description
                                  })
                                });
                                if (!response.ok) {
                                  throw new Error("Failed to save one of the slides.");
                                }
                              }
                              setDraftSlides([]);
                              fetchSlides();
                            } catch (err) {
                              setSettingsSlideUploadError(err.message || "Error uploading slides.");
                            }
                          }}
                          style={{
                            background: "#10B981",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            padding: "10px 20px",
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                          }}
                        >
                          <Upload size={16} />
                          Upload All Selected Slides
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <hr style={{ border: "none", borderTop: "1px solid #F3F4F6", margin: "24px 0" }} />

                {/* Existing Slides */}
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1F2937", marginBottom: "16px" }}>Existing Slides</h3>

                  {slidesLoading ? (
                    <div style={{ color: "#6B7280", fontSize: "13px" }}>Loading existing slides...</div>
                  ) : slides.length === 0 ? (
                    <div style={{ color: "#9CA3AF", fontSize: "13px", fontStyle: "italic" }}>No slides added yet.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                      {slides.map((slide) => (
                        <div
                          key={slide.id}
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                            padding: "16px",
                            background: "#FFFFFF",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            position: "relative"
                          }}
                        >
                          <img
                            src={slide.imageUrl}
                            alt={slide.title}
                            style={{ width: "100%", height: "140px", objectFit: "contain", background: "#F9FAFB", borderRadius: "6px", border: "1px solid #E5E7EB" }}
                          />
                          <div>
                            <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#1F2937" }}>{slide.title || "(Untitled)"}</h4>
                            <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", lineHeight: "1.4" }}>{slide.description || "(No description)"}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSlide(slide.id)}
                            style={{
                              position: "absolute",
                              top: "12px",
                              right: "12px",
                              background: "rgba(255, 255, 255, 0.9)",
                              border: "1px solid #EF4444",
                              borderRadius: "4px",
                              color: "#EF4444",
                              cursor: "pointer",
                              padding: "4px"
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "32px", borderTop: "1px solid #F3F4F6", paddingTop: "16px" }}>
                  <button
                    onClick={() => setActiveMenu("Dashboard")}
                    style={{
                      background: "#F3F4F6",
                      border: "none",
                      borderRadius: "6px",
                      padding: "8px 20px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4B5563",
                      cursor: "pointer"
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
