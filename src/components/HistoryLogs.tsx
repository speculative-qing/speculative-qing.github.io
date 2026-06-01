import React, { useState } from 'react';
import { DrawRecord, Prize } from '../types';
import { Download, Trash2, Calendar, ClipboardCheck, BarChart3, PieChart, Search, User } from 'lucide-react';

interface HistoryLogsProps {
  records: DrawRecord[];
  prizes: Prize[];
  onClearHistory: () => void;
  onDeleteRecord: (id: string) => void;
  isAdmin?: boolean;
}

export const HistoryLogs: React.FC<HistoryLogsProps> = ({
  records,
  prizes,
  onClearHistory,
  onDeleteRecord,
  isAdmin = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate draw statistics: how many times each item has won
  const stats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.prizeName] = (counts[r.prizeName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => {
        // Track matching color if prize still exists
        const matchedPrize = prizes.find((p) => p.name === name);
        return {
          name,
          count,
          percentage: records.length > 0 ? ((count / records.length) * 100).toFixed(1) : '0.0',
          color: matchedPrize ? matchedPrize.color : '#94A3B8',
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [records, prizes]);

  // Filter records based on search query (by prize name or participant name/ID)
  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.prizeName.toLowerCase().includes(query) ||
        (r.participantId && r.participantId.toLowerCase().includes(query))
    );
  }, [records, searchQuery]);

  // Export as Excel-friendly CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (records.length === 0) return;

    const headers = ['序号', '中奖奖项名称', '抽奖人身份/工号', '中奖概率', '抽奖时间'];
    const rows = records.map((r, index) => [
      records.length - index, // Inverse counting to match presentation
      `"${r.prizeName.replace(/"/g, '""')}"`, // escape quotes
      `"${(r.participantId || '系统默认').replace(/"/g, '""')}"`,
      `"${r.probability || '未知'}"`,
      r.timestamp,
    ]);

    // EF BB BF is standard UTF-8 Byte Order Mark (BOM) so Excel reads Chinese characters properly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `转盘中奖结果_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export as neat formatted JSON format
  const handleExportJSON = () => {
    if (records.length === 0) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `转盘中奖结果_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* 🚀 Active Draw logs checklist */}
      <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="h-4.5 w-4.5 text-blue-500" />
              <span>抽奖历史日志记录</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">记录抽中的全部历史结果，支持按照抽奖人过滤和多格式导出</p>
          </div>

          {/* Export and clear actions */}
          {records.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleExportCSV}
                id="export-csv-btn"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none bg-blue-500 hover:bg-blue-600 text-white cursor-pointer active:scale-95 transition-all flex items-center gap-1 shadow-sm"
              >
                <Download className="h-3 w-3" />
                <span>导出 CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                id="export-json-btn"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
              >
                <span>导出 JSON</span>
              </button>
              {isAdmin && (
                <button
                  onClick={onClearHistory}
                  id="clear-history-btn"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                >
                  清空日志
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search filter input bar */}
        {records.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 输入抽奖人 ID 或中奖项目，精准过滤查看个人记录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="history-search-input"
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 transition-colors placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                清除
              </button>
            )}
          </div>
        )}

        {/* List of Draw entries */}
        <div className="max-h-[340px] overflow-y-auto pr-1">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-100 rounded-2xl">
              <Calendar className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">暂无中奖结果记录</p>
              <p className="text-[10px] text-slate-400 mt-1">转动轮盘，中奖纪录会自动记录在此处哦！</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-100 rounded-2xl">
              <p className="text-xs text-slate-400 font-semibold">未匹配到“{searchQuery}”相关的抽奖记录</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-blue-500 hover:underline font-bold"
              >
                重置搜索
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((r) => {
                // Determine sequence placement matching standard index ordering
                const realIndex = records.findIndex((rec) => rec.id === r.id);
                const displayIndex = records.length - realIndex;

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/40 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                        #{displayIndex}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-bold text-slate-800 truncate">{r.prizeName}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                            <User className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[90px]">{r.participantId || '系统随机'}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{r.timestamp}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {r.probability && (
                        <span className="text-[10px] font-mono font-extrabold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          中奖概率: {r.probability}
                        </span>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => onDeleteRecord(r.id)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 cursor-pointer"
                          title="删除此条纪录"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 📊 Winner statistics distribution and counts charts panel */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-amber-500" />
            <span>中奖概率大统计</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">显示历史中奖频次与实际产出占比</p>
        </div>

        <div className="max-h-[340px] overflow-y-auto space-y-3.5 pr-1">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PieChart className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-semibold">暂无统计报告</p>
              <p className="text-[10px] text-slate-400 mt-1">抽奖开始后将展示分布指标</p>
            </div>
          ) : (
            stats.map((stat) => (
              <div key={stat.name} className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700 truncate max-w-[140px]">{stat.name}</span>
                  <span className="text-slate-500">
                    <span className="text-slate-800 font-bold">{stat.count}</span> 次 ({stat.percentage}%)
                  </span>
                </div>
                {/* Custom proportional progress bars */}
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stat.percentage}%`,
                      backgroundColor: stat.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {records.length > 0 && (
          <div className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            共计累计抽取 {records.length} 次
          </div>
        )}
      </div>

    </div>
  );
};
