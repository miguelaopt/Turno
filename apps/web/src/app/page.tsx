'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullScreenMessage, LoadingScreen } from '@/components/full-screen-message';
import { useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'signed-in') router.replace('/turnos');
    if (auth.status === 'signed-out') router.replace('/login');
  }, [auth.status, router]);

  if (auth.status === 'config-error') {
    return <FullScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  return <LoadingScreen />;
}
