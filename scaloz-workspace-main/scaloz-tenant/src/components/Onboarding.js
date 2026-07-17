import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Shield, Mail, User, Info, CheckCircle, XCircle, Trash2, Edit2, Upload, Download, FileText, X, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';

const cleanEmpId = (empId) => {
    if (!empId) return "";
    if (typeof empId === "string" && empId.includes("_")) {
        return empId.substring(empId.indexOf("_") + 1);
    }
    return empId;
};

const Onboarding = ({ tenantId }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [tenantProducts, setTenantProducts] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkData, setBulkData] = useState([]);
    const [bulkErrors, setBulkErrors] = useState([]);
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [formData, setFormData] = useState({
        employeeId: '',
        name: '',
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        status: 'Active',
        workLocation: '',
        personalEmail: '',
        gender: 'Male',
        dateOfBirth: '',
        aadharNo: '',
        panNo: '',
        presentAddress: '',
        permanentAddress: '',
        contactNo: '',
        emergencyContactNo: '',
        bloodGroup: 'A+',
        joiningDate: '',
        assignedProducts: '',
        tenant: { id: tenantId }
    });

    useEffect(() => {
        fetchUsers();
        fetchTenantProducts();
    }, [tenantId]);

    const fetchTenantProducts = async () => {
        try {
            const response = await api.get(`/tenant/${tenantId}/products`);
            setTenantProducts(response.data);
        } catch (error) {
            console.error("Error loading tenant products from API:", error);
        }
    };

    const downloadTemplate = async () => {
        try {
            const response = await api.get('/tenant-users/template-fields');
            const fields = response.data;

            const mandatoryFieldsList = ["employeeId", "firstName", "lastName", "email", "role", "status", "gender", "dateOfBirth", "aadharNo", "panNo", "bloodGroup", "joiningDate", "assignedProducts"];
            const formattedFields = fields.map(f => {
                let name = f;
                if (f === 'dateOfBirth') {
                    name = 'dateOfBirth(DD/MM/YYYY)';
                } else if (f === 'joiningDate') {
                    name = 'joiningDate(DD/MM/YYYY)';
                }
                return mandatoryFieldsList.includes(f) ? `${name}*` : name;
            });

            // Create a worksheet
            const ws = XLSX.utils.aoa_to_sheet([formattedFields]);
            
            // Apply bold style to headers (in case styling is supported by local Excel viewer/writer)
            for (let i = 0; i < formattedFields.length; i++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
                if (ws[cellRef]) {
                    ws[cellRef].s = {
                        font: {
                            bold: true
                        }
                    };
                }
            }

            // Create a new workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Onboarding Template");
            
            // Generate buffer and trigger download as Excel file
            XLSX.writeFile(wb, "user_onboarding_template.xlsx");
        } catch (error) {
            console.error("Error generating Excel template:", error);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBulkFile(file);
        setBulkErrors([]);
        setBulkResult(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (json.length === 0) {
                    setBulkErrors(["The uploaded file contains no data rows."]);
                    setBulkData([]);
                    return;
                }

                const fieldsResponse = await api.get('/tenant-users/template-fields');
                const expectedFields = fieldsResponse.data;

                const fileHeaders = Object.keys(json[0]).map(h => h.trim().replace(/\*/g, ''));
                const mandatoryFields = [
                    { key: "employeeId", label: "Employee ID" },
                    { key: "firstName", label: "First Name" },
                    { key: "lastName", label: "Last Name" },
                    { key: "email", label: "Work Email" },
                    { key: "role", label: "Role" },
                    { key: "status", label: "Status" },
                    { key: "gender", label: "Gender" },
                    { key: "dateOfBirth", label: "Date of Birth" },
                    { key: "aadharNo", label: "Aadhaar Number" },
                    { key: "panNo", label: "PAN Number" },
                    { key: "bloodGroup", label: "Blood Group" },
                    { key: "joiningDate", label: "Joining Date" },
                    { key: "assignedProducts", label: "Products selection" }
                ];

                const missingRequiredHeaders = [];
                mandatoryFields.forEach(f => {
                    if (f.key === 'dateOfBirth') {
                        if (!fileHeaders.includes("dateOfBirth(DD/MM/YYYY)") && !fileHeaders.includes("dateOfBirth")) {
                            missingRequiredHeaders.push(`${f.label} (dateOfBirth(DD/MM/YYYY))`);
                        }
                    } else if (f.key === 'joiningDate') {
                        if (!fileHeaders.includes("joiningDate(DD/MM/YYYY)") && !fileHeaders.includes("joiningDate")) {
                            missingRequiredHeaders.push(`${f.label} (joiningDate(DD/MM/YYYY))`);
                        }
                    } else {
                        if (!fileHeaders.includes(f.key)) {
                            missingRequiredHeaders.push(`${f.label} (${f.key})`);
                        }
                    }
                });

                if (missingRequiredHeaders.length > 0) {
                    setBulkErrors([`Missing required column headers: ${missingRequiredHeaders.join(", ")}`]);
                    setBulkData([]);
                    return;
                }

                const rows = [];
                const errors = [];
                json.forEach((row, index) => {
                    const rowNum = index + 2;

                    const userObj = { 
                        tenant: { id: tenantId },
                        isSubAdmin: false,
                        assignedModules: ""
                    };
                    expectedFields.forEach(f => {
                        let rawVal = "";
                        if (f === 'dateOfBirth') {
                            const valWithStar = row[`dateOfBirth(DD/MM/YYYY)*`] !== undefined ? String(row[`dateOfBirth(DD/MM/YYYY)*`]).trim() : undefined;
                            const valWithoutStar = row[`dateOfBirth(DD/MM/YYYY)`] !== undefined ? String(row[`dateOfBirth(DD/MM/YYYY)`]).trim() : undefined;
                            const valOrigStar = row[`dateOfBirth*`] !== undefined ? String(row[`dateOfBirth*`]).trim() : undefined;
                            const valOrigWithoutStar = row[`dateOfBirth`] !== undefined ? String(row[`dateOfBirth`]).trim() : undefined;
                            
                            rawVal = valWithStar !== undefined ? valWithStar : 
                                     (valWithoutStar !== undefined ? valWithoutStar : 
                                     (valOrigStar !== undefined ? valOrigStar : 
                                     (valOrigWithoutStar !== undefined ? valOrigWithoutStar : "")));
                        } else if (f === 'joiningDate') {
                            const valWithStar = row[`joiningDate(DD/MM/YYYY)*`] !== undefined ? String(row[`joiningDate(DD/MM/YYYY)*`]).trim() : undefined;
                            const valWithoutStar = row[`joiningDate(DD/MM/YYYY)`] !== undefined ? String(row[`joiningDate(DD/MM/YYYY)`]).trim() : undefined;
                            const valOrigStar = row[`joiningDate*`] !== undefined ? String(row[`joiningDate*`]).trim() : undefined;
                            const valOrigWithoutStar = row[`joiningDate`] !== undefined ? String(row[`joiningDate`]).trim() : undefined;
                            
                            rawVal = valWithStar !== undefined ? valWithStar : 
                                     (valWithoutStar !== undefined ? valWithoutStar : 
                                     (valOrigStar !== undefined ? valOrigStar : 
                                     (valOrigWithoutStar !== undefined ? valOrigWithoutStar : "")));
                        } else {
                            const valWithStar = row[`${f}*`] !== undefined ? String(row[`${f}*`]).trim() : undefined;
                            const valWithoutStar = row[f] !== undefined ? String(row[f]).trim() : undefined;
                            rawVal = valWithStar !== undefined ? valWithStar : (valWithoutStar !== undefined ? valWithoutStar : "");
                        }
                        userObj[f] = rawVal;
                    });

                    // Validate presence of mandatory fields
                    mandatoryFields.forEach(f => {
                        if (!userObj[f.key]) {
                            errors.push(`Row ${rowNum}: ${f.label} is missing.`);
                        }
                    });

                    // Format checks
                    if (userObj.email && !/\S+@\S+\.\S+/.test(userObj.email)) {
                        errors.push(`Row ${rowNum}: Work Email format is invalid (${userObj.email}).`);
                    }
                    if (userObj.personalEmail && !/\S+@\S+\.\S+/.test(userObj.personalEmail)) {
                        errors.push(`Row ${rowNum}: Personal Email format is invalid (${userObj.personalEmail}).`);
                    }
                    if (userObj.aadharNo && !/^\d{12}$/.test(userObj.aadharNo)) {
                        errors.push(`Row ${rowNum}: Aadhaar Number must be exactly 12 digits and contain only numbers.`);
                    }
                    if (userObj.panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(userObj.panNo)) {
                        errors.push(`Row ${rowNum}: PAN Number must be of format: 5 letters, 4 numbers, and 1 letter (e.g., ABCDE1234F).`);
                    }
                    if (userObj.contactNo && !/^\d{10}$/.test(userObj.contactNo)) {
                        errors.push(`Row ${rowNum}: Contact Number must be a 10-digit number.`);
                    }
                    if (userObj.emergencyContactNo && !/^\d{10}$/.test(userObj.emergencyContactNo)) {
                        errors.push(`Row ${rowNum}: Emergency Contact Number must be a 10-digit number.`);
                    }
                    if (userObj.dateOfBirth) {
                        let dobDate = null;
                        const dobStr = userObj.dateOfBirth.trim();
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
                            dobDate = new Date(dobStr);
                        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) {
                            const [d, m, y] = dobStr.split('/');
                            dobDate = new Date(y, m - 1, d);
                        } else {
                            dobDate = new Date(dobStr);
                        }

                        if (isNaN(dobDate.getTime())) {
                            errors.push(`Row ${rowNum}: Date of Birth format is invalid. Please use YYYY-MM-DD or DD/MM/YYYY.`);
                        } else {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dobDate.setHours(0, 0, 0, 0);
                            if (dobDate > today) {
                                errors.push(`Row ${rowNum}: Date of Birth cannot be in the future (${dobStr}).`);
                            }
                        }
                    }

                    rows.push(userObj);
                });

                if (errors.length > 0) {
                    setBulkErrors(errors);
                    setBulkData([]);
                } else {
                    setBulkData(rows);
                }
            } catch (err) {
                console.error("Error parsing file:", err);
                setBulkErrors(["Failed to read or parse the file. Please ensure it is a valid CSV or Excel file."]);
                setBulkData([]);
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleBulkSubmit = async () => {
        if (bulkData.length === 0 || bulkSubmitting) return;
        setBulkSubmitting(true);
        setBulkErrors([]);
        try {
            const response = await api.post('/tenant-users/bulk-onboard', bulkData);
            setBulkResult(response.data);
            fetchUsers();
        } catch (error) {
            console.error("Error submitting bulk onboarding:", error);
            setBulkErrors(["An error occurred on the server during bulk onboarding. Please check your data."]);
        } finally {
            setBulkSubmitting(false);
        }
    };

    const resetBulkState = () => {
        setBulkFile(null);
        setBulkData([]);
        setBulkErrors([]);
        setBulkResult(null);
        setShowBulkModal(false);
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get(`/tenant-users/tenant/${tenantId}`);
            setUsers(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching users:", error);
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            firstName: '',
            lastName: '',
            email: '',
            role: '',
            status: 'Active',
            workLocation: '',
            personalEmail: '',
            gender: 'Male',
            dateOfBirth: '',
            aadharNo: '',
            panNo: '',
            presentAddress: '',
            permanentAddress: '',
            contactNo: '',
            emergencyContactNo: '',
            bloodGroup: 'A+',
            joiningDate: '',
            assignedProducts: '',
            tenant: { id: tenantId }
        });
        setEditingUserId(null);
        setCurrentStep(1);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        if (formData.aadharNo && !/^\d{12}$/.test(formData.aadharNo)) {
            alert("❌ Aadhaar Number must be exactly 12 digits and contain only numbers.");
            setIsSubmitting(false);
            return;
        }

        if (formData.panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNo)) {
            alert("❌ PAN Number must be of format: 5 letters, 4 numbers, and 1 letter (e.g., ABCDE1234F).");
            setIsSubmitting(false);
            return;
        }

        if (formData.dateOfBirth) {
            const dob = new Date(formData.dateOfBirth);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dob.setHours(0, 0, 0, 0);
            if (dob > today) {
                alert("❌ Date of Birth cannot be in the future.");
                setIsSubmitting(false);
                return;
            }
        }

        try {
            if (editingUserId) {
                await api.put(`/tenant-users/${editingUserId}`, formData);
            } else {
                await api.post('/tenant-users/onboard', formData);
            }
            setShowModal(false);
            fetchUsers();
            resetForm();
        } catch (error) {
            if (error.response && error.response.status === 409) {
                alert(`❌ ${error.response.data.message || 'Data already exists.'}`);
            } else {
                alert(`❌ Failed to ${editingUserId ? 'update' : 'onboard'} user. Please check your network or try again.`);
            }
            console.error("Error submitting user form:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (user) => {
        setEditingUserId(user.id);
        setFormData({
            employeeId: cleanEmpId(user.employeeId) || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            role: user.role || 'Employee',
            status: user.status || 'Active',
            workLocation: user.workLocation || '',
            personalEmail: user.personalEmail || '',
            gender: user.gender || 'Male',
            dateOfBirth: user.dateOfBirth || '',
            aadharNo: user.aadharNo || '',
            panNo: user.panNo || '',
            presentAddress: user.presentAddress || '',
            permanentAddress: user.permanentAddress || '',
            contactNo: user.contactNo || '',
            emergencyContactNo: user.emergencyContactNo || '',
            bloodGroup: user.bloodGroup || 'A+',
            joiningDate: user.joiningDate || '',
            assignedProducts: user.assignedProducts || '',
            tenant: { id: tenantId }
        });
        setCurrentStep(1);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                await api.delete(`/tenant-users/${id}`);
                fetchUsers();
            } catch (error) {
                console.error("Error deleting user:", error);
            }
        }
    };

    const filteredUsers = users.filter(u =>
        (`${u.firstName || ""} ${u.lastName || ""}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
        cleanEmpId(u.employeeId).toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleProductToggle = (productCode) => {
        const currentProducts = formData.assignedProducts ? formData.assignedProducts.split(',') : [];
        const codeStr = productCode ? productCode.toString() : '';
        if (!codeStr) return;

        let newProducts;
        if (currentProducts.includes(codeStr)) {
            newProducts = currentProducts.filter(c => c !== codeStr);
        } else {
            newProducts = [...currentProducts, codeStr];
        }
        setFormData({ ...formData, assignedProducts: newProducts.join(',') });
    };

    return (
        <div className="onboarding-container">
            <div className="launchpad-view-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>Onboarding</h1>
                        <p>Manage and onboard your organization's members.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="invite-btn" style={{ backgroundColor: '#10B981' }} onClick={() => { resetBulkState(); setShowBulkModal(true); }}>
                            <Upload size={18} />
                            <span>Bulk Onboard</span>
                        </button>
                        <button className="invite-btn" onClick={() => { resetForm(); setShowModal(true); }}>
                            <UserPlus size={18} />
                            <span>Onboard New User</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="onboarding-controls" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div className="search-input-wrapper header-search" style={{ flex: 1, maxWidth: '400px' }}>
                    <Search size={16} className="search-icon-inside" />
                    <input
                        type="text"
                        placeholder="Search by name, ID or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="users-table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User Details</th>
                            <th>Employee ID</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>No users found.</td></tr>
                        ) : filteredUsers.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <div className="user-info-cell">
                                        <div className="user-avatar-small">
                                            {`${user.firstName || ""} ${user.lastName || ""}`.trim().split(' ').map(n => n[0]).join('').toUpperCase()}
                                        </div>
                                        <div className="user-meta">
                                            <span className="user-name">{`${user.firstName || ""} ${user.lastName || ""}`.trim()}</span>
                                            <span className="user-email">{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td><span className="emp-id-badge">{cleanEmpId(user.employeeId)}</span></td>
                                <td>
                                    <div className="role-chip">
                                        <span>{user.role}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-badge ${user.status.toLowerCase()}`}>
                                        {user.status === 'Active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        {user.status}
                                    </span>
                                </td>
                                <td>
                                    <div className="action-btns">
                                        <button className="icon-btn edit" onClick={() => handleEditClick(user)} title="Edit User"><Edit2 size={16} /></button>
                                        <button className="icon-btn delete" onClick={() => handleDelete(user.id)} title="Delete User"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingUserId ? "Edit User Details" : (currentStep === 1 ? "Select Products" : "Onboard New User")}</h2>
                            <button className="close-btn" onClick={() => { setShowModal(false); resetForm(); }}><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="onboard-form">
                            <div className="form-sections-container">

                                {currentStep === 1 ? (
                                    <div className="form-section">
                                        <h3>Products Access</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                            Select the products this user will have access to.
                                        </p>
                                        <div className="product-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                            {tenantProducts.map(product => (
                                                <div
                                                    key={product.productId}
                                                    onClick={() => handleProductToggle(product.productCode)}
                                                    style={{
                                                        padding: '16px',
                                                        border: `2px solid ${(formData.assignedProducts && formData.assignedProducts.split(',').includes(product.productCode?.toString())) ? '#2563EB' : 'var(--border-color)'}`,
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        backgroundColor: (formData.assignedProducts && formData.assignedProducts.split(',').includes(product.productCode?.toString())) ? '#EFF6FF' : '#FFF',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: `2px solid ${(formData.assignedProducts && formData.assignedProducts.split(',').includes(product.productCode?.toString())) ? '#2563EB' : '#CBD5E1'}`,
                                                        backgroundColor: (formData.assignedProducts && formData.assignedProducts.split(',').includes(product.productCode?.toString())) ? '#2563EB' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {(formData.assignedProducts && formData.assignedProducts.split(',').includes(product.productCode?.toString())) && <CheckCircle size={14} color="#FFF" />}
                                                    </div>
                                                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>{product.productName}</span>
                                                </div>
                                            ))}
                                            {tenantProducts.length === 0 && (
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No products available for this tenant.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="form-section">
                                            <h3>Work & Account Details</h3>
                                            <div className="form-grid">
                                                <div className="form-group">
                                                    <label>First Name <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formData.firstName}
                                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                        placeholder="e.g. John"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Last Name <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formData.lastName}
                                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                        placeholder="e.g. Doe"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Employee ID <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formData.employeeId}
                                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                                        placeholder="e.g. EMP123"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Work Email <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="email"
                                                        required
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        placeholder="e.g. john@company.com"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Role <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Manager, Employee"
                                                        value={formData.role}
                                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Work Location <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Hyderabad, Bangalore"
                                                        value={formData.workLocation}
                                                        onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Date of Joining <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.joiningDate}
                                                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Status <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <select
                                                        value={formData.status}
                                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                        required
                                                    >
                                                        <option value="Active">Active</option>
                                                        <option value="Inactive">Inactive</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-section">
                                            <h3>Personal Details</h3>
                                            <div className="form-grid">
                                                <div className="form-group">
                                                    <label>Personal Email</label>
                                                    <input
                                                        type="email"
                                                        value={formData.personalEmail}
                                                        onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                                                        placeholder="e.g. john.doe@gmail.com"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Contact Number</label>
                                                    <input
                                                        type="text"
                                                        value={formData.contactNo}
                                                        onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                                                        placeholder="e.g. 9876543210"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Emergency Contact Number</label>
                                                    <input
                                                        type="text"
                                                        value={formData.emergencyContactNo}
                                                        onChange={(e) => setFormData({ ...formData, emergencyContactNo: e.target.value })}
                                                        placeholder="e.g. 9876543211"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Gender <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <select
                                                        value={formData.gender}
                                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                    >
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>Date of Birth <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.dateOfBirth}
                                                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                                        max={(() => {
                                                            const d = new Date();
                                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                        })()}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Blood Group <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <select
                                                        value={formData.bloodGroup}
                                                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                                                    >
                                                        <option value="A+">A+</option>
                                                        <option value="A-">A-</option>
                                                        <option value="B+">B+</option>
                                                        <option value="B-">B-</option>
                                                        <option value="AB+">AB+</option>
                                                        <option value="AB-">AB-</option>
                                                        <option value="O+">O+</option>
                                                        <option value="O-">O-</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-section">
                                            <h3>Statutory & Address Details</h3>
                                            <div className="form-grid">
                                                <div className="form-group">
                                                    <label>Aadhaar Number <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        maxLength="12"
                                                        required
                                                        value={formData.aadharNo}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            setFormData({ ...formData, aadharNo: val });
                                                        }}
                                                        placeholder="e.g. 123456789012"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>PAN Number <span style={{ color: '#DC2626' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        maxLength="10"
                                                        required
                                                        value={formData.panNo}
                                                        onChange={(e) => {
                                                            let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                                            if (val.length > 10) val = val.substring(0, 10);
                                                            setFormData({ ...formData, panNo: val });
                                                        }}
                                                        placeholder="e.g. ABCDE1234F"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                    <label>Present Address</label>
                                                    <input
                                                        type="text"
                                                        value={formData.presentAddress}
                                                        onChange={(e) => setFormData({ ...formData, presentAddress: e.target.value })}
                                                        placeholder="Street address, City, State"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                    <label>Permanent Address</label>
                                                    <input
                                                        type="text"
                                                        value={formData.permanentAddress}
                                                        onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                                                        placeholder="Same as present address or other permanent address"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                            </div>
                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>

                                {currentStep === 1 ? (
                                    <button type="button" className="submit-btn" onClick={() => setCurrentStep(2)}>
                                        Next
                                    </button>
                                ) : (
                                    <>
                                        <button type="button" className="cancel-btn" onClick={() => setCurrentStep(1)} style={{ marginRight: 'auto' }}>
                                            Back
                                        </button>
                                        <button type="submit" className="submit-btn" disabled={isSubmitting}>
                                            {isSubmitting ? (editingUserId ? 'Updating...' : 'Onboarding...') : (editingUserId ? 'Update User' : 'Onboard User')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '650px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={22} color="#10B981" />
                                <h2>Bulk User Onboarding</h2>
                            </div>
                            <button className="close-btn" onClick={resetBulkState}><XCircle size={24} /></button>
                        </div>

                        <div className="form-sections-container" style={{ padding: '24px' }}>
                            {/* Instructions */}
                            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                                <Info size={24} color="#3B82F6" style={{ flexShrink: 0 }} />
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>Instructions</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                                        Download the onboarding CSV template, fill in all dynamic column details accurately, then select and upload the file below. Supported formats: <strong>CSV</strong> and <strong>Excel (.xlsx, .xls)</strong>.
                                    </p>
                                </div>
                            </div>

                            {/* Download Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px dashed #CBD5E1', borderRadius: '8px', marginBottom: '24px', backgroundColor: '#FFF' }}>
                                <div>
                                    <span style={{ fontWeight: '600', fontSize: '13px', color: '#1E293B' }}>Dynamic Template</span>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>Includes all columns dynamically synchronized from the User schema.</p>
                                </div>
                                <button className="cancel-btn" onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', borderColor: '#3B82F6', color: '#3B82F6' }}>
                                    <Download size={14} />
                                    <span>Download Template</span>
                                </button>
                            </div>

                            {/* Upload Area */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', border: '2px dashed #E2E8F0', borderRadius: '12px', backgroundColor: '#F8FAFC', position: 'relative', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        handleFileChange({ target: { files: e.dataTransfer.files } });
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    accept=".csv, .xlsx, .xls"
                                    onChange={handleFileChange}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                                />
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                    <FileText size={24} color="#10B981" />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                                    {bulkFile ? bulkFile.name : "Choose CSV or Excel file, or drag it here"}
                                </span>
                                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                                    {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : "Max file size: 5MB"}
                                </span>
                            </div>

                            {/* Local Validation Success Details */}
                            {bulkData.length > 0 && !bulkResult && (
                                <div style={{ marginTop: '20px', padding: '12px 16px', backgroundColor: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <CheckCircle size={18} color="#059669" />
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#065F46' }}>
                                        File parsed successfully! {bulkData.length} users ready for onboarding.
                                    </span>
                                </div>
                            )}

                            {/* Local Parse Errors */}
                            {bulkErrors.length > 0 && (
                                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FEE2E2' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <AlertCircle size={18} color="#DC2626" />
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B' }}>Validation Failures</span>
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#B91C1C', maxHeight: '120px', overflowY: 'auto', lineHeight: '1.6' }}>
                                        {bulkErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Server Bulk Result Output */}
                            {bulkResult && (
                                <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Import Results Summary</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div style={{ padding: '12px', backgroundColor: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                                            <span style={{ display: 'block', fontSize: '24px', fontWeight: '800', color: '#059669' }}>{bulkResult.successCount}</span>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#047857' }}>Successfully Onboarded</span>
                                        </div>
                                        <div style={{ padding: '12px', backgroundColor: bulkResult.failureCount > 0 ? '#FEF2F2' : '#F8FAFC', borderRadius: '8px', border: bulkResult.failureCount > 0 ? '1px solid #FEE2E2' : '1px solid #E2E8F0', textAlign: 'center' }}>
                                            <span style={{ display: 'block', fontSize: '24px', fontWeight: '800', color: bulkResult.failureCount > 0 ? '#DC2626' : '#64748B' }}>{bulkResult.failureCount}</span>
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: bulkResult.failureCount > 0 ? '#B91C1C' : '#475569' }}>Failed Rows</span>
                                        </div>
                                    </div>

                                    {bulkResult.failures && bulkResult.failures.length > 0 && (
                                        <div>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Failure Details:</span>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFF' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#F1F5F9', textAlign: 'left' }}>
                                                            <th style={{ padding: '8px 12px', fontWeight: '600' }}>Identifier</th>
                                                            <th style={{ padding: '8px 12px', fontWeight: '600' }}>Error Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {bulkResult.failures.map((fail, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                                <td style={{ padding: '8px 12px', fontWeight: '600', color: '#475569' }}>{fail.identifier}</td>
                                                                <td style={{ padding: '8px 12px', color: '#DC2626' }}>{fail.error}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="cancel-btn" onClick={resetBulkState}>
                                {bulkResult ? "Done" : "Cancel"}
                            </button>
                            {!bulkResult && (
                                <button
                                    type="button"
                                    className="submit-btn"
                                    style={{ backgroundColor: '#10B981', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
                                    disabled={bulkData.length === 0 || bulkSubmitting}
                                    onClick={handleBulkSubmit}
                                >
                                    {bulkSubmitting ? "Onboarding..." : `Onboard ${bulkData.length} Users`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .users-table-container {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    max-height: 550px;
                    overflow-y: auto;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .users-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .users-table th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    padding: 16px 24px;
                    background: #F8FAFC;
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border-color);
                }
                .users-table td {
                    padding: 16px 24px;
                    border-bottom: 1px solid var(--border-color);
                    vertical-align: middle;
                }
                .user-info-cell {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .user-avatar-small {
                    width: 32px;
                    height: 32px;
                    background: #EFF6FF;
                    color: #2563EB;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 700;
                }
                .user-meta {
                    display: flex;
                    flex-direction: column;
                }
                .user-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-main);
                }
                .user-email {
                    font-size: 12px;
                    color: var(--text-muted);
                }
                .emp-id-badge {
                    font-size: 12px;
                    font-weight: 600;
                    background: #F1F5F9;
                    padding: 4px 8px;
                    border-radius: 6px;
                    color: var(--text-sub);
                }
                .role-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: #F0F9FF;
                    color: #0369A1;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-badge.active { color: #059669; }
                .status-badge.inactive { color: #DC2626; }
                
                .action-btns {
                    display: flex;
                    gap: 8px;
                }
                .icon-btn {
                    padding: 6px;
                    border: 1px solid var(--border-color);
                    background: #fff;
                    border-radius: 6px;
                    cursor: pointer;
                    color: var(--text-muted);
                    transition: all 0.2s;
                }
                .icon-btn:hover.edit { color: #2563EB; border-color: #2563EB; }
                .icon-btn:hover.delete { color: #DC2626; border-color: #DC2626; }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease-out;
                }
                .modal-content {
                    background: #fff;
                    width: 700px;
                    max-height: 85vh;
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .onboard-form {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow: hidden;
                }
                .form-sections-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .form-sections-container::-webkit-scrollbar {
                    width: 6px;
                }
                .form-sections-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .form-sections-container::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .form-sections-container::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .form-section h3 {
                    font-size: 13px;
                    font-weight: 700;
                    color: #2563EB;
                    margin-top: 0;
                    margin-bottom: 12px;
                    padding-bottom: 6px;
                    border-bottom: 1px dashed var(--border-color);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px 32px 16px 32px;
                    border-bottom: 1px solid var(--border-color);
                }
                .modal-header h2 { 
                    font-size: 20px; 
                    font-weight: 800; 
                    color: #0f172a;
                    margin: 0;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-group label {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-sub);
                }
                .form-group input, .form-group select {
                    padding: 10px 14px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    outline: none;
                    font-size: 14px;
                    background-color: #F8FAFC;
                    transition: all 0.2s;
                }
                .form-group input:focus, .form-group select:focus { 
                    border-color: #2563EB; 
                    background-color: #FFF; 
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 32px 24px 32px;
                    border-top: 1px solid var(--border-color);
                    background: #FFF;
                }
                .cancel-btn { 
                    padding: 10px 20px; 
                    border: 1px solid #e2e8f0; 
                    background: #fff; 
                    color: #475569;
                    border-radius: 8px; 
                    font-weight: 600; 
                    font-size: 14px;
                    cursor: pointer; 
                    transition: all 0.2s;
                }
                .cancel-btn:hover {
                    background: #f8fafc;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .submit-btn { 
                    padding: 10px 24px; 
                    border: none; 
                    background: #2563EB; 
                    color: #fff; 
                    border-radius: 8px; 
                    font-weight: 600; 
                    font-size: 14px;
                    cursor: pointer; 
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                }
                .submit-btn:hover {
                    background: #1d4ed8;
                    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
                }
                .submit-btn:disabled {
                    background: #94a3b8;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .close-btn { 
                    background: none; 
                    border: none; 
                    color: var(--text-muted); 
                    cursor: pointer; 
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .close-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Onboarding;
