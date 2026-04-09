import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getInviteCode, createMesoInvite } from '../../utils/sync';
import { store } from '../../utils/storage';
import { tokens } from '../../styles/tokens';

interface ShareMesoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShareMesoModal({ open, onClose }: ShareMesoModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(null);
    setCopied(false);
    setLoading(true);

    const mesoId = store.get('foundry:active_meso_id');
    if (!mesoId) {
      setLoading(false);
      return;
    }

    getInviteCode(mesoId).then(async (existing) => {
      if (existing) {
        setCode(existing);
        setLoading(false);
      } else {
        const fresh = await createMesoInvite(mesoId);
        setCode(fresh);
        setLoading(false);
      }
    });
  }, [open]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={340}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          Share Program
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Send this code to a friend so they can train on the same program.
        </div>

        {loading ? (
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              padding: '20px 0',
            }}
          >
            Generating code...
          </div>
        ) : code ? (
          <>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.25em',
                color: 'var(--accent)',
                padding: '16px 0',
                userSelect: 'all',
              }}
            >
              {code}
            </div>
            <Button
              onClick={handleCopy}
              variant="primary"
              fullWidth
              style={{ marginTop: 8 }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </>
        ) : (
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              padding: '20px 0',
            }}
          >
            Could not generate invite code.
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
            padding: `${tokens.spacing.sm}px`,
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
