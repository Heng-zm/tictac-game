import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer, type GameServerRuntime } from '../src/server/create-server';
import {
  encodeCell,
  type QueueStatus,
  type SocketAck,
  type UserProfile,
} from '../src/shared/game-types';
import { makeTestConfig, makeTestLogger } from './helpers';

interface Session {
  cookie: string;
  user: UserProfile;
}

interface MatchFound {
  match: {
    id: string;
    status: string;
    board: Record<number, 'X' | 'O'>;
    currentTurn: 'X' | 'O' | null;
    turnNumber: number;
    version: number;
    youSide: 'X' | 'O';
    winnerSide: 'X' | 'O' | null;
    result: string | null;
    finishReason: string | null;
    opponentConnection: string;
  };
}

interface InviteCreated {
  invitation: {
    id: string;
    deepLink: string;
    matchId: string;
    expiresAt: string;
  };
}

interface InviteWaiting {
  invitation: {
    id: string;
    matchId: string;
    expiresAt: string;
    status: string;
  };
}

describe('Socket.IO end-to-end', () => {
  let runtime: GameServerRuntime;
  let baseUrl: string;
  let sockets: Socket[] = [];
  const readyPayloads = new Map<Socket, { protocol: number; serverTime: string; user: UserProfile }>();

  beforeAll(async () => {
    runtime = createGameServer({
      config: makeTestConfig({
        disconnectGraceMs: 1_000,
        turnTimeoutMs: 0,
        aiThinkMinMs: 0,
        aiThinkMaxMs: 0,
        queueAiTimeoutMs: 10_000,
      }),
      logger: makeTestLogger(),
      disableRateLimits: true,
      startMaintenance: false,
      startBot: false,
    });
    await runtime.start();
    const address = runtime.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
  });

  afterAll(async () => {
    await runtime.stop();
  });

  async function authenticate(deviceKey: string, displayName: string): Promise<Session> {
    const response = await request(runtime.app)
      .post('/api/auth/dev')
      .send({ deviceKey, displayName });
    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.[0]).toBeDefined();
    return { cookie: cookies![0]!.split(';')[0]!, user: response.body.user as UserProfile };
  }

  function connect(cookie: string): Promise<Socket> {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 4_000,
      extraHeaders: { Cookie: cookie },
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 5_000);
      socket.once('session:ready', (payload: { protocol: number; serverTime: string; user: UserProfile }) => {
        clearTimeout(timer);
        readyPayloads.set(socket, payload);
        resolve(socket);
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function connectExpectFailure(cookie?: string): Promise<Error> {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 4_000,
      ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Expected connection to fail')), 5_000);
      socket.once('connect', () => {
        clearTimeout(timer);
        reject(new Error('Socket unexpectedly connected'));
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        resolve(error);
      });
    });
  }

  function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<SocketAck<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Ack timed out for ${event}`)), 5_000);
      const callback = (response: SocketAck<T>) => {
        clearTimeout(timer);
        resolve(response);
      };
      if (payload === undefined) socket.emit(event, callback);
      else socket.emit(event, payload, callback);
    });
  }

  function waitFor<T>(
    socket: Socket,
    event: string,
    predicate: (payload: T) => boolean = () => true,
    timeoutMs = 5_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);
      const handler = (payload: T) => {
        if (!predicate(payload)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      };
      socket.on(event, handler);
    });
  }

  function expectOk<T>(response: SocketAck<T>): T {
    if (!response.ok) throw new Error(`Expected success, received ${response.error.code}: ${response.error.message}`);
    return response.data;
  }

  function expectError<T>(response: SocketAck<T>, code: string): void {
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe(code);
  }

  function inviteToken(invitation: InviteCreated): string {
    const startParam = new URL(invitation.invitation.deepLink).searchParams.get('startapp');
    expect(startParam).toMatch(/^invite_/);
    return startParam!.slice('invite_'.length);
  }

  async function createMatchedPair(): Promise<{
    alice: Session;
    bob: Session;
    aliceSocket: Socket;
    bobSocket: Socket;
    aliceMatch: MatchFound;
    bobMatch: MatchFound;
  }> {
    const suffix = randomUUID().slice(0, 8);
    const alice = await authenticate(`e2e-alice-${suffix}`, 'Alice');
    const bob = await authenticate(`e2e-bob-${suffix}`, 'Bob');
    const aliceSocket = await connect(alice.cookie);
    const bobSocket = await connect(bob.cookie);

    const aliceFound = waitFor<MatchFound>(aliceSocket, 'match:found');
    const bobFound = waitFor<MatchFound>(bobSocket, 'match:found');
    expectOk(await emitAck<{ status: QueueStatus }>(aliceSocket, 'queue:join', { autoAiFallback: false }));
    expectOk(await emitAck<{ status: QueueStatus }>(bobSocket, 'queue:join', { autoAiFallback: false }));

    const [aliceMatch, bobMatch] = await Promise.all([aliceFound, bobFound]);
    expect(aliceMatch.match.id).toBe(bobMatch.match.id);
    return { alice, bob, aliceSocket, bobSocket, aliceMatch, bobMatch };
  }

  it('rejects unauthenticated and tampered socket sessions', async () => {
    const error = await connectExpectFailure();
    expect(error.message).toMatch(/Please open the game from Telegram|Socket authentication failed/);

    const session = await authenticate('e2e-auth-socket', 'Auth User');
    const tampered = await connectExpectFailure(`${session.cookie.slice(0, -2)}AA`);
    expect(tampered.message).toMatch(/Please open the game from Telegram|Socket authentication failed/);

    const socket = await connect(session.cookie);
    const ready = readyPayloads.get(socket);
    expect(ready?.protocol).toBe(1);
    expect(ready?.serverTime).toEqual(expect.any(String));
    expect(ready?.user.id).toBe(session.user.id);
  });

  it('matches two players, enforces room authorization and plays a full game', async () => {
    const { alice, bob, aliceSocket, bobSocket, aliceMatch, bobMatch } = await createMatchedPair();
    const matchId = aliceMatch.match.id;
    const aliceFirstSide = aliceMatch.match.youSide;
    const charlie = await authenticate(`e2e-charlie-${randomUUID().slice(0, 8)}`, 'Charlie');
    const charlieSocket = await connect(charlie.cookie);

    expectError(await emitAck(charlieSocket, 'match:join', { matchId }), 'MATCH_FORBIDDEN');
    expectError(
      await emitAck(charlieSocket, 'move:submit', { matchId, cell: 0, actionId: randomUUID() }),
      'MATCH_FORBIDDEN',
    );

    const aliceSide = aliceMatch.match.youSide;
    const bobSide = bobMatch.match.youSide;
    expect(aliceSide).not.toBe(bobSide);
    const xSocket = aliceSide === 'X' ? aliceSocket : bobSocket;
    const oSocket = bobSide === 'O' ? bobSocket : aliceSocket;

    const c00 = encodeCell(0, 0);
    const c01 = encodeCell(0, 1);
    const c10 = encodeCell(1, 0);
    const c11 = encodeCell(1, 1);
    const c20 = encodeCell(2, 0);
    const c21 = encodeCell(2, 1);
    const c30 = encodeCell(3, 0);
    const c31 = encodeCell(3, 1);
    const c40 = encodeCell(4, 0);

    const firstAction = randomUUID();
    const firstMove = expectOk<{ match: MatchFound['match'] }>(
      await emitAck(xSocket, 'move:submit', { matchId, cell: c00, actionId: firstAction }),
    );
    expect(firstMove.match.board[c00]).toBe('X');
    expect(firstMove.match.currentTurn).toBe('O');

    const duplicate = expectOk<{ match: MatchFound['match'] }>(
      await emitAck(xSocket, 'move:submit', { matchId, cell: c00, actionId: firstAction }),
    );
    expect(duplicate.match.version).toBe(firstMove.match.version);

    expectError(
      await emitAck(xSocket, 'move:submit', { matchId, cell: c10, actionId: randomUUID() }),
      'OUT_OF_TURN',
    );
    expectError(
      await emitAck(oSocket, 'move:submit', { matchId, cell: c00, actionId: randomUUID() }),
      'OCCUPIED_CELL',
    );

    const moves: Array<[Socket, number]> = [
      [oSocket, c01],
      [xSocket, c10],
      [oSocket, c11],
      [xSocket, c20],
      [oSocket, c21],
      [xSocket, c30],
      [oSocket, c31],
    ];
    for (const [socket, cell] of moves) {
      expectOk(await emitAck(socket, 'move:submit', { matchId, cell, actionId: randomUUID() }));
    }

    const xFinished = waitFor<MatchFound>(xSocket, 'match:finished');
    const oFinished = waitFor<MatchFound>(oSocket, 'match:finished');
    const finalActionId = randomUUID();
    const finalMove = expectOk<{ match: MatchFound['match'] }>(
      await emitAck(xSocket, 'move:submit', { matchId, cell: c40, actionId: finalActionId }),
    );
    expect(finalMove.match.status).toBe('FINISHED');
    expect(finalMove.match.result).toBe('X_WINS');

    const [xFinal, oFinal] = await Promise.all([xFinished, oFinished]);
    expect(xFinal.match.status).toBe('FINISHED');
    expect(xFinal.match.result).toBe('X_WINS');
    expect(xFinal.match.finishReason).toBe('LINE');
    expect(oFinal.match.result).toBe('X_WINS');

    const retry = expectOk<{ match: MatchFound['match'] }>(
      await emitAck(xSocket, 'move:submit', { matchId, cell: c40, actionId: finalActionId }),
    );
    expect(retry.match.status).toBe('FINISHED');

    const rematchFound = waitFor<MatchFound>(aliceSocket, 'match:found');
    const firstRequest = expectOk<{ matchId: string; rematch: { requestedByYou: boolean } }>(
      await emitAck(aliceSocket, 'match:rematch', { matchId }),
    );
    expect(firstRequest.matchId).toBe(matchId);
    expect(firstRequest.rematch.requestedByYou).toBe(true);
    const secondRequest = expectOk<{ matchId: string; rematch: { requestedByYou: boolean } }>(
      await emitAck(bobSocket, 'match:rematch', { matchId }),
    );
    expect(secondRequest.matchId).not.toBe(matchId);
    const rematch = await rematchFound;
    expect(rematch.match.id).toBe(secondRequest.matchId);
    expect(rematch.match.status).toBe('ACTIVE');

    // The rematch swaps sides.
    expect(rematch.match.youSide).not.toBe(aliceFirstSide);
    expect(alice.user.id).not.toBe(bob.user.id);
  });

  it('starts an AI game and applies the bot response', async () => {
    const session = await authenticate(`e2e-ai-${randomUUID().slice(0, 8)}`, 'AI Player');
    const socket = await connect(session.cookie);

    const found = waitFor<MatchFound>(socket, 'match:found');
    const started = expectOk<{ matchId: string }>(
      await emitAck(socket, 'ai:start', { difficulty: 'HARD', side: 'X' }),
    );
    const match = await found;
    expect(match.match.id).toBe(started.matchId);
    expect(match.match.youSide).toBe('X');

    const c00 = encodeCell(0, 0);
    const afterAiMove = waitFor<MatchFound>(
      socket,
      'match:state',
      (payload) => payload.match.turnNumber >= 2,
    );
    expectOk(await emitAck(socket, 'move:submit', { matchId: started.matchId, cell: c00, actionId: randomUUID() }));
    const state = await afterAiMove;
    expect(state.match.board[c00]).toBe('X');
    const oMoves = Object.values(state.match.board).filter((v) => v === 'O');
    expect(oMoves).toHaveLength(1);
    expect(state.match.turnNumber).toBe(2);
    expect(state.match.currentTurn).toBe('X');

    expectError(await emitAck(socket, 'ai:start', { difficulty: 'EASY', side: 'O' }), 'PLAYER_BUSY');
  });

  it('creates and accepts invitation links with self and replay protection', async () => {
    const suffix = randomUUID().slice(0, 8);
    const host = await authenticate(`e2e-host-${suffix}`, 'Host');
    const guest = await authenticate(`e2e-guest-${suffix}`, 'Guest');
    const third = await authenticate(`e2e-third-${suffix}`, 'Third');
    const hostSocket = await connect(host.cookie);
    const guestSocket = await connect(guest.cookie);
    const thirdSocket = await connect(third.cookie);

    const waiting = waitFor<InviteWaiting>(hostSocket, 'invite:waiting');
    const created = expectOk<InviteCreated>(await emitAck(hostSocket, 'invite:create'));
    expect(created.invitation.deepLink).toContain('startapp=invite_');
    expect((await waiting).invitation.id).toBe(created.invitation.id);
    const token = inviteToken(created);

    expectError(await emitAck(hostSocket, 'invite:accept', { token }), 'INVITATION_OWN');

    const hostFound = waitFor<MatchFound>(hostSocket, 'match:found');
    const guestFound = waitFor<MatchFound>(guestSocket, 'match:found');
    const accepted = expectOk<{ matchId: string }>(
      await emitAck(guestSocket, 'invite:accept', { token }),
    );
    expect(accepted.matchId).toBe(created.invitation.matchId);
    const [hostMatch, guestMatch] = await Promise.all([hostFound, guestFound]);
    expect(hostMatch.match.id).toBe(created.invitation.matchId);
    expect(hostMatch.match.youSide).toBe('X');
    expect(guestMatch.match.youSide).toBe('O');

    expectError(await emitAck(thirdSocket, 'invite:accept', { token }), 'INVITATION_USED');

    const thirdWaiting = waitFor<InviteWaiting>(thirdSocket, 'invite:waiting');
    const thirdInvite = expectOk<InviteCreated>(await emitAck(thirdSocket, 'invite:create'));
    await thirdWaiting;
    const thirdToken = inviteToken(thirdInvite);
    expectError(
      await emitAck(guestSocket, 'invite:cancel', { invitationId: thirdInvite.invitation.id }),
      'INVITATION_FORBIDDEN',
    );
    expectOk(await emitAck(thirdSocket, 'invite:cancel', { invitationId: thirdInvite.invitation.id }));
    expectError(await emitAck(thirdSocket, 'invite:accept', { token: thirdToken }), 'INVITATION_OWN');
  });

  it('allows reconnecting within the grace period and forfeits after it expires', async () => {
    const { alice, aliceSocket, bobSocket, aliceMatch, bobMatch } = await createMatchedPair();
    const matchId = aliceMatch.match.id;
    const bobSide = bobMatch.match.youSide;

    const disconnected = waitFor<{ matchId: string; graceEndsAt: string }>(
      bobSocket,
      'opponent:disconnected',
    );
    aliceSocket.disconnect();
    const disconnectedEvent = await disconnected;
    expect(disconnectedEvent.matchId).toBe(matchId);

    const reconnected = waitFor<{ matchId: string }>(bobSocket, 'opponent:reconnected');
    const aliceSocket2 = await connect(alice.cookie);
    expect((await reconnected).matchId).toBe(matchId);

    const joined = expectOk<{ match: MatchFound['match'] }>(
      await emitAck(aliceSocket2, 'match:join', { matchId }),
    );
    expect(joined.match.status).toBe('ACTIVE');
    expect(joined.match.opponentConnection).toBe('connected');

    const disconnectedAgain = waitFor<{ matchId: string }>(bobSocket, 'opponent:disconnected');
    aliceSocket2.disconnect();
    await disconnectedAgain;

    const finished = await waitFor<MatchFound>(bobSocket, 'match:finished', () => true, 6_000);
    expect(finished.match.id).toBe(matchId);
    expect(finished.match.status).toBe('FINISHED');
    expect(finished.match.finishReason).toBe('DISCONNECT');
    expect(finished.match.winnerSide).toBe(bobSide);
    expect(finished.match.result).toBe(bobSide === 'X' ? 'X_WINS' : 'O_WINS');
  });

  it('cancels matchmaking and reports the cancelled state', async () => {
    const session = await authenticate(`e2e-cancel-${randomUUID().slice(0, 8)}`, 'Cancel Player');
    const socket = await connect(session.cookie);

    const status = waitFor<QueueStatus>(socket, 'queue:status', (payload) => payload.state === 'cancelled');
    const joined = expectOk<{ status: QueueStatus }>(
      await emitAck(socket, 'queue:join', { autoAiFallback: false }),
    );
    expect(joined.status.state).toBe('searching');
    expectOk(await emitAck(socket, 'queue:cancel'));
    expect((await status).state).toBe('cancelled');
  });
});
