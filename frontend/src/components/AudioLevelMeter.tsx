'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioLevelMeterProps {
  stream: MediaStream | null
  label: string
  color?: string
}

export const AudioLevelMeter = ({ stream, label, color = 'bg-green-500' }: AudioLevelMeterProps) => {
  const [level, setLevel] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setLevel(0)
      return
    }

    try {
      // Create audio context and analyser
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      microphone.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          
          // Calculate average volume
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const average = sum / dataArray.length
          
          // Normalize to 0-100
          const normalizedLevel = Math.min(100, (average / 255) * 100 * 2)
          setLevel(normalizedLevel)
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
      }
    } catch (error) {
      console.error('Error setting up audio level meter:', error)
      setLevel(0)
    }
  }, [stream])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">{Math.round(level)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-100 ease-out`}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  )
}
