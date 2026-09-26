import './globals.css';
import './product.css';
import './extra.css';
import './real.css';
import Providers from './providers';
export const metadata = { title: 'CodeVeritas — Proof over promises', description: 'Developer identity, verified through real engineering evidence.' };
export default function RootLayout({ children }) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
