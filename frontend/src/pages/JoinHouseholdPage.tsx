import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';

export default function JoinHouseholdPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [preview, setPreview] = useState<{ householdName: string; ownerName: string; inviteEmail: string; role: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Invalid invite link.'); setLoading(false); return; }
    api.getHouseholdInvitePreview(token)
      .then(setPreview)
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`);
      return;
    }
    setAccepting(true);
    try {
      await api.acceptHouseholdInvite(token);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">You're in!</h2>
            <p className="text-sm text-muted mb-6">You've joined <strong>{preview?.householdName}</strong>.</p>
            <Button onClick={() => navigate('/')} className="w-full">Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
            <p className="text-sm text-muted mb-6">{error}</p>
            <Link to="/"><Button variant="outline" className="w-full">Go Home</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-sm w-full">
        <CardContent className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-1">Household Invite</h2>
          {preview && (
            <div className="mb-6 space-y-1">
              <p className="text-sm text-muted">
                <strong>{preview.ownerName}</strong> has invited you to join
              </p>
              <p className="text-base font-semibold">{preview.householdName}</p>
              <p className="text-xs text-muted">as a <span className="capitalize font-medium">{preview.role.toLowerCase()}</span></p>
            </div>
          )}
          {preview?.status === 'ACCEPTED' ? (
            <p className="text-sm text-green-600 mb-4">This invite has already been accepted.</p>
          ) : (
            <Button onClick={handleAccept} disabled={accepting} className="w-full">
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept Invitation'}
            </Button>
          )}
          {!isAuthenticated && (
            <p className="text-xs text-muted mt-3">You'll need to log in or create an account first.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
