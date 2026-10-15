import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/ui/Feedback';

// Gate for every dashboard route: wait while the role is being read, send signed-out people to the
// login page, and turn away signed-in accounts that are not admins.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="fullscreen-center">
        <Spinner />
      </div>
    );
  }
  if (status === 'signedOut' || status === 'notAdmin') {
    return <Navigate to="/login" replace state={{ from: location.pathname, denied: status === 'notAdmin' }} />;
  }
  return <>{children}</>;
}
