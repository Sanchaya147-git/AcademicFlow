'use client';
import { useAuth } from '@/components/auth-provider';
import { ClassroomHub } from '@/components/classroom-hub';
import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ClassroomsPage() {
  const { user } = useAuth();
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
      <ClassroomHub
        user={user}
        onOpenVoiceCall={() => {}}
        onNotify={setNotice}
        onError={setError}
      />
    </div>
  );
}
