import type { ReactNode } from 'react';
import './globals.css';
export const metadata = { title: 'Civic Grants · Application & Award Demo', description: 'A fictional grant application and award demo using sample data only.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
