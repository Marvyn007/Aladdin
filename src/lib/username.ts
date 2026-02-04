/**
 * Username Generation Utility
 * Creates memorable, quirky usernames like PixelPuppyCoder, CosmicNinjaMaker
 * Minimum 10 characters, unique, with validation
 */

// Word lists for generating playful usernames
const ADJECTIVES = [
    'Spicy', 'Cosmic', 'Fluffy', 'Electric', 'Turbo', 'Mega', 'Pixel', 'Quantum',
    'Stellar', 'Mystic', 'Neon', 'Fuzzy', 'Zippy', 'Snappy', 'Bouncy', 'Gleaming',
    'Swift', 'Blazing', 'Frosty', 'Misty', 'Sparkly', 'Dazzling', 'Epic', 'Lunar',
    'Solar', 'Atomic', 'Hyper', 'Ultra', 'Cyber', 'Retro', 'Funky', 'Groovy',
    'Chill', 'Peppy', 'Zesty', 'Crispy', 'Toasty', 'Cozy', 'Lucky', 'Happy',
    'Quirky', 'Witty', 'Clever', 'Dreamy', 'Stormy', 'Breezy', 'Sunny', 'Golden',
    'Silver', 'Crystal', 'Velvet', 'Marble', 'Copper', 'Bronze', 'Ruby', 'Jade',
    'Vivid', 'Bold', 'Radiant', 'Glossy', 'Plucky', 'Nimble', 'Keen', 'Fierce'
];

const NOUNS = [
    'Toast', 'Ninja', 'Puppy', 'Koala', 'Penguin', 'Dragon', 'Phoenix', 'Wizard',
    'Panda', 'Tiger', 'Falcon', 'Otter', 'Dolphin', 'Rocket', 'Comet', 'Nebula',
    'Galaxy', 'Voyager', 'Pioneer', 'Ranger', 'Scout', 'Knight', 'Rogue', 'Sage',
    'Noodle', 'Waffle', 'Pretzel', 'Muffin', 'Donut', 'Cookie', 'Taco', 'Nacho',
    'Pixel', 'Byte', 'Circuit', 'Widget', 'Gadget', 'Robot', 'Droid', 'Cyborg',
    'Pebble', 'Boulder', 'Thunder', 'Storm', 'Blizzard', 'Aurora', 'Breeze', 'Wave',
    'Spark', 'Flame', 'Ember', 'Frost', 'Shadow', 'Echo', 'Whisper', 'Dream',
    'Cloud', 'Star', 'Moon', 'Orbit', 'Cosmos', 'Horizon', 'Lynx', 'Badger',
    'Ferret', 'Hedgehog', 'Squirrel', 'Rabbit', 'Hamster', 'Owl', 'Raven', 'Hawk'
];

const HOBBIES = [
    'Coder', 'Hacker', 'Gamer', 'Artist', 'Maker', 'Builder', 'Crafter', 'Writer',
    'Runner', 'Surfer', 'Diver', 'Climber', 'Explorer', 'Hunter', 'Rider', 'Racer',
    'Glider', 'Drifter', 'Wanderer', 'Seeker', 'Dreamer', 'Thinker', 'Creator',
    'Singer', 'Dancer', 'Painter', 'Chef', 'Baker', 'Brewer', 'Mixer', 'Spinner',
    'Reader', 'Scribe', 'Poet', 'Bard', 'Sage', 'Scholar', 'Mentor', 'Guide'
];

// Reserved/blocked words (case-insensitive check)
const RESERVED_WORDS = [
    'user', 'admin', 'administrator', 'root', 'system', 'guest', 'anonymous',
    'null', 'undefined', 'test', 'demo', 'example', 'default', 'unknown',
    'moderator', 'mod', 'staff', 'support', 'help', 'info', 'contact',
    'official', 'verified', 'legacy', 'deleted', 'banned', 'suspended'
];

// Offensive patterns (simplified blocklist)
const OFFENSIVE_PATTERNS = [
    /ass/i, /fuck/i, /shit/i, /damn/i, /hell/i, /bitch/i, /crap/i,
    /dick/i, /cock/i, /pussy/i, /slut/i, /whore/i, /nigger/i, /nigga/i,
    /fag/i, /retard/i, /idiot/i, /stupid/i, /dumb/i, /hate/i, /kill/i
];

/**
 * Generate a random quirky username (adjective + noun + hobby)
 * Always produces 10+ character usernames
 */
export function generateUsername(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

    // 70% chance to add a hobby suffix for extra length and personality
    const useHobby = Math.random() < 0.7;
    const hobby = useHobby ? HOBBIES[Math.floor(Math.random() * HOBBIES.length)] : '';

    let username = `${adjective}${noun}${hobby}`;

    // If still less than 10 chars, add a number suffix
    if (username.length < 10) {
        const suffix = Math.floor(Math.random() * 900) + 100; // 100-999
        username = `${username}${suffix}`;
    }

    return username;
}

/**
 * Generate multiple unique username suggestions
 */
export function generateUsernameSuggestions(count: number = 5): string[] {
    const suggestions = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 10;

    while (suggestions.size < count && attempts < maxAttempts) {
        const candidate = generateUsername();
        const validation = validateUsername(candidate);
        if (validation.valid) {
            suggestions.add(candidate);
        }
        attempts++;
    }

    return Array.from(suggestions);
}

/**
 * Validate username format and content
 * Rules:
 * - Must be at least 10 characters
 * - Max 30 characters  
 * - Only letters, numbers, hyphens, underscores allowed
 * - Cannot start/end with hyphen or underscore
 * - Cannot be a reserved word
 * - Cannot contain offensive patterns
 */
export function validateUsername(username: string | null | undefined): { valid: boolean; error?: string } {
    // Empty/null is valid (allows clearing username)
    if (!username || username.trim().length === 0) {
        return { valid: true };
    }

    const trimmed = username.trim();

    // Length checks
    if (trimmed.length < 10) {
        return { valid: false, error: 'Username must be at least 10 characters.' };
    }

    if (trimmed.length > 30) {
        return { valid: false, error: 'Username must be 30 characters or less.' };
    }

    // Character allow-list: letters, numbers, hyphen, underscore
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores (no spaces).' };
    }

    // Cannot start/end with special chars
    if (/^[-_]/.test(trimmed) || /[-_]$/.test(trimmed)) {
        return { valid: false, error: 'Username cannot start or end with a hyphen or underscore.' };
    }

    // Reserved word check (case-insensitive)
    const lower = trimmed.toLowerCase();
    if (RESERVED_WORDS.some(word => lower === word || lower.includes(word))) {
        return { valid: false, error: 'This username contains a reserved word and cannot be used.' };
    }

    // Offensive content check
    if (OFFENSIVE_PATTERNS.some(pattern => pattern.test(trimmed))) {
        return { valid: false, error: 'This username contains inappropriate content.' };
    }

    return { valid: true };
}

/**
 * Check if a username is a reserved/blocked word
 */
export function isReservedUsername(username: string): boolean {
    const lower = username.toLowerCase().trim();
    return RESERVED_WORDS.some(word => lower === word || lower.includes(word));
}

/**
 * Normalize username for comparison (lowercase, trimmed)
 */
export function normalizeUsername(username: string): string {
    return username.toLowerCase().trim();
}

