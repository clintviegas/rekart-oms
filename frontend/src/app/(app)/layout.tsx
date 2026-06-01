import { AppShell } from '@/components/layout/AppShell';
import { TenantProvider } from '@/components/providers/TenantProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
