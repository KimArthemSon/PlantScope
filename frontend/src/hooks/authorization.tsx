import { useEffect, useState } from "react";
import { api } from "@/constant/api";
interface UserData{
  id: number;
  email: string;
  profile_img: string ;
  full_name: string ;
  user_role: string;
}

export type UserRole =
  | "CityENROHead"
  | "DataManager"
  | "treeGrowers"
  | "GISSpecialist";

export const useAuthorize = (requiredRole?: UserRole) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user_data, set_userData] = useState<UserData | null>(null);
   
  useEffect(() => {
    const checkIfStillLogin = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(api+"api/get_me/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
     
        if (!response.ok) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        // console.log(data)
        set_userData(data);
        // role check
        if (requiredRole && data.user_role !== requiredRole) {
          setIsAuthorized(false);
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkIfStillLogin();

    // Reload the signed-in user (name, email, photo) after the profile is saved,
    // so the sidebar avatar updates without a full page refresh
    window.addEventListener(PROFILE_UPDATED_EVENT, checkIfStillLogin);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, checkIfStillLogin);
  }, [requiredRole]);

  return { isAuthorized, isLoading, user_data };
};

/** Fired after the signed-in user's own profile changes (photo, name, email). */
export const PROFILE_UPDATED_EVENT = "plantscope:profile-updated";
export const notifyProfileUpdated = () => window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));


export const useUserRole = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(api+"api/get_me/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setUserRole(null);
          return;
        }

        const data = await response.json();
      
        setUserRole(data.user_role || null);
      } catch (error) {
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return { userRole, isLoading };
};