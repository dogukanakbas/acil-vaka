'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, BrainCircuit, Stethoscope, ShieldCheck, Activity, Zap } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans selection:bg-emerald-500/30">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
              <Stethoscope size={24} className="text-zinc-950" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
              Acil Vaka Asistanı
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/login')} className="text-sm font-medium text-zinc-300 hover:text-emerald-400 transition-colors hidden md:block">
              Giriş Yap
            </button>
            <Button onClick={() => router.push('/register')} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-6 shadow-lg shadow-emerald-900/50 transition-all hover:scale-105">
              Hemen Başla
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 relative">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] -z-10 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] -z-10" />

        <div className="max-w-5xl mx-auto text-center space-y-8 mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-4 animate-fade-in-up">
            <Zap size={16} className="fill-emerald-400" />
            <span>Llama 3.1 Teknolojisi ile Güçlendirildi</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            Acil Servisteki <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-500">
              Süper Zeki Asistanınız
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Gerçek vakalarla eğitilmiş, saniyeler içinde tanı önerileri sunan ve uzman hekimlerle anında iletişim kurmanızı sağlayan klinik karar destek sistemi.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <Button onClick={() => router.push('/register')} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white h-14 px-8 rounded-full text-lg shadow-xl shadow-emerald-900/20 transition-all hover:scale-105">
              Ücretsiz Deneyin <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button onClick={() => router.push('/login')} variant="outline" className="w-full sm:w-auto h-14 px-8 rounded-full text-lg border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all">
              Zaten hesabım var
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          
          {/* Feature 1 */}
          <div className="group relative p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/80 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] group-hover:bg-emerald-500/10 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
              <BrainCircuit className="text-emerald-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-3">RAG Destekli Zeka</h3>
            <p className="text-zinc-400 leading-relaxed">
              "Acilde 100 Vaka" kitabındaki binlerce klinik senaryoyu okuyup anlayan yapay zeka ile anında doğru referanslar alın.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group relative p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/80 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] group-hover:bg-amber-500/10 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
              <Stethoscope className="text-amber-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-3">Uzmana Sor Modülü</h3>
            <p className="text-zinc-400 leading-relaxed">
              Kararsız kaldığınız zorlu vakalarda tek bir tuşla uzman hekimlere danışın, anında ikinci bir görüş alın.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group relative p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/80 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] group-hover:bg-blue-500/10 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
              <ShieldCheck className="text-blue-400" size={28} />
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-3">Sürekli Gelişen Model</h3>
            <p className="text-zinc-400 leading-relaxed">
              Doktorların verdiği geri bildirimler (RLHF) sayesinde sistem her geçen gün daha doğru ve güvenilir yanıtlar üretir.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-zinc-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Activity size={18} className="text-emerald-500" />
            <span>Acil Vaka Asistanı © 2026. Tüm hakları saklıdır.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Gizlilik Politikası</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">İletişim</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
