import logo from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";

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

  function handleLogIn() {
    navigate("/Login");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgb(255,255,255,.1)]/95 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center justify-between px-6 py-3 max-w-[2000px] mx-auto relative">
        {/* Logo + Title */}
        <div className="flex items-center gap-10 shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#7CD56A] shadow-[0_4px_15px_rgba(124,213,106,0.3)]">
            <img
              src={logo}
              className="w-full h-full object-cover"
              alt="PlantScope Logo"
            />
          </div>
          <span className="font-bold text-lg tracking-wide text-white">
            PlantScope
          </span>
        </div>

        {/* Desktop Nav */}
        <ul className="hidden md:flex gap-8 text-white/90">
          {["home", "about", "service", "team", "contact"].map((item) => (
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

        {/* Right Buttons */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Desktop Login */}
          <button className="btn-login hidden md:block" onClick={handleLogIn}>
            Login
          </button>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={toggleMobileMenu}>
            {!menuActive ? (
              <svg
                className="w-6 h-6 text-white"
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
                className="w-6 h-6 text-white"
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
        <div className="mobile-menu md:hidden">
          <ul className="flex flex-col gap-4 p-6 text-white/90">
            {["home", "about", "service", "team", "contact"].map((item) => (
              <li key={item}>
                <a
                  href={`#${item}`}
                  className="nav-link"
                  onClick={closeMobileMenu}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </a>
              </li>
            ))}
            {/* Mobile Login */}
            <li>
              <button
                className="btn-login w-full"
                onClick={() => {
                  handleLogIn();
                  closeMobileMenu(); // close menu after navigating
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
