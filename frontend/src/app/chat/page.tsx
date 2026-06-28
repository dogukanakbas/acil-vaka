'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, User, Stethoscope, ThumbsUp, ThumbsDown, HelpCircle, AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Toaster, toast } from 'sonner';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'positive' | 'negative' | null;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Merhaba doktor bey/hanım. Ben Acil Vaka Asistanı. Bugünkü nöbetinizde size nasıl yardımcı olabilirim? Vakalarla ilgili danışmak istediğiniz belirtileri veya tahlil sonuçlarını yazabilirsiniz.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [reviewMessageId, setReviewMessageId] = useState<string | null>(null);
  const [expertNote, setExpertNote] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: userMessage.content,
          session_id: sessionId
        }),
      });

      const data = await response.json();

      if (response.status === 403) {
        toast.error('Geri Bildirim Gerekli', {
          description: data.detail || 'Lütfen önceki AI yanıtlarına geri bildirim (👍/👎) verin.',
          duration: 5000,
        });
        setMessages((prev) => prev.slice(0, -1));
        setInput(userMessage.content);
        return;
      }

      if (!response.ok) throw new Error(data.detail || 'API hatası');

      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
      }

      setMessages((prev) => [
        ...prev,
        { id: data.message_id, role: 'assistant', content: data.response, feedback: null },
      ]);
    } catch (error: any) {
      console.error(error);
      toast.error('Hata oluştu', { description: error.message });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Üzgünüm, şu an sisteme bağlanamıyorum. Lütfen daha sonra tekrar deneyin.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message_id: messageId, is_positive: isPositive }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: isPositive ? 'positive' : 'negative' } : m));
        toast.success(isPositive ? 'Beğeniniz kaydedildi.' : 'Geri bildiriminiz alındı.', {
          description: 'Sistemi geliştirmemize yardımcı olduğunuz için teşekkürler.'
        });
      }
    } catch (e) {
      toast.error('Geri bildirim gönderilemedi.');
    }
  };

  const handleExpertSubmit = async () => {
    if (!reviewMessageId || !expertNote.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/expert-review', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message_id: reviewMessageId, doctor_note: expertNote }),
      });
      if (res.ok) {
        toast.success('Talep Gönderildi', { description: 'Vakanız ilgili uzman hekim paneline düşmüştür.' });
        setReviewMessageId(null);
        setExpertNote('');
      } else {
        toast.error('Talep gönderilemedi.');
      }
    } catch (e) {
      toast.error('Talep gönderilemedi.');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 items-center justify-center p-4 md:p-8 font-sans">
      <Toaster theme="dark" position="top-center" />
      <Card className="w-full max-w-4xl h-full flex flex-col bg-zinc-900 border-zinc-800 shadow-2xl relative overflow-hidden">
        <CardHeader className="border-b border-zinc-800 bg-zinc-950/50 flex flex-row items-center gap-4 py-4 z-10">
          <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400">
            <Stethoscope size={28} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl md:text-2xl text-zinc-100">Acil Vaka Asistanı</CardTitle>
            <CardDescription className="text-zinc-400">
              Yapay Zeka Destekli Klinik Karar Sistemi
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('role');
              router.push('/login');
            }}
          >
            <LogOut size={20} />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative z-0">
          <div ref={scrollRef} className="flex-1 p-4 md:p-6 w-full overflow-y-auto">
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-4 ${
                    m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <Avatar className={m.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600 mt-1'}>
                    <AvatarFallback>{m.role === 'user' ? <User size={20} /> : <Bot size={20} />}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[75%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-blue-600/90 text-white rounded-tr-sm'
                          : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === 'assistant' && m.id !== 'welcome' && (
                      <div className="flex items-center gap-2 pl-2">
                        <button 
                          onClick={() => handleFeedback(m.id, true)}
                          className={`p-1.5 rounded-md transition-colors ${m.feedback === 'positive' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800'}`}
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <button 
                          onClick={() => handleFeedback(m.id, false)}
                          className={`p-1.5 rounded-md transition-colors ${m.feedback === 'negative' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'}`}
                        >
                          <ThumbsDown size={16} />
                        </button>
                        <button 
                          onClick={() => setReviewMessageId(m.id)}
                          className="ml-2 flex items-center gap-1.5 text-xs font-medium text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10 px-2.5 py-1.5 rounded-md transition-colors"
                        >
                          <HelpCircle size={14} />
                          <span>Uzmana Sor</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-4 flex-row">
                  <Avatar className="bg-emerald-600 mt-1">
                    <AvatarFallback><Bot size={20} /></AvatarFallback>
                  </Avatar>
                  <div className="bg-zinc-800 rounded-2xl px-5 py-4 max-w-[75%] rounded-tl-sm flex gap-1.5 items-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 z-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-3 max-w-4xl mx-auto"
            >
              <Input
                placeholder="Vaka bilgilerini veya semptomları yazın..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 h-12 rounded-xl text-base px-4"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-12 px-6 rounded-xl transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!reviewMessageId} onOpenChange={(open) => !open && setReviewMessageId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle size={20} /> Vakayı Uzmana Yönlendir
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Bu vakanın çözümü için bir uzman hekimin görüşüne ihtiyacınız varsa, lütfen notunuzu aşağıya ekleyerek gönderin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
              placeholder="Örnek: Hastanın laboratuvar sonuçlarında x değeri yüksek geldi, yapay zekanın önerisinden emin olamadım..."
              value={expertNote}
              onChange={(e) => setExpertNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="hover:bg-zinc-800 text-zinc-300" onClick={() => setReviewMessageId(null)}>İptal</Button>
            <Button onClick={handleExpertSubmit} className="bg-amber-600 hover:bg-amber-500 text-white">Gönder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
