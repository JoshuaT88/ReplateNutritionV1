import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: () => api.resetPassword(token, password),
    onSuccess: () => setSuccess(true),
    onError: (err: Error) => toast('error', 'Reset failed', err.message),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-muted mb-4">This password reset link is invalid or has expired.</p>
            <Button asChild>
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-accent-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Password Reset</h2>
            <p className="text-sm text-muted mb-4">Your password has been updated. You can now sign in.</p>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Set New Password</h1>
            <p className="text-sm text-muted mt-1">Enter your new password below.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password === confirmPassword) resetMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
              />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-accent-danger">Passwords do not match.</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!password || password !== confirmPassword || password.length < 8 || resetMutation.isPending}
            >
              {resetMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</> : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
