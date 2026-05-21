import { Game } from '../core/Game';
import { Player, GameMode, Difficulty, GameConfig, BLACK, WHITE, EMPTY, BOARD_SIZE, MODE_NAMES, DIFFICULTY_NAMES } from '../core/types';
import { BoardRenderer } from './BoardRenderer';
import { AI } from '../ai/AI';

export class UIManager {
  private game: Game;
  private renderer: BoardRenderer;
  private ai: AI;
  private container: HTMLElement;
  private darkMode: boolean = false;

  // DOM refs
  private canvas!: HTMLCanvasElement;
  private statusEl!: HTMLElement;
  private modeBtn!: HTMLElement;
  private difficultyBtn!: HTMLElement;
  private undoBtn!: HTMLElement;
  private redoBtn!: HTMLElement;
  private newGameBtn!: HTMLElement;
  private switchSideBtn!: HTMLElement;
  private modeMenu!: HTMLElement;
  private difficultyMenu!: HTMLElement;
  private blackTimerEl!: HTMLElement;
  private whiteTimerEl!: HTMLElement;
  private moveCountEl!: HTMLElement;
  private moveListEl!: HTMLElement;
  private overlayEl!: HTMLElement;
  private resultTitleEl!: HTMLElement;
  private resultSubtitleEl!: HTMLElement;
  private themeBtn!: HTMLElement;
  private suggestBtn!: HTMLElement;

  private currentMode: GameMode = 'pvai';
  private currentDifficulty: Difficulty = 3;
  private aiPlayer: Player = WHITE; // Human plays BLACK by default
  private showSuggestions: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.ai = new AI();
    this.renderHTML();
    this.bindEvents();

    const config: GameConfig = {
      mode: this.currentMode,
      difficulty: this.currentDifficulty,
      aiPlayer: this.aiPlayer,
      timeLimit: 600, // 10 min per player
    };

    this.game = new Game(config);
    this.renderer = new BoardRenderer(this.canvas);

    this.game.onStateChange = () => this.onStateChange();
    this.game.onTimerTick = () => this.onTimerTick();
    this.game.onMoveMade = () => this.onMoveMade();

