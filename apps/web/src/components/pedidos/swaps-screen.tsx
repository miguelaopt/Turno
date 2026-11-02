'use client';

import { getErrorMessage, groupSwapRequests } from '@turno/shared';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { useStoreProfiles, useSwapRequests } from '@/hooks/use-turno-data';
import { SwapCard } from './swap-card';

export function SwapsScreen() {
  const { client, profile } = useSession();
  const swaps = useSwapRequests(client, profile.store_id);
  const profiles = useStoreProfiles(client, profile.store_id);
  const sections = groupSwapRequests(swaps.data ?? [], profile);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          {profile.role === 'manager' ? 'Pedidos e aprovações' : 'Pedidos de troca'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {profile.role === 'manager'
            ? 'Aprova ou recusa os pedidos aceites e regista quando já atualizaste o MPI.'
            : 'Para pedir uma troca, abre "Turnos" e escolhe "Pedir troca" num turno teu.'}
        </p>
      </div>

      {swaps.isError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Não foi possível carregar os pedidos</AlertTitle>
          <AlertDescription>
            {getErrorMessage(swaps.error)}
            <Button variant="link" className="px-0" onClick={() => void swaps.refetch()}>
              Tentar outra vez
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.key}
          className="flex flex-col gap-2"
          aria-labelledby={`sec-${section.key}`}
        >
          <h2 id={`sec-${section.key}`} className="flex items-center gap-2 font-bold">
            {section.title}
            {section.requests.length ? (
              <span className="text-muted-foreground text-sm font-semibold">
                {section.requests.length}
              </span>
            ) : null}
          </h2>
          {swaps.isPending ? (
            <p className="text-muted-foreground text-sm">A carregar…</p>
          ) : section.requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">{section.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {section.requests.map((r) => (
                <li key={r.id}>
                  <SwapCard request={r} profiles={profiles.data} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
