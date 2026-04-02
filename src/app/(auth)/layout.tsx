export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.975_0.002_260)]">
      {children}
    </div>
  );
}
