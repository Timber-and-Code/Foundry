/**
 * Tests for MobilityProtocolDetail — verifies move video links render when
 * videoUrl is set, the "Add to schedule" CTA exists (and opens the apply
 * sheet), and "Start now" still works.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { mockNavigate, mockShowToast, mockSaveMobilitySession, mockSaveProfile } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockShowToast: vi.fn(),
  mockSaveMobilitySession: vi.fn(),
  mockSaveProfile: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../data/constants', () => ({
  MOBILITY_PROTOCOLS: [
    {
      id: 'w1',
      name: 'Warmup One',
      duration: '3 min',
      category: 'warmup',
      description: 'Short warmup',
      dayTags: ['PUSH'],
      moves: [
        { name: 'Cat-Cow', reps: '10', cue: 'Cue one', videoUrl: 'https://youtube.com/cat-cow' },
        { name: "Child's Pose", reps: '30s', cue: 'Cue two' /* no videoUrl */ },
        { name: 'Spinal Twist', reps: '20s', cue: 'Cue three', videoUrl: 'https://youtube.com/twist' },
      ],
    },
  ],
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

vi.mock('../../../utils/store', () => ({
  saveMobilitySession: mockSaveMobilitySession,
  saveProfile: mockSaveProfile,
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

import MobilityProtocolDetail from '../MobilityProtocolDetail';
import type { Profile } from '../../../types';

const profileFixture: Profile = {
  name: 'Tester',
  age: 30,
  experience: 'intermediate',
  mobilitySchedule: [],
} as unknown as Profile;

function renderDetail(overrides: { profile?: Profile | null } = {}) {
  return render(
    <MemoryRouter>
      <MobilityProtocolDetail
        protocolId="w1"
        profile={overrides.profile === undefined ? profileFixture : overrides.profile}
        onBack={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe('MobilityProtocolDetail', () => {
  beforeEach(() => {
    cleanup();
    mockNavigate.mockReset();
    mockShowToast.mockReset();
    mockSaveMobilitySession.mockReset();
    mockSaveProfile.mockReset();
  });

  it('renders a Video link for each move that has a videoUrl', () => {
    renderDetail();
    const videoLinks = screen.getAllByRole('link');
    // 2 of the 3 moves have videoUrl
    expect(videoLinks).toHaveLength(2);
    expect(videoLinks[0]).toHaveAttribute('href', 'https://youtube.com/cat-cow');
    expect(videoLinks[0]).toHaveAttribute('target', '_blank');
    expect(videoLinks[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(videoLinks[1]).toHaveAttribute('href', 'https://youtube.com/twist');
  });

  it('renders the protocol name, description, and all moves', () => {
    renderDetail();
    expect(screen.getByText('Warmup One')).toBeInTheDocument();
    expect(screen.getByText('Short warmup')).toBeInTheDocument();
    expect(screen.getByText('Cat-Cow')).toBeInTheDocument();
    expect(screen.getByText("Child's Pose")).toBeInTheDocument();
    expect(screen.getByText('Spinal Twist')).toBeInTheDocument();
  });

  it('has "Start now" button that saves a mobility session and navigates', () => {
    renderDetail();
    fireEvent.click(screen.getByText('Start now'));
    expect(mockSaveMobilitySession).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toMatch(/^\/mobility\/\d{4}-\d{2}-\d{2}$/);
  });

  it('has an "Add to schedule" button that opens the apply sheet', () => {
    renderDetail();
    const addBtn = screen.getByRole('button', { name: /Add to schedule/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    // Sheet opens — it has a dialog role and an ADD TO SCHEDULE heading
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Add to schedule" button is disabled when there is no profile', () => {
    renderDetail({ profile: null });
    const addBtn = screen.getByRole('button', { name: /Add to schedule/i });
    expect(addBtn).toBeDisabled();
  });
});
