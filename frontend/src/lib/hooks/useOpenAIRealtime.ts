import { useState, useEffect, useRef, useCallback } from 'react'
import type { RealtimeSession } from '@/lib/api/realtime'

export interface RealtimeTranscript {
  text: string
  timestamp: number
  isFinal: boolean
}

export interface UseOpenAIRealtimeReturn {
  transcripts: RealtimeTranscript[]
  isConnected: boolean
  isTranscribing: boolean
  isPaused: boolean
  error: string | null
  connect: (session: RealtimeSession, audioStream?: MediaStream) => void
  disconnect: () => void
  pause: () => void
  resume: () => void
  clearTranscripts: () => void
}

export const useOpenAIRealtime = (): UseOpenAIRealtimeReturn => {
  const [transcripts, setTranscripts] = useState<RealtimeTranscript[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const externalStreamRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Helper function to calculate string similarity (Levenshtein distance based)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }
  
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  const downsampleBuffer = (buffer: Float32Array, inputRate: number, outputRate: number): Int16Array => {
    if (inputRate === outputRate) {
      const output = new Int16Array(buffer.length)
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]))
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }
      return output
    }

    const sampleRateRatio = inputRate / outputRate
    const newLength = Math.round(buffer.length / sampleRateRatio)
    const result = new Int16Array(newLength)
    
    let offsetResult = 0
    let offsetBuffer = 0
    
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
      let accum = 0
      let count = 0
      
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i]
        count++
      }
      
      const sample = accum / count
      const s = Math.max(-1, Math.min(1, sample))
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF
      
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    
    return result
  }

  const connect = useCallback(async (session: RealtimeSession, audioStream?: MediaStream) => {
    try {
      setError(null)
      
      // Create WebSocket connection to our backend proxy
      // Backend proxy will handle authentication with OpenAI
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:'
      const wsHost = apiUrl.replace(/^https?:\/\//, '')
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
      const wsUrl = `${wsProtocol}//${wsHost}${session.websocketUrl}${tokenParam}`
      console.log('[REALTIME] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'))
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[REALTIME] WebSocket connected')
        setIsConnected(true)
        startTimeRef.current = Date.now()
        
        // Send authorization and configure session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a transcription assistant. Transcribe all spoken audio accurately in English.',
            input_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'en'
            },
            turn_detection: null  // Disable turn detection for continuous transcription
          }
        }))
        
        console.log('[REALTIME] Session configured, ready to transcribe')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('[REALTIME] Message received:', message.type, message)
          
          // Handle different message types
          switch (message.type) {
            case 'session.created':
            case 'session.updated':
              console.log('[REALTIME] Session ready')
              setIsTranscribing(true)
              break
              
            case 'conversation.item.input_audio_transcription.completed':
              // This is the actual transcription from Whisper
              console.log('[REALTIME] Transcription completed:', message.transcript)
              if (message.transcript && message.transcript.trim()) {
                const timestamp = (Date.now() - startTimeRef.current) / 1000
                const newText = message.transcript.trim()
                
                setTranscripts(prev => {
                  const finalTranscripts = prev.filter(t => t.isFinal)
                  
                  // Check if this is a duplicate or overlapping transcript
                  if (finalTranscripts.length > 0) {
                    const lastTranscript = finalTranscripts[finalTranscripts.length - 1]
                    const lastText = lastTranscript.text.toLowerCase()
                    const newTextLower = newText.toLowerCase()
                    
                    // 1. Check for exact duplicates
                    if (lastText === newTextLower) {
                      console.log('[REALTIME] Exact duplicate detected, skipping')
                      return prev
                    }
                    
                    // 2. Check if new text is contained within last text (complete subset)
                    if (lastText.includes(newTextLower)) {
                      console.log('[REALTIME] New text is subset of last, skipping')
                      return prev
                    }
                    
                    // 3. Check if last text is contained within new text (new is superset - keep longer version)
                    if (newTextLower.includes(lastText)) {
                      console.log('[REALTIME] New text is superset of last, replacing')
                      const updated = [...finalTranscripts]
                      updated[updated.length - 1] = {
                        text: newText,
                        timestamp: lastTranscript.timestamp,
                        isFinal: true
                      }
                      return updated
                    }
                    
                    // 4. Check for significant overlap at word level (handles "back" vs "back-end." cases)
                    const lastWords = lastText.split(/\s+/)
                    const newWords = newTextLower.split(/\s+/)
                    
                    // Check if at least 70% of the shorter text matches the beginning of the longer text
                    const minLength = Math.min(lastWords.length, newWords.length)
                    const matchThreshold = Math.floor(minLength * 0.7)
                    let matchCount = 0
                    
                    for (let i = 0; i < minLength; i++) {
                      // Use fuzzy matching for words (handles punctuation differences)
                      const lastWord = lastWords[i].replace(/[.,!?;:]/g, '')
                      const newWord = newWords[i].replace(/[.,!?;:]/g, '')
                      if (lastWord === newWord || 
                          lastWord.startsWith(newWord) || 
                          newWord.startsWith(lastWord)) {
                        matchCount++
                      }
                    }
                    
                    if (matchCount >= matchThreshold) {
                      console.log('[REALTIME] Significant overlap detected (', matchCount, '/', minLength, '), replacing with longer version')
                      // Keep the longer version
                      if (newWords.length > lastWords.length) {
                        const updated = [...finalTranscripts]
                        updated[updated.length - 1] = {
                          text: newText,
                          timestamp: lastTranscript.timestamp,
                          isFinal: true
                        }
                        return updated
                      } else {
                        return prev  // Keep existing if it's longer or same
                      }
                    }
                    
                    // 5. Check if we should merge for continuous speech
                    const timeDiff = timestamp - lastTranscript.timestamp
                    if (timeDiff < 4) {
                      // Before merging, check if new text starts with the ending of last text (overlap)
                      // This handles cases where OpenAI repeats the last few words
                      let foundOverlap = false
                      
                      // Check last 10 words of previous transcript
                      for (let overlapSize = Math.min(10, lastWords.length); overlapSize >= 3; overlapSize--) {
                        const lastNWords = lastWords.slice(-overlapSize).join(' ')
                        const firstNWords = newWords.slice(0, overlapSize).join(' ')
                        
                        // Fuzzy match (allow small differences)
                        const similarity = calculateSimilarity(lastNWords, firstNWords)
                        if (similarity > 0.8) {
                          console.log('[REALTIME] Found overlap at end, merging without duplicate')
                          foundOverlap = true
                          // Merge without repeating the overlapping part
                          const nonOverlappingPart = newWords.slice(overlapSize).join(' ')
                          if (nonOverlappingPart) {
                            const merged = [...finalTranscripts]
                            merged[merged.length - 1] = {
                              text: lastTranscript.text + ' ' + nonOverlappingPart,
                              timestamp: lastTranscript.timestamp,
                              isFinal: true
                            }
                            return merged
                          }
                          return prev  // No new content, keep existing
                        }
                      }
                      
                      if (!foundOverlap) {
                        // No overlap detected, safe to merge
                        console.log('[REALTIME] Merging with previous transcript (gap:', timeDiff.toFixed(1), 's)')
                        const merged = [...finalTranscripts]
                        merged[merged.length - 1] = {
                          text: lastTranscript.text + ' ' + newText,
                          timestamp: lastTranscript.timestamp,
                          isFinal: true
                        }
                        return merged
                      }
                    }
                  }
                  
                  // Otherwise add as new transcript (remove any interim first)
                  return [...finalTranscripts, {
                    text: newText,
                    timestamp,
                    isFinal: true
                  }]
                })
              }
              break
              
            case 'conversation.item.input_audio_transcription.delta':
              // Show partial transcription for real-time feedback
              if (message.delta && message.delta.trim()) {
                const timestamp = (Date.now() - startTimeRef.current) / 1000
                setTranscripts(prev => {
                  // Find existing interim transcript and append to it
                  const withoutInterim = prev.filter(t => t.isFinal)
                  const lastInterim = prev.find(t => !t.isFinal)
                  
                  if (lastInterim) {
                    // Append to existing interim
                    return [...withoutInterim, {
                      text: lastInterim.text + message.delta,
                      timestamp: lastInterim.timestamp,
                      isFinal: false
                    }]
                  } else {
                    // Create new interim transcript
                    return [...withoutInterim, {
                      text: message.delta.trim(),
                      timestamp,
                      isFinal: false
                    }]
                  }
                })
              }
              break
              
            case 'error':
              console.error('[REALTIME] Error:', message.error)
              setError(message.error.message || 'Realtime API error')
              break
          }
        } catch (err) {
          console.error('[REALTIME] Parse error:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('[REALTIME] WebSocket error:', event)
        setError('Connection error')
      }

      ws.onclose = () => {
        console.log('[REALTIME] WebSocket closed')
        setIsConnected(false)
        setIsTranscribing(false)
      }

      // Start capturing audio from provided stream or microphone
      let stream: MediaStream
      
      if (audioStream) {
        console.log('[REALTIME] Using provided audio stream')
        const audioTracks = audioStream.getAudioTracks()
        console.log('[REALTIME] Audio tracks in provided stream:', audioTracks.length)
        
        if (audioTracks.length === 0) {
          throw new Error('Provided audio stream has no audio tracks')
        }
        
        audioTracks.forEach((track, i) => {
          console.log(`[REALTIME] Track ${i}:`, track.label, 'enabled:', track.enabled, 'muted:', track.muted, 'readyState:', track.readyState)
        })
        
        // Verify at least one track is enabled and ready
        const hasActiveTrack = audioTracks.some(track => 
          track.enabled && track.readyState === 'live' && !track.muted
        )
        
        if (!hasActiveTrack) {
          console.warn('[REALTIME] No active audio tracks in provided stream')
          throw new Error('Provided audio stream has no active audio tracks. Please check your audio source selection.')
        }
        
        stream = audioStream
        externalStreamRef.current = true
      } else {
        console.log('[REALTIME] No audio stream provided - STOPPING. Live transcription requires an audio source.')
        throw new Error('No audio stream provided for live transcription. This should not happen.')
      }
      
      mediaStreamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext
      
      console.log('[REALTIME] AudioContext created, state:', audioContext.state)
      
      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('[REALTIME] AudioContext resumed, new state:', audioContext.state)
      }
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      console.log('[REALTIME] Audio source and processor created')

      let lastCommitTime = 0
      let audioChunkCount = 0
      let hasVoiceActivity = false
      let silenceCount = 0
      const VOICE_THRESHOLD = 2  // Minimum RMS level to consider as voice (reduced from 5)
      const MAX_SILENCE_BEFORE_COMMIT = 15  // ~1.3 seconds of silence (15 chunks * 85ms)
      
      processor.onaudioprocess = (e) => {
        // Skip processing if paused
        if (isPausedRef.current || ws.readyState !== WebSocket.OPEN) {
          return
        }
        
        const inputData = e.inputBuffer.getChannelData(0)
        
        // Calculate audio level for Voice Activity Detection
        let sum = 0
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i]
        }
        const rms = Math.sqrt(sum / inputData.length)
        const level = Math.max(0, Math.min(100, Math.floor(rms * 100 * 10)))
        
        // Detect voice activity
        const hasVoice = level > VOICE_THRESHOLD
        
        if (hasVoice) {
          hasVoiceActivity = true
          silenceCount = 0
        } else {
          silenceCount++
        }
        
        // Always log first few times to confirm processing is happening
        const now = Date.now()
        if (audioChunkCount < 5) {
          console.log('[REALTIME] Audio processing - level:', level, '/ 100', hasVoice ? '(voice detected)' : '(silence)')
          audioChunkCount++
        } else if (hasVoice) {
          console.log('[REALTIME] Voice detected - level:', level, '/ 100')
        }
        
        // Only send audio if there's voice activity OR we're within the silence window after voice
        if (hasVoiceActivity) {
          // Convert to PCM16
          const pcm16 = downsampleBuffer(inputData, audioContext.sampleRate, 24000)
          
          // Convert to base64
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)))
            
          // Send audio chunk
          ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64
          }))
        }
        
        // Commit when:
        // 1. We have voice activity AND
        // 2. Either 2 seconds have passed OR we've detected silence after voice
        const timeSinceLastCommit = now - lastCommitTime
        const shouldCommitBySilence = hasVoiceActivity && silenceCount >= MAX_SILENCE_BEFORE_COMMIT
        const shouldCommitByTime = hasVoiceActivity && timeSinceLastCommit >= 2000
        
        if (shouldCommitBySilence || shouldCommitByTime) {
          console.log('[REALTIME] Committing audio buffer -', shouldCommitBySilence ? 'silence detected' : 'time interval', '(level:', level, ')')
          ws.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }))
          // Clear the buffer after commit to prevent overlapping transcriptions
          ws.send(JSON.stringify({
            type: 'input_audio_buffer.clear'
          }))
          lastCommitTime = now
          hasVoiceActivity = false
          silenceCount = 0
        }
      }

      // Create a gain node with zero gain to keep audio graph active without feedback
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0  // Silent output
      gainNodeRef.current = gainNode
      
      // Connect: source -> processor -> gainNode -> destination
      source.connect(processor)
      processor.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      console.log('[REALTIME] Audio pipeline connected and active (silent output)')

    } catch (err: any) {
      console.error('[REALTIME] Connection error:', err)
      setError(err.message || 'Failed to connect to Realtime API')
    }
  }, [])

  const disconnect = useCallback(() => {
    console.log('[REALTIME] Disconnecting...')
    
    // Stop audio processing
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Only stop the stream if we created it (not if it was provided externally)
    if (mediaStreamRef.current && !externalStreamRef.current) {
      console.log('[REALTIME] Stopping internal audio stream')
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
    } else if (externalStreamRef.current) {
      console.log('[REALTIME] Keeping external audio stream active')
    }
    mediaStreamRef.current = null
    externalStreamRef.current = false
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsTranscribing(false)
    setIsPaused(false)
    isPausedRef.current = false
  }, [])

  const pause = useCallback(() => {
    console.log('[REALTIME] Pausing transcription')
    isPausedRef.current = true
    setIsPaused(true)
    setIsTranscribing(false)
  }, [])

  const resume = useCallback(() => {
    console.log('[REALTIME] Resuming transcription')
    isPausedRef.current = false
    setIsPaused(false)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTranscribing(true)
    }
  }, [])

  const clearTranscripts = useCallback(() => {
    setTranscripts([])
    startTimeRef.current = Date.now()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    transcripts,
    isConnected,
    isTranscribing,
    isPaused,
    error,
    connect,
    disconnect,
    pause,
    resume,
    clearTranscripts
  }
}
