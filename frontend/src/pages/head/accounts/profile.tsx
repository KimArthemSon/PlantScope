import {
  Mail,
  Phone,
  Info,
  Lock,
  Unlock,
  Cake,
  Map,
  UserX,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
  Save,
  Camera,
  Shield,
  User,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import profile_sample from "../../../assets/carlos.jpg";
import { useEffect, useState, type FormEvent } from "react";
import LoaderPending from "../../../components/layout/loaderSmall";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";

type UserRole =
  | "CityENROHead"
  | "OnsiteInspector"
  | "GISSpecialist"
  | "DataManager";
type Gender = "o" | "M" | "F";

interface Profile {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birthday: string;
  gender: Gender;
  is_active: string;
  user_role: UserRole;
  address: string;
  preview_profile: string;
  contact: string;
  confirm_pass: string;
}

interface PasswordConstraint {
  lower: boolean;
  upper: boolean;
  length: boolean;
  number: boolean;
  symbol: boolean;
}

export function Profile() {
  const { id } = useParams();
  const [profile_img, setProfile_img] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordConstraints, setPasswordConstraints] =
    useState<PasswordConstraint>({
      lower: false,
      upper: false,
      length: false,
      number: false,
      symbol: false,
    });

  const [profile, setProfile] = useState<Profile>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    birthday: "",
    gender: "M",
    is_active: "",
    user_role: "CityENROHead",
    address: "",
    preview_profile: "",
    contact: "",
    confirm_pass: "",
  });

  const [action, __] = useState<"Create" | "Update">(id ? "Update" : "Create");

  async function get_user() {
    try {
      const token = localStorage.getItem("token");
      setIsLoading(true);
      if (!token) return;
      const res = await fetch("http://127.0.0.1:8000/api/get_user/" + id, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setIsLoading(false);
        navigate("/account-management");
        return;
      }
      setProfile(data);
      setProfile((e) => ({
        ...e,
        password: "",
        confirm_pass: "",
        preview_profile: "http://127.0.0.1:8000/" + data.profile_img,
      }));
      setIsLoading(false);
    } catch (err) {
      setPSAlert({ type: "error", title: "Error", message: "Failed to load users." });
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (id) get_user();
  }, []);

  useEffect(() => {
    const password = profile.password;
    setPasswordConstraints({
      length: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    });
  }, [profile.password]);

  const navigate = useNavigate();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfile_img(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, preview_profile: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setProfile((prev) => ({ ...prev, preview_profile: "" }));
    }
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    if ((action == "Update" && profile.password.length != 0) || action == "Create") {
      if (!passwordConstraints.length || !passwordConstraints.lower || !passwordConstraints.upper || !passwordConstraints.number || !passwordConstraints.symbol) {
        setIsLoading(false);
        setPSAlert({ type: "error", title: "Bad password", message: "Password does not meet all requirements." });
        return;
      }
    }
    if (profile.password !== profile.confirm_pass) {
      alert("Password & Confirm Password do not match!");
      setIsLoading(false);
      return;
    }
    const form_data = new FormData();
    form_data.append("email", profile.email);
    form_data.append("password", profile.password);
    form_data.append("user_role", profile.user_role);
    form_data.append("first_name", profile.first_name);
    form_data.append("last_name", profile.last_name);
    form_data.append("middle_name", profile.middle_name);
    form_data.append("address", profile.address);
    form_data.append("birthday", profile.birthday);
    form_data.append("contact", profile.contact);
    form_data.append("gender", profile.gender);
    form_data.append("is_active", profile.is_active);
    
    if (profile_img) form_data.append("profile_img", profile_img);
    if (action === "Create") handleCreate(form_data);
    else handleUpdate(form_data);
  }

  async function handleCreate(formData: FormData) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
        setIsLoading(false);
        return;
      }
      setPSAlert({ type: "success", title: "Account Created", message: data.message });
      setTimeout(() => navigate("/account-management/"), 3000);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setPSAlert({ type: "error", title: "Error", message: "Failed to create user." });
    }
  }

  async function handleUpdate(formData: FormData) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("http://127.0.0.1:8000/api/update_user/" + id, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setIsLoading(false);
        setPSAlert({ type: "error", title: "Error", message: data.error });
        return;
      }
      setPSAlert({ type: "success", title: "Profile Updated", message: data.message });
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      setPSAlert({ type: "error", title: "Error", message: "Server Error!" });
    }
  }

  const inputBase =
    "flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3 mt-1.5 " +
    "focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 " +
    "transition-all duration-200 group";

  const inputField =
    "flex-1 text-sm text-stone-800 outline-none bg-transparent placeholder:text-stone-400";

  const iconClass = "text-emerald-600 shrink-0 w-4 h-4";

  const labelClass = "text-xs font-semibold text-stone-500 uppercase tracking-wider";

  const constraints = [
    { key: "length", label: "At least 8 characters" },
    { key: "lower", label: "One lowercase letter" },
    { key: "upper", label: "One uppercase letter" },
    { key: "number", label: "One number" },
    { key: "symbol", label: "One symbol" },
  ] as const;

  const allConstraintsMet = Object.values(passwordConstraints).every(Boolean);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600&display=swap');

        .profile-page * { font-family: 'DM Sans', sans-serif; }
        .profile-heading { font-family: 'Playfair Display', serif; }

        .profile-page {
          background: #f7f6f3;
          min-height: 100vh;
        }

        .profile-header-bg {
          background: linear-gradient(135deg, #0d3d26 0%, #145c38 60%, #1a7a4a 100%);
          position: relative;
          overflow: hidden;
        }

        .profile-header-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 40%);
        }

        .profile-header-bg::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0; right: 0;
          height: 60px;
          background: #f7f6f3;
          clip-path: ellipse(55% 100% at 50% 100%);
        }

        .avatar-ring {
          background: linear-gradient(135deg, #4ade80, #16a34a, #0d3d26);
          padding: 3px;
          border-radius: 50%;
        }

        .avatar-inner {
          background: #f7f6f3;
          border-radius: 50%;
          padding: 3px;
        }

        .upload-btn {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          transition: all 0.2s;
        }
        .upload-btn:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.4);
        }

        .section-card {
          background: white;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s;
        }

        .constraint-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          transition: color 0.2s;
        }

        .constraint-met { color: #16a34a; }
        .constraint-unmet { color: #a8a29e; }

        .btn-primary {
          background: linear-gradient(135deg, #145c38, #0d3d26);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px 28px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(13,61,38,0.3);
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #0d3d26, #0a2f1e);
          box-shadow: 0 4px 16px rgba(13,61,38,0.4);
          transform: translateY(-1px);
        }

        .btn-ghost {
          background: white;
          color: #57534e;
          border: 1px solid #e7e5e4;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-ghost:hover {
          background: #f5f5f4;
          border-color: #d6d3d1;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          background: rgba(22,163,74,0.08);
          color: #15803d;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid rgba(22,163,74,0.15);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .section-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(22,163,74,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #16a34a;
        }

        .password-strength-bar {
          height: 4px;
          border-radius: 2px;
          background: #e7e5e4;
          overflow: hidden;
          margin-top: 8px;
        }
        .password-strength-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.4s, background 0.4s;
        }
      `}</style>

      <div className="profile-page">
        {isLoading && <LoaderPending />}
        {PSalert && (
          <PlantScopeAlert
            type={PSalert.type}
            title={PSalert.title}
            message={PSalert.message}
            onClose={() => setPSAlert(null)}
          />
        )}

        {/* ── HERO HEADER ── */}
        <div className="profile-header-bg px-8 pt-8 pb-20 relative z-10">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => navigate("/account-management")}
              className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft size={16} />
              Account Management
            </button>

            <div className="flex items-end gap-6">
              {/* Avatar */}
              <div className="avatar-ring shrink-0">
                <div className="avatar-inner">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden">
                    <img
                      src={profile.preview_profile || profile_sample}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                      <Camera size={20} className="text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        required={action === "Create"}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Name & role */}
              <div className="pb-1">
                <h1 className="profile-heading text-2xl text-white font-semibold leading-tight">
                  {profile.first_name || profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : action === "Create" ? "New Account" : "Edit Profile"}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="role-badge">{profile.user_role.replace(/([A-Z])/g, " $1").trim()}</span>
                  {profile.email && (
                    <span className="text-white/50 text-sm">{profile.email}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FORM ── */}
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto px-8 pb-16 -mt-6 relative z-20"
        >
          <div className="grid grid-cols-1 gap-6">

            {/* ── PERSONAL INFO CARD ── */}
            <div className="section-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="section-icon">
                  <User size={16} />
                </div>
                <div>
                  <h2 className="profile-heading text-lg text-stone-800">Personal Information</h2>
                  <p className="text-xs text-stone-400 mt-0.5">Basic details about this user</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* First Name */}
                <div>
                  <label className={labelClass}>First Name</label>
                  <div className={inputBase}>
                    <Info className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="text"
                      className={inputField}
                      placeholder="e.g. Maria"
                      value={profile.first_name}
                      onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Middle Name */}
                <div>
                  <label className={labelClass}>Middle Name</label>
                  <div className={inputBase}>
                    <Info className={iconClass} />
                    <input
                      type="text"
                      className={inputField}
                      placeholder="e.g. Santos"
                      value={profile.middle_name}
                      onChange={(e) => setProfile((p) => ({ ...p, middle_name: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label className={labelClass}>Last Name</label>
                  <div className={inputBase}>
                    <Info className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="text"
                      className={inputField}
                      placeholder="e.g. Dela Cruz"
                      value={profile.last_name}
                      onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <label className={labelClass}>Contact Number</label>
                  <div className={inputBase}>
                    <Phone className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="text"
                      className={inputField}
                      placeholder="e.g. +63 912 345 6789"
                      value={profile.contact}
                      onChange={(e) => setProfile((p) => ({ ...p, contact: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className={labelClass}>Gender</label>
                  <div className={inputBase}>
                    <UserX className={iconClass} />
                    <select
                      className={inputField + " cursor-pointer"}
                      value={profile.gender}
                      onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value as Gender }))}
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  </div>
                </div>

                {/* Birthday */}
                <div>
                  <label className={labelClass}>Birthday</label>
                  <div className={inputBase}>
                    <Cake className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="date"
                      className={inputField}
                      value={profile.birthday}
                      onChange={(e) => setProfile((p) => ({ ...p, birthday: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Address — full width */}
                <div className="col-span-2">
                  <label className={labelClass}>Address</label>
                  <div className={inputBase}>
                    <Map className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="text"
                      className={inputField}
                      placeholder="e.g. Brgy. San Isidro, Ormoc City, Leyte"
                      value={profile.address}
                      onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── ACCOUNT INFO CARD ── */}
            <div className="section-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="section-icon">
                  <Shield size={16} />
                </div>
                <div>
                  <h2 className="profile-heading text-lg text-stone-800">Account & Security</h2>
                  <p className="text-xs text-stone-400 mt-0.5">Login credentials and access level</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Email */}
                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className={inputBase}>
                    <Mail className={iconClass} />
                    <input
                      required={action === "Create"}
                      type="email"
                      className={inputField}
                      placeholder="example@enro.gov.ph"
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className={labelClass}>User Role</label>
                  <div className={inputBase}>
                    <Unlock className={iconClass} />
                    <select
                      className={inputField + " cursor-pointer"}
                      value={profile.user_role}
                      onChange={(e) => setProfile((p) => ({ ...p, user_role: e.target.value as UserRole }))}
                    >
                      <option value="CityENROHead">City ENRO Head</option>
                      <option value="OnsiteInspector">Onsite Inspector</option>
                      <option value="GISSpecialist">GIS Specialist</option>
                      <option value="DataManager">Data Manager</option>
                    </select>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className={labelClass}>Account Status</label>
                  <div className={inputBase}>
                    <Unlock className={iconClass} />
                    <select
                      className={inputField + " cursor-pointer"}
                      value={profile.is_active}
                      onChange={(e) => setProfile((p) => ({ ...p, is_active: e.target.value }))}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Spacer */}
                <div />

                {/* Password */}
                <div>
                  <label className={labelClass}>
                    Password
                    {action === "Update" && (
                      <span className="ml-2 normal-case font-normal text-stone-400">(leave blank to keep current)</span>
                    )}
                  </label>
                  <div className={inputBase}>
                    <Lock className={iconClass} />
                    <input
                      required={action === "Create"}
                      type={showPassword ? "text" : "password"}
                      className={inputField}
                      placeholder="Enter password"
                      value={profile.password}
                      onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-stone-400 hover:text-emerald-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {profile.password.length > 0 && (
                    <div className="password-strength-bar">
                      <div
                        className="password-strength-fill"
                        style={{
                          width: `${(Object.values(passwordConstraints).filter(Boolean).length / 5) * 100}%`,
                          background: allConstraintsMet
                            ? "#16a34a"
                            : Object.values(passwordConstraints).filter(Boolean).length >= 3
                            ? "#f59e0b"
                            : "#ef4444",
                        }}
                      />
                    </div>
                  )}

                  {/* Constraints grid */}
                  <div className="mt-3 grid grid-cols-1 gap-1.5">
                    {constraints.map(({ key, label }) => (
                      <div
                        key={key}
                        className={`constraint-item ${passwordConstraints[key] ? "constraint-met" : "constraint-unmet"}`}
                      >
                        <CheckCircle2
                          size={13}
                          className={passwordConstraints[key] ? "text-emerald-500" : "text-stone-300"}
                          strokeWidth={passwordConstraints[key] ? 2.5 : 1.5}
                        />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div
                    className={
                      inputBase +
                      (profile.confirm_pass && profile.password !== profile.confirm_pass
                        ? " !border-red-400 !ring-2 !ring-red-100"
                        : profile.confirm_pass && profile.password === profile.confirm_pass
                        ? " !border-emerald-400"
                        : "")
                    }
                  >
                    <Lock className={iconClass} />
                    <input
                      required={action === "Create"}
                      type={showPasswordConfirm ? "text" : "password"}
                      className={inputField}
                      placeholder="Re-enter password"
                      value={profile.confirm_pass}
                      onChange={(e) => setProfile((p) => ({ ...p, confirm_pass: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="text-stone-400 hover:text-emerald-600 transition-colors"
                    >
                      {showPasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {profile.confirm_pass && (
                    <p
                      className={`text-xs mt-1.5 ${
                        profile.password === profile.confirm_pass
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {profile.password === profile.confirm_pass
                        ? "✓ Passwords match"
                        : "Passwords do not match"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate("/account-management")}
              >
                <ArrowLeft size={15} />
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={15} />
                {action === "Create" ? "Create Account" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}