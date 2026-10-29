import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AudioLines, Check, CheckCircle2, CreditCard, Globe2, KeyRound,
  Languages, LockKeyhole, Palette, Play, Plus, Save, Search, Settings2,
  ShieldCheck, Store, Trash2, Upload, Users, X, XCircle, Eye, EyeOff,
} from 'lucide-react';

type SubscriptionStatus = 'pending' | 'active' | 'rejected';
type Subscription = {
  id: string; customer: string; store: string; plan: string; amount: string;
  method: 'BaridiMob' | 'Edahabia'; transactionId: string; status: SubscriptionStatus;
  submittedAt: string;
};
type VoiceSample = { id: string; name: string; text: string; fileName: string; url: string; type: string };

const initialSubscriptions: Subscription[] = [
  { id: 'SUB-1001', customer: 'مسؤول متجر SunVera Jolie', store: 'SunVera Jolie', plan: 'Pro شهري', amount: '2,500 دج', method: 'BaridiMob', transactionId: 'DEMO-BARIDI-001', status: 'pending', submittedAt: 'اليوم، 10:35' },
  { id: 'SUB-1002', customer: 'متجر تجريبي', store: 'متجر العناية والجمال', plan: 'Starter شهري', amount: '1,200 دج', method: 'Edahabia', transactionId: 'DEMO-EDAHABIA-002', status: 'active', submittedAt: 'أمس، 16:20' },
  { id: 'SUB-1003', customer: 'عميل تجريبي', store: 'DZ Cosmetics', plan: 'Pro شهري', amount: '2,500 دج', method: 'BaridiMob', transactionId: 'DEMO-BARIDI-003', status: 'rejected', submittedAt: '26 أكتوبر' },
];

const modelOptions = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — نصوص سريعة' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — تحليل متقدم' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — متوافق' },
];
const ttsOptions = [
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini Flash TTS' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini Pro TTS' },
];

const statusLabel: Record<SubscriptionStatus, string> = { pending: 'بانتظار التأكيد', active: 'مفعّل', rejected: 'مرفوض' };

