export const STICKER_IDS = [
  'victory',
  'greeting',
  'laughing',
  'shocked',
  'crying',
  'frustrated',
  'thinking',
  'clapping',
  'respect',
  'teasing',
  'good_game',
  'rematch_invite',
] as const;

export type StickerId = (typeof STICKER_IDS)[number];

export type StickerCategory = 'all' | 'chat' | 'emotion' | 'tactics';

export interface StickerDefinition {
  id: StickerId;
  name: string;
  category: 'chat' | 'emotion' | 'tactics';
  label: {
    en: string;
    km: string;
  };
  durationMs: number;
}

export const STICKER_REGISTRY: Record<StickerId, StickerDefinition> = {
  victory: {
    id: 'victory',
    name: 'Victory Celebration',
    category: 'emotion',
    label: {
      en: 'Victory!',
      km: 'ជ័យជំនះ!',
    },
    durationMs: 3200,
  },
  greeting: {
    id: 'greeting',
    name: 'Friendly Wave',
    category: 'chat',
    label: {
      en: 'Hello!',
      km: 'សួស្តី!',
    },
    durationMs: 2800,
  },
  laughing: {
    id: 'laughing',
    name: 'Joyful Laugh',
    category: 'emotion',
    label: {
      en: 'Haha!',
      km: 'ហាហា!',
    },
    durationMs: 3000,
  },
  shocked: {
    id: 'shocked',
    name: 'Shocked Eyes',
    category: 'emotion',
    label: {
      en: 'Wow!',
      km: 'អស្ចារ្យ!',
    },
    durationMs: 3000,
  },
  crying: {
    id: 'crying',
    name: 'Defeat Tears',
    category: 'emotion',
    label: {
      en: 'Oh no...',
      km: 'អូទេ...',
    },
    durationMs: 3200,
  },
  frustrated: {
    id: 'frustrated',
    name: 'Frustrated Steam',
    category: 'emotion',
    label: {
      en: 'Argh!',
      km: 'យ៉ាប់ណាស់!',
    },
    durationMs: 3000,
  },
  thinking: {
    id: 'thinking',
    name: 'Deep Concentration',
    category: 'tactics',
    label: {
      en: 'Hmm...',
      km: 'គិតមើលសិន...',
    },
    durationMs: 3200,
  },
  clapping: {
    id: 'clapping',
    name: 'Applaud & Cheer',
    category: 'tactics',
    label: {
      en: 'Nice move!',
      km: 'ការដើរល្អ!',
    },
    durationMs: 3000,
  },
  respect: {
    id: 'respect',
    name: 'Humble Bow',
    category: 'chat',
    label: {
      en: 'Respect!',
      km: 'គោរព!',
    },
    durationMs: 2800,
  },
  teasing: {
    id: 'teasing',
    name: 'Playful Wink',
    category: 'tactics',
    label: {
      en: 'Almost got me!',
      km: 'ជិតឈ្នះហើយ!',
    },
    durationMs: 3000,
  },
  good_game: {
    id: 'good_game',
    name: 'Good Game',
    category: 'chat',
    label: {
      en: 'Good Game!',
      km: 'លេងបានល្អ!',
    },
    durationMs: 3000,
  },
  rematch_invite: {
    id: 'rematch_invite',
    name: 'Rematch Request',
    category: 'chat',
    label: {
      en: 'One more round?',
      km: 'លេងម្តងទៀតទេ?',
    },
    durationMs: 3200,
  },
};

export const STICKER_LIST: StickerDefinition[] = STICKER_IDS.map((id) => STICKER_REGISTRY[id]);

export function isValidStickerId(id: unknown): id is StickerId {
  return typeof id === 'string' && (STICKER_IDS as readonly string[]).includes(id);
}

export function getSticker(id: StickerId): StickerDefinition {
  return STICKER_REGISTRY[id];
}

export function getStickerLabel(id: StickerId, languageCode?: string | null): string {
  const sticker = STICKER_REGISTRY[id];
  if (!sticker) return '';
  const lang = (languageCode ?? '').toLowerCase().startsWith('km') ? 'km' : 'en';
  return sticker.label[lang] ?? sticker.label.en;
}
