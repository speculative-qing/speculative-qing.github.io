import { Preset } from './types';

export const COLOR_PALETTE = [
  '#F43F5E', // Rose 500
  '#3B82F6', // Blue 500
  '#10B981', // Emerald 500
  '#F59E0B', // Amber 500
  '#8B5CF6', // Violet 500
  '#EC4899', // Pink 500
  '#06B6D4', // Cyan 500
  '#14B8A6', // Teal 500
  '#F97316', // Orange 500
  '#6366F1', // Indigo 500
  '#A855F7', // Purple 500
  '#84CC16', // Lime 500
];

export const PRESETS: Preset[] = [
  {
    name: '🎉 年会幸运大抽奖',
    prizes: [
      { name: '✨ 豪华特等奖', weight: 1, color: '#F43F5E' },
      { name: '📱 一等奖 (最新数码)', weight: 3, color: '#F59E0B' },
      { name: '🎧 二等奖 (蓝牙耳机)', weight: 8, color: '#8B5CF6' },
      { name: '💸 三等奖 (百元京东卡)', weight: 15, color: '#3B82F6' },
      { name: '🧧 阳光普照奖 (礼包)', weight: 73, color: '#10B981' },
    ],
  },
  {
    name: '🍵 今天下午茶吃什么',
    prizes: [
      { name: '🥤 丝袜奶茶 + 蛋挞', weight: 1, color: '#F97316' },
      { name: '☕ 美式咖啡 + 提拉米苏', weight: 1, color: '#8B5CF6' },
      { name: '🍕 脆皮鸡翅 + 炸薯条', weight: 1, color: '#F43F5E' },
      { name: '🥝 应季果盘 + 气泡水', weight: 1, color: '#10B981' },
      { name: '🍦 冰淇淋圣代', weight: 1, color: '#06B6D4' },
      { name: '🥗 健康轻食沙拉', weight: 1, color: '#84CC16' },
    ],
  },
  {
    name: '🤫 诚实守信大冒险',
    prizes: [
      { name: '💬 真心话回答一个问题', weight: 2, color: '#3B82F6' },
      { name: '🤸 现场做 10 个俯卧撑', weight: 1, color: '#F59E0B' },
      { name: '🍹 自罚喝下一大杯温水', weight: 2, color: '#10B981' },
      { name: '🎤 现场高歌一首经典曲目', weight: 1.5, color: '#8B5CF6' },
      { name: '🎭 模仿群里一张热门表情包', weight: 1.5, color: '#EC4899' },
    ],
  },
  {
    name: '🪙 经典硬币正反两面',
    prizes: [
      { name: '🪙 正面', weight: 50, color: '#3B82F6' },
      { name: '🪙 反面', weight: 50, color: '#F59E0B' },
    ],
  },
];
