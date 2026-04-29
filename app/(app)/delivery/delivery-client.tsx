'use client';

import { useState } from 'react';
import type { DeliveryPageData } from './types';

type DeliveryClientProps = DeliveryPageData & {
  canManageDelivery: boolean;
};

export function DeliveryClient(_props: DeliveryClientProps) {
  const [message] = useState('Delivery system ready');

  return (
    <div style={{ padding: 20 }}>
      <h1>Delivery Control</h1>
      <p>{message}</p>
    </div>
  );
}