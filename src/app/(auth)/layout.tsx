/**
 * Pass-through. Each auth page owns its own chrome now: /login has the
 * full-bleed Submarine design, while /register and the staff login wrap
 * themselves in AuthShell for the plain centred treatment.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
