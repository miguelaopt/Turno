'use client';

import { useParams } from 'next/navigation';
import { SwapDetail } from '@/components/pedidos/swap-detail';

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  return <SwapDetail id={id} />;
}
