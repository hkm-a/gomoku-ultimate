import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { BLACK, WHITE, type GameConfig } from '../src/core/types';

const config: GameConfig = {
  mode: 'pvp',
  difficulty: 2,
  aiPlayer: WHITE,
  timeLimit: 10,
};

const games: Game[] = [];

function startGame(timeLimit = config.timeLimit): Game {
  const game = new Game({ ...config, timeLimit });
  games.push(game);
  game.start();
  return game;
}

afterEach(() => {
  games.splice(0).forEach((game) => game.destroy());
  vi.useRealTimers();
});

describe('计时规则', () => {
  it('只扣除当前执棋方的剩余时间', () => {
    vi.useFakeTimers();
    const game = startGame();

    expect(game.consumeCurrentPlayerTime(2.5)).toBe(false);
    expect(game.blackTime).toBe(7.5);
    expect(game.whiteTime).toBe(10);

    expect(game.makeMove(7, 7)).toBe(true);
    expect(game.currentPlayer).toBe(WHITE);
    expect(game.consumeCurrentPlayerTime(1.25)).toBe(false);
    expect(game.blackTime).toBe(7.5);
    expect(game.whiteTime).toBe(8.75);
  });

  it('当前方时间耗尽时，判定对手获胜并拒绝后续落子', () => {
    vi.useFakeTimers();
    const game = startGame(1);

    expect(game.consumeCurrentPlayerTime(1)).toBe(true);
    expect(game.status).toBe('over');
    expect(game.winner).toBe(WHITE);
    expect(game.blackTime).toBe(0);
    expect(game.makeMove(7, 7)).toBe(false);
  });

  it('无限时模式不改变时钟或对局状态', () => {
    vi.useFakeTimers();
    const game = startGame(0);

    expect(game.consumeCurrentPlayerTime(60)).toBe(false);
    expect(game.status).toBe('playing');
    expect(game.currentPlayer).toBe(BLACK);
    expect(game.blackTime).toBe(0);
  });
});
