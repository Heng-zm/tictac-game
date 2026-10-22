import { describe, expect, it } from 'vitest';
import { chooseAiMove } from '../src/server/game/ai';
import {
  COORD_OFFSET,
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

  it('does not treat an aliased edge cell as an immediate win', () => {
    const board: Board = createEmptyBoard();
    // Three X stones ending at the right edge, plus a stone encoded at the
    // same index as the out-of-range (COORD_OFFSET, 0) on the opposite edge.
    for (let x = COORD_OFFSET - 3; x < COORD_OFFSET; x++) {
      board[encodeCell(x, 0)] = 'X';
    }
    board[encodeCell(-COORD_OFFSET, 1)] = 'X';
    // A genuine four-in-a-row that should be the AI's winning move.
    for (let x = 0; x < 4; x++) board[encodeCell(x, 10)] = 'X';
    // Eight spaced human stones keep the game active with X to move.
    for (let i = 0; i < 8; i++) board[encodeCell(i * 2, -500)] = 'O';

    const move = chooseAiMove(board, 'X', 'HARD');
    expect(move).not.toBeNull();
    const { x, y } = decodeCell(move!);
    expect(y).toBe(10);
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
