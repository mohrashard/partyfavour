import { supabase } from './lib/supabase';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  Package,
  TrendingUp,
  Printer,
  BarChart3,
  ArrowRight,
  Sparkles,
  PartyPopper
} from 'lucide-react';

export const metadata: Metadata = {
  title: "Party Favour | Modern Shop POS",
  description: "All-in-one POS and inventory system for party supplies.",
  icons: {
    icon: "/logo.png",
  },
};

export default async function Home() {
  const { data, error } = await supabase.from('inventory').select('*');
  const isConnected = !error;

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative">

      {/* Modern Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      {/* Subtle Top Glow */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-indigo-50/50 via-purple-50/20 to-transparent pointer-events-none z-0"></div>

      {/* Glassmorphism Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300 backdrop-blur-md bg-white/60 border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center justify-center">
              <img src="/logo.png" alt="Party Favour Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900">
              Party <span className="text-indigo-600">Favour</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">How it works</Link>
            <Link href="#pricing" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center">
            <Link
              href="/login"
              className="h-9 sm:h-10 px-4 sm:px-6 flex items-center justify-center bg-slate-900 text-white rounded-full text-xs sm:text-sm font-semibold transition-all hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95"
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32 pt-24 sm:pt-32">

        {/* Hero Section */}
        <section className="flex flex-col items-center text-center pt-4 sm:pt-8 pb-16 sm:pb-20">

          {/* Version Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] text-[11px] sm:text-sm font-medium text-slate-600 mb-6 sm:mb-8 hover:bg-slate-50 transition-colors cursor-pointer group">
            <Sparkles size={14} className="text-indigo-500 hidden sm:block" />
            <Sparkles size={12} className="text-indigo-500 sm:hidden" />
            <span className="tracking-wide">Introducing v1.0</span>
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ml-0.5 sm:ml-1 group-hover:bg-indigo-200 transition-colors">New</span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.5rem] leading-[1.1] sm:text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-5 sm:mb-6 max-w-4xl">
            Manage your party shop.<br />
            <span className="relative whitespace-nowrap">
              <span className="absolute -inset-1 blur-lg bg-indigo-100/50 rounded-2xl"></span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600">
                With ultimate clarity.
              </span>
            </span>
          </h1>

          <p className="max-w-xl md:max-w-2xl text-base sm:text-lg text-slate-500 mb-8 sm:mb-10 leading-relaxed px-2">
            The all-in-one POS and inventory system designed to track sales, calculate profits instantly, and print customer bills. Perfectly tailored for party supplies.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0">
            <Link
              href="/login"
              className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-10 flex items-center justify-center gap-2 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white rounded-full text-sm sm:text-base font-semibold transition-all hover:brightness-110 shadow-[0_8px_16px_-6px_rgba(99,102,241,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-[0.98]"
            >
              Log In
              <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            </Link>
          </div>
        </section>

        {/* Beautiful Floating UI Element Layout - Bento Grid */}
        <section id="features" className="mt-2 sm:mt-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">

            {/* Wide Card 1: Smart Inventory */}
            <div className="md:col-span-8 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
              {/* Decorative Blur */}
              <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

              <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner group-hover:scale-110 transition-transform duration-500">
                  <Package size={24} className="text-indigo-600 sm:w-[26px] sm:h-[26px]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2 sm:mb-3">Smart Inventory Management</h3>
                  <p className="text-slate-500 text-sm sm:text-lg leading-relaxed max-w-lg">
                    Add and track items like balloons, candles, and decorations in real-time. Low-stock alerts ensure you never miss a sale during peak party seasons.
                  </p>
                </div>
              </div>
            </div>

            {/* Square Card 1: Profit Tracking */}
            <div className="md:col-span-4 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
              <div className="absolute -top-10 -right-10 w-32 sm:w-40 h-32 sm:h-40 bg-emerald-50/50 rounded-full blur-3xl"></div>

              <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center border border-emerald-100 shadow-inner group-hover:-translate-y-1 transition-transform duration-300">
                  <TrendingUp size={20} className="text-emerald-600 sm:w-[22px] sm:h-[22px]" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1.5 sm:mb-2">Auto-Profit Tracking</h3>
                  <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                    Instantly calculates margins on every sale. Know your exact take-home pay at a glance.
                  </p>
                </div>
              </div>
            </div>

            {/* Square Card 2: Thermal Printing */}
            <div className="md:col-span-5 bg-white/70 backdrop-blur-xl p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 sm:w-32 h-24 sm:h-32 bg-amber-50/50 rounded-full blur-2xl"></div>

              <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center border border-amber-100 shadow-inner group-hover:rotate-6 transition-transform duration-300">
                  <Printer size={20} className="text-amber-600 sm:w-[22px] sm:h-[22px]" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1.5 sm:mb-2">Native Thermal Printing</h3>
                  <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                    Hook up your standard 80mm printer and push beautiful receipts directly from the web client.
                  </p>
                </div>
              </div>
            </div>

            {/* Wide Card 2: Financial Dashboard */}
            <div className="md:col-span-7 bg-slate-900 p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
              {/* Subtle mesh background for dark card */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-indigo-500/20 to-transparent pointer-events-none"></div>

              <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors duration-300">
                  <BarChart3 size={24} className="text-indigo-300 sm:w-[26px] sm:h-[26px]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2 sm:mb-3">Financial Dashboard</h3>
                  <p className="text-slate-400 text-sm sm:text-lg leading-relaxed max-w-md">
                    View daily, weekly, and monthly revenue metrics. Generate gorgeous, structured PDF reports to hand off to your accountant.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Structured Minimal Footer */}
      <footer className="w-full border-t border-slate-200/60 bg-slate-50/50 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Party Favour Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-800">Party Favour</span>
          </div>

          <div className="flex gap-6 sm:gap-8">
            <Link href="https://www.mohamedrashard.dev/labs" target="_blank" className="text-xs sm:text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1">
              Built by Mr² Labs
            </Link>
            <span className="text-xs sm:text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer">Support</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 font-medium w-full sm:w-auto text-center sm:text-right mt-2 sm:mt-0">
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}