export interface Prize {
  id: string;
  name: string;
  weight: number; // Probability weight
  color: string;
}

export interface DrawRecord {
  id: string;
  prizeId: string;
  prizeName: string;
  timestamp: string; // ISO String or custom formatted
  participantId?: string; // Participant's name or custom ID
  probability?: string; // Winning probability string, e.g. "15.0%"
}

export interface WheelConfig {
  duration: number; // spin duration in seconds
  drawMode: 'normal' | 'remove'; // normal: keeps prize, remove: automatically removes/reduces prize weight
  soundEnabled: boolean;
}

export interface Preset {
  name: string;
  prizes: Omit<Prize, 'id'>[];
}
