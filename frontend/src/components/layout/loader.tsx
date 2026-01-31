import logo from "../../assets/logo.png"; // <-- Update path if needed

export default function Loader() {
  return (
    <div id="loader">
      <div className="loader-container">

        <div className="loader-ring-outer"></div>
        <div className="loader-ring-middle"></div>
        <div className="loader-ring-inner"></div>

        <div className="loader-logo">
          <img src={logo} alt="PlantScope Logo" />
        </div>

        {/* Tree Orbits */}
        {[1, 2, 3, 4].map((i) => (
          <div className="tree-orbit" key={i}>
            <svg className="tree-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L9 9H3l6 4.5L7 22l5-3.5 5 3.5-2-8.5L21 9h-6l-3-7z" />
              <path d="M12 22v-8" />
            </svg>
          </div>
        ))}

        {/* Growing Trees */}
        {[1, 2, 3, 4].map((i) => (
          <svg
            key={"grow-" + i}
            className="growing-tree"
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill="#4BA74E"
            opacity="0.3"
          >
            <path d="M12 2L9 9H3l6 4.5L7 22l5-3.5 5 3.5-2-8.5L21 9h-6l-3-7z" />
          </svg>
        ))}

      </div>

      <div className="loader-text">PLANTSCOPE</div>
      <div className="loader-subtitle">
        Growing Forests Through Data & Technology
      </div>
    </div>
  );
}