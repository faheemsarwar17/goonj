import { RecordingProvider } from '@/lib/contexts/RecordingContext'

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RecordingProvider>
      {children}
    </RecordingProvider>
  )
}
