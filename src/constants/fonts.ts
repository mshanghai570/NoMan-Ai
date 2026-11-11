export interface FontOption {
  family: string;
  label: string;
  category: 'sans' | 'serif' | 'mono' | 'display';
  previewText?: string;
  isGoogleFont: boolean;
}

export const CURATED_FONTS: FontOption[] = [
  // Modern Clean Sans
  { family: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans (Default)', category: 'sans', isGoogleFont: true },
  { family: 'Inter', label: 'Inter (Clean & Balanced)', category: 'sans', isGoogleFont: true },
  { family: 'Space Grotesk', label: 'Space Grotesk (Tech Modern)', category: 'sans', isGoogleFont: true },
  { family: 'Outfit', label: 'Outfit (Geometric Clean)', category: 'sans', isGoogleFont: true },
  { family: 'Poppins', label: 'Poppins (Soft & Friendly)', category: 'sans', isGoogleFont: true },
  { family: 'Syne', label: 'Syne (Artistic & Bold)', category: 'sans', isGoogleFont: true },
  { family: 'Urbanist', label: 'Urbanist (Minimalist Tech)', category: 'sans', isGoogleFont: true },
  { family: 'Lexend', label: 'Lexend (High Readability)', category: 'sans', isGoogleFont: true },

  // Editorial & High-Fashion Serif
  { family: 'Playfair Display', label: 'Playfair Display (Luxury & Drama)', category: 'serif', isGoogleFont: true },
  { family: 'Cinzel', label: 'Cinzel (Mythic & Cinematic)', category: 'serif', isGoogleFont: true },
  { family: 'Cormorant Garamond', label: 'Cormorant (Ethereal Vintage)', category: 'serif', isGoogleFont: true },
  { family: 'Merriweather', label: 'Merriweather (Editorial Book)', category: 'serif', isGoogleFont: true },
  { family: 'Lora', label: 'Lora (Contemporary Serif)', category: 'serif', isGoogleFont: true },
  { family: 'DM Serif Display', label: 'DM Serif Display (Sculpted Elegance)', category: 'serif', isGoogleFont: true },

  // Sci-Fi, Cyberpunk & Monospace
  { family: 'JetBrains Mono', label: 'JetBrains Mono (Developer Favorite)', category: 'mono', isGoogleFont: true },
  { family: 'Orbitron', label: 'Orbitron (Futuristic Sci-Fi)', category: 'display', isGoogleFont: true },
  { family: 'Rajdhani', label: 'Rajdhani (HUD & Mecha UI)', category: 'display', isGoogleFont: true },
  { family: 'Space Mono', label: 'Space Mono (Retro Cyberpunk)', category: 'mono', isGoogleFont: true },
  { family: 'Fira Code', label: 'Fira Code (Geometric Code)', category: 'mono', isGoogleFont: true },
  { family: 'Share Tech Mono', label: 'Share Tech Mono (Console Terminal)', category: 'mono', isGoogleFont: true },

  // Creative & Display
  { family: 'Audiowide', label: 'Audiowide (Synthwave Electronic)', category: 'display', isGoogleFont: true },
  { family: 'Righteous', label: 'Righteous (Retro Neo-Arcade)', category: 'display', isGoogleFont: true },
  { family: 'Unbounded', label: 'Unbounded (Ultrawide Display)', category: 'display', isGoogleFont: true },
  { family: 'Syncopate', label: 'Syncopate (Architectural Wide)', category: 'display', isGoogleFont: true },
];

export const FONT_PAIRING_PRESETS = [
  {
    name: 'Modern Cyber Studio',
    heading: 'Space Grotesk',
    body: 'Plus Jakarta Sans',
    mono: 'JetBrains Mono',
    vibe: 'Default high-tech look',
  },
  {
    name: 'Futuristic Mecha HUD',
    heading: 'Orbitron',
    body: 'Rajdhani',
    mono: 'Share Tech Mono',
    vibe: 'Sci-fi consoles & mecha',
  },
  {
    name: 'Luxury Dark Editorial',
    heading: 'Cinzel',
    body: 'Plus Jakarta Sans',
    mono: 'JetBrains Mono',
    vibe: 'High fashion & cinematic art',
  },
  {
    name: '80s Synthwave Arcade',
    heading: 'Audiowide',
    body: 'Space Grotesk',
    mono: 'Space Mono',
    vibe: 'Neon grid & retro arcade',
  },
  {
    name: 'Vintage Ethereal Novel',
    heading: 'Playfair Display',
    body: 'Merriweather',
    mono: 'JetBrains Mono',
    vibe: 'Elegance & rich storytelling',
  },
  {
    name: 'Clean Minimalist Nordic',
    heading: 'Urbanist',
    body: 'Inter',
    mono: 'Fira Code',
    vibe: 'Clutter-free Scandinavian',
  },
  {
    name: 'Terminal Hacker Matrix',
    heading: 'Share Tech Mono',
    body: 'JetBrains Mono',
    mono: 'JetBrains Mono',
    vibe: 'Monochrome console matrix',
  },
];
