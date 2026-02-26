'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Sessions', href: '/sessions', icon: MicrophoneIcon },
  { name: 'Transcripts', href: '/transcripts', icon: DocumentTextIcon },
  { name: 'Speakers', href: '/speakers', icon: UserGroupIcon },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function SideNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-200 bg-white px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center gap-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold">AT</span>
            </div>
            <span className="text-lg font-semibold text-slate-900">Audio Transcript</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={classNames(
                          isActive
                            ? 'bg-slate-50 text-primary-600'
                            : 'text-slate-700 hover:text-primary-600 hover:bg-slate-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                      >
                        <item.icon
                          className={classNames(
                            isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-primary-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            
            <li className="mt-auto">
                <div className="flex items-center gap-x-4 py-3 text-sm font-semibold leading-6 text-slate-900 hover:bg-slate-50 rounded-md -mx-2 px-2">
                    <div className='h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500'>
                        {user?.full_name?.charAt(0) || 'U'}
                    </div>
                    <span className="sr-only">Your profile</span>
                    <div className="flex flex-col">
                        <span aria-hidden="true">{user?.full_name}</span>
                        <span className="text-xs text-slate-500 font-normal">{user?.email}</span>
                    </div>
                </div>
                <button
                    onClick={() => logout()}
                    className="w-full mt-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 p-2 rounded-md transition-colors"
                >
                    Sign out
                </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

function HomeIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function MicrophoneIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
    )
}

function DocumentTextIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    )
}

function UserGroupIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 01-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 5.472m0 0a9.094 9.094 0 00-4.962.875 3 3 0 004.682 2.72 6.09 6.09 0 01-3.74-3.198" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    )
}
