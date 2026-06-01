import { useState, useEffect, useRef } from 'react';
import { Prize, DrawRecord, WheelConfig } from './types';
import { PRESETS, COLOR_PALETTE } from './presets';
import { LuckyWheel } from './components/LuckyWheel';
import { PrizeManager } from './components/PrizeManager';
import { HistoryLogs } from './components/HistoryLogs';
import { Gift, SlidersHorizontal, Trash2, Award, RefreshCw, Sparkles, AlertCircle, Volume2, HelpCircle, Share2, Check, Copy, Home } from 'lucide-react';

const DEFAULT_PRIZES: Prize[] = PRESETS[0].prizes.map((p, idx) => ({
  id: `default-${idx}`,
  name: p.name,
  weight: p.weight,
  color: p.color,
}));

// Simple lightweight Confetti component
const ConfettiGenerator = ({ active }: { active: boolean }) => {
  if (!active) return null;
  const particles = Array.from({ length: 90 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-40 rounded-3xl">
      {particles.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2.8;
        const duration = Math.random() * 2.5 + 1.8;
        const size = Math.random() * 8 + 5;
        const rotate = Math.random() * 360;
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
        
        return (
          <div
            key={i}
            className="absolute animate-fall"
            style={{
              left: `${left}%`,
              top: `-15px`,
              width: `${size}px`,
              height: `${size * (Math.random() > 0.5 ? 1 : 2.5)}px`,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '3px',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotate}deg)`,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
};

export default function App() {
  const [role, setRole] = useState<'portal' | 'admin' | 'draw'>(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    if (r === 'draw' || r === 'admin') return r;
    return 'portal';
  });

  const [prizes, setPrizes] = useState<Prize[]>(() => {
    const saved = localStorage.getItem('lucky_wheel_prizes_v1');
    return saved ? JSON.parse(saved) : DEFAULT_PRIZES;
  });

  const [records, setRecords] = useState<DrawRecord[]>(() => {
    const saved = localStorage.getItem('lucky_wheel_records_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [participantInput, setParticipantInput] = useState('');

  const [config, setConfig] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('lucky_wheel_config_v1');
    return saved ? JSON.parse(saved) : {
      duration: 5,
      drawMode: 'normal',
      soundEnabled: true,
    };
  });

  // State for active winner modal
  const [winner, setWinner] = useState<Prize | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);

  // Sync state modifications to local storage
  useEffect(() => {
    localStorage.setItem('lucky_wheel_prizes_v1', JSON.stringify(prizes));
  }, [prizes]);

  useEffect(() => {
    localStorage.setItem('lucky_wheel_records_v1', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('lucky_wheel_config_v1', JSON.stringify(config));
  }, [config]);

  // Load initial settings and history logs from the Express full-stack API
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.prizes) setPrizes(configData.prizes);
          if (configData.config) setConfig(configData.config);
          setDbConnected(true);
        } else {
          setDbConnected(false);
        }
        
        const recordsRes = await fetch('/api/records');
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          setRecords(recordsData);
        }
      } catch (e) {
        setDbConnected(false);
        console.warn('Initial server configuration not reachable. Falling back to local storage schema.', e);
      }
    };
    fetchInitialData();
  }, []);

  // Background polling to keep players' wheels up-to-date with admin edits,
  // and keep admins' logs up-to-date with player entries.
  useEffect(() => {
    if (role === 'portal') return;
    const handlePolling = async () => {
      try {
        // Both roles fetch records so they can see new logs immediately
        const recordsRes = await fetch('/api/records');
        if (recordsRes.ok) {
          const recordsJson = await recordsRes.json();
          setRecords(recordsJson);
          setDbConnected(true);
        } else {
          setDbConnected(false);
        }

        // Draw (player) role polls configuration so any prize weight updates/removal mode changes from admin take instant effect
        if (role === 'draw') {
          const configRes = await fetch('/api/config');
          if (configRes.ok) {
            const configJson = await configRes.json();
            if (configJson.prizes) setPrizes(configJson.prizes);
            if (configJson.config) setConfig(configJson.config);
            setDbConnected(true);
          } else {
            setDbConnected(false);
          }
        }
      } catch (err) {
        setDbConnected(false);
        console.warn('Real-time synchronization interval offline/reconnecting...', err);
      }
    };

    const timer = setInterval(handlePolling, 3000);
    return () => clearInterval(timer);
  }, [role]);

  // Sync configuration updates to server database
  const syncConfigToServer = async (updatedPrizes: Prize[], updatedConfig: WheelConfig) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizes: updatedPrizes, config: updatedConfig }),
      });
    } catch (e) {
      console.error('Failed to sync config to server:', e);
    }
  };

  const onAdminUpdatePrizes = (newPrizes: Prize[]) => {
    setPrizes(newPrizes);
    if (role === 'admin') {
      syncConfigToServer(newPrizes, config);
    }
  };

  const onAdminUpdateConfig = (updater: WheelConfig | ((prev: WheelConfig) => WheelConfig)) => {
    setConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (role === 'admin') {
        syncConfigToServer(prizes, next);
      }
      return next;
    });
  };

  const handleRoleChange = (newRole: 'portal' | 'admin' | 'draw') => {
    setRole(newRole);
    const url = new URL(window.location.href);
    if (newRole === 'portal') {
      url.searchParams.delete('role');
    } else {
      url.searchParams.set('role', newRole);
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Handle spin start event from LuckyWheel
  const handleSpinStart = () => {
    setIsSpinning(true);
    setWinner(null);
    setShowWinnerModal(false);
  };

  // Handle spin stop landing event from LuckyWheel
  const handleSpinEnd = (drawnPrize: Prize) => {
    setIsSpinning(false);
    setWinner(drawnPrize);
    setShowWinnerModal(true);

    // Append history log
    const now = new Date();
    const formattedTime = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    const probabilityVal = totalWeight > 0 ? ((drawnPrize.weight / totalWeight) * 100).toFixed(1) + '%' : '0.0%';
    const finalParticipant = participantInput.trim() || `访客 #${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord: DrawRecord = {
      id: crypto.randomUUID(),
      prizeId: drawnPrize.id,
      prizeName: drawnPrize.name,
      timestamp: formattedTime,
      participantId: finalParticipant,
      probability: probabilityVal,
    };

    setRecords((prev) => [newRecord, ...prev]);

    // Send newly generated record to Express server database
    fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch((e) => console.error('Failed to post draw record to server:', e));
  };

  const handleShareWinner = () => {
    if (!winner) return;
    
    // Calculate winning probability matching modal calculation
    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    const probabilityVal = totalWeight > 0 ? ((winner.weight / totalWeight) * 100).toFixed(1) + '%' : '100%';
    const participant = participantInput.trim() || '系统默认 / 随机访客';
    const now = new Date();
    const formattedTime = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const shareText = `🏆 【转盘抽奖 Pro】中奖喜报 🏆
─────────────────────────
✨ 恭喜诞生幸运星！ ✨

👤 中 奖 人：${participant}
🎁 中奖奖项：${winner.name}
🎯 中奖概率：${probabilityVal}
⏰ 抽奖时间：${formattedTime}

🎈 运势指数：★★★★★ (好运爆棚)
🍀 快来转动你的幸运轮盘，测测你的手气吧！
👉 访问链接实时体验：${window.location.origin}${window.location.pathname}
─────────────────────────`;

    navigator.clipboard.writeText(shareText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // Fallback copy method
      const textArea = document.createElement("textarea");
      textArea.value = shareText;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        }
      } catch (err2) {
        console.error('Fallback copy failed: ', err2);
      }
      document.body.removeChild(textArea);
    });
  };

  // Callback to handle win closure and any subsequent deductions
  const handleCloseWinnerModal = (shouldDeduct: boolean = false) => {
    if (!winner) return;

    if (shouldDeduct && config.drawMode === 'remove') {
      deductPrizeWeightAndClean(winner.id);
    }

    setShowWinnerModal(false);
    setIsCopied(false);
    // delay resetting winner to make visual exit transitions nicer
    setTimeout(() => {
      setWinner(null);
    }, 300);
  };

  // Decreases weight by 1, and removes prize if weight lands at 0
  const deductPrizeWeightAndClean = (prizeId: string) => {
    setPrizes((prev) => {
      const target = prev.find((p) => p.id === prizeId);
      if (!target) return prev;

      const updatedWeight = target.weight - 1;
      let nextPrizes: Prize[];
      if (updatedWeight <= 0) {
        nextPrizes = prev.filter((p) => p.id !== prizeId);
      } else {
        nextPrizes = prev.map((p) => (p.id === prizeId ? { ...p, weight: updatedWeight } : p));
      }

      // Sync the deduction update immediately to server
      syncConfigToServer(nextPrizes, config);
      return nextPrizes;
    });
  };

  // Handle manual removal of item outside modal
  const handleToggleSound = () => {
    onAdminUpdateConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const handleClearHistory = () => {
    if (window.confirm('确认清空所有中奖记录与统计吗？')) {
      setRecords([]);
      fetch('/api/records/clear', { method: 'POST' })
        .catch((e) => console.error('Failed to clear records on server:', e));
    }
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    fetch(`/api/records/${id}`, { method: 'DELETE' })
      .catch((e) => console.error('Failed to delete record on server:', e));
  };

  if (role === 'portal') {
    return (
      <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 flex flex-col justify-between overflow-y-auto relative">
        {/* Floating background decorative animations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <ConfettiGenerator active={true} />
        </div>

        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 md:px-8 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
              <svg className="w-5 h-5 text-white animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-800">转盘抽奖 Pro</h1>
              <span className="text-xs font-semibold text-slate-400 italic">v2.5</span>
            </div>
          </div>
          {dbConnected ? (
            <div className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>云端实时同步联接</span>
            </div>
          ) : (
            <div className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>离线模式：同步正在连接中</span>
            </div>
          )}
        </header>

        {/* Main Content Portal */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 md:py-20 flex flex-col justify-center items-center z-10 space-y-10 md:space-y-14">
          
          {/* Main Slogan Headings */}
          <div className="text-center space-y-4 max-w-2xl">
            <span className="text-[10px] tracking-widest uppercase font-extrabold bg-blue-100 text-blue-700 px-3.5 py-1 rounded-full border border-blue-200/80 shadow-sm">
              ⚡️ 多端独立互通 · 活动专属方案 ⚡️
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight pt-2">
              幸运轮盘大抽奖
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto font-medium">
              支持一键自由定制扇区、奖项与中奖概率；支持管理员专属设置后生成分享链接，参与者点开链接即可直达抽奖现场！
            </p>
          </div>

          {/* Interactive Mode Grid Selection */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8 w-full max-w-4xl animate-fade-in-up">
            
            {/* Admin Portal card */}
            <div 
              onClick={() => handleRoleChange('admin')}
              className="bg-white border border-slate-200/80 sm:border-2 hover:border-blue-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col justify-between text-left cursor-pointer transition-all duration-300 hover:shadow-[0_15px_30px_-5px_rgba(59,130,246,0.12)] hover:-translate-y-1.5 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50/20 rounded-bl-full -z-10 transition-all duration-300 group-hover:scale-125" />
              
              <div className="space-y-4 sm:space-y-5">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl sm:text-2xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  ⚙️
                </div>
                
                <div className="space-y-1.5 sm:space-y-2">
                  <h3 className="text-sm sm:text-lg md:text-xl font-bold text-slate-800 leading-tight">1. 轮盘设置端</h3>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-mono">WHEEL CONFIG PANEL</p>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1 sm:mt-2">
                    专为主办方或活动策划者研发，提供高级管理控制：
                  </p>
                  <ul className="text-[10px] sm:text-xs text-slate-500 space-y-1 list-disc list-inside">
                    <li>自由增加、删除、修改大转盘奖项和背景色</li>
                    <li>自定义配置各项权重与计算生成的中奖概率</li>
                    <li>设置旋转时长与配置<strong>消耗减项</strong>等高级机制</li>
                    <li>查看、检索、单个删除或整体打包导出中奖日志数据</li>
                    <li><strong className="text-blue-600 font-bold">生成或一键复制专属的普通抽奖客户端链接</strong></li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-blue-600 font-bold group-hover:underline">
                  前往并设置轮盘 &rarr;
                </span>
                <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  ADMIN ONLY
                </span>
              </div>
            </div>

            {/* Draw Client card */}
            <div 
              onClick={() => handleRoleChange('draw')}
              className="bg-white border border-slate-200/80 sm:border-2 hover:border-purple-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col justify-between text-left cursor-pointer transition-all duration-300 hover:shadow-[0_15px_30px_-5px_rgba(147,51,234,0.12)] hover:-translate-y-1.5 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-50 to-pink-50/20 rounded-bl-full -z-10 transition-all duration-300 group-hover:scale-125" />
              
              <div className="space-y-4 sm:space-y-5">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xl sm:text-2xl group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                  🎯
                </div>
                
                <div className="space-y-1.5 sm:space-y-2">
                  <h3 className="text-sm sm:text-lg md:text-xl font-bold text-slate-800 leading-tight">2. 抽奖参与端</h3>
                  <p className="text-[9px] sm:text-xs text-purple-400 font-mono">LUCKY WHEEL DRAW PANEL</p>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed mt-1 sm:mt-2">
                    专为广大活动参与、兑奖与娱乐者研发：
                  </p>
                  <ul className="text-[10px] sm:text-xs text-slate-500 space-y-1 list-disc list-inside">
                    <li>一键直接点击开始旋转大轮盘，免登录即抽</li>
                    <li>支持填写专属身份姓名、工号等信息（非必填）</li>
                    <li>大轮盘实时同步管理员端设置的奖项内容及概率</li>
                    <li>完美配套中奖特效与便捷的<strong>一键复制分享中奖喜报</strong></li>
                    <li>支持查看实时的中奖历史滚动，保障公开透明</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-purple-600 font-bold group-hover:underline">
                  直接开始抽放好运 &rarr;
                </span>
                <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  GUEST CHANCE
                </span>
              </div>
            </div>

          </div>

          {/* Key values bar */}
          <div className="bg-slate-100/60 border border-slate-200/80 px-6 py-3 rounded-2xl text-[11px] text-slate-500 font-semibold flex flex-wrap gap-4 md:gap-8 justify-center items-center text-center">
            <span>💾 实时云端高速数据存储</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>🔐 核心参数防篡改：纯抽奖页面仅抽奖</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>📱 完美的移动/PC多分辨率触控交互适配</span>
          </div>

        </main>

        {/* Footer */}
        <footer className="h-12 bg-slate-800 text-slate-400 px-6 flex items-center justify-between text-[10px] uppercase tracking-widest shrink-0 select-none z-10">
          <div className="flex gap-6">
            <span>Status: Online</span>
            <span>Workspace: #WHEEL-PRO-2026</span>
          </div>
          <div className="flex gap-4">
            <span>Secure Database Sync</span>
            <span>v2.5.0-stable</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">
      
      {/* 🔮 Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRoleChange('portal')}
            className="flex items-center justify-center p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer mr-1 border border-slate-100 bg-slate-50"
            title="返回主入口"
          >
            <Home className="h-4 w-4" />
          </button>
          
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
            <svg className="w-5 h-5 text-white animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-800 font-sans">转盘抽奖 Pro</h1>
            <span className="text-xs font-semibold text-slate-400 italic">v2.5</span>
          </div>
        </div>

        {/* 🎮 Multi-Role Switcher Segment Control */}
        {role === 'admin' ? (
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/60 shadow-sm select-none">
            <button
              onClick={() => handleRoleChange('admin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                role === 'admin'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>⚙️ 轮盘设置端</span>
            </button>
            <button
              onClick={() => handleRoleChange('draw')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                role === 'draw'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🎯 抽奖参与端</span>
            </button>
          </div>
        ) : (
          <div className="bg-purple-50 border border-purple-100 text-purple-700 px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 select-none shadow-sm">
            <span>🎯 抽奖客户端</span>
          </div>
        )}
        
        {/* Top Status Indicators */}
        <div className="flex items-center gap-3">
          {dbConnected ? (
            <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-xs text-emerald-600 font-semibold font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>云同步：数据实时联通中</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200 text-xs text-amber-700 font-semibold font-mono">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>离线模式：同步重连中</span>
            </div>
          )}
        </div>
      </header>

      {/* 🧭 Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Sidebar: Configuration of prizes and rules - ONLY visible in 'admin' role */}
        {role === 'admin' && (
          <aside className="w-full lg:w-[390px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-6">
            
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Gift className="h-4 w-4 text-blue-500 animate-bounce-slow" />
                <span>奖项配置与导入 (Prize Settings)</span>
              </h2>
              <PrizeManager
                prizes={prizes}
                onChangePrizes={onAdminUpdatePrizes}
              />
            </div>
            
            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                <span>旋转高级规则设置 (Advanced Rules)</span>
              </h2>
              
              <div className="space-y-4">
                {/* Slider for Rotate Duration */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">每次旋转时长：</span>
                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded">
                      {config.duration} 秒
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="1"
                    value={config.duration}
                    onChange={(e) => onAdminUpdateConfig((prev) => ({ ...prev, duration: parseInt(e.target.value) || 5 }))}
                    disabled={isSpinning}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                    <span>3s (超快)</span>
                    <span>5s (推荐)</span>
                    <span>12s (极具悬念)</span>
                  </div>
                </div>

                {/* Toggle switch for Consumption Modes (Deduction state) */}
                <div className="space-y-2 mt-2">
                  <span className="text-xs font-semibold text-slate-600">中奖结算规则方式：</span>
                  <div className="grid grid-cols-1 gap-2">
                    <label
                      onClick={() => !isSpinning && onAdminUpdateConfig(prev => ({ ...prev, drawMode: 'normal' }))}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        config.drawMode === 'normal'
                          ? 'border-blue-500 bg-blue-50/10 text-slate-800 font-semibold'
                          : 'border-slate-100 hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="drawMode"
                        checked={config.drawMode === 'normal'}
                        onChange={() => {}}
                        disabled={isSpinning}
                        className="mt-0.5 accent-blue-500 shrink-0"
                      />
                      <div>
                        <span className="font-bold flex items-center gap-1">🔄 循环抽奖 (默认)</span>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5 font-normal">普通模式，中奖后转盘保持原样，可多次重叠中同一奖项。</p>
                      </div>
                    </label>

                    <label
                      onClick={() => !isSpinning && onAdminUpdateConfig(prev => ({ ...prev, drawMode: 'remove' }))}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        config.drawMode === 'remove'
                          ? 'border-rose-500 bg-rose-50/10 text-slate-800 font-semibold'
                          : 'border-slate-100 hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="drawMode"
                        checked={config.drawMode === 'remove'}
                        onChange={() => {}}
                        disabled={isSpinning}
                        className="mt-0.5 accent-rose-500 shrink-0"
                      />
                      <div>
                        <span className="font-bold flex items-center gap-1 text-rose-600">🗑️ 消耗式抽奖 (限量抽检)</span>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5 font-normal">适合抽实物奖品。中奖后，该奖项的权重会自动扣减 1；清零后该项自动移出转盘。</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Mode Alert Box */}
                {config.drawMode === 'remove' && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-start gap-2 text-[11px] font-medium leading-relaxed">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>消耗抽奖模式提示：</strong>在此模式下，权重被视作礼品数。建议中奖后在弹窗中选择“<strong>扣减数量并关闭</strong>”或手动配合微调。
                    </span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Main Section: Wheel and Logs */}
        <section className="flex-1 flex flex-col p-6 overflow-y-auto gap-6 lg:gap-8 min-w-0">
          
          {/* Admin invitation link box */}
          {role === 'admin' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg select-none">
                  🔗
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">一键分享专属抽奖链接</h4>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">复制专用抽奖客户端链接发送给参与者，他们只参与抽奖，无法修改您的轮盘和奖项配置。</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-[10px] font-mono font-bold text-slate-400 bg-slate-200/50 px-2.5 py-1.5 rounded-lg border border-slate-200 select-all truncate max-w-[200px]">
                  {`${window.location.origin}${window.location.pathname}?role=draw`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const l = `${window.location.origin}${window.location.pathname}?role=draw`;
                    navigator.clipboard.writeText(l);
                    alert('抽奖参与者专属链接已成功复制到剪贴板！');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold self-start cursor-pointer active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>复制专属链接</span>
                </button>
              </div>
            </div>
          )}

          {/* Draw mode intro banner */}
          {role === 'draw' && (
            <div className="bg-gradient-to-r from-purple-50 to-amber-50 border border-purple-100 p-4 rounded-2xl flex items-center gap-3 shrink-0 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg select-none">
                ✨
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">欢迎来到幸运旋转大抽奖！</h4>
                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">请在下方输入您的工号、姓名或专属识别ID，然后点击中心 [抽奖] 按钮开启您的好运吧！</p>
              </div>
            </div>
          )}

          {/* 👤 Participant custom input section */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg select-none">
                👤
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">当前抽奖人姓名/工号 (选填)</h4>
                <p className="text-[10px] text-slate-400">输入身份记录在中奖日志中，提供多用户历史查看与检索体验</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="请输入名字 (如：张三 / Employee #122)"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                disabled={isSpinning}
                id="participant-name-input"
                className="w-full sm:w-[240px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-slate-800 transition-all"
              />
              {participantInput && (
                <button
                  onClick={() => setParticipantInput('')}
                  disabled={isSpinning}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 shrink-0 py-1"
                >
                  清除
                </button>
              )}
            </div>
          </div>
          
          {/* Wheel Frame Display */}
          <div className="flex-1 flex items-center justify-center relative py-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[420px]">
            <LuckyWheel
              prizes={prizes}
              duration={config.duration}
              soundEnabled={config.soundEnabled}
              onSoundToggle={handleToggleSound}
              onSpinStart={handleSpinStart}
              onSpinEnd={handleSpinEnd}
            />
            
            {/* Ready Badge status */}
            <div className="absolute top-4 right-4 bg-white/80 border border-slate-200 backdrop-blur-sm px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm select-none z-10">
              <div className={`w-2 h-2 rounded-full ${isSpinning ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isSpinning ? 'Spinning Now' : 'Ready' }
              </span>
            </div>
          </div>

          {/* Table: Results History and stats */}
          <div className="shrink-0 bg-transparent rounded-2xl">
            <HistoryLogs
              records={records}
              prizes={prizes}
              onClearHistory={handleClearHistory}
              onDeleteRecord={handleDeleteRecord}
              isAdmin={role === 'admin'}
            />
          </div>
        </section>
      </main>

      {/* Bottom status bar */}
      <footer className="h-8 bg-slate-800 text-slate-400 px-6 flex items-center justify-between text-[10px] uppercase tracking-widest shrink-0 select-none">
        <div className="flex gap-6">
          <span>Status: Ready</span>
          <span>Workspace: #LUCKY-WHEEL-PRO-2026</span>
        </div>
        <div className="flex gap-4">
          <span>Secure Cache</span>
          <span>v2.4.0-stable</span>
        </div>
      </footer>

      {/* 🏆 Congratulations Backdrop Winner Overlay Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60 transition-all duration-300
          ${showWinnerModal && winner ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        {/* Particle and Confetti loop triggered */}
        <ConfettiGenerator active={showWinnerModal} />

        {/* Visual card content pop */}
        <div
          className={`relative bg-white w-full max-w-md rounded-3xl p-6 md:p-8 text-center shadow-[0_24px_50px_-12px_rgba(30,41,59,0.3)] border border-slate-100 transform transition-all duration-300 flex flex-col space-y-6
            ${showWinnerModal ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}
        >
          {/* Upper Celebration Award Ring Icon */}
          <div className="mx-auto h-16 w-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner filter drop-shadow-[0_2px_4px_rgba(245,158,11,0.2)] animate-bounce">
            <Award className="h-9 w-9" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              🎊 恭喜诞生中奖者！ 🎊
            </span>
            <h2 className="text-xl font-black text-slate-800 pt-3">幸运转盘大揭晓</h2>
          </div>

          {/* Golden/Silver Border Box for Winner card detail */}
          {winner && (
            <div
              className="p-5 rounded-2xl border-2 flex flex-col items-center justify-center space-y-2 group filter drop-shadow-sm shadow-md text-white overflow-hidden relative"
              style={{
                backgroundColor: winner.color,
                borderColor: 'rgba(255, 255, 255, 0.25)',
              }}
            >
              {/* Outer shining overlay flare */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />

              <span className="text-[11px] opacity-80 uppercase font-mono font-bold">
                WON PRIZE ITEM
              </span>
              <p className="text-2xl font-black truncate max-w-full font-sans tracking-wide px-2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
                {winner.name}
              </p>
              
              {/* Actual percentage chance when drawn */}
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-full font-mono font-bold tracking-tight">
                  中奖理论概率: {((winner.weight / prizes.reduce((sum, p) => sum + p.weight, 0)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Interaction action buttons stack */}
          <div className="flex flex-col gap-2.5 pt-2">
            
            {/* Share and copy win bulletin indicator */}
            <button
              onClick={handleShareWinner}
              id="share-winner-btn"
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center justify-center gap-1.5 border active:scale-95
                ${isCopied 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-100/50' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/80 hover:text-slate-805'}`}
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 stroke-[3.5]" />
                  <span>已成功复制中奖喜报！</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-blue-500" />
                  <span>分享并复制中奖喜报</span>
                </>
              )}
            </button>

            {/* If drawMode is remove: we show a green primary to subtract prize quantity */}
            {config.drawMode === 'remove' ? (
              <>
                <button
                  onClick={() => handleCloseWinnerModal(true)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all select-none cursor-pointer flex items-center justify-center gap-1.5 filter drop-shadow-md shadow-emerald-100"
                >
                  <RefreshCw className="h-4.5 w-4.5" />
                  <span>扣减此奖项数量 (剩余减1) 并继续</span>
                </button>
                <button
                  onClick={() => handleCloseWinnerModal(false)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all select-none cursor-pointer border border-slate-200"
                >
                  直接关闭 (保持剩余数量不变)
                </button>
              </>
            ) : (
              <button
                onClick={() => handleCloseWinnerModal(false)}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all select-none cursor-pointer flex items-center justify-center gap-1.5 filter drop-shadow-md shadow-blue-100"
              >
                <Sparkles className="h-4.5 w-4.5 animate-spin-slow" />
                <span>太棒了！继续抽奖</span>
              </button>
            )}

          </div>

        </div>
      </div>

    </div>
  );
}
