import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ title = 'Something went wrong', message = "We couldn't load this content. Please try again.", onRetry }: ErrorCardProps) {
  return (
    <Card className="border-red-100">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 mb-4">
          <AlertTriangle className="h-6 w-6 text-accent-danger" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted max-w-sm">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
