'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Stethoscope } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('doctor');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Kayıt başarılı!', { description: 'Şimdi giriş yapabilirsiniz.', duration: 3000 });
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        toast.error('Kayıt başarısız', { description: data.detail });
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
          <div className="mx-auto bg-blue-500/20 p-4 rounded-full text-blue-400 w-16 h-16 flex items-center justify-center">
            <Stethoscope size={32} />
          </div>
          <div>
            <CardTitle className="text-2xl text-zinc-100">Kayıt Ol</CardTitle>
            <CardDescription className="text-zinc-400 mt-2">
              Acil Vaka Asistanını kullanmak için hesap oluşturun.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
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
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Hesap Türü</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 h-12 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="doctor">Pratisyen Hekim</option>
                <option value="expert">Uzman Hekim (Panel Yetkilisi)</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">Not: Uzman hekim hesabı açarak paneli test edebilirsiniz.</p>
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-base mt-2"
            >
              {loading ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-zinc-500">
            Zaten hesabınız var mı?{' '}
            <button onClick={() => router.push('/login')} className="text-blue-400 hover:underline">
              Giriş Yap
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
