'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import SideNav from './SideNav'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loadUser, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
             const token = localStorage.getItem('access_token')
             
             if (!token) {
                 if (mounted) router.replace('/login')
                 return
             }
             
             try {
                if (!user) {
                   await loadUser()
                }
             } catch (e) {
                 console.error("Auth check failed:", e)
                 if (mounted) router.replace('/login')
             } finally {
                 if (mounted) setIsChecking(false)
             }
        }
        
        checkAuth()

        return () => { mounted = false }
    }, [pathname]) // Only run on mount or pathname change

    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
                    <p className="text-slate-600 font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="bg-slate-50 min-h-screen">
            <SideNav />
            <main className="lg:pl-72 py-10 px-4 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    )
}
