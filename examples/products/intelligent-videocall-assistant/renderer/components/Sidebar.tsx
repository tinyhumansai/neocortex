'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, BookOpen, Users, Settings, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
    { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'knowledge-base', href: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
    { id: 'interview', href: '/interview', icon: Users, label: 'Interview' },
    { id: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ active }: { active: string }) {
    const pathname = usePathname();

    return (
        <div className="w-[72px] h-screen glass border-r border-white/5 flex flex-col items-center py-5 gap-2 flex-shrink-0">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                      flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-white" />
            </div>

            {/* Nav */}
            {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => {
                const isActive = active === id || pathname.startsWith(href);
                return (
                    <Link key={id} href={href} className="relative group">
                        <motion.div
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                            className={clsx(
                                'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                                isActive
                                    ? 'bg-indigo-500/25 text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeIndicator"
                                    className="absolute left-0 w-0.5 h-6 bg-indigo-500 rounded-r-full -translate-x-3"
                                />
                            )}
                            <Icon className="w-5 h-5" />
                        </motion.div>
                        {/* Tooltip */}
                        <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 pointer-events-none
                            opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="glass rounded-lg px-2.5 py-1.5 text-xs text-white whitespace-nowrap">
                                {label}
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
