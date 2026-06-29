'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Bot, User, Stethoscope, ThumbsUp, ThumbsDown, HelpCircle, AlertTriangle, LogOut, MessageSquare, Plus, Menu, X, Paperclip, ImageIcon, XCircle, Database, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster, toast } from 'sonner';

type ExpertReview = {
  id: number;
  doctor_note: string;
  expert_response: string | null;
  is_resolved: boolean;
  created_at: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string | null;
  feedback?: 'positive' | 'negative' | null;
  expert_review?: ExpertReview | null;
};

type Session = {
  id: string;
  title: string;
  created_at: string;
};

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Merhaba doktor bey/hanım. Ben Acil Vaka Asistanı. Bugünkü nöbetinizde size nasıl yardımcı olabilirim? Vakalarla ilgili danışmak istediğiniz belirtileri yazabilir veya analiz için röntgen/tahlil fotoğrafları yükleyebilirsiniz.',
};

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [reviewMessageId, setReviewMessageId] = useState<string | null>(null);
  const [expertNote, setExpertNote] = useState('');
  
  const [visionModel, setVisionModel] = useState('gpt-4o');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchSessions();
    }
  }, [router]);

  const loadSession = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/chat/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setSessionId(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (e) {
      toast.error('Sohbet yüklenemedi.');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    if (sessionParam) {
      loadSession(sessionParam);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionId);
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url.toString());
    }
  }, [sessionId]);

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([WELCOME_MESSAGE]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    let base64Image = null;
    if (selectedImage) {
      base64Image = await fileToBase64(selectedImage);
    }

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input || 'Lütfen bu görseli inceleyin.',
      image_url: imagePreview
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    const sentInput = input;
    setInput('');
    removeImage();
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
          message: sentInput || 'Lütfen bu görseli inceleyin.',
          session_id: sessionId,
          image_base64: base64Image,
          vision_model: visionModel
        }),
      });

      const data = await response.json();

      if (response.status === 403) {
        toast.error('Geri Bildirim Gerekli', {
          description: data.detail || 'Lütfen önceki AI yanıtlarına geri bildirim (👍/👎) verin.',
          duration: 5000,
        });
        setMessages((prev) => prev.slice(0, -1));
        setInput(sentInput);
        if (base64Image) setImagePreview(base64Image);
        return;
      }

      if (!response.ok) throw new Error(data.detail || 'API hatası');

      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
        fetchSessions();
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
        
        // Update local state to immediately show the pending review
        setMessages(prev => prev.map(m => m.id === reviewMessageId ? {
          ...m,
          expert_review: {
            id: 0,
            doctor_note: expertNote,
            expert_response: null,
            is_resolved: false,
            created_at: new Date().toISOString()
          }
        } : m));

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
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans overflow-hidden">
      <Toaster theme="dark" position="top-center" />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <Button 
            onClick={handleNewChat}
            className="flex-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-none justify-start gap-2"
          >
            <Plus size={18} />
            Yeni Sohbet
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden ml-2 text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-zinc-500 mb-2 px-2 uppercase tracking-wider">Geçmiş Sohbetler</div>
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => loadSession(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors text-sm
                ${sessionId === session.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
              `}
            >
              <MessageSquare size={16} className={sessionId === session.id ? 'text-emerald-500' : ''} />
              <span className="truncate flex-1">{session.title}</span>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-zinc-500 text-sm px-2 italic">Geçmiş sohbet bulunamadı.</div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 space-y-2">
          <div className="space-y-2 mb-4">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">Görüntü İşleme Yapay Zekası</label>
            <Select value={visionModel} onValueChange={(val) => val && setVisionModel(val)}>
              <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-300">
                <SelectValue placeholder="Model Seçin" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                <SelectItem value="gpt-4o">OpenAI GPT-4o</SelectItem>
                <SelectItem value="gemini-1.5-pro">Google Gemini Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {typeof window !== 'undefined' && localStorage.getItem('role') === 'admin' && (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
              onClick={() => router.push('/admin/knowledge')}
            >
              <Database size={18} className="text-blue-500" />
              Bilgi Bankası
            </Button>
          )}

          <Button 
            variant="ghost" 
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-2"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('role');
              router.push('/login');
            }}
          >
            <LogOut size={18} />
            Çıkış Yap
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 relative h-full">
        <header className="h-16 flex items-center gap-4 px-4 border-b border-zinc-800 bg-zinc-900/50">
          <Button variant="ghost" size="icon" className="md:hidden text-zinc-400 hover:text-white" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </Button>
          <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400 hidden md:flex">
            <Stethoscope size={20} />
          </div>
          <div className="flex-1 truncate">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">Acil Vaka Asistanı</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-0 overflow-hidden relative z-0">
          <div ref={scrollRef} className="flex-1 p-4 md:p-6 w-full max-w-4xl mx-auto overflow-y-auto">
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
                  <div className={`flex flex-col gap-2 max-w-[90%] md:max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-5 py-3 text-sm md:text-base leading-relaxed shadow-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-blue-600/90 text-white rounded-tr-sm'
                          : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                      }`}
                    >
                      {m.image_url && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-zinc-700 max-w-sm">
                          <img src={m.image_url} alt="Vaka Görseli" className="w-full object-cover" />
                        </div>
                      )}
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
                        {!m.expert_review && (
                          <button 
                            onClick={() => setReviewMessageId(m.id)}
                            className="ml-2 flex items-center gap-1.5 text-xs font-medium text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10 px-2.5 py-1.5 rounded-md transition-colors"
                          >
                            <HelpCircle size={14} />
                            <span>Uzmana Sor</span>
                          </button>
                        )}
                      </div>
                    )}
                    {m.expert_review && (
                      m.expert_review.is_resolved ? (
                        <div className="w-full mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                              <Stethoscope size={16} />
                              <span>Uzman Hekim Değerlendirmesi</span>
                            </div>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(m.expert_review.created_at).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-400 italic">
                              <span className="font-semibold text-zinc-300 not-italic">Sizin Notunuz: </span>
                              "{m.expert_review.doctor_note}"
                            </p>
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                              {m.expert_review.expert_response}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                            <Clock size={16} className="animate-pulse" />
                            <span>Uzman İncelemesi Bekleniyor</span>
                          </div>
                          <p className="text-xs text-zinc-400 italic">
                            <span className="font-semibold text-zinc-300 not-italic">İletilen Hekim Notu: </span>
                            "{m.expert_review.doctor_note}"
                          </p>
                        </div>
                      )
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
          
          <div className="p-4 bg-zinc-950 z-10 w-full max-w-4xl mx-auto">
            {imagePreview && (
              <div className="mb-3 inline-flex items-start relative group bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 shadow-sm">
                <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                <button 
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-zinc-800 text-zinc-300 hover:text-red-400 hover:bg-zinc-700 rounded-full p-0.5 shadow-md transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            )}
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2 items-end"
            >
              <div className="relative flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg z-10"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={20} />
                </Button>
                <Input
                  placeholder="Vaka bilgilerini yazın veya görsel ekleyin..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/50 h-12 rounded-xl text-base pl-12 pr-4 shadow-inner"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-12 px-6 rounded-xl transition-all shadow-md shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

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
