/**
 * Modal — centered full-screen overlay dialog.
 * Props:
 *   open      {boolean}   Whether the modal is visible.
 *   onClose   {function}  Called when the backdrop is clicked.
 *   children  {node}      Dialog content.
 *   maxWidth  {number}    Max width of the inner card (default 380).
 *   zIndex    {number}    Stack order (default 300).
 *   blur      {boolean}   Apply backdrop blur (default false).
 */
export default function Modal({
  open,
  onClose,
  children,
  maxWidth = 380,
  zIndex = 300,
  blur = false,
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: blur ? 'blur(6px)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 24px',
          maxWidth,
          width: '100%',
          boxShadow: 'var(--shadow-xl)',
          animation: 'dialogIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
