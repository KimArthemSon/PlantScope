import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/Login");
  }, []);
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-[#545454] text-[4rem]">404 Page Not Found!</h1>
    </div>
  );
}