    this.renderer.render(this.game);
    this.updateUI();
  }

  private renderHTML(): void {
    this.container.innerHTML = `
      <div class="game-wrapper ${this.darkMode ? 'dark' : ''}">
        <!-- Header -->
        <div class="game-header">
          <div class="logo">
            <span class="logo-icon">♟</span>
            <div class="logo-text">
              <h1>五子棋</h1>
              <span class="logo-sub">GOMOKU ULTIMATE</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-icon" id="themeBtn" title="切换主题">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 2a8 8 0 0 1 8 8 8 8 0 0 1-8 8V4z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="game-body">
          <!-- Board side -->
          <div class="board-section">
            <!-- Player info bar -->
            <div class="player-bar">
              <div class="player-info black-player" id="blackPlayer">
                <div class="player-stone black-stone"></div>
                <div class="player-detail">
                  <span class="player-label" id="blackLabel">黑棋</span>
                  <span class="player-time" id="blackTimer">--:--</span>
                </div>
                <div class="player-indicator" id="blackIndicator"></div>
              </div>
              <div class="vs-badge">VS</div>
              <div class="player-info white-player" id="whitePlayer">
                <div class="player-stone white-stone"></div>
                <div class="player-detail">
                  <span class="player-label" id="whiteLabel">白棋</span>
                  <span class="player-time" id="whiteTimer">--:--</span>
                </div>
                <div class="player-indicator" id="whiteIndicator"></div>
              </div>
            </div>

            <!-- Canvas -->
            <div class="canvas-container">
              <canvas id="boardCanvas"></canvas>
            </div>
          </div>

          <!-- Control side -->
          <div class="controls-section">
            <!-- Status -->
            <div class="status-bar" id="statusBar">
              <div class="status-icon" id="statusIcon">⚪</div>
              <span id="statusText">点击「新游戏」开始</span>
            </div>

            <!-- Game modes -->
            <div class="control-group">
              <label class="control-label">游戏模式</label>
              <div class="dropdown" id="modeDropdown">
                <button class="dropdown-btn btn" id="modeBtn">
                  <span id="modeText">🤖 人机对战</span>
                  <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                </button>
                <div class="dropdown-menu" id="modeMenu">
                  <div class="menu-item" data-mode="pvp">👤 双人对战</div>
                  <div class="menu-item" data-mode="pvai">🤖 人机对战</div>
                  <div class="menu-item" data-mode="aivai">🧠 AI自对弈</div>
                </div>
              </div>
            </div>

            <!-- Difficulty -->
            <div class="control-group">
              <label class="control-label">AI 难度</label>
              <div class="dropdown" id="difficultyDropdown">
                <button class="dropdown-btn btn" id="difficultyBtn">
                  <span id="difficultyText">🔥 困难</span>
                  <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                </button>
                <div class="dropdown-menu" id="difficultyMenu">
                  <div class="menu-item" data-diff="1">🌱 简单</div>
                  <div class="menu-item" data-diff="2">🌿 中等</div>
                  <div class="menu-item" data-diff="3">🔥 困难</div>
                  <div class="menu-item" data-diff="4">💎 专家</div>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="action-buttons">
              <button class="btn btn-primary" id="newGameBtn">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                <span>新游戏</span>
              </button>
              <button class="btn btn-secondary" id="switchSideBtn" title="交换黑白">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 17l6 6v-4h10v-4H10V7L4 17z"/></svg>
                <span>换边</span>
              </button>
              <button class="btn btn-secondary" id="undoBtn" disabled>
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                <span>悔棋</span>
              </button>
              <button class="btn btn-secondary" id="redoBtn" disabled>
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.37.78c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
                <span>重做</span>
              </button>
              <button class="btn btn-secondary suggestions-btn" id="suggestBtn" title="AI 建议">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <span>建议</span>
              </button>
            </div>

            <!-- Move history -->
            <div class="control-group">
              <div class="move-history-header">
                <label class="control-label">棋谱</label>
                <span class="move-count" id="moveCount">0 手</span>
              </div>
              <div class="move-list" id="moveList">
                <div class="move-list-empty">暂无记录</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Overlay -->
        <div class="overlay hidden" id="overlay">
          <div class="overlay-content">
            <div class="result-icon" id="resultIcon">🎉</div>
            <h2 id="resultTitle">黑棋获胜！</h2>
            <p id="resultSubtitle">精彩的对局</p>
            <div class="result-actions">
              <button class="btn btn-primary" id="rematchBtn">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                <span>再来一局</span>
              </button>
              <button class="btn btn-secondary" id="closeResultBtn">关闭</button>
            </div>
          </div>
        </div>

        <!-- Thinking indicator -->
        <div class="thinking-indicator hidden" id="thinkingIndicator">
          <div class="thinking-spinner"></div>
          <span>AI 思考中...</span>
        </div>
      </div>
    `;

    // Get DOM refs
    this.canvas = this.container.querySelector('#boardCanvas')!;
    this.statusEl = this.container.querySelector('#statusText')!;
    this.modeBtn = this.container.querySelector('#modeBtn')!;
    this.difficultyBtn = this.container.querySelector('#difficultyBtn')!;
    this.undoBtn = this.container.querySelector('#undoBtn')!;
    this.redoBtn = this.container.querySelector('#redoBtn')!;
    this.newGameBtn = this.container.querySelector('#newGameBtn')!;
    this.switchSideBtn = this.container.querySelector('#switchSideBtn')!;
    this.modeMenu = this.container.querySelector('#modeMenu')!;
    this.difficultyMenu = this.container.querySelector('#difficultyMenu')!;
    this.blackTimerEl = this.container.querySelector('#blackTimer')!;
    this.whiteTimerEl = this.container.querySelector('#whiteTimer')!;
    this.moveCountEl = this.container.querySelector('#moveCount')!;
    this.moveListEl = this.container.querySelector('#moveList')!;
    this.overlayEl = this.container.querySelector('#overlay')!;
    this.resultTitleEl = this.container.querySelector('#resultTitle')!;
    this.resultSubtitleEl = this.container.querySelector('#resultSubtitle')!;
    this.themeBtn = this.container.querySelector('#themeBtn')!;
    this.suggestBtn = this.container.querySelector('#suggestBtn')!;
  }

  private bindEvents(): void {
    // Canvas click
    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onCanvasHover(e));
    this.canvas.addEventListener('mouseleave', () => this.renderer.setHover(null));

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = this.renderer.screenToBoard(touch.clientX, touch.clientY);
      if (pos) this.handleBoardClick(pos);
    }, { passive: false });

    // Dropdowns
    this.modeBtn.addEventListener('click', () => this.toggleDropdown(this.modeMenu));
    this.difficultyBtn.addEventListener('click', () => this.toggleDropdown(this.difficultyMenu));

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#modeDropdown')) this.modeMenu.classList.remove('open');
      if (!target.closest('#difficultyDropdown')) this.difficultyMenu.classList.remove('open');
    });

    this.modeMenu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.menu-item') as HTMLElement;
      if (!item) return;
      const mode = item.dataset.mode as GameMode;
      this.currentMode = mode;
      this.modeMenu.classList.remove('open');
      this.updateModeButton();
      this.resetGame();
    });

    this.difficultyMenu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.menu-item') as HTMLElement;
      if (!item) return;
      const diff = parseInt(item.dataset.diff!) as Difficulty;
      this.currentDifficulty = diff;
      this.difficultyMenu.classList.remove('open');
      this.updateDifficultyButton();
      this.resetGame();
    });

    // Buttons
    this.newGameBtn.addEventListener('click', () => this.resetGame());
    this.undoBtn.addEventListener('click', () => this.undoMove());
    this.redoBtn.addEventListener('click', () => this.redoMove());
    this.switchSideBtn.addEventListener('click', () => this.switchSide());
    this.themeBtn.addEventListener('click', () => this.toggleTheme());
    this.suggestBtn.addEventListener('click', () => this.toggleSuggestions());

    // Result overlay
    this.container.querySelector('#rematchBtn')?.addEventListener('click', () => {
      this.hideOverlay();
      this.resetGame();
    });
    this.container.querySelector('#closeResultBtn')?.addEventListener('click', () => {
      this.hideOverlay();
    });

    // ResizeObserver for responsive canvas
    const canvasContainer = this.canvas.parentElement!;
    const resizeObserver = new ResizeObserver(() => {
      this.renderer.resize();
      this.renderer.render(this.game);
    });
    resizeObserver.observe(canvasContainer);
  }

  private toggleDropdown(menu: HTMLElement): void {
    const isOpen = menu.classList.contains('open');
    this.modeMenu.classList.remove('open');
    this.difficultyMenu.classList.remove('open');
    if (!isOpen) menu.classList.add('open');
  }

  private updateModeButton(): void {
    const textEl = this.container.querySelector('#modeText')!;
    textEl.textContent = MODE_NAMES[this.currentMode];
  }

  private updateDifficultyButton(): void {
    const textEl = this.container.querySelector('#difficultyText')!;
    const icons = { 1: '🌱', 2: '🌿', 3: '🔥', 4: '💎' };
    textEl.textContent = `${icons[this.currentDifficulty]} ${DIFFICULTY_NAMES[this.currentDifficulty]}`;
  }

  private onStateChange(): void {
    this.updateUI();

    // After any move, clear outdated suggestions; recompute after a brief fade
    if (this.showSuggestions) {
      this.renderer.setSuggestions([], false);
      if (this.game.status === 'playing') {
        setTimeout(() => {
          if (this.showSuggestions && this.game.status === 'playing') {
            this.computeSuggestions();
          }
        }, 400);
      }
    }

    this.renderer.render(this.game);

    // Check if AI should move
    if (this.game.status === 'playing' && this.game.isAIThinking()) {
      this.triggerAIMove();
    }
  }

  // Lightweight timer-only update — does NOT re-render the board
  private onTimerTick(): void {
    if (this.game.timeLimit > 0) {
      this.blackTimerEl.textContent = this.formatTime(this.game.blackTime);
      this.whiteTimerEl.textContent = this.formatTime(this.game.whiteTime);
    }
  }

  private onMoveMade(): void {
    this.updateMoveHistory();
  }

  private async triggerAIMove(): Promise<void> {
    const thinkingIndicator = this.container.querySelector('#thinkingIndicator')!;
    thinkingIndicator.classList.remove('hidden');

    const move = await this.ai.computeMove(
      this.game.board,
      this.game.currentPlayer,
      this.currentDifficulty,
      () => {}
    );

    thinkingIndicator.classList.add('hidden');

    if (move && this.game.status === 'playing' && this.game.isAIThinking()) {
      this.game.makeMove(move.row, move.col);
    }
  }

  private onCanvasClick(e: MouseEvent): void {
    const pos = this.renderer.screenToBoard(e.clientX, e.clientY);
    if (pos) this.handleBoardClick(pos);
  }

  private onCanvasHover(e: MouseEvent): void {
    if (this.game.status !== 'playing') {
      this.renderer.setHover(null);
      return;
    }

    // In PvAI mode, only show hover on human's turn
    if (this.currentMode === 'pvai' && this.game.currentPlayer === this.aiPlayer) {
      this.renderer.setHover(null);
      return;
    }

    const pos = this.renderer.screenToBoard(e.clientX, e.clientY);
    this.renderer.setHover(pos);
    this.renderer.render(this.game);
  }

  private handleBoardClick(pos: { row: number; col: number }): void {
    if (this.game.status !== 'playing') return;

    // In PvAI mode, only accept human clicks
    if (this.currentMode === 'pvai' && this.game.currentPlayer === this.aiPlayer) return;
    if (this.currentMode === 'aivai') return;

    // Check if valid move
    if (this.game.board.grid[pos.row][pos.col] !== EMPTY) return;

    this.game.makeMove(pos.row, pos.col);
  }

  private resetGame(): void {
    this.hideOverlay();
    this.game.destroy();

    const config: GameConfig = {
      mode: this.currentMode,
      difficulty: this.currentDifficulty,
      aiPlayer: this.aiPlayer,
      timeLimit: 600,
    };

    this.game = new Game(config);
    this.game.onStateChange = () => this.onStateChange();
    this.game.onTimerTick = () => this.onTimerTick();
    this.game.onMoveMade = () => this.onMoveMade();
    this.game.start();

    this.renderer.render(this.game);
    this.updateUI();
    this.updateMoveHistory();
  }

  private undoMove(): void {
    this.game.undo();
    this.updateUI();
    this.updateMoveHistory();
    this.renderer.render(this.game);
  }

  private redoMove(): void {
    this.game.redo();
    this.updateUI();
    this.updateMoveHistory();
    this.renderer.render(this.game);
  }

  private switchSide(): void {
    this.aiPlayer = this.aiPlayer === BLACK ? WHITE : BLACK;
    this.resetGame();
  }

  private toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.container.querySelector('.game-wrapper')!.classList.toggle('dark', this.darkMode);
    this.renderer.setDarkMode(this.darkMode);
    this.renderer.resize();
    this.renderer.render(this.game);
  }

  private toggleSuggestions(): void {
    this.showSuggestions = !this.showSuggestions;
    this.suggestBtn.classList.toggle('active', this.showSuggestions);
    if (this.showSuggestions && this.game.status === 'playing') {
      this.computeSuggestions();
    } else {
      this.renderer.setSuggestions([], false);
    }
    this.renderer.render(this.game);
  }

  private async computeSuggestions(): Promise<void> {
    if (this.game.status !== 'playing') return;
    const player = this.game.currentPlayer;
    const suggestions = await this.ai.analyzePosition(this.game.board, player, this.currentDifficulty);
    this.renderer.setSuggestions(suggestions, true);
    this.renderer.render(this.game);
  }

  private updateUI(): void {
    const g = this.game;

    // Status
    const statusIcon = this.container.querySelector('#statusIcon')!;
    const statusText = this.container.querySelector('#statusText')!;

    if (g.status === 'idle') {
      statusIcon.textContent = '⚪';
      statusText.textContent = '点击「新游戏」开始';
    } else if (g.status === 'playing') {
      const isAI = g.isAIThinking();
      if (isAI) {
        statusIcon.textContent = '🤖';
        statusText.textContent = `AI (${g.getCurrentPlayerName()}) 思考中...`;
      } else if (this.currentMode === 'aivai') {
        statusIcon.textContent = '🧠';
        statusText.textContent = `AI 对弈中 · ${g.getCurrentPlayerName()} 落子`;
      } else {
        statusIcon.textContent = g.currentPlayer === BLACK ? '⚫' : '⚪';
        statusText.textContent = `轮到 ${g.getCurrentPlayerName()}`;
      }
    }

    // Player labels
    const blackLabel = this.container.querySelector('#blackLabel')!;
    const whiteLabel = this.container.querySelector('#whiteLabel')!;

    if (this.currentMode === 'pvai') {
      blackLabel.textContent = this.aiPlayer === BLACK ? 'AI 黑棋' : '👤 黑棋';
      whiteLabel.textContent = this.aiPlayer === WHITE ? 'AI 白棋' : '👤 白棋';
    } else if (this.currentMode === 'aivai') {
      blackLabel.textContent = 'AI 黑棋';
      whiteLabel.textContent = 'AI 白棋';
    } else {
      blackLabel.textContent = '⚫ 黑棋';
      whiteLabel.textContent = '⚪ 白棋';
    }

    // Turn indicator
    const blackIndicator = this.container.querySelector('#blackIndicator')!;
    const whiteIndicator = this.container.querySelector('#whiteIndicator')!;
    blackIndicator.classList.toggle('active', g.currentPlayer === BLACK);
    whiteIndicator.classList.toggle('active', g.currentPlayer === WHITE);

    // Timers
    if (g.timeLimit > 0) {
      this.blackTimerEl.textContent = this.formatTime(g.blackTime);
      this.whiteTimerEl.textContent = this.formatTime(g.whiteTime);
    } else {
      this.blackTimerEl.textContent = '--:--';
      this.whiteTimerEl.textContent = '--:--';
    }

    // Buttons
    (this.undoBtn as HTMLButtonElement).disabled = !g.canUndo();
    (this.redoBtn as HTMLButtonElement).disabled = !g.canRedo();

    // Move count
    this.moveCountEl.textContent = `${g.board.moveCount} 手`;

    // Game over
    if (g.status === 'over') {
      this.showResult(g);
    }
  }

  private updateMoveHistory(): void {
    const moves = this.game.getMoveHistory();
    this.moveListEl.innerHTML = '';

    if (moves.length === 0) {
      this.moveListEl.innerHTML = '<div class="move-list-empty">暂无记录</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    moves.forEach((move, i) => {
      const el = document.createElement('div');
      el.className = 'move-item';
      const moveNum = i + 1;
      const player = move.player === BLACK ? '⚫' : '⚪';
      const col = String.fromCharCode(65 + move.col);
      const row = 15 - move.row;
      el.innerHTML = `<span class="move-num">${moveNum}.</span> <span class="move-player">${player}</span> <span class="move-pos">${col}${row}</span>`;
      fragment.appendChild(el);
    });

    this.moveListEl.appendChild(fragment);
    this.moveListEl.scrollTop = this.moveListEl.scrollHeight;
  }

  private showResult(g: Game): void {
    setTimeout(() => {
      const icon = this.container.querySelector('#resultIcon')!;
      const title = this.container.querySelector('#resultTitle')!;
      const subtitle = this.container.querySelector('#resultSubtitle')!;

      if (g.winner === BLACK) {
        icon.textContent = '⚫';
        title.textContent = '黑棋获胜！';
      } else if (g.winner === WHITE) {
        icon.textContent = '⚪';
        title.textContent = '白棋获胜！';
      } else {
        icon.textContent = '🤝';
        title.textContent = '平局！';
      }

      subtitle.textContent = `共 ${g.board.moveCount} 手 · ${g.mode === 'pvai' ? '人机对战' : g.mode === 'aivai' ? 'AI自对弈' : '双人对战'}`;

      this.overlayEl.classList.remove('hidden');
      this.renderer.startWinAnimation();
    }, 500);
  }

  private hideOverlay(): void {
    this.overlayEl.classList.add('hidden');
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
