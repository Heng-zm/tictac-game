import { describe, expect, it } from 'vitest';
import { chooseAiMove } from '../src/server/game/ai';
import {
  createEmptyBoard,
  decodeCell,
  encodeCell,
  type Board,
} from '../src/shared/game-types';

describe('Caro AI engine', () => {
  it('places at center (0, 0) on an empty board', () => {
    const board = createEmptyBoard();
    const move = chooseAiMove(board, 'X', 'HARD');
    expect(move).toBe(encodeCell(0, 0));
  });

  it('Hard takes an immediate winning move (4 to 5 in a row)', () => {
    const board: Board = createEmptyBoard();
    // AI (X) has 4 in a row at y=0, x=0,1,2,3
    for (let x = 0; x < 4; x++) board[encodeCell(x, 0)] = 'X';
    // Human (O) has pieces elsewhere
    for (let x = 0; x < 4; x++) board[encodeCell(x, 2)] = 'O';

    const move = chooseAiMove(board, 'X', 'HARD');
    expect(move).not.toBeNull();
    // The winning move can be x=4 or x=-1
    const { x, y } = decodeCell(move!);
    expect(y).toBe(0);
    expect([4, -1]).toContain(x);
  });

  it('Hard blocks an immediate opponent 4-in-a-row threat', () => {
    const board: Board = createEmptyBoard();
    // Human (X) has 4 in a row at y=1, x=0,1,2,3
    for (let x = 0; x < 4; x++) board[encodeCell(x, 1)] = 'X';
    // AI (O) has 3 moves elsewhere
    for (let x = 0; x < 3; x++) board[encodeCell(x, 4)] = 'O';

    const move = chooseAiMove(board, 'O', 'HARD');
    expect(move).not.toBeNull();
    const { x, y } = decodeCell(move!);
    // AI must block at (4, 1) or (-1, 1)
    expect(y).toBe(1);
    expect([4, -1]).toContain(x);
  });

  it('Easy, Medium, and Hard all select valid unoccupied moves', () => {
    const board: Board = createEmptyBoard();
    board[encodeCell(0, 0)] = 'X';

    for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const move = chooseAiMove(board, 'O', diff);
      expect(move).not.toBeNull();
      expect(board[move!]).toBeUndefined();
    }
  });
});
