import '../styles/globals.css';

import { MeshApp } from '@uniformdev/mesh-sdk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { useState } from 'react';

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
      },
    },
  }));

  return (
    // The <MeshApp> component must wrap the entire app to provide Uniform Mesh SDK services
    <MeshApp>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </MeshApp>
  );
}

export default MyApp;
