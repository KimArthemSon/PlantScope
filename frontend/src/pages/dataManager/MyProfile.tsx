import { useEffect, useState, type FormEvent } from "react";
import {
  Mail, Phone, Info, Lock, Eye, EyeOff, Save,
  Camera, Shield, User, Cake, UserX, MapPin, CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoaderPending from "@/components/layout/loaderSmall";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import { api } from "@/constant/api";

interface FullProfile {
  id: number;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birthday: string;
  gender: string;
  is_active: string;
  user_role: string;
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

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function MyProfile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [profileImg, setProfileImg] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [passwordConstraints, setPasswordConstraints] = useState<PasswordConstraint>({
    lower: false, upper: false, length: false, number: false, symbol: false,
  });

  const [profile, setProfile] = useState<FullProfile>({
    id: 0, email: "", password: "", first_name: "", last_name: "",
    middle_name: "", birthday: "", gender: "M", is_active: "true",
    user_role: "", address: "", preview_profile: "", contact: "", confirm_pass: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch("http://127.0.0.1:8000/api/get_me/", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) { navigate("/Login"); return; }
        const me = await meRes.json();
        setUserId(me.id);

        const pRes = await fetch(`http://127.0.0.1:8000/api/get_user/${me.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await pRes.json();
        if (!pRes.ok) return;

        setProfile({
          ...data,
          password: "",
          confirm_pass: "",
          preview_profile: data.profile_img ? `${api}${data.profile_img}` : "",
        });
      } catch {
        setPSAlert({ type: "error", title: "Error", message: "Failed to load profile." });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const p = profile.password;
    setPasswordConstraints({
      length: p.length >= 8,
      lower: /[a-z]/.test(p),
      upper: /[A-Z]/.test(p),
      number: /\d/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
    });
  }, [profile.password]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setProfileImg(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setProfile((p) => ({ ...p, preview_profile: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;

    if (profile.password.length > 0) {
      if (!Object.values(passwordConstraints).every(Boolean)) {
        setPSAlert({ type: "error", title: "Weak Password", message: "Password does not meet all requirements." });
        return;
      }
      if (profile.password !== profile.confirm_pass) {
        setPSAlert({ type: "error", title: "Mismatch", message: "Passwords do not match." });
        return;
      }
    }

    setIsLoading(true);
    const fd = new FormData();
    fd.append("email", profile.email);
    fd.append("password", profile.password);
    fd.append("user_role", profile.user_role);
    fd.append("first_name", profile.first_name);
    fd.append("last_name", profile.last_name);
    fd.append("middle_name", profile.middle_name);
    fd.append("address", profile.address);
    fd.append("birthday", profile.birthday);
    fd.append("contact", profile.contact);
    fd.append("gender", profile.gender);
    fd.append("is_active", profile.is_active);
    if (profileImg) fd.append("profile_img", profileImg);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/update_user/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPSAlert({ type: "error", title: "Error", message: data.error });
      } else {
        setPSAlert({ type: "success", title: "Saved", message: "Profile updated successfully." });
        setProfile((p) => ({ ...p, password: "", confirm_pass: "" }));
      }
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Server error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  const allMet = Object.values(passwordConstraints).every(Boolean);
  const constraints = [
    { key: "length", label: "At least 8 characters" },
    { key: "lower",  label: "One lowercase letter"  },
    { key: "upper",  label: "One uppercase letter"  },
    { key: "number", label: "One number"             },
    { key: "symbol", label: "One symbol"             },
  ] as const;

  const metCount = Object.values(passwordConstraints).filter(Boolean).length;

  const inputBase =
    "flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3 mt-1.5 " +
    "focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all";
  const inputField = "flex-1 text-sm text-stone-800 outline-none bg-transparent placeholder:text-stone-400";
  const iconCls = "text-emerald-600 shrink-0 w-4 h-4";
  const labelCls = "text-xs font-semibold text-stone-500 uppercase tracking-wider";

  return (
    <>
      <style>{`
        .mp-page { background: #f4f6f5; min-height: 100vh; }

        .mp-hero {
          background: linear-gradient(135deg, #0a2e1c 0%, #0f4a2f 55%, #166534 100%);
          position: relative; overflow: hidden;
        }
        .mp-hero::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 15% 60%, rgba(255,255,255,.05) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 10%, rgba(255,255,255,.04) 0%, transparent 45%);
        }
        .mp-hero::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 56px; background: #f4f6f5;
          clip-path: ellipse(55% 100% at 50% 100%);
        }

        .mp-avatar-ring {
          background: conic-gradient(from 0deg, #4ade80, #16a34a, #0d9488, #4ade80);
          padding: 3px; border-radius: 50%;
          box-shadow: 0 8px 32px rgba(0,0,0,.35);
        }
        .mp-avatar-inner { background: #f4f6f5; border-radius: 50%; padding: 3px; }

        .mp-card {
          background: white; border-radius: 20px;
          border: 1px solid rgba(0,0,0,.06);
          box-shadow: 0 1px 4px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.04);
        }

        .mp-section-icon {
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(22,163,74,.1);
          display: flex; align-items: center; justify-content: center;
          color: #16a34a; flex-shrink: 0;
        }

        .mp-role-badge {
          display: inline-flex; align-items: center;
          background: rgba(22,163,74,.1); color: #15803d;
          font-size: 11px; font-weight: 600;
          padding: 3px 12px; border-radius: 20px;
          border: 1px solid rgba(22,163,74,.2);
          text-transform: uppercase; letter-spacing: .05em;
        }

        .mp-strength { height: 4px; border-radius: 2px; background: #e7e5e4; overflow: hidden; margin-top: 8px; }
        .mp-strength-fill { height: 100%; border-radius: 2px; transition: width .4s, background .4s; }

        .mp-btn-primary {
          background: linear-gradient(135deg, #0f4a2f, #0a2e1c);
          color: white; border-radius: 12px; padding: 12px 28px;
          font-size: 14px; font-weight: 600; border: none;
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          box-shadow: 0 2px 10px rgba(10,46,28,.35);
          transition: all .2s;
        }
        .mp-btn-primary:hover {
          background: linear-gradient(135deg, #0a2e1c, #071d12);
          box-shadow: 0 4px 18px rgba(10,46,28,.45);
          transform: translateY(-1px);
        }

        .mp-btn-ghost {
          background: white; color: #57534e;
          border: 1px solid #e7e5e4; border-radius: 12px;
          padding: 12px 24px; font-size: 14px; font-weight: 500;
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          transition: all .2s;
        }
        .mp-btn-ghost:hover { background: #f5f5f4; border-color: #d6d3d1; }
      `}</style>

      <div className="mp-page">
        {isLoading && <LoaderPending />}
        {PSalert && (
          <PlantScopeAlert
            type={PSalert.type}
            title={PSalert.title}
            message={PSalert.message}
            onClose={() => setPSAlert(null)}
          />
        )}

        {/* ── HERO ── */}
        <div className="mp-hero px-8 pt-8 pb-20 relative z-10">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-7 transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>

            <div className="flex items-end gap-6">
              {/* Avatar */}
              <div className="mp-avatar-ring shrink-0">
                <div className="mp-avatar-inner">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden">
                    {profile.preview_profile ? (
                      <img
                        src={profile.preview_profile}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">
                        {initials(profile.first_name, profile.last_name)}
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                      <Camera size={20} className="text-white" />
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Name + meta */}
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-white leading-tight">
                  {profile.first_name || profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : "My Profile"}
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {profile.user_role && (
                    <span className="mp-role-badge">
                      {profile.user_role.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  )}
                  <span className="text-white/45 text-sm">{profile.email}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <span className={`w-2 h-2 rounded-full ${profile.is_active === "true" ? "bg-emerald-400" : "bg-stone-400"}`} />
                  <span className="text-white/50 text-xs font-medium">
                    {profile.is_active === "true" ? "Active account" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FORM ── */}
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto px-8 pb-16 -mt-6 relative z-20 flex flex-col gap-5"
        >
          {/* ── PERSONAL INFO ── */}
          <div className="mp-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="mp-section-icon"><User size={16} /></div>
              <div>
                <h2 className="font-bold text-stone-800 text-base">Personal Information</h2>
                <p className="text-xs text-stone-400 mt-0.5">Your name, contact and location</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name</label>
                <div className={inputBase}>
                  <Info className={iconCls} />
                  <input type="text" className={inputField} placeholder="First name"
                    value={profile.first_name}
                    onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Middle Name</label>
                <div className={inputBase}>
                  <Info className={iconCls} />
                  <input type="text" className={inputField} placeholder="Middle name"
                    value={profile.middle_name}
                    onChange={(e) => setProfile((p) => ({ ...p, middle_name: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Last Name</label>
                <div className={inputBase}>
                  <Info className={iconCls} />
                  <input type="text" className={inputField} placeholder="Last name"
                    value={profile.last_name}
                    onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Contact Number</label>
                <div className={inputBase}>
                  <Phone className={iconCls} />
                  <input type="text" className={inputField} placeholder="+63 912 345 6789"
                    value={profile.contact}
                    onChange={(e) => setProfile((p) => ({ ...p, contact: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Gender</label>
                <div className={inputBase}>
                  <UserX className={iconCls} />
                  <select className={inputField + " cursor-pointer"}
                    value={profile.gender}
                    onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Birthday</label>
                <div className={inputBase}>
                  <Cake className={iconCls} />
                  <input type="date" className={inputField}
                    value={profile.birthday}
                    onChange={(e) => setProfile((p) => ({ ...p, birthday: e.target.value }))} />
                </div>
              </div>

              <div className="col-span-2">
                <label className={labelCls}>Address</label>
                <div className={inputBase}>
                  <MapPin className={iconCls} />
                  <input type="text" className={inputField}
                    placeholder="Brgy. San Isidro, Ormoc City, Leyte"
                    value={profile.address}
                    onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* ── SECURITY ── */}
          <div className="mp-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="mp-section-icon"><Shield size={16} /></div>
              <div>
                <h2 className="font-bold text-stone-800 text-base">Account & Security</h2>
                <p className="text-xs text-stone-400 mt-0.5">Email and password settings</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Email — read-only */}
              <div className="col-span-2">
                <label className={labelCls}>Email Address</label>
                <div className={inputBase + " bg-stone-50"}>
                  <Mail className={iconCls} />
                  <input type="email" className={inputField + " text-stone-400"} readOnly
                    value={profile.email} />
                  <span className="text-[10px] bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                    Read-only
                  </span>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className={labelCls}>
                  New Password
                  <span className="ml-2 normal-case font-normal text-stone-400">(leave blank to keep current)</span>
                </label>
                <div className={inputBase}>
                  <Lock className={iconCls} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className={inputField}
                    placeholder="New password"
                    value={profile.password}
                    onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="text-stone-400 hover:text-emerald-600 transition-colors shrink-0">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Strength */}
                {profile.password.length > 0 && (
                  <>
                    <div className="mp-strength">
                      <div className="mp-strength-fill" style={{
                        width: `${(metCount / 5) * 100}%`,
                        background: allMet ? "#16a34a" : metCount >= 3 ? "#f59e0b" : "#ef4444",
                      }} />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-1">
                      {constraints.map(({ key, label }) => (
                        <div key={key} className={`flex items-center gap-2 text-xs ${passwordConstraints[key] ? "text-emerald-600" : "text-stone-400"}`}>
                          <CheckCircle2 size={12} strokeWidth={passwordConstraints[key] ? 2.5 : 1.5}
                            className={passwordConstraints[key] ? "text-emerald-500" : "text-stone-300"} />
                          {label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className={
                  inputBase +
                  (profile.confirm_pass && profile.password !== profile.confirm_pass
                    ? " !border-red-400 !ring-2 !ring-red-100"
                    : profile.confirm_pass && profile.password === profile.confirm_pass
                      ? " !border-emerald-400"
                      : "")
                }>
                  <Lock className={iconCls} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    className={inputField}
                    placeholder="Re-enter new password"
                    value={profile.confirm_pass}
                    onChange={(e) => setProfile((p) => ({ ...p, confirm_pass: e.target.value }))} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="text-stone-400 hover:text-emerald-600 transition-colors shrink-0">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {profile.confirm_pass && (
                  <p className={`text-xs mt-1.5 ${profile.password === profile.confirm_pass ? "text-emerald-600" : "text-red-500"}`}>
                    {profile.password === profile.confirm_pass ? "✓ Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div className="flex items-center justify-between pt-1">
            <button type="button" className="mp-btn-ghost" onClick={() => navigate(-1)}>
              <ChevronLeft size={15} /> Cancel
            </button>
            <button type="submit" className="mp-btn-primary">
              <Save size={15} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
