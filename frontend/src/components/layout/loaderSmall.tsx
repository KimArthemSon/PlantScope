type LoaderPendingProps = {
  overlay?: boolean; // adds dark pending background
  size?: number; // spinner size in px (default fits container)
};

export default function LoaderPending({
  overlay = true,
  size = 50,
}: LoaderPendingProps) {
  return (
    <div
      className={`
        ${overlay ? "absolute z-100 inset-0 bg-[#00000013] backdrop-blur-[.5px]" : ""}
        flex items-center justify-center
        pointer-events-none
      `}
    >
      <div
        className="
          animate-spin
          rounded-full
          border-5
          border-emerald-400/30
          border-t-emerald-500
          border-r-emerald-500
        "
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
