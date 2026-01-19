'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues with it
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocPage() {
  return (
    <div style={{ background: 'white', minHeight: '100vh', paddingBottom: '50px' }}>
      <SwaggerUI url="/api/doc" />
    </div>
  );
}
