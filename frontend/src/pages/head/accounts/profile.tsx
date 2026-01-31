import {
  Mail,
  Phone,
  Info,
  Lock,
  Unlock,
  Cake,
  Map,
  UserX,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import profile_sample from "../../../assets/carlos.jpg";
import { useEffect, useState, type FormEvent } from "react";
import LoaderPending from "../../../components/layout/loaderSmall";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";

type UserRole =
  | "CityENROHead"
  | "FieldOfficer"
  | "GISSpecialist"
  | "treeGrowers";
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

export function Profile() {
  const { id } = useParams();
  const [profile_img, setProfile_img] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

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
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load users.",
      });
      setIsLoading(false);
    }
  }
  useEffect(() => {
    if (id) get_user();
  }, []);

  const navigate = useNavigate();
  const inputWrapper =
    "flex items-center border border-black rounded-md mt-2 p-1 " +
    "focus-within:border-green-700 focus-within:ring-2 " +
    "focus-within:ring-green-300 transition-all";

  const inputField = "flex-1 text-[1rem] p-2 ml-4 outline-none bg-transparent";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfile_img(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({
          ...prev,
          preview_profile: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setProfile((prev) => ({
        ...prev,
        preview_profile: "",
      }));
    }
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    if (profile.password !== profile.confirm_pass) {
      alert("Password & Confirm Password is not match!");

      return;
    }

    console.log(profile);

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
    form_data.append("is_active", "true");
    if (profile_img) {
      form_data.append("profile_img", profile_img);
    }

    if (action === "Create") {
      handleCreate(form_data);
    } else {
      handleUpdate(form_data);
    }
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
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        setIsLoading(false);
        return;
      }

      setPSAlert({
        type: "success",
        title: "Success Create",
        message: data.message,
      });
      setTimeout(() => {
        navigate("/account-management/");
      }, 3000);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to CREATE users.",
      });
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
        setPSAlert({
          type: "error",
          title: "Error",
          message: data.error,
        });
        return;
      }

      setPSAlert({
        type: "success",
        title: "Success Update",
        message: data.message,
      });
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Server Error!",
      });
    }
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-1 h-full justify-center gap-8 p-5 bg-[linear-gradient(to_bottom,#16a34a_250px,#16a34a_250px,#f3f1f1_250px,#f3f1f1_100%)] overflow-y-auto"
    >
      {isLoading && <LoaderPending />}
      {/* <LoaderPending /> */}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}
      {/* <LoaderPending /> */}
      {/* PROFILE CARD */}
      <div className="w-[20%] mt-7 max-w-85 h-80 bg-white shadow-lg p-5 min-w-[174.8px] flex flex-col items-center rounded-md">
        <img
          src={profile.preview_profile || profile_sample}
          alt="profile"
          className="w-full h-50 rounded-full border"
        />
        <div className="relative mt-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="absolute opacity-0 w-full h-full cursor-pointer"
            required={action === "Create"}
          />
          <div className="bg-[#0F4A2F] px-10 p-3 shadow-lg rounded-4xl cursor-pointer text-white text-[.8rem] text-center">
            Upload Image
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="mt-7 min-w-[546.4px] max-w-400 flex flex-col w-[70%] bg-white shadow-lg rounded-md min-h-fit">
        {/* PERSONAL INFO */}
        <div className="p-5">
          <h1 className="text-green-700 text-2xl font-bold">
            Personal Information
          </h1>

          <div className="mt-4 gap-4 grid grid-cols-2 grid-rows-4">
            {/* FIRST NAME */}
            <div>
              <label className="font-bold text-[1rem]">First name:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="text"
                  className={inputField}
                  placeholder="Ex: Kim"
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* MIDDLE NAME */}
            <div>
              <label className="font-bold text-[1rem]">Middle name:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  type="text"
                  className={inputField}
                  placeholder="Ex: Caones"
                  value={profile.middle_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      middle_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* LAST NAME */}
            <div>
              <label className="font-bold text-[1rem]">Last name:</label>
              <div className={inputWrapper}>
                <Info size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="text"
                  className={inputField}
                  placeholder="Ex: Son"
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* ADDRESS */}
            <div>
              <label className="font-bold text-[1rem]">Address:</label>
              <div className={inputWrapper}>
                <Map size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="text"
                  className={inputField}
                  placeholder="Ex: Brgy. San Isidro, Ormoc City, Leyte"
                  value={profile.address}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* GENDER */}
            <div>
              <label className="font-bold text-[1rem]">Gender:</label>
              <div className={inputWrapper}>
                <UserX size={20} className="ml-4 text-green-700" />
                <select
                  className={inputField}
                  value={profile.gender}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      gender: e.target.value as Gender,
                    }))
                  }
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>

            {/* CONTACT */}
            <div>
              <label className="font-bold text-[1rem]">Contact No.:</label>
              <div className={inputWrapper}>
                <Phone size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="text"
                  className={inputField}
                  placeholder="Ex: 63XXX-XXX-XXXX"
                  value={profile.contact}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      contact: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* BIRTHDAY */}
            <div>
              <label className="font-bold text-[1rem]">Birthday:</label>
              <div className={inputWrapper}>
                <Cake size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="date"
                  className={inputField}
                  value={profile.birthday}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      birthday: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* ACCOUNT INFO */}
        <div className="p-5 pt-0">
          <h1 className="text-green-700 text-2xl font-bold">Account</h1>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* EMAIL */}
            <div>
              <label className="font-bold text-[1rem]">Email:</label>
              <div className={inputWrapper}>
                <Mail size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="email"
                  className={inputField}
                  placeholder="example@email.com"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="font-bold text-[1rem]">Password:</label>
              <div className={inputWrapper}>
                <Lock size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="password"
                  className={inputField}
                  placeholder="Password"
                  value={profile.password}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="font-bold text-[1rem]">Confirm Password:</label>
              <div
                className={
                  inputWrapper +
                  (profile.password !== profile.confirm_pass
                    ? "border border-red-700"
                    : "")
                }
              >
                <Unlock size={20} className="ml-4 text-green-700" />
                <input
                  required={action === "Create"}
                  type="password"
                  className={inputField}
                  placeholder="Confirm password"
                  value={profile.confirm_pass}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      confirm_pass: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* ROLE */}
            <div>
              <label className="font-bold text-[1rem]">User role:</label>
              <div className={inputWrapper}>
                <Unlock size={20} className="ml-4 text-green-700" />
                <select
                  className={inputField}
                  value={profile.user_role}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      user_role: e.target.value as UserRole,
                    }))
                  }
                >
                  <option value="CityENROHead">City ENRO Head</option>
                  <option value="FieldOfficer">Field Officer</option>
                  <option value="GISSpecialist"> GIS Specialist</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex w-full p-4 gap-5 mt-auto">
          <button
            className="bg-[#0F4A2F] px-10 p-3 rounded-4xl text-white border border-[#0F4A2F] text-[.8rem] cursor-pointer hover:text-[#0F4A2F] hover:bg-[#ffffff]"
            onClick={(e) => {
              e.preventDefault();
              navigate("/account-management");
            }}
          >
            Cancel
          </button>
          <button className="bg-[#0F4A2F] px-10 p-3 rounded-4xl text-white border border-[#0F4A2F] text-[.8rem] cursor-pointer hover:text-[#0F4A2F] hover:bg-[#ffffff]">
            {action}
          </button>
        </div>
      </div>
    </form>
  );
}
