import { baseMetadata, snapshot } from '@/lib/site';
import { Home } from './home';

export const metadata = baseMetadata('/', snapshot.site.title, snapshot.site.description);

export default function HomePage() {
  return <Home page={1} />;
}
