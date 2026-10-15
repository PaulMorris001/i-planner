// The i-Planner "iP" mark. The artwork has generous white padding around it, so it is scaled up
// inside a rounded tile to fill the space; the white tile also keeps it clean on the gradient menu.
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <img src="/logo.png" alt="i-Planner" width={size} height={size} />
    </span>
  );
}
