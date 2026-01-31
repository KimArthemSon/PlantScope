import { useEffect, useState } from "react";

type UserRole = "CityENROHead" | "FieldOfficer" | "AFA" | "GISSpecialist";

export const useAuthorize = (requiredRole?: UserRole) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkIfStillLogin = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
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
  }, [requiredRole]);

  return { isAuthorized, isLoading };
};