export const AdminDashboard: React.FC = () => {
  const [section, setSection] = useState<'overview' | 'subscriptions' | 'voices' | 'settings'>('overview');
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [search, setSearch] = useState('');
  const [voiceName, setVoiceName] = useState('شاب عاصمي');
  const [voiceText, setVoiceText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [ttsModel, setTtsModel] = useState('gemini-2.5-flash-preview-tts');
  const [language, setLanguage] = useState('ar');
  const [theme, setTheme] = useState('indigo');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-ad-studio-admin-preferences');
      if (saved) {
        const prefs = JSON.parse(saved) as { aiModel?: string; ttsModel?: string; language?: string; theme?: string };
        if (prefs.aiModel) setAiModel(prefs.aiModel);
        if (prefs.ttsModel) setTtsModel(prefs.ttsModel);
        if (prefs.language) setLanguage(prefs.language);
        if (prefs.theme) setTheme(prefs.theme);
      }
    } catch { /* Ignore invalid local preferences. */ }
  }, []);

  const filteredSubscriptions = useMemo(() => subscriptions.filter((item) =>
    [item.customer, item.store, item.transactionId, item.method].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  ), [subscriptions, search]);

  const updateStatus = (id: string, status: SubscriptionStatus) => {
    setSubscriptions((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    setNotice('تم تحديث الحالة في هذه الجلسة فقط. اربط عمليات التأكيد بالخادم وقاعدة البيانات لتطبيقها فعليًا.');
  };

  const savePreferences = () => {
    localStorage.setItem('ai-ad-studio-admin-preferences', JSON.stringify({ aiModel, ttsModel, language, theme }));
    setNotice('تم حفظ تفضيلات الواجهة على هذا الجهاز فقط.');
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setNotice('أدخل المفتاح أولًا. لن يتم حفظه في المتصفح.');
      return;
    }
    setIsSavingKey(true);
    try {
      const response = await fetch('/api/admin/settings/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', apiKey: apiKey.trim() }),
      });
      if (!response.ok) throw new Error('الخادم الإداري غير مهيأ أو رفض الطلب.');
      setApiKey('');
      setNotice('تم إرسال المفتاح إلى الخادم بنجاح.');
    } catch {
      setNotice('لم يُحفظ المفتاح: لا يوجد مسار خادم إداري متصل حاليًا. لا تضع المفتاح في ملفات الواجهة أو GitHub.');
    } finally {
      setIsSavingKey(false);
    }
  };

  const saveSample = () => {
    if (!audioFile) { setNotice('اختر ملف WAV أو MP3 أولًا.'); return; }
    if (!/\\.(wav|mp3)$/i.test(audioFile.name) && !['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav'].includes(audioFile.type)) {
      setNotice('صيغة الملف غير مدعومة. استخدم WAV أو MP3.'); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sample: VoiceSample = {
        id: editingSampleId ?? crypto.randomUUID(),
        name: voiceName.trim() || 'صوت جديد',
        text: voiceText.trim(),
        fileName: audioFile.name,
        url: String(reader.result),
        type: audioFile.type || 'audio/mpeg',
      };
      setSamples((items) => editingSampleId ? items.map((item) => item.id === editingSampleId ? sample : item) : [sample, ...items]);
      setAudioFile(null);
      setVoiceText('');
      setEditingSampleId(null);
      setNotice('أضيفت العينة لهذه الجلسة فقط. لن تظهر للزوار حتى تربطها بخادم التخزين وواجهة الصفحة الرئيسية.');
    };
    reader.onerror = () => setNotice('تعذر قراءة الملف الصوتي.');
    reader.readAsDataURL(audioFile);
  };

  const editSample = (sample: VoiceSample) => {
    setEditingSampleId(sample.id);
    setVoiceName(sample.name);
    setVoiceText(sample.text);
    setNotice('للتعديل، اختر ملف الصوت مجددًا ثم احفظ.'); 
  };

  const navItems = [
    { id: 'overview' as const, label: 'نظرة عامة', icon: Activity },
    { id: 'subscriptions' as const, label: 'الاشتراكات والمدفوعات', icon: CreditCard },
    { id: 'voices' as const, label: 'العينات الصوتية', icon: AudioLines },
    { id: 'settings' as const, label: 'إعدادات الذكاء الاصطناعي', icon: Settings2 },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-bold text-indigo-200"><ShieldCheck size={14} /> غرفة عمليات المسؤول</div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">لوحة التحكم الإدارية</h1>
            <p className="mt-2 text-sm text-slate-400">إدارة الاشتراكات والأصوات وإعدادات المنصة من مكان واحد.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"><LockKeyhole size={15} /> وضع واجهة أولي — يحتاج ربطًا آمنًا بالخادم</div>
        </div>

        {notice && <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-4 py-3 text-sm text-indigo-100"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="إغلاق التنبيه"><X size={16} /></button></div>}

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="px-3 pb-3 pt-2 text-[11px] font-bold text-slate-500">الإدارة</p>
            <nav className="space-y-1">
              {navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold transition ${section === id ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon size={17} /><span>{label}</span></button>)}
            </nav>
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-6 text-slate-500">تنبيه: لا تعتبر بيانات العرض التجريبية معاملات مالية حقيقية. لا تؤكد أي تحويل قبل التحقق منه خارج المنصة.</div>
          </aside>

          <section className="min-w-0 space-y-5">
            {section === 'overview' && <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'كل الاشتراكات', value: subscriptions.length, detail: 'بيانات الجلسة الحالية', icon: Users },
                  { label: 'بانتظار المراجعة', value: subscriptions.filter((s) => s.status === 'pending').length, detail: 'تحتاج تحققًا يدويًا', icon: CreditCard },
                  { label: 'حسابات مفعّلة', value: subscriptions.filter((s) => s.status === 'active').length, detail: 'حالة محلية تجريبية', icon: CheckCircle2 },
                  { label: 'عينات صوتية', value: samples.length, detail: 'مضافة في هذه الجلسة', icon: AudioLines },
                ].map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-4 flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><Icon size={18} className="text-indigo-300" /></div><div className="text-3xl font-black">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div>)}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 font-bold"><Activity size={18} className="text-emerald-300" /> إجراءات سريعة</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button onClick={() => setSection('subscriptions')} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-right hover:border-indigo-400/50"><CreditCard className="mb-3 text-indigo-300" size={20} /><div className="font-bold">مراجعة المدفوعات</div><p className="mt-1 text-xs text-slate-400">مراجعة مراجع التحويلات</p></button>
                  <button onClick={() => setSection('voices')} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-right hover:border-indigo-400/50"><AudioLines className="mb-3 text-emerald-300" size={20} /><div className="font-bold">إدارة الأصوات</div><p className="mt-1 text-xs text-slate-400">إضافة ملفات WAV أو MP3</p></button>
                  <button onClick={() => setSection('settings')} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-right hover:border-indigo-400/50"><Settings2 className="mb-3 text-amber-300" size={20} /><div className="font-bold">إعدادات المنصة</div><p className="mt-1 text-xs text-slate-400">النماذج واللغة والمظهر</p></button>
                </div>
              </div>
            </>}

            {section === 'subscriptions' && <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
              <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">الاشتراكات والمدفوعات المحلية</h2><p className="mt-1 text-xs text-slate-400">راجع رقم العملية وتحقق من التحويل قبل اتخاذ القرار.</p></div><div className="relative"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث عن متجر أو رقم عملية" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-3 pr-9 text-sm outline-none focus:border-indigo-400 sm:w-64" /></div></div>
              <div className="space-y-3 p-4">
                {filteredSubscriptions.map((item) => <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-bold">{item.store}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : item.status === 'rejected' ? 'bg-red-400/10 text-red-300' : 'bg-amber-400/10 text-amber-200'}`}>{statusLabel[item.status]}</span><span className="text-xs text-slate-500">{item.id}</span></div><p className="text-sm text-slate-400">{item.customer} · {item.plan} · {item.amount}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>الطريقة: {item.method}</span><span>مرجع العملية: <b dir="ltr" className="font-mono text-slate-300">{item.transactionId}</b></span><span>{item.submittedAt}</span></div></div>
                    <div className="flex shrink-0 gap-2"><button onClick={() => updateStatus(item.id, 'active')} disabled={item.status === 'active'} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"><Check size={15} /> تفعيل الحساب</button><button onClick={() => updateStatus(item.id, 'rejected')} disabled={item.status === 'rejected'} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"><XCircle size={15} /> رفض</button></div>
                  </div>
                </article>)}
                {!filteredSubscriptions.length && <p className="p-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة.</p>}
              </div>
            </div>}

            {section === 'voices' && <div className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <h2 className="mb-1 flex items-center gap-2 font-bold"><Upload size={18} className="text-emerald-300" /> {editingSampleId ? 'تعديل عينة صوتية' : 'إضافة عينة صوتية'}</h2><p className="mb-5 text-xs text-slate-400">الصيغ المدعومة WAV وMP3. اكتب النص الذي يسمعه الزائر عند معاينة الصوت.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-300">اسم الشخصية<input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder="مثال: خبيرة إعلانات" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-indigo-400" /></label>
                  <label className="block text-sm font-semibold text-slate-300">ملف الصوت<input type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:px-3 file:py-2 file:text-indigo-200" />{audioFile && <span className="mt-1 block text-xs text-emerald-300">{audioFile.name}</span>}</label>
                  <label className="block text-sm font-semibold text-slate-300 md:col-span-2">النص الترويجي المنطوق<textarea value={voiceText} onChange={(e) => setVoiceText(e.target.value)} rows={3} placeholder="سلام، حبيت نوريكم منتوج جديد..." className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-indigo-400" /></label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><button onClick={saveSample} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold hover:bg-indigo-500"><Plus size={16} /> {editingSampleId ? 'حفظ التعديل' : 'إضافة العينة'}</button><button onClick={() => { setEditingSampleId(null); setAudioFile(null); setVoiceText(''); setVoiceName('شاب عاصمي'); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">مسح الحقول</button></div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="mb-4 font-bold">العينات الحالية ({samples.length})</h2>{samples.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">لم تُضف عينات في هذه الجلسة بعد.</div> : <div className="space-y-3">{samples.map((sample) => <article key={sample.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-bold">{sample.name}</div><p className="mt-1 text-xs text-slate-500">{sample.fileName}</p><p className="mt-2 text-sm text-slate-300">{sample.text || 'لا يوجد نص مرفق.'}</p></div><div className="flex gap-2"><button onClick={() => editSample(sample)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800">تعديل</button><button onClick={() => { setSamples((items) => items.filter((item) => item.id !== sample.id)); if (sample.url.startsWith('blob:')) URL.revokeObjectURL(sample.url); }} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10"><Trash2 size={14} /></button></div></div><audio controls preload="metadata" src={sample.url} className="mt-3 w-full" /></article>)}</div>}</div>
            </div>}

            {section === 'settings' && <div className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <h2 className="mb-1 flex items-center gap-2 font-bold"><Settings2 size={18} className="text-indigo-300" /> إعدادات النماذج</h2><p className="mb-5 text-xs text-slate-400">اختر النماذج المقترحة. التطبيق يحتاج خادمًا ليطبقها على طلبات التوليد.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-300">نموذج الذكاء الاصطناعي<select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">{modelOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                  <label className="text-sm font-semibold text-slate-300">نموذج توليد الصوت (TTS)<select value={ttsModel} onChange={(e) => setTtsModel(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">{ttsOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <h2 className="mb-1 flex items-center gap-2 font-bold"><KeyRound size={18} className="text-amber-300" /> مفتاح Google AI Studio</h2><p className="mb-4 text-xs leading-6 text-slate-400">يُرسل المفتاح إلى نقطة خادم إدارية فقط. لا تضعه في الكود أو GitHub، ولا يُحفظ في localStorage.</p>
                <label className="block text-sm font-semibold text-slate-300">GEMINI_API_KEY<div className="mt-2 flex gap-2"><input type={showKey ? 'text' : 'password'} autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="أدخل المفتاح عند ربط الخادم الآمن" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm outline-none focus:border-indigo-400" /><button onClick={() => setShowKey(!showKey)} className="rounded-xl border border-slate-700 px-3 text-slate-300" aria-label={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
                <button onClick={saveApiKey} disabled={isSavingKey} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"><Save size={16} /> {isSavingKey ? 'جارٍ الإرسال...' : 'حفظ المفتاح بأمان'}</button>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 font-bold"><Palette size={18} className="text-pink-300" /> اللغة والمظهر</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-300"><span className="flex items-center gap-2"><Languages size={15} /> لغة الواجهة</span><select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="ar">العربية (RTL)</option><option value="fr">Français</option><option value="en">English</option></select></label>
                  <label className="text-sm font-semibold text-slate-300"><span className="flex items-center gap-2"><Palette size={15} /> سمة المنصة</span><select value={theme} onChange={(e) => setTheme(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="indigo">Dark Indigo</option><option value="emerald">Emerald</option></select></label>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400"><Globe2 size={17} /> الإعدادات تُحفظ كتفضيلات محلية ولا تغيّر مظهر الزوار حتى ربطها بإعدادات الخادم.</div>
                <button onClick={savePreferences} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold hover:bg-emerald-500"><Save size={16} /> حفظ التفضيلات</button>
              </div>
            </div>}
          </section>
        </div>
      </div>
    </div>
  );
};
