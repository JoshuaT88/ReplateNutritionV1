import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-7xl font-bold text-primary/20 font-display">404</h1>
      <h2 className="text-xl font-semibold mt-4">Page not found</h2>
      <p className="text-sm text-muted mt-2 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <Button variant="outline" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Go back
          </Link>
        </Button>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4" /> Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
