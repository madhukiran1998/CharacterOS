'use client';
import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId="cmplfruyp00170cl2ylk1fwks"
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#8fd6a8',
        },
        loginMethods: ['wallet', 'email'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
