import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } },
}));

import { callFoundryAI } from '../api';

// The privacy policy and the in-app consent sheet both say the coach is NOT
// sent the lifter's name, email or account. This pins the prompt to that.
describe('callFoundryAI — what leaves the device', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{"days":[],"coachNote":""}' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never includes the name or gender in the prompt', async () => {
    await callFoundryAI(
      {
        split: 'upper_lower',
        daysPerWeek: 4,
        mesoLength: 6,
        experience: 'intermediate',
        equipment: ['barbell'],
        name: 'Zebediah Quartermaine',
        gender: 'nonbinary-marker',
        goal: 'build_muscle',
        goalNote: 'sore left shoulder',
      },
      [],
    ).catch(() => undefined); // an empty program may throw; the request is what matters

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const sent = JSON.stringify(body);
    expect(sent).not.toContain('Zebediah');
    expect(sent).not.toContain('Quartermaine');
    expect(sent).not.toContain('nonbinary-marker');
    // The note the lifter typed FOR the coach does go — and the policy says so.
    expect(sent).toContain('sore left shoulder');
    expect(Object.keys(body)).toEqual(['prompt']);
  });
});
