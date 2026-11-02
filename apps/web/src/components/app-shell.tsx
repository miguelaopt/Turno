'use client';

import { actionableSwapCount, unreadCount } from '@turno/shared';
import { Bell, CalendarDays, LogOut, Repeat } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { useNotifications, useStoreRealtime, useSwapRequests } from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { client, profile, signOut } = useSession();
  const pathname = usePathname();
  useStoreRealtime(client, { storeId: profile.store_id, userId: profile.id });

  const swaps = useSwapRequests(client, profile.store_id);
  const notifications = useNotifications(client, profile.id);
  const pending = swaps.data ? actionableSwapCount(swaps.data, profile) : 0;
  const unread = unreadCount(notifications.data);

  const links = [
    { href: '/turnos', label: 'Turnos', icon: CalendarDays, badge: 0 },
    {
      href: '/pedidos',
      label: profile.role === 'manager' ? 'Pedidos e aprovações' : 'Pedidos',
      icon: Repeat,
      badge: pending,
    },
    { href: '/notificacoes', label: 'Notificações', icon: Bell, badge: unread },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 pt-6 pb-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-bold tracking-wide uppercase">Turno</p>
          <p className="text-muted-foreground text-sm">
            {profile.name}
            {profile.role === 'manager' ? ' (gerência)' : ''}
            {profile.store?.name ? ` · ${profile.store.name}` : ''}
          </p>
        </div>
        <Button variant="ghost" onClick={() => void signOut()}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </header>

      <nav aria-label="Secções" className="bg-card grid grid-cols-3 gap-1 rounded-card border p-1">
        {links.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'min-h-touch relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-xs font-semibold sm:flex-row sm:gap-2 sm:text-sm',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span>{label}</span>
              {badge > 0 ? (
                <span
                  className={cn(
                    'min-w-5 rounded-full px-1.5 text-xs leading-5 font-bold',
                    active ? 'bg-primary-foreground text-primary' : 'bg-urgent text-white',
                  )}
                  aria-label={`${badge} por ver`}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
