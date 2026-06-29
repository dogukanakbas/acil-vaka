'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Trash2, FileText, ArrowLeft, Database, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';

interface KnowledgeFile {
  filename: string;
  size: string;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      router.push('/chat');
      return;
    }
    fetchFiles();
  }, [router]);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/knowledge/files`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      } else {
        toast.error('Dosyalar yüklenemedi.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.pdf')) {
      toast.error('Sadece PDF dosyaları yüklenebilir.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    const toastId = toast.loading('Dosya yükleniyor ve yapay zeka tarafından işleniyor (Bu işlem biraz sürebilir)...');

    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/knowledge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Dosya başarıyla sisteme işlendi.', { id: toastId });
        fetchFiles();
      } else {
        toast.error(data.detail || 'Yükleme sırasında hata oluştu.', { id: toastId });
      }
    } catch (error) {
      toast.error('Bağlantı hatası.', { id: toastId });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`${filename} dosyasını silmek istediğinize emin misiniz?`)) return;

    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/knowledge/files/${filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        toast.success('Dosya silindi.');
        fetchFiles();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Silme başarısız.');
      }
    } catch (error) {
      toast.error('Bağlantı hatası.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => router.push('/chat')}>
            <ArrowLeft size={20} className="mr-2" /> Sohbete Dön
          </Button>
          <div className="h-6 w-px bg-zinc-800" />
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Database className="text-blue-500" />
            Bilgi Bankası Yönetimi
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-zinc-900 border-zinc-800 md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>Yeni Rehber Ekle</CardTitle>
              <CardDescription className="text-zinc-400">
                Sistemin öğrenmesini istediğiniz PDF kılavuzlarını veya kitaplarını yükleyin. Yüklenen dosyalar anında yapay zeka hafızasına (Vektör Veritabanı) eklenecektir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors hover:border-blue-500/50 hover:bg-blue-500/5 group relative">
                <Input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="bg-zinc-950 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud size={32} className={isUploading ? "text-amber-500 animate-pulse" : "text-blue-500"} />
                </div>
                <p className="font-medium text-sm text-zinc-300">
                  {isUploading ? "İşleniyor..." : "PDF dosyasını seçin veya sürükleyin"}
                </p>
                <p className="text-xs text-zinc-500 mt-2">Maksimum dosya boyutu: 50MB</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 md:col-span-2">
            <CardHeader>
              <CardTitle>Yüklü Dosyalar</CardTitle>
              <CardDescription className="text-zinc-400">Sistem şu anda aşağıdaki kaynakları kullanarak hekimlere danışmanlık vermektedir.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-500 mr-3"></div>
                  Yükleniyor...
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                  <Search size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Bilgi bankasına henüz hiç dosya yüklenmemiş.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-red-500/10 p-3 rounded-lg text-red-500">
                          <FileText size={24} />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200">{file.filename}</p>
                          <p className="text-xs text-zinc-500">{file.size}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDelete(file.filename)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster theme="dark" />
    </div>
  );
}
