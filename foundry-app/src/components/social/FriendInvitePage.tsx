import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AddFriendModal from './AddFriendModal';

/**
 * FriendInvitePage — handles /friend/:code deep links. Renders the
 * AddFriendModal in "accept this specific code" mode and bounces back to
 * the home view when the modal closes (either accepted or cancelled).
 *
 * Auth gating happens upstream in App.tsx — an unauthenticated visitor
 * is routed to WelcomeScreen / AuthPage first and lands here only once
 * they're signed in. The code is preserved through that bounce because
 * App.tsx re-renders at the same URL once auth resolves.
 */
export default function FriendInvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // If no code at all, nothing to do — kick back home.
    if (!code) navigate('/', { replace: true });
  }, [code, navigate]);

  return (
    <AddFriendModal
      open={open && !!code}
      onClose={() => {
        setOpen(false);
        navigate('/', { replace: true });
      }}
      initialCode={code?.toUpperCase()}
    />
  );
}
