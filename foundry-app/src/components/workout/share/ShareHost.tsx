import { useEffect, useState } from 'react';
import { on, emit } from '../../../utils/events';
import {
  resolveShareSnapshot,
  buildShareCaption,
  type ShareSnapshot,
} from '../../../utils/shareSnapshot';
import ShareStudio from './ShareStudio';
import type { TrainingDay } from '../../../types';

/**
 * One share studio for every "share it later" entry point: the SHARE chip on
 * Home's finished-session card, the SHARE chip on a Schedule session card,
 * and the "logged · Share" toast after NEXT SESSION. Each just emits
 * `foundry:openShare`; this host resolves the saved snapshot (the exact card
 * the lifter saw at completion) or rebuilds one from the logged sets.
 */
export default function ShareHost({
  activeDays,
  gender,
}: {
  activeDays: TrainingDay[];
  gender?: string;
}) {
  const [snap, setSnap] = useState<ShareSnapshot | null>(null);

  useEffect(
    () =>
      on('foundry:openShare', ({ dayIdx, weekIdx }) => {
        const s = resolveShareSnapshot(activeDays, dayIdx, weekIdx, gender);
        if (!s) {
          emit('foundry:toast', { message: 'Nothing logged for that session yet.', type: 'warning' });
          return;
        }
        setSnap(s);
      }),
    [activeDays, gender],
  );

  if (!snap) return null;
  return (
    <ShareStudio
      open
      onClose={() => setSnap(null)}
      data={{
        dayLabel: snap.dayLabel,
        weekIdx: snap.weekIdx,
        phase: snap.phase,
        stats: snap.stats,
        quote: snap.quote,
      }}
      caption={buildShareCaption(snap.dayLabel, snap.weekIdx, snap.phase, snap.stats)}
    />
  );
}
