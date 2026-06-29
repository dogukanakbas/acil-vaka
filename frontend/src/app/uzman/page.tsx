'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, Stethoscope, User, Bot, ArrowRight, LogOut } from 'lucide-react';
import { Toaster, toast } from 'sonner';

type ChatHistory = {
  role: 'user' | 'assistant';
  content: string;
};

type ExpertReview = {
  id: number;
  doctor_note: string;
  expert_response?: string | null;
  urgency?: string | null;
  is_resolved?: boolean;
  created_at: string;
  history: ChatHistory[];
};

export default function UzmanPaneli() {
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (!token) {
      router.push('/login');
    } else if (role !== 'expert') {
      router.push('/chat');
    } else {
      fetchReviews(activeTab);
    }
  }, [router, activeTab]);

  const fetchReviews = async (tab: 'pending' | 'resolved' = activeTab) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const isResolved = tab === 'resolved';
      const res = await fetch(`/api/expert-reviews?resolved=${isResolved}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) router.push('/login');
        throw new Error('Yetkisiz');
      }
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      toast.error('Vakalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (id: number, val: string) => {
    setResponses(prev => ({ ...prev, [id]: val }));
  };

  const submitAnswer = async (id: number) => {
    const answer = responses[id];
    if (!answer?.trim()) {
      toast.error('Lütfen uzman yanıtı girin.');
      return;
    }
    
    setSubmitting(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/expert-reviews/${id}/answer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ expert_response: answer })
      });
      
      if (res.ok) {
        toast.success('Yanıt kaydedildi.');
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        toast.error('Yanıt kaydedilemedi.');
      }
    } catch (e) {
      toast.error('Sunucu hatası.');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <div className="flex h-screen bg-zinc-950 text-white items-center justify-center">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4 md:p-8 font-sans">
      <Toaster theme="dark" position="top-center" />
      
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-4 pb-4 border-b border-zinc-800">
          <div className="bg-amber-500/20 p-3 rounded-full text-amber-400">
            <AlertTriangle size={32} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">Uzman Hekim Paneli</h1>
            <p className="text-zinc-400">Danışılan zorlu vakalar ve klinik değerlendirmeler</p>
          </div>
          <Button 
            variant="outline" 
            className="border-zinc-700 text-zinc-300 hover:text-red-400 hover:bg-zinc-800"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('role');
              router.push('/login');
            }}
          >
            <LogOut size={16} className="mr-2" />
            Çıkış Yap
          </Button>
        </header>

        {/* Tabs Control */}
        <div className="flex border-b border-zinc-800 gap-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Bekleyen Vakalar {activeTab === 'pending' && `(${reviews.length})`}
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'resolved'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Değerlendirilen Vakalar (Arşiv) {activeTab === 'resolved' && `(${reviews.length})`}
          </button>
        </div>

        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
            <CheckCircle size={64} className="text-emerald-500/50" />
            <p className="text-lg">
              {activeTab === 'pending' 
                ? 'Bekleyen vaka değerlendirmesi bulunmuyor.' 
                : 'Henüz vaka değerlendirmesi yapılmamış.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {reviews.map(review => (
              <Card key={review.id} className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
                <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-amber-500 flex items-center gap-2">
                      <Stethoscope size={20} /> Vaka No: {review.id}
                    </CardTitle>
                    <CardDescription className="text-zinc-400 mt-1 flex items-center gap-2">
                      <Clock size={14} /> {new Date(review.created_at).toLocaleString('tr-TR')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      review.urgency === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      review.urgency === 'yellow' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {review.urgency === 'red' ? '🔴 Kırmızı Kod' :
                       review.urgency === 'yellow' ? '🟡 Sarı Kod' :
                       '🟢 Yeşil Kod'}
                    </div>
                    {activeTab === 'resolved' && (
                      <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/20">
                        ✓ Değerlendirildi
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Chat History Column */}
                    <div className="p-6 border-b lg:border-b-0 lg:border-r border-zinc-800 max-h-[500px] overflow-y-auto bg-zinc-950/30">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        Vaka Geçmişi
                      </h3>
                      <div className="space-y-4">
                        {review.history.map((msg, idx) => (
                          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`mt-1 rounded-full p-1.5 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>
                            <div className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none' : 'bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-tl-none'}`}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Expert Review Column */}
                    <div className="p-6 flex flex-col gap-6">
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700">
                        <h3 className="text-sm font-bold text-amber-500 mb-2">Pratisyen Hekim Notu:</h3>
                        <p className="text-zinc-200 text-sm italic">"{review.doctor_note}"</p>
                      </div>

                      <div className="flex-1 flex flex-col gap-3">
                        <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Uzman Değerlendirmesi</label>
                        {activeTab === 'resolved' ? (
                          <div className="flex-1 min-h-[200px] bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm whitespace-pre-wrap select-text">
                            {review.expert_response || 'Değerlendirme notu boş bırakılmış.'}
                          </div>
                        ) : (
                          <>
                            <textarea
                              className="flex-1 min-h-[200px] bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none resize-none"
                              placeholder="Bu vakadaki pratisyen hekime ve yapay zekanın önerisine dair uzman yorumunuzu buraya yazın..."
                              value={responses[review.id] || ''}
                              onChange={(e) => handleResponseChange(review.id, e.target.value)}
                            />
                            <Button 
                              onClick={() => submitAnswer(review.id)}
                              disabled={submitting === review.id}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-12 rounded-xl mt-2"
                            >
                              {submitting === review.id ? 'Kaydediliyor...' : 'Değerlendirmeyi Gönder'} <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
