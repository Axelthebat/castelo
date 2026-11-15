import type { Color } from './types.ts';

export interface ClockConfig {
  baseMs: number;
  incrementMs: number;
}

export interface ClockSnapshot {
  w: number;
  b: number;
  active: Color | null;
  running: boolean;
}

/**
 * Relógio de xadrez.
 * O lado ativo consome tempo; ao mover, recebe o incremento.
 */
export class Clock {
  readonly config: ClockConfig;

  private whiteMs: number;
  private blackMs: number;
  private active: Color;
  private running = true;
  private lastAt: number;

  constructor(config: ClockConfig, now = Date.now()) {
    this.config = config;
    this.whiteMs = config.baseMs;
    this.blackMs = config.baseMs;
    this.active = 'w';
    this.lastAt = now;
  }

  /** Debita o tempo do lado ativo, soma o incremento e troca o lado. */
  press(color: Color, now: number): number {
    const spent = this.consume(now);
    this.active = color === 'w' ? 'b' : 'w';
    this.lastAt = now;
    return spent;
  }

  /** Soma o incremento ao lado indicado. */
  applyIncrement(color: Color): number {
    if (color === 'w') this.whiteMs += this.config.incrementMs;
    else this.blackMs += this.config.incrementMs;
    return color === 'w' ? this.whiteMs : this.blackMs;
  }

  remaining(color: Color, now = Date.now()): number {
    const base = color === 'w' ? this.whiteMs : this.blackMs;
    if (!this.running) return base;
    if (this.active !== color) return base;
    return Math.max(0, base - (now - this.lastAt));
  }

  snapshot(now = Date.now()): ClockSnapshot {
    return {
      w: this.remaining('w', now),
      b: this.remaining('b', now),
      active: this.running ? this.active : null,
      running: this.running,
    };
  }

  expired(color: Color, now = Date.now()): boolean {
    return this.remaining(color, now) <= 0;
  }

  stop(): void {
    this.consume(Date.now());
    this.running = false;
  }

  /** Debita o tempo do lado ativo sem trocar o lado. */
  private consume(now: number): number {
    const elapsed = Math.max(0, now - this.lastAt);
    if (this.active === 'w') this.whiteMs = Math.max(0, this.whiteMs - elapsed);
    else this.blackMs = Math.max(0, this.blackMs - elapsed);
    this.lastAt = now;
    return elapsed;
  }
}
