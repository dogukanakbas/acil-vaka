'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Stethoscope } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        
        toast.success('Giriş başarılı!', { duration: 2000 });
        
        setTimeout(() => {
          if (data.role === 'expert') {
            router.push('/uzman');
          } else {
            router.push('/chat');
          }
        }, 1000);
      } else {
        toast.error('Giriş başarısız', { description: data.detail });
      }
    } catch (err) {
      toast.error('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 items-center justify-center p-4">
      <Toaster theme="dark" position="top-center" />
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-emerald-500/20 p-4 rounded-full text-emerald-400 w-16 h-16 flex items-center justify-center">
            <Stethoscope size={32} />
          </div>
          <div>
            <CardTitle className="text-2xl text-zinc-100">Giriş Yap</CardTitle>
            <CardDescription className="text-zinc-400 mt-2">
              Acil Vaka Asistanına erişmek için e-posta ve şifrenizi girin.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">E-Posta</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-700 text-zinc-100 h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Şifre</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-700 text-zinc-100 h-12 rounded-xl"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-12 rounded-xl text-base mt-2"
            >
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-zinc-500">
            Hesabınız yok mu?{' '}
            <button onClick={() => router.push('/register')} className="text-emerald-400 hover:underline">
              Kayıt Ol
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
