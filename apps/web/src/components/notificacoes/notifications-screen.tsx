'use client';

import {
  formatDateTimeShort,
  getErrorMessage,
  notificationPath,
  unreadCount,
  type AppNotification,
} from '@turno/shared';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';

export function NotificationsScreen() {
  const { client, profile } = useSession();
  const router = useRouter();
  const notifications = useNotifications(client, profile.id);
  const markRead = useMarkNotificationsRead(client, profile.id);
  const unread = unreadCount(notifications.data);

  function open(n: AppNotification) {
    if (!n.read_at) markRead.mutate([n.id]);
    router.push(notificationPath(n));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Notificações</h1>
        {unread > 0 ? (
          <Button
            variant="outline"
            onClick={() => markRead.mutate(undefined)}
            disabled={markRead.isPending}
          >
            Marcar todas como lidas
          </Button>
        ) : null}
      </div>

      {notifications.isError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Não foi possível carregar as notificações</AlertTitle>
          <AlertDescription>{getErrorMessage(notifications.error)}</AlertDescription>
        </Alert>
      ) : null}

      {notifications.isPending ? (
        <p className="text-muted-foreground text-sm">A carregar…</p>
      ) : !notifications.data?.length ? (
        <p className="text-muted-foreground text-sm">Ainda não tens notificações.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  'bg-card hover:border-primary focus-visible:ring-ring/50 min-h-touch flex w-full flex-col gap-1 rounded-card border p-4 text-left outline-none focus-visible:ring-[3px]',
                  !n.read_at && 'border-primary/50',
                  n.urgent && !n.read_at && 'border-urgent/50 bg-urgent-soft',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={cn('font-semibold', !n.read_at && 'font-bold')}>
                    {n.urgent ? <span className="text-urgent">Urgente · </span> : null}
                    {n.title}
                  </span>
                  {!n.read_at ? (
                    <span
                      className="bg-primary mt-1.5 size-2.5 shrink-0 rounded-full"
                      aria-label="Não lida"
                    />
                  ) : null}
                </span>
                <span className="text-sm">{n.body}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDateTimeShort(n.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
