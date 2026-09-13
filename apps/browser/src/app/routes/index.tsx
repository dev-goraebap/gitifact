import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { HomePage } from '../../pages/home';

export const Route = createFileRoute('/')({ component: HomeRoute });

function HomeRoute() {
  const navigate = useNavigate();
  return <HomePage onAbout={() => { void navigate({ to: '/about' }); }} />;
}
