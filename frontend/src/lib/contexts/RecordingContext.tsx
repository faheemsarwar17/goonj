'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface RecordingContextType {
  micStream: MediaStream | null
  screenStream: MediaStream | null
  setMicStream: (stream: MediaStream | null) => void
  setScreenStream: (stream: MediaStream | null) => void
  clearStreams: () => void
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined)

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

  const clearStreams = () => {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop())
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop())
    }
    setMicStream(null)
    setScreenStream(null)
  }

  return (
    <RecordingContext.Provider value={{ micStream, screenStream, setMicStream, setScreenStream, clearStreams }}>
      {children}
    </RecordingContext.Provider>
  )
}

export function useRecordingContext() {
  const context = useContext(RecordingContext)
  if (context === undefined) {
    throw new Error('useRecordingContext must be used within a RecordingProvider')
  }
  return context
}
