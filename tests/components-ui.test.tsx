// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Search, Trophy } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  Input,
  Pill,
  Progress,
  StatTile,
} from '../src/client/components/ui';

describe('Modernized UI Components', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Badge component', () => {
    it('renders with different variants and tones', () => {
      const { rerender } = render(<Badge tone="accent">Active</Badge>);
      expect(screen.getByText('Active')).toBeTruthy();

      rerender(<Badge tone="success" variant="solid">Completed</Badge>);
      expect(screen.getByText('Completed')).toBeTruthy();

      rerender(<Badge tone="warning" variant="dot">Pending</Badge>);
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('Pending').querySelector('span')).toBeTruthy();
    });
  });

  describe('Progress component', () => {
    it('renders progress bar with clamped percentages and aria attributes', () => {
      const { rerender } = render(<Progress value={45} max={100} showLabel />);
      expect(screen.getByRole('progressbar')).toBeTruthy();
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45');
      expect(screen.getByText('45%')).toBeTruthy();

      // Test clamping over 100
      rerender(<Progress value={150} max={100} showLabel />);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
      expect(screen.getByText('100%')).toBeTruthy();
    });
  });

  describe('Input component', () => {
    it('renders label, input, leading icon, and error message', () => {
      render(
        <Input
          label="Player Nickname"
          placeholder="Enter nickname"
          icon={Search}
          error="Nickname is already taken"
        />,
      );

      expect(screen.getByLabelText('Player Nickname')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter nickname')).toBeTruthy();
      expect(screen.getByText('Nickname is already taken')).toBeTruthy();
    });

    it('handles clear button when clearable is enabled', () => {
      const onClear = vi.fn();
      render(
        <Input
          value="Antigravity"
          onChange={() => undefined}
          clearable
          onClear={onClear}
          placeholder="Search..."
        />,
      );

      const clearBtn = screen.getByRole('button', { name: 'Clear input' });
      expect(clearBtn).toBeTruthy();
      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledOnce();
    });
  });

  describe('Card subcomponents', () => {
    it('renders Card with Header, Title, Description, Content and Footer', () => {
      render(
        <Card interactive>
          <CardHeader>
            <CardTitle>Championship Season</CardTitle>
            <CardDescription>Compete against ranked players worldwide</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Season details and rules</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Join Season</Button>
          </CardFooter>
        </Card>,
      );

      expect(screen.getByText('Championship Season')).toBeTruthy();
      expect(screen.getByText('Compete against ranked players worldwide')).toBeTruthy();
      expect(screen.getByText('Season details and rules')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Join Season' })).toBeTruthy();
    });
  });

  describe('Avatar with status indicator', () => {
    it('renders avatar with initial and status dot', () => {
      render(<Avatar name="Vader" status="online" size="lg" />);
      expect(screen.getByText('V')).toBeTruthy();
      expect(screen.getByTitle('Status: online')).toBeTruthy();
    });
  });

  describe('StatTile with trend indicator', () => {
    it('renders label, value, hint, and trend indicator', () => {
      render(
        <StatTile
          label="Win Streak"
          value={7}
          icon={Trophy}
          hint="Personal best"
          trend={{ value: '+3', direction: 'up' }}
        />,
      );

      expect(screen.getByText('Win Streak')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.getByText('Personal best')).toBeTruthy();
      expect(screen.getByText('+3')).toBeTruthy();
    });
  });

  describe('IconButton, Pill, and EmptyState components', () => {
    it('renders IconButton and handles click', () => {
      const onClick = vi.fn();
      render(
        <IconButton label="Search settings" onClick={onClick}>
          <Search />
        </IconButton>,
      );

      const btn = screen.getByRole('button', { name: 'Search settings' });
      expect(btn).toBeTruthy();
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('renders Pill with tone styling', () => {
      render(<Pill tone="success">Verified</Pill>);
      expect(screen.getByText('Verified')).toBeTruthy();
    });

    it('renders EmptyState with icon, title, description, and action', () => {
      render(
        <EmptyState
          icon={Trophy}
          title="No trophies yet"
          description="Win matches to earn championship trophies."
          action={<Button size="sm">Play Now</Button>}
        />,
      );

      expect(screen.getByText('No trophies yet')).toBeTruthy();
      expect(screen.getByText('Win matches to earn championship trophies.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Play Now' })).toBeTruthy();
    });
  });
});
