// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RankBadge, RankIcon, RankLabel } from '../src/client/components/RankBadge';

describe('RankBadge & RankIcon Components', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders RankIcon for different tiers and ratings', () => {
    // Rookie (0 rating)
    const { rerender } = render(<RankIcon rating={500} size="sm" />);
    expect(screen.getByLabelText('rookie rank icon')).toBeTruthy();

    // Bronze (1000 rating)
    rerender(<RankIcon rating={1050} size="md" />);
    expect(screen.getByLabelText('bronze rank icon')).toBeTruthy();

    // Silver (1100 rating)
    rerender(<RankIcon rating={1150} size="md" />);
    expect(screen.getByLabelText('silver rank icon')).toBeTruthy();

    // Gold (1200 rating)
    rerender(<RankIcon rating={1250} size="lg" />);
    expect(screen.getByLabelText('gold rank icon')).toBeTruthy();

    // Platinum (1350 rating)
    rerender(<RankIcon rating={1400} size="lg" />);
    expect(screen.getByLabelText('platinum rank icon')).toBeTruthy();

    // Diamond (1500 rating)
    rerender(<RankIcon rating={1600} size="xl" />);
    expect(screen.getByLabelText('diamond rank icon')).toBeTruthy();

    // Master (1750+ rating)
    rerender(<RankIcon rating={1800} size="xl" />);
    expect(screen.getByLabelText('master rank icon')).toBeTruthy();
  });

  it('renders RankIcon explicitly by tier name', () => {
    render(<RankIcon tier="master" size="md" />);
    expect(screen.getByLabelText('master rank icon')).toBeTruthy();
  });

  it('renders RankBadge with tier name and icon', () => {
    render(<RankBadge rating={1250} />);
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('renders RankLabel with or without icon', () => {
    const { rerender } = render(<RankLabel rating={1500} withIcon={false} />);
    expect(screen.getByText('Diamond')).toBeTruthy();

    rerender(<RankLabel rating={1500} withIcon={true} />);
    expect(screen.getByText('Diamond')).toBeTruthy();
    // svg icon is present inside the label
    const label = screen.getByText('Diamond').parentElement;
    expect(label?.querySelector('svg')).toBeTruthy();
  });
});
