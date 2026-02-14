import { useState, useRef, useEffect } from 'react'

interface VideoPreviewProps {
  videoPath?: string
  autoReload?: boolean
}

export default function VideoPreview({
  videoPath,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (videoPath && videoRef.current) {
      // Reload video when path changes
      videoRef.current.load()
      setError(null)
    }
  }, [videoPath])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleError = () => setError('Failed to load video')

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('durationchange', updateDuration)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('durationchange', updateDuration)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
    }
  }, [])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (videoRef.current) {
      videoRef.current.volume = vol
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!videoPath) {
    return (
      <div className="bg-black rounded-lg flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-lg">No video loaded</p>
          <p className="text-sm mt-2">Import or create a video to preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      {/* Video Element */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full"
            onClick={togglePlay}
            src={videoPath}
          >
            <track kind="captions" />
          </video>
        )}

        {/* Play/Pause Overlay */}
        {!isPlaying && !error && videoPath && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center text-4xl">
              ▶️
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 space-y-3">
        {/* Timeline Scrubber */}
        <div className="flex items-center space-x-3">
          <span className="text-white text-sm font-mono w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <span className="text-white text-sm font-mono w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleVolumeChange({ target: { value: volume === 0 ? '1' : '0' } } as any)}
                className="text-white hover:text-primary transition-colors"
              >
                {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Additional Controls */}
          <div className="flex items-center space-x-2 text-white">
            <button
              onClick={() => {
                if (videoRef.current) {
                  if (videoRef.current.requestFullscreen) {
                    videoRef.current.requestFullscreen()
                  }
                }
              }}
              className="p-2 hover:text-primary transition-colors"
              title="Fullscreen"
            >
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
