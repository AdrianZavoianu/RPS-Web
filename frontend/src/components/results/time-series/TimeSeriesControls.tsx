/**
 * Playback controls bar for the time-series view.
 * Play/Pause, Reset, scrub slider, time display, speed controls.
 */

import clsx from 'clsx'

// --- Types ---

interface TimeSeriesControlsProps {
  isPlaying: boolean
  currentPosition: number
  maxPosition: number
  speedMultiplier: number
  currentTime: number
  sliderRef: React.RefObject<HTMLInputElement>
  timeDisplayRef: React.RefObject<HTMLSpanElement>
  onPlayPause: () => void
  onReset: () => void
  onSliderChange: (value: number) => void
  onSlower: () => void
  onFaster: () => void
  isSlowerDisabled: boolean
  isFasterDisabled: boolean
}

// --- Component ---

export function TimeSeriesControls({
  isPlaying,
  currentPosition,
  maxPosition,
  speedMultiplier,
  currentTime,
  sliderRef,
  timeDisplayRef,
  onPlayPause,
  onReset,
  onSliderChange,
  onSlower,
  onFaster,
  isSlowerDisabled,
  isFasterDisabled,
}: TimeSeriesControlsProps) {
  return (
    <div className="ts-controls flex items-center gap-3 mx-3 my-2 px-3 py-1.5 text-[13px]">
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className={clsx(
          'ts-play-btn px-3 py-1 rounded text-[13px] font-medium transition-colors',
          isPlaying
            ? 'bg-red-500/80 text-white hover:bg-red-500'
            : 'bg-accent-primary text-white hover:opacity-90'
        )}
      >
        {isPlaying ? 'Pause' : '> Play'}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="ts-reset-btn px-2 py-1 rounded text-[13px] text-text-secondary hover:text-text-primary transition-colors"
      >
        {'< Reset'}
      </button>

      {/* Slider */}
      <div className="flex-1 flex items-center">
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={maxPosition}
          step={0.25}
          value={currentPosition}
          onChange={(e) => onSliderChange(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-border-default rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
        />
      </div>

      {/* Time display */}
      <span className="text-text-muted min-w-[90px] text-center">
        Time:{' '}
        <span ref={timeDisplayRef} className="font-mono text-text-primary">
          {currentTime.toFixed(3)}s
        </span>
      </span>

      {/* Speed controls */}
      <button
        onClick={onSlower}
        disabled={isSlowerDisabled}
        className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
      >
        {'<< Slower'}
      </button>

      <span className="font-mono text-text-primary min-w-[40px] text-center">
        {speedMultiplier}x
      </span>

      <button
        onClick={onFaster}
        disabled={isFasterDisabled}
        className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
      >
        {'Faster >>'}
      </button>
    </div>
  )
}
