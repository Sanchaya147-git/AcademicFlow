'use client';
import { useAuth } from '@/components/auth-provider';
import { PlanGenerator } from '@/components/plan-generator';
import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PlanGeneratorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} /> <span>{notice}</span>
          <button onClick={() => setNotice('')} className="ml-auto font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} /> <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto font-bold">×</button>
        </div>
      )}
      <PlanGenerator
        user={user}
        onPlanPublished={() => {
          setNotice('Academic plan published successfully and synchronized to Master Excel!');
          setTimeout(() => router.push('/activities'), 1500);
        }}
        onNotify={setNotice}
        onError={setError}
      />
    </div>
  );
}
