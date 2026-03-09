'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { PartyPopper, Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log("Attempting login for:", email);

        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            console.log("Login result:", { data, error: loginError });

            if (loginError) {
                setError(loginError.message);
                setLoading(false);
                return;
            }

            console.log("Login successful, redirecting to /dashboard");

            // Force a hard refresh/navigation to ensure middleware and session are in sync
            window.location.href = '/dashboard';

        } catch (err: any) {
            console.error("Caught error during login:", err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[#FDFDFD] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            {/* Background elements to match landing page */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
            <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-indigo-50/50 via-purple-50/20 to-transparent pointer-events-none z-0"></div>

            <div className="w-full max-w-md relative z-10 fade-in zoom-in-95 duration-500 animate-in">
                <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col items-center mb-6 sm:mb-8">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-4">
                            <PartyPopper size={24} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center">Welcome back</h1>
                        <p className="text-sm sm:text-base text-slate-500 mt-1.5 sm:mt-2 font-medium text-center">Access your PartyShop dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                        {error && (
                            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-xs sm:text-sm font-medium animate-shake">
                                <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-semibold text-slate-700 ml-1">Email address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Mail size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-slate-900 text-sm sm:text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs sm:text-sm font-semibold text-slate-700">Password</label>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-11 sm:h-12 pl-10 sm:pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-slate-900 text-sm sm:text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 sm:h-12 flex items-center justify-center gap-2 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-xl sm:rounded-2xl font-bold transition-all hover:brightness-110 shadow-[0_8px_16px_-6px_rgba(99,102,241,0.5)] active:scale-95 disabled:opacity-70 disabled:pointer-events-none mt-4 sm:mt-6 text-sm sm:text-base"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin sm:w-5 sm:h-5" />
                            ) : (
                                <>
                                    Log in
                                    <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm font-medium text-slate-400">
                    &copy; {new Date().getFullYear()} PartyShopPOS. Private access only.
                </p>
            </div>
        </div>
    );
}
