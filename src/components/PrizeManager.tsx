import React, { useState } from 'react';
import { Prize, Preset } from '../types';
import { COLOR_PALETTE, PRESETS } from '../presets';
import { Plus, Trash2, Sliders, LayoutGrid, RotateCcw, Paintbrush, Percent, HelpCircle } from 'lucide-react';

interface PrizeManagerProps {
  prizes: Prize[];
  onChangePrizes: (newPrizes: Prize[]) => void;
}

export const PrizeManager: React.FC<PrizeManagerProps> = ({ prizes, onChangePrizes }) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState<number | ''>(1);
  const [customColor, setCustomColor] = useState('#8B5CF6');

  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);

  // Generate round-robin color for new items
  const getNextColor = () => {
    const usedColors = prizes.map((p) => p.color);
    for (const color of COLOR_PALETTE) {
      if (!usedColors.includes(color)) {
        return color;
      }
    }
    // If all are used, pick a random one
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  };

  const handleAddPrize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const weightNum = Number(newItemWeight) || 1;
    if (weightNum <= 0) return;

    const newPrize: Prize = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      weight: weightNum,
      color: customColor || getNextColor(),
    };

    const updated = [...prizes, newPrize];
    onChangePrizes(updated);
    setNewItemName('');
    setNewItemWeight(1);
    
    // Cycle custom color
    const nextColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    setCustomColor(nextColor);
  };

  const handleUpdateName = (id: string, name: string) => {
    const updated = prizes.map((p) => {
      if (p.id === id) {
        return { ...p, name };
      }
      return p;
    });
    onChangePrizes(updated);
  };

  const handleUpdateWeight = (id: string, weightVal: string) => {
    const numeric = parseFloat(weightVal);
    if (isNaN(numeric) || numeric <= 0) return; // Prevent zero or negative values
    
    const updated = prizes.map((p) => {
      if (p.id === id) {
        return { ...p, weight: numeric };
      }
      return p;
    });
    onChangePrizes(updated);
  };

  const handleUpdateColor = (id: string, color: string) => {
    const updated = prizes.map((p) => {
      if (p.id === id) {
        return { ...p, color };
      }
      return p;
    });
    onChangePrizes(updated);
  };

  const handleDeletePrize = (id: string) => {
    const updated = prizes.filter((p) => p.id !== id);
    onChangePrizes(updated);
  };

  // Equally distribute weights
  const handleEqualWeights = () => {
    const updated = prizes.map((p) => ({
      ...p,
      weight: 1,
    }));
    onChangePrizes(updated);
  };

  // Normalize all weights as integer percentages that sum to 100%
  const handleScaleTo100 = () => {
    if (prizes.length === 0) return;
    if (totalWeight <= 0) return;

    let accumulatedPercentage = 0;
    const updated = prizes.map((p, idx) => {
      let pct = (p.weight / totalWeight) * 100;
      
      // For the last element, adjust to exactly sum to 100 and clean floating margins
      if (idx === prizes.length - 1) {
        pct = 100 - accumulatedPercentage;
      } else {
        pct = Math.round(pct * 10) / 10; // Keep 1 decimal place
        accumulatedPercentage += pct;
      }
      
      return {
        ...p,
        weight: Math.max(0.1, pct),
      };
    });

    onChangePrizes(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清空所有奖项吗？')) {
      onChangePrizes([]);
    }
  };

  const loadPreset = (preset: Preset) => {
    const mapped: Prize[] = preset.prizes.map((p, idx) => ({
      id: `${idx}-${Date.now()}`,
      name: p.name,
      weight: p.weight,
      color: p.color,
    }));
    onChangePrizes(mapped);
  };

  return (
    <div className="flex flex-col space-y-6">
      
      {/* 🎰 Preset Configuration Cards section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center gap-2">
          <LayoutGrid className="h-4.5 w-4.5 text-blue-500" />
          <span>选择推荐配置模版 (一键导入)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => loadPreset(p)}
              className="px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold select-none border border-slate-100 text-slate-700 bg-slate-50/60 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-all active:scale-[0.98] cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 🖋️ Add and Edit Grid Area */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-5">
        
        {/* Title and Utilities Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-amber-500" />
              <span>奖项设置管理</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">可以在列表中直接修改奖品名字、权重和概率</p>
          </div>

          {/* Quick Normalizer Commands */}
          {prizes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleEqualWeights}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                title="所有奖项中奖概率设为均等"
              >
                均分概率
              </button>
              <button
                onClick={handleScaleTo100}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none hover:bg-slate-50 text-blue-600 border border-blue-200 bg-blue-50/20 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                title="缩放各占比使得数值加和为 100"
              >
                <Percent className="h-3 w-3" />
                <span>归一 100%</span>
              </button>
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
              >
                全部清空
              </button>
            </div>
          )}
        </div>

        {/* 🚀 Quick Add Form */}
        <form onSubmit={handleAddPrize} className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              placeholder="添加新奖项名称..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-blue-500 font-sans"
              maxLength={24}
              required
            />
          </div>

          <div className="w-[85px]">
            <input
              type="number"
              placeholder="权重"
              value={newItemWeight}
              onChange={(e) => {
                const val = e.target.value;
                setNewItemWeight(val === '' ? '' : Math.max(0.1, parseFloat(val) || 1));
              }}
              step="0.1"
              min="0.1"
              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-2.5 text-xs text-slate-700 font-mono outline-none focus:border-blue-500"
              required
              title="中奖相对权重或概率(支持浮点数)"
            />
          </div>

          {/* Color Pallet Picker Swatch Selection */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">颜色</span>
            <div className="relative flex items-center">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-8 h-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-200 p-0 overflow-hidden cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            className="h-9 px-3.5 rounded-lg text-xs font-semibold select-none bg-blue-500 hover:bg-blue-600 text-white cursor-pointer active:scale-95 shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>添加</span>
          </button>
        </form>

        {/* 📝 Prizes Spreadsheet List Stack */}
        <div className="max-h-[380px] overflow-y-auto pr-1">
          {prizes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 rounded-2xl text-center">
              <Paintbrush className="h-8 w-8 text-slate-300 mb-2 animate-bounce-slow" />
              <p className="text-xs text-slate-500 font-semibold">暂无奖项，请在上方添加或者一键导入模版哦！</p>
              <p className="text-[10px] text-slate-400 mt-1">至少配置 2 个奖项开始模拟抽奖</p>
            </div>
          ) : (
            <div className="space-y-2">
              {prizes.map((p, idx) => {
                const probability = totalWeight > 0 ? (p.weight / totalWeight) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/20 transition-all"
                  >
                    {/* Swatch & Input Name block */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Interactive Color swatch circle */}
                      <input
                        type="color"
                        value={p.color}
                        onChange={(e) => handleUpdateColor(p.id, e.target.value)}
                        className="w-5 h-5 rounded-full border border-white shadow-sm ring-1 ring-slate-200 shrink-0 p-0 overflow-hidden cursor-pointer"
                        title="点击更换该奖项颜色"
                      />
                      
                      {/* Name string editable element */}
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdateName(p.id, e.target.value)}
                        className="font-sans text-xs text-slate-700 font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full pb-0.5 truncate transition-all"
                        placeholder="请输入奖项名称"
                        maxLength={24}
                      />
                    </div>

                    {/* Weight and Probability stats block */}
                    <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0">
                      
                      {/* Weight numeric editor */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">权重</span>
                        <input
                          type="number"
                          value={p.weight}
                          onChange={(e) => handleUpdateWeight(p.id, e.target.value)}
                          onBlur={(e) => {
                            if (!e.target.value || parseFloat(e.target.value) <= 0) {
                              handleUpdateWeight(p.id, '1');
                            }
                          }}
                          step="0.1"
                          min="0.1"
                          className="w-[65px] h-7 bg-white border border-slate-200 rounded-md px-1.5 text-center text-xs text-slate-600 font-mono outline-none focus:border-blue-400"
                        />
                      </div>

                      {/* Display final percentage */}
                      <div className="w-[65px] text-right">
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100/70 px-1.5 py-0.5 rounded">
                          {probability.toFixed(1)}%
                        </span>
                      </div>

                      {/* Delete swiper link */}
                      <button
                        type="button"
                        onClick={() => handleDeletePrize(p.id)}
                        className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95"
                        title="删除该奖项"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 📊 Bottom Total Summary Status */}
        {prizes.length > 0 && (
          <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              总权重: <span className="font-mono text-slate-800 font-bold">{totalWeight.toFixed(1)}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold bg-slate-200/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              概率百分比汇总：100%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
