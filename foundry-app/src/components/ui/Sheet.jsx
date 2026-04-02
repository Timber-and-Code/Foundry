/**
 * Sheet — bottom sheet that slides up from the bottom of the screen.
 * Props:
 *   open      {boolean}   Whether the sheet is visible.
 *   onClose   {function}  Called when the backdrop is clicked.
 *   children  {node}      Sheet content (rendered below the drag handle).
 *   maxWidth  {number}    Max width of the inner panel (default 480).
 *   zIndex    {number}    Stack order (default 300).
 */
export default function Sheet({ open, onClose, children, maxWidth = 480, zIndex = 300 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px 14px 0 0',
          width: '100%',
          maxWidth,
          maxHeight: '85vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.1,0.64,1)',
        }}
      >
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        {children}
      </div>
    </div>
  );
}
