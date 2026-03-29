// src/pages/auth/RegisterTreeGrower.tsx
import logo from "../../assets/logo.png";
import {
  Eye,
  EyeOff,
  Upload,
  CheckCircle,
  FileText,
  User,
  Mail,
  Lock,
  MapPin,
  Phone,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  X,
  Sprout,
  Trees,
  CalendarCheck,
} from "lucide-react";
import { useState, useRef } from "react";
import "../../global css/login.css";
import { useNavigate } from "react-router-dom";
import PlantScopeAlert from "../../components/alert/PlantScopeAlert";
import PlantScopeLoader from "../../components/alert/PlantScopeLoader";

export default function RegisterTreeGrower() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");

  // Step 1: Account Info
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Step 2: Personal Info
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [organization, setOrganization] = useState("");
  // Step 3: Attachment
  const [maintenancePlanDescription, setMaintenancePlanDescription] =
    useState("");
  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = [
    {
      number: 1,
      title: "Account",
      desc: "Set up your login",
      icon: <User size={16} />,
      color: "from-emerald-400 to-green-500",
    },
    {
      number: 2,
      title: "Personal",
      desc: "Your contact details",
      icon: <MapPin size={16} />,
      color: "from-green-500 to-teal-500",
    },
    {
      number: 3,
      title: "Plan",
      desc: "Upload maintenance plan",
      icon: <FileText size={16} />,
      color: "from-teal-500 to-cyan-500",
    },
    {
      number: 4,
      title: "Review",
      desc: "Confirm & submit",
      icon: <ClipboardList size={16} />,
      color: "from-cyan-500 to-blue-500",
    },
  ];

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!email.trim()) newErrors.email = "Email required";
      else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email";
      if (!password) newErrors.password = "Password required";
      else if (password.length < 8) newErrors.password = "Min. 8 characters";
      if (password !== confirmPassword)
        newErrors.confirmPassword = "Passwords don't match";
    }
    if (step === 2) {
      if (!fullName.trim()) newErrors.fullName = "Name required";
      if (!contactNumber.trim()) newErrors.contactNumber = "Contact required";
      if (!address.trim()) newErrors.address = "Address required";
      if (!barangay.trim()) newErrors.barangay = "Barangay required";
    }
    if (step === 3) {
      if (!selectedFile) newErrors.file = "Upload plan required";
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (selectedFile && !allowed.includes(selectedFile.type))
        newErrors.file = "PDF/DOC/DOCX only";
    }
    if (step === 4 && !termsAccepted)
      newErrors.terms = "Accept terms to continue";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep((p) => Math.min(p + 1, 4));
  };
  const handleBack = () => {
    setCurrentStep((p) => Math.max(p - 1, 1));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(file.name);
      if (errors.file) setErrors((p) => ({ ...p, file: "" }));
    }
  };
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("full_name", fullName);
      formData.append("contact_number", contactNumber);
      formData.append("address", address);
      formData.append("barangay", barangay);
      formData.append("organization", organization);
      formData.append(
        "maintenance_plan_description",
        maintenancePlanDescription,
      );
      formData.append("user_role", "TreeGrower");
      if (selectedFile) formData.append("maintenance_plan_file", selectedFile);

      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setPSAlert({
          type: "success",
          title: "Registration Successful!",
          message: `Welcome ${fullName}! Account pending approval.`,
        });
        // Reset
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setContactNumber("");
        setAddress("");
        setBarangay("");
        setOrganization("");
        setSelectedFile(null);
        setFilePreview("");
        setMaintenancePlanDescription("");
        setTermsAccepted(false);
        setCurrentStep(1);
        setTimeout(() => navigate("/login"), 3500);
      } else {
        setPSAlert({
          type: "failed",
          title: "Registration Failed",
          message: data.error || "Please try again.",
        });
      }
    } catch (err) {
      console.error("Registration error:", err);
      setPSAlert({
        type: "error",
        title: "Connection Error",
        message: "Unable to connect to server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = (currentStep / 4) * 100;

  return (
    // ✅ Full viewport gradient background
    <div className="fixed inset-0 bg-[linear-gradient(135deg,#4CAF50_75%,#FFFFFF_25%)] flex items-center justify-center p-3 md:p-4 z-50">
      {isLoading && <PlantScopeLoader />}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* ✅ Main Card: Left Panel + Scrollable Form */}
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row bg-white">
        {/* 🌿 LEFT PANEL - Branding + Progress */}
        <div className="flex-shrink-0 md:w-80 lg:w-96 bg-gradient-to-b from-green-700 via-green-600 to-emerald-700 text-white p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-5 w-24 h-24 bg-emerald-300 rounded-full blur-2xl"></div>
          </div>

          {/* Header Section */}
          <div className="relative z-10 text-center space-y-4">
            <div className="logo-container-login">
              <div className="radar-ring"></div>
              <div className="w-20 h-20 mx-auto rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg animate-bounce-logo">
                <img
                  src={logo}
                  alt="PlantScope"
                  className="w-14 h-14 object-contain"
                />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">PLANTSCOPE</h1>
              <p className="text-green-100 text-sm font-medium">
                TreeGrower Registration
              </p>
            </div>
          </div>

          {/* Progress Section - Vertical Steps */}
          <div className="relative z-10 flex-1 flex flex-col justify-center py-4 md:py-8">
            <p className="text-xs text-green-100/80 text-center mb-4 font-medium">
              Registration Progress
            </p>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;

                return (
                  <div key={step.number} className="relative">
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div
                        className={`absolute left-4 top-8 w-0.5 h-8 ${isCompleted ? "bg-white/60" : "bg-white/20"}`}
                      />
                    )}

                    {/* Step Item */}
                    <div
                      className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-300 ${
                        isActive ? "bg-white/15 ring-1 ring-white/30" : ""
                      }`}
                    >
                      {/* Step Indicator */}
                      <div
                        className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isCompleted
                            ? `bg-gradient-to-br ${step.color} text-white`
                            : isActive
                              ? "bg-white text-green-700 ring-2 ring-white"
                              : "bg-white/20 text-white/70"
                        }`}
                      >
                        {isCompleted ? <CheckCircle size={14} /> : step.icon}
                        {isActive && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#04de71] rounded-full animate-pulse" />
                        )}
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/80"}`}
                        >
                          {step.title}
                        </p>
                        <p
                          className={`text-[10px] ${isActive ? "text-green-100" : "text-white/60"}`}
                        >
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="mt-6 px-2">
              <div className="flex justify-between text-[10px] text-green-100/70 mb-1.5">
                <span>Step {currentStep} of 4</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#04de71] to-emerald-300 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Footer Badge */}
          <div className="relative z-10 pt-4 border-t border-white/20">
            <div className="flex items-center justify-center gap-2 text-[10px] text-green-100/70">
              <Sprout size={12} className="text-[#04de71]" />
              <span>Planting hope, one tree at a time</span>
            </div>
          </div>
        </div>

        {/* 📝 RIGHT PANEL - Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          <div className="max-w-xl mx-auto h-full flex flex-col">
            {/* Form Header */}
            <div className="mb-5 pb-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {steps[currentStep - 1].title} Details
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {steps[currentStep - 1].desc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                title="Back to Login"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1">
              {/* STEP 1: Account */}
              {currentStep === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={14}
                      />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email)
                            setErrors((p) => ({ ...p, email: "" }));
                        }}
                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.email ? "border-red-400" : "border-gray-300"}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-0.5 text-[10px] text-red-500">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={14}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 chars"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password)
                              setErrors((p) => ({ ...p, password: "" }));
                          }}
                          className={`w-full pl-8 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.password ? "border-red-400" : "border-gray-300"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600"
                        >
                          {showPassword ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-0.5 text-[10px] text-red-500">
                          {errors.password}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Confirm <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={14}
                        />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (errors.confirmPassword)
                              setErrors((p) => ({ ...p, confirmPassword: "" }));
                          }}
                          className={`w-full pl-8 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.confirmPassword ? "border-red-400" : "border-gray-300"}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-0.5 text-[10px] text-red-500">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Personal */}
              {currentStep === 2 && (
                <div className="space-y-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName)
                          setErrors((p) => ({ ...p, fullName: "" }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.fullName ? "border-red-400" : "border-gray-300"}`}
                    />
                    {errors.fullName && (
                      <p className="mt-0.5 text-[10px] text-red-500">
                        {errors.fullName}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contact <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={14}
                        />
                        <input
                          type="tel"
                          placeholder="09XX XXX XXXX"
                          value={contactNumber}
                          onChange={(e) => {
                            setContactNumber(e.target.value);
                            if (errors.contactNumber)
                              setErrors((p) => ({ ...p, contactNumber: "" }));
                          }}
                          className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.contactNumber ? "border-red-400" : "border-gray-300"}`}
                        />
                      </div>
                      {errors.contactNumber && (
                        <p className="mt-0.5 text-[10px] text-red-500">
                          {errors.contactNumber}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Organization
                      </label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      placeholder="House, Street, Purok"
                      value={address}
                      rows={2}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (errors.address)
                          setErrors((p) => ({ ...p, address: "" }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm resize-none ${errors.address ? "border-red-400" : "border-gray-300"}`}
                    />
                    {errors.address && (
                      <p className="mt-0.5 text-[10px] text-red-500">
                        {errors.address}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Valencia"
                      value={barangay}
                      onChange={(e) => {
                        setBarangay(e.target.value);
                        if (errors.barangay)
                          setErrors((p) => ({ ...p, barangay: "" }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm ${errors.barangay ? "border-red-400" : "border-gray-300"}`}
                    />
                    {errors.barangay && (
                      <p className="mt-0.5 text-[10px] text-red-500">
                        {errors.barangay}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Plan Upload */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Maintenance Plan <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[10px] text-gray-500 mb-2">
                      PDF, DOC, DOCX • Max 10MB
                    </p>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${errors.file ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50 hover:border-green-500 hover:bg-green-50/30"}`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                      />
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2 text-green-700">
                          <FileText size={16} />
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">
                              {filePreview}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setFilePreview("");
                              if (fileInputRef.current)
                                fileInputRef.current.value = "";
                            }}
                            className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload
                            className="mx-auto text-gray-400 mb-1"
                            size={20}
                          />
                          <p className="text-xs text-gray-600 font-medium">
                            Click or drag to upload
                          </p>
                          <p className="text-[10px] text-gray-400">
                            PDF, DOC, DOCX • Max 10MB
                          </p>
                        </>
                      )}
                    </div>
                    {errors.file && (
                      <p className="mt-1 text-[10px] text-red-500">
                        {errors.file}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description{" "}
                      <span className="text-gray-400 font-normal">
                        (Optional)
                      </span>
                    </label>
                    <textarea
                      placeholder="Goals, species, timeline..."
                      value={maintenancePlanDescription}
                      onChange={(e) =>
                        setMaintenancePlanDescription(
                          e.target.value.slice(0, 300),
                        )
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-xs resize-none"
                    />
                    <p className="text-[9px] text-gray-400 text-right mt-0.5">
                      {maintenancePlanDescription.length}/300
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-[10px] text-blue-700 font-medium mb-1.5 flex items-center gap-1">
                      <Trees size={12} className="text-blue-600" /> Plan
                      Guidelines
                    </p>
                    <ul className="text-[9px] text-blue-700 space-y-1 list-disc list-inside">
                      <li>Specify target location in Ormoc City</li>
                      <li>List tree species & estimated quantity</li>
                      <li>Include watering & maintenance schedule</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-gray-100 rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-gray-800 text-xs flex items-center gap-1">
                      <CalendarCheck size={14} className="text-green-600" />{" "}
                      Registration Summary
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <p className="text-gray-500">Email</p>
                        <p className="font-medium truncate">{email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Name</p>
                        <p className="font-medium truncate">{fullName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Contact</p>
                        <p className="font-medium">{contactNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Barangay</p>
                        <p className="font-medium">{barangay}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500">Address</p>
                        <p className="font-medium text-xs leading-relaxed">
                          {address}
                        </p>
                      </div>
                      {organization && (
                        <div className="col-span-2">
                          <p className="text-gray-500">Organization</p>
                          <p className="font-medium">{organization}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-gray-500">Plan File</p>
                        <p className="font-medium text-green-700 flex items-center gap-1">
                          <FileText size={10} /> {selectedFile?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 p-3 mt-20 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-green-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        if (errors.terms)
                          setErrors((p) => ({ ...p, terms: "" }));
                      }}
                      className="mt-0.5 w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-[10px] text-gray-700 leading-relaxed">
                      I agree to the{" "}
                      <a
                        href="/terms"
                        className="text-green-700 hover:underline font-medium"
                        target="_blank"
                        rel="noopener"
                      >
                        Terms of Service
                      </a>{" "}
                      &{" "}
                      <a
                        href="/privacy-policy"
                        className="text-green-700 hover:underline font-medium"
                        target="_blank"
                        rel="noopener"
                      >
                        Privacy Policy
                      </a>
                      . I understand my TreeGrower account requires admin
                      approval before activation.
                    </span>
                  </label>
                  {errors.terms && (
                    <p className="text-[10px] text-red-500 -mt-2">
                      {errors.terms}
                    </p>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-2 pt-2 ">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowLeft size={12} /> Back
                  </button>
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-green-700 to-green-800 text-white rounded-lg text-xs font-semibold hover:from-green-800 hover:to-green-900 transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    Continue <ArrowRight size={12} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!termsAccepted || isLoading}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-1 ${termsAccepted && !isLoading ? "bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900" : "bg-gray-400 cursor-not-allowed"}`}
                  >
                    {isLoading ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    {isLoading ? "Submitting..." : "Submit Registration"}
                  </button>
                )}
              </div>

              {/* Login Link */}
              <p className="text-center text-[10px] text-gray-600 pt-2">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-green-700 font-medium hover:underline"
                >
                  Sign in here
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-white/85 bg-black/20 backdrop-blur-md rounded-full border border-white/15 shadow">
          <a
            href="/privacy-policy"
            className="hover:text-white transition-colors"
          >
            🔒 Privacy
          </a>
          <span className="text-white/30">|</span>
          <a href="/terms" className="hover:text-white transition-colors">
            📜 Terms
          </a>
          <span className="text-white/30">|</span>
          <a href="/security" className="hover:text-white transition-colors">
            🛡️ Security
          </a>
        </div>
      </footer>
    </div>
  );
}
