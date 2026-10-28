export type AiTauntMood =
  | 'greeting'
  | 'reply'
  | 'block'
  | 'threat'
  | 'win'
  | 'lose'
  | 'draw';

type TauntLanguage = 'en' | 'km';

/**
 * Playful, kid-safe trash talk. The bot is allowed to be smug, but never
 * abusive; keep every line focused on the board rather than the person.
 */
export const AI_TAUNTS: Record<AiTauntMood, Record<TauntLanguage, readonly string[]>> = {
  greeting: {
    en: [
      "Another challenger? Let's see how long you last.",
      "I hope you warmed up. You're going to need it.",
      "You can move first. It won't save you.",
    ],
    km: [
      'អ្នកប្រកួតម្នាក់ទៀតមែនទេ? មើលថាអ្នកទ្រាំបានប៉ុន្មានជំហាន។',
      'សង្ឃឹមថាអ្នកបានកម្តៅខ្លួនហើយ។ អ្នកនឹងត្រូវការវា។',
      'អ្នកដើរមុនបាន។ វាមិនជួយសង្គ្រោះអ្នកទេ។',
    ],
  },
  reply: {
    en: [
      "Cute words. The board doesn't listen.",
      "Keep talking. I'll keep winning.",
      "I've seen smarter trash talk from a captcha.",
      'Bold words for someone about to lose.',
    ],
    km: [
      'ពាក្យពិរោះណាស់។ តែក្តារមិនស្តាប់អ្នកទេ។',
      'និយាយបន្តទៅ។ ខ្ញុំនឹងឈ្នះបន្តទៅ។',
      'ខ្ញុំធ្លាប់ឃើញការនិយាយដ៏ឆ្លាតជាងនេះពី captcha។',
      'ពាក្យក្លាហានណាស់សម្រាប់មនុស្សដែលជិតចាញ់។',
    ],
  },
  block: {
    en: [
      'Nice try. I saw that line before you did.',
      "Blocked. You'll have to do better than that.",
      'That was your plan? Adorable.',
    ],
    km: [
      'សាកល្បងបានល្អ។ ខ្ញុំឃើញបន្ទាត់នោះមុនអ្នកទៀត។',
      'ការពារបានហើយ។ អ្នកត្រូវធ្វើបានល្អជាងនេះ។',
      'នោះជាផែនការរបស់អ្នកមែនទេ? គួរឲ្យស្រលាញ់ណាស់។',
    ],
  },
  threat: {
    en: [
      "Two ways to win. Pick one to block. I'll take the other.",
      "The board is already mine. You're just filling space.",
      'See the trap? Too late.',
    ],
    km: [
      'ផ្លូវឈ្នះពីរ។ ជ្រើសមួយដើម្បីការពារ។ ខ្ញុំយកមួយទៀត។',
      'ក្តារនេះជារបស់ខ្ញុំហើយ។ អ្នកគ្រាន់តែបំពេញកន្លែងទទេ។',
      'ឃើញអន្ទាក់ទេ? យឺតពេលហើយ។',
    ],
  },
  win: {
    en: [
      "Good game. I'd say better luck next time, but I'd be lying.",
      'That was almost a challenge. Almost.',
      'The board belongs to me. Feel free to try again.',
    ],
    km: [
      'លេងបានល្អ។ ខ្ញុំចង់និយាយថាសំណាងល្អពេលក្រោយ ប៉ុន្តែខ្ញុំកុហកទេ។',
      'នោះស្ទើរតែជាការប្រកួតប្រជែង។ ស្ទើរតែ។',
      'ក្តារនេះជារបស់ខ្ញុំ។ អ្នកអាចសាកល្បងម្តងទៀត។',
    ],
  },
  lose: {
    en: [
      'Enjoy it. I was testing a new strategy. It failed.',
      "You beat me. Don't let it go to your head.",
      "Fine. Rematch. I won't hold back this time.",
    ],
    km: [
      'រីករាយទៅ។ ខ្ញុំកំពុងសាកល្បងយុទ្ធសាស្ត្រថ្មី។ វាបរាជ័យ។',
      'អ្នកឈ្នះខ្ញុំ។ កុំឲ្យវាឡើងក្បាលពេក។',
      'មិនអីទេ។ លេងម្តងទៀត។ ពេលនេះខ្ញុំមិនបន្ធូរបន្ថយទេ។',
    ],
  },
  draw: {
    en: [
      'A draw. You survived. Barely.',
      "Nobody won. That means I didn't lose. I'll take it.",
      "We're evenly matched. How boring.",
    ],
    km: [
      'ស្មើគ្នា។ អ្នករស់រានបាន។ តែបន្តិចទេ។',
      'គ្មានអ្នកឈ្នះ។ មានន័យថាខ្ញុំមិនចាញ់។ ខ្ញុំយក។',
      'យើងស្មើគ្នា។ គួរឲ្យធុញណាស់។',
    ],
  },
};

/**
 * Picks a taunt matching the player's language. Khmer falls back to English
 * only when the mood has no localized lines (it always does today).
 */
export function pickAiTaunt(
  mood: AiTauntMood,
  languageCode?: string | null,
  rng: () => number = Math.random,
): string {
  const language: TauntLanguage = (languageCode ?? '').toLowerCase().startsWith('km') ? 'km' : 'en';
  const pool = AI_TAUNTS[mood][language];
  const fallback = AI_TAUNTS[mood].en;
  const roll = Math.min(0.999_999, Math.max(0, rng()));
  const index = Math.floor(roll * pool.length);
  return pool[index] ?? fallback[0] ?? '';
}
