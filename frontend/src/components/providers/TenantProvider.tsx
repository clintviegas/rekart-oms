'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { parseTenantSlug } from '@/lib/tenant';

type Branding = { logoUrl?: string; primaryColor?: string };

type TenantContextValue = {
  slug: string | null;
  branding: Branding;
  setBranding: (b: Branding) => void;
};

const TenantContext = createContext<TenantContextValue>({
  slug: null,
  branding: { primaryColor: '#055ed7' },
  setBranding: () => undefined
});

export function TenantProvider({
  children,
  initialBranding
}: {
  children: React.ReactNode;
  initialBranding?: Branding;
}) {
  const [branding, setBranding] = useState<Branding>(initialBranding || { primaryColor: '#055ed7' });
  const slug = useMemo(() => (typeof window !== 'undefined' ? parseTenantSlug(window.location.host) : null), []);

  useEffect(() => {
    const color = branding.primaryColor || '#055ed7';
    document.documentElement.style.setProperty('--brand', color);
  }, [branding.primaryColor]);

  return (
    <TenantContext.Provider value={{ slug, branding, setBranding }}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
