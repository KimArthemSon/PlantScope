import logo from "../../assets/logo.png";
import { useNavigate, useLocation } from "react-router-dom";

type NavbarProps = {
  menuActive: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  activeSection: string;
};

export default function Navbar({
  menuActive,
  toggleMobileMenu,
  closeMobileMenu,
  activeSection,
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav links on privacy policy and terms pages
  const hideNavLinks = location.pathname === "/privacy-policy" || location.pathname === "/terms";

  function handleLogIn() {
    navigate("/Login");
  }

  function handleLogoClick() {
    navigate("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgb(255,255,255,.1)]/95 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 max-w-[2000px] mx-auto relative">
        {/* Logo + Title - Clickable */}
        <div 
          className="flex items-center gap-3 md:gap-10 shrink-0 cursor-pointer"
          onClick={handleLogoClick}
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-[#7CD56A] shadow-[0_4px_15px_rgba(124,213,106,0.3)]">
            <img
              src={logo}
              className="w-full h-full object-cover"
              alt="PlantScope Logo"
            />
          </div>
          <span className="font-bold text-base md:text-lg tracking-wide text-white">
            PlantScope
          </span>
        </div>

        {/* Desktop Nav - Conditionally Hidden */}
        {!hideNavLinks && (
          <ul className="hidden md:flex gap-6 md:gap-8 text-white/90">
            {["home", "about", "service", "download", "team", "contact"].map((item) => (
              <li key={item}>
                <a
                  href={`#${item}`}
                  className={`nav-link ${activeSection === item ? "active" : ""}`}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Right Buttons */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          {/* Desktop Login */}
          <button className="btn-login hidden md:block" onClick={handleLogIn}>
            Login
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-white p-2" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {!menuActive ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuActive && (
        <div className="md:hidden bg-[#0F4A2F]/95 backdrop-blur-md border-b border-white/10">
          <ul className="flex flex-col gap-2 p-4 text-white/90">
            {!hideNavLinks && (
              <>
                {["home", "about", "service", "download", "team", "contact"].map((item) => (
                  <li key={item}>
                    <a
                      href={`#${item}`}
                      className="block py-3 px-4 rounded-lg hover:bg-white/10 transition-colors text-base"
                      onClick={closeMobileMenu}
                    >
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </a>
                  </li>
                ))}
              </>
            )}
            {/* Mobile Login */}
            <li className="pt-2">
              <button
                className="btn-login w-full py-3 px-4 bg-[#7CD56A] text-[#0F4A2F] font-semibold rounded-lg hover:bg-[#6BC45A] transition-colors"
                onClick={() => {
                  handleLogIn();
                  closeMobileMenu();
                }}
              >
                Login
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}