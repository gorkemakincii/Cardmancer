import { Howl, Howler } from 'howler';

const BASE = '/sounds/';

function make(src: string, opts?: { loop?: boolean; volume?: number }) {
  return new Howl({
    src: [`${BASE}${src}`],
    loop: opts?.loop ?? false,
    volume: opts?.volume ?? 0.7,
    onloaderror: () => {},   // silent when file is missing
    onplayerror: () => {},
  });
}

const sfx = {
  bgm:      make('bgm.mp3',       { loop: true,  volume: 0.22 }),
  draw:     make('draw.mp3',      { volume: 0.55 }),
  play:     make('play.mp3',      { volume: 0.65 }),
  eliminate:make('eliminate.mp3', { volume: 0.75 }),
  win:      make('win.mp3',       { volume: 0.75 }),
  click:    make('click.mp3',     { volume: 0.45 }),
};

// ── Mute state ────────────────────────────────────────────────────────────────

let _muted = localStorage.getItem('php_muted') === 'true';
if (_muted) Howler.mute(true);

export function getMuted(): boolean { return _muted; }

export function toggleMute(): boolean {
  _muted = !_muted;
  Howler.mute(_muted);
  localStorage.setItem('php_muted', String(_muted));
  // Resume BGM if we just unmuted and it was playing
  if (!_muted && _bgmStarted && !sfx.bgm.playing()) sfx.bgm.play();
  return _muted;
}

// ── BGM ───────────────────────────────────────────────────────────────────────

let _bgmStarted = false;

export function startBGM() {
  if (_bgmStarted) return;
  _bgmStarted = true;
  sfx.bgm.play();
}

// ── SFX helpers ───────────────────────────────────────────────────────────────

export function playDraw()      { sfx.draw.play(); }
export function playPlayCard()  { sfx.play.play(); }
export function playEliminate() { sfx.eliminate.play(); }
export function playWin()       { sfx.win.play(); }
export function playClick()     { sfx.click.play(); }
