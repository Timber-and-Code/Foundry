import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { previewInviteCode, joinMesoByCode } from '../../utils/sync';
import { tokens } from '../../styles/tokens';

interface JoinMesoFlowProps {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}

type Step = 'enter' | 'confirm' | 'joining';

export default function JoinMesoFlow({ open, onClose, onJoined }: JoinMesoFlowProps) {
  const [step, setStep] = useState<Step>('enter');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    mesoId: string;
    mesoName: string;
    ownerName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('enter');
    setCode('');
    setError('');
    setPreview(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleLookup = async () => {
    if (code.length < 8) return;
    setLoading(true);
    setError('');
    const result = await previewInviteCode(code);
    if (!result) {
      setError('Invalid invite code. Check and try again.');
      setLoading(false);
      return;
    }
    setPreview(result);
    setStep('confirm');
    setLoading(false);
  };

  const handleJoin = async () => {
    setStep('joining');
    const result = await joinMesoByCode(code);
    if (result.success) {
      handleClose();
      onJoined();
    } else {
      setError(result.error || 'Failed to join.');
      setStep('confirm');
    }
  };

  const ALLOWED = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const handleCodeChange = (val: string) => {
    const filtered = val
      .toUpperCase()
      .split('')
      .filter((c) => ALLOWED.includes(c))
      .join('')
      .slice(0, 8);
    setCode(filtered);
    setError('');
  };

  return (
    <Modal open={open} onClose={handleClose} maxWidth={360}>
      <div style={{ textAlign: 'center' }}>
        {step === 'enter' && (
          <>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              Join a Friend
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Enter the invite code your friend shared with you.
            </div>

            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABCD1234"
              autoFocus
              style={{
                width: '100%',
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.2em',
                padding: '12px 16px',
                borderRadius: tokens.radius.lg,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--danger)',
                  marginTop: 12,
                }}
              >
                {error}
              </div>
            )}

            <Button
              onClick={handleLookup}
              variant="primary"
              fullWidth
              disabled={code.length < 8 || loading}
              style={{ marginTop: 16 }}
            >
              {loading ? 'Looking up...' : 'Join'}
            </Button>

            <button
              onClick={handleClose}
              style={{
                marginTop: 12,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                padding: `${tokens.spacing.sm}px`,
              }}
            >
              Cancel
            </button>
          </>
        )}

        {step === 'confirm' && preview && (
          <>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}
            >
              Join {preview.ownerName}'s Program?
            </div>

            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {preview.mesoName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                by {preview.ownerName}
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: 'var(--phase-peak)',
                background: 'rgba(212,152,60,0.1)',
                border: '1px solid rgba(212,152,60,0.2)',
                borderRadius: tokens.radius.md,
                padding: '10px 14px',
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              This will end your current mesocycle and start you on their program.
            </div>

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--danger)',
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => { setStep('enter'); setError(''); }}
                variant="secondary"
                style={{ flex: 1 }}
              >
                Back
              </Button>
              <Button
                onClick={handleJoin}
                variant="primary"
                style={{ flex: 1 }}
              >
                Join Program
              </Button>
            </div>
          </>
        )}

        {step === 'joining' && (
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              padding: '32px 0',
            }}
          >
            Joining program...
          </div>
        )}
      </div>
    </Modal>
  );
}
