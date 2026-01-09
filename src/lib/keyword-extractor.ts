/**
 * Keyword Extractor - Deterministic keyword extraction for ATS scoring
 * No AI hallucinations - pure algorithmic keyword matching
 */

// Technology keywords database (comprehensive list for software engineering)
const TECH_KEYWORDS: Record<string, string[]> = {
    // Languages
    languages: [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
        'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl',
        'Objective-C', 'Dart', 'Lua', 'Haskell', 'Elixir', 'Clojure', 'F#',
        'Assembly', 'COBOL', 'Fortran', 'Julia', 'Groovy', 'Shell', 'Bash',
        'PowerShell', 'SQL', 'HTML', 'CSS', 'SASS', 'LESS', 'XML', 'JSON', 'YAML',
    ],
    // Frameworks
    frameworks: [
        'React', 'React.js', 'ReactJS', 'Angular', 'AngularJS', 'Vue', 'Vue.js',
        'Next.js', 'NextJS', 'Nuxt', 'Gatsby', 'Svelte', 'Ember', 'Backbone',
        'Node.js', 'NodeJS', 'Express', 'Express.js', 'Fastify', 'Koa', 'NestJS',
        'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Rails', 'Ruby on Rails',
        'Laravel', 'Symfony', 'ASP.NET', '.NET', '.NET Core', 'Blazor',
        'React Native', 'Flutter', 'Ionic', 'Xamarin', 'Electron',
        'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'pandas', 'NumPy',
        'jQuery', 'Bootstrap', 'Tailwind', 'TailwindCSS', 'Material UI', 'Chakra UI',
    ],
    // Databases
    databases: [
        'PostgreSQL', 'Postgres', 'MySQL', 'MariaDB', 'SQLite', 'Oracle', 'SQL Server',
        'MongoDB', 'Mongoose', 'Cassandra', 'DynamoDB', 'Firebase', 'Firestore',
        'Redis', 'Memcached', 'Elasticsearch', 'Solr', 'Neo4j', 'CouchDB',
        'Supabase', 'PlanetScale', 'Prisma', 'Sequelize', 'TypeORM', 'Drizzle',
    ],
    // Cloud & DevOps
    cloud: [
        'AWS', 'Amazon Web Services', 'EC2', 'S3', 'Lambda', 'ECS', 'EKS',
        'Azure', 'Google Cloud', 'GCP', 'Firebase', 'Heroku', 'Vercel', 'Netlify',
        'DigitalOcean', 'Linode', 'Cloudflare', 'Render',
        'Docker', 'Kubernetes', 'K8s', 'Helm', 'Terraform', 'Ansible', 'Puppet', 'Chef',
        'Jenkins', 'CircleCI', 'GitHub Actions', 'GitLab CI', 'Travis CI', 'ArgoCD',
        'CI/CD', 'DevOps', 'SRE', 'Infrastructure as Code', 'IaC',
    ],
    // Tools
    tools: [
        'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial',
        'npm', 'yarn', 'pnpm', 'pip', 'Maven', 'Gradle', 'Webpack', 'Vite', 'Rollup',
        'ESLint', 'Prettier', 'Babel', 'SWC', 'esbuild',
        'Jest', 'Mocha', 'Jasmine', 'Cypress', 'Playwright', 'Selenium', 'Puppeteer',
        'Postman', 'Insomnia', 'Swagger', 'OpenAPI',
        'Jira', 'Confluence', 'Trello', 'Asana', 'Linear', 'Notion',
        'Figma', 'Sketch', 'Adobe XD', 'InVision',
        'VS Code', 'Visual Studio', 'IntelliJ', 'WebStorm', 'PyCharm', 'Eclipse', 'Vim',
        'Slack', 'Discord', 'Teams',
    ],
    // Concepts
    concepts: [
        'REST', 'RESTful', 'GraphQL', 'gRPC', 'WebSocket', 'API', 'APIs',
        'Microservices', 'Monolith', 'Serverless', 'Event-driven',
        'Agile', 'Scrum', 'Kanban', 'Waterfall', 'Sprint',
        'TDD', 'BDD', 'Unit Testing', 'Integration Testing', 'E2E',
        'OOP', 'Functional Programming', 'Design Patterns', 'SOLID',
        'MVC', 'MVVM', 'Clean Architecture', 'Domain-Driven Design', 'DDD',
        'OAuth', 'JWT', 'SSO', 'SAML', 'Authentication', 'Authorization',
        'Security', 'Encryption', 'SSL', 'TLS', 'HTTPS',
        'Performance', 'Optimization', 'Caching', 'CDN', 'Load Balancing',
        'Responsive Design', 'Mobile-first', 'Accessibility', 'a11y', 'i18n',
        'SEO', 'Analytics', 'Monitoring', 'Logging', 'Observability',
        'Machine Learning', 'ML', 'AI', 'NLP', 'Computer Vision', 'Deep Learning',
        'Data Science', 'Data Engineering', 'ETL', 'Data Pipeline',
        'Blockchain', 'Smart Contracts', 'Web3',
    ],
};

// Synonym mappings for normalization
const SYNONYMS: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'py': 'Python',
    'node': 'Node.js',
    'react.js': 'React',
    'reactjs': 'React',
    'vue.js': 'Vue',
    'vuejs': 'Vue',
    'next': 'Next.js',
    'nextjs': 'Next.js',
    'postgres': 'PostgreSQL',
    'mongo': 'MongoDB',
    'k8s': 'Kubernetes',
    'aws': 'AWS',
    'gcp': 'Google Cloud',
    'ml': 'Machine Learning',
    'ai': 'AI',
    'restful': 'REST',
    'ci/cd': 'CI/CD',
    'cicd': 'CI/CD',
};

// Stopwords to filter out
const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'then', 'once', 'if', 'because',
    'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'any', 'your', 'our', 'their',
    'experience', 'required', 'preferred', 'skills', 'ability', 'strong',
    'excellent', 'good', 'great', 'working', 'knowledge', 'understanding',
    'proficient', 'proficiency', 'familiar', 'familiarity', 'years', 'year',
    'minimum', 'plus', 'bonus', 'nice', 'etc', 'including', 'related',
]);

// Role-critical keywords (weighted higher in scoring)
const CRITICAL_KEYWORDS = new Set([
    'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java',
    'REST', 'API', 'AWS', 'Docker', 'Kubernetes', 'SQL', 'Git',
    'Agile', 'Scrum', 'CI/CD', 'Testing',
]);

/**
 * Normalize a keyword to its canonical form
 */
function normalizeKeyword(keyword: string): string {
    const lower = keyword.toLowerCase().trim();
    return SYNONYMS[lower] || keyword;
}

/**
 * Build a set of all known tech keywords (lowercase for matching)
 */
function buildKeywordSet(): Set<string> {
    const keywords = new Set<string>();
    Object.values(TECH_KEYWORDS).forEach(arr => {
        arr.forEach(k => keywords.add(k.toLowerCase()));
    });
    return keywords;
}

const KNOWN_KEYWORDS = buildKeywordSet();

export interface ExtractedKeywords {
    all: string[];           // All unique keywords found
    critical: string[];      // Role-critical keywords
    standard: string[];      // Non-critical keywords
    categories: Record<string, string[]>;
}

/**
 * Extract technical keywords from text (job description)
 */
export function extractKeywords(text: string): ExtractedKeywords {
    if (!text) return { all: [], critical: [], standard: [], categories: {} };

    // Tokenize: split on whitespace and punctuation, keep tech symbols
    const tokens = text
        .replace(/[^\w\s\-\+\#\.\/]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOPWORDS.has(t.toLowerCase()));

    const found = new Map<string, string>(); // lowercase -> canonical
    const categories: Record<string, Set<string>> = {};

    // Check each token against known keywords
    for (const token of tokens) {
        const lower = token.toLowerCase();

        // Direct match
        if (KNOWN_KEYWORDS.has(lower)) {
            const canonical = normalizeKeyword(token);
            found.set(lower, canonical);
        }

        // Check for multi-word matches (e.g., "Node.js", "Ruby on Rails")
        // This is handled by the presence of such tokens in the set
    }

    // Also do phrase matching for multi-word keywords
    const textLower = text.toLowerCase();
    Object.entries(TECH_KEYWORDS).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
            if (textLower.includes(keyword.toLowerCase())) {
                const canonical = normalizeKeyword(keyword);
                found.set(keyword.toLowerCase(), canonical);

                if (!categories[category]) categories[category] = new Set();
                categories[category].add(canonical);
            }
        });
    });

    const all = Array.from(new Set(found.values()));
    const critical = all.filter(k => CRITICAL_KEYWORDS.has(k));
    const standard = all.filter(k => !CRITICAL_KEYWORDS.has(k));

    const catResult: Record<string, string[]> = {};
    Object.entries(categories).forEach(([cat, set]) => {
        catResult[cat] = Array.from(set);
    });

    return { all, critical, standard, categories: catResult };
}

export interface KeywordMatch {
    matched: string[];       // Keywords present in resume
    missing: string[];       // Keywords not in resume
    matchedCritical: string[];
    missingCritical: string[];
}

/**
 * Compare job keywords against resume content
 */
export function matchKeywords(
    jobKeywords: ExtractedKeywords,
    resumeText: string,
    linkedInText?: string
): KeywordMatch {
    const resumeLower = (resumeText + ' ' + (linkedInText || '')).toLowerCase();

    const matched: string[] = [];
    const missing: string[] = [];
    const matchedCritical: string[] = [];
    const missingCritical: string[] = [];

    for (const keyword of jobKeywords.all) {
        const keywordLower = keyword.toLowerCase();
        const isPresent = resumeLower.includes(keywordLower);
        const isCritical = CRITICAL_KEYWORDS.has(keyword);

        if (isPresent) {
            matched.push(keyword);
            if (isCritical) matchedCritical.push(keyword);
        } else {
            missing.push(keyword);
            if (isCritical) missingCritical.push(keyword);
        }
    }

    return { matched, missing, matchedCritical, missingCritical };
}

export interface ATSScore {
    raw: number;            // (matched / total) * 100
    weighted: number;       // Weighted by critical keywords
    matchedCount: number;
    totalCount: number;
    criticalMatchedCount: number;
    criticalTotalCount: number;
}

/**
 * Calculate deterministic ATS score
 */
export function calculateATSScore(
    jobKeywords: ExtractedKeywords,
    keywordMatch: KeywordMatch
): ATSScore {
    const totalCount = jobKeywords.all.length;
    const matchedCount = keywordMatch.matched.length;
    const criticalTotalCount = jobKeywords.critical.length;
    const criticalMatchedCount = keywordMatch.matchedCritical.length;

    if (totalCount === 0) {
        return { raw: 100, weighted: 100, matchedCount: 0, totalCount: 0, criticalMatchedCount: 0, criticalTotalCount: 0 };
    }

    // Raw score: simple percentage
    const raw = Math.round((matchedCount / totalCount) * 100);

    // Weighted score: critical keywords count 2x
    const standardMatched = matchedCount - criticalMatchedCount;
    const standardTotal = totalCount - criticalTotalCount;
    const weightedMatched = (criticalMatchedCount * 2) + standardMatched;
    const weightedTotal = (criticalTotalCount * 2) + standardTotal;
    const weighted = weightedTotal > 0 ? Math.round((weightedMatched / weightedTotal) * 100) : 100;

    return {
        raw,
        weighted,
        matchedCount,
        totalCount,
        criticalMatchedCount,
        criticalTotalCount,
    };
}

export interface KeywordSuggestion {
    keyword: string;
    suggestedSection: 'skills' | 'summary' | 'experience' | 'projects';
    suggestedPhrase: string;
    isCritical: boolean;
}

/**
 * Generate deterministic suggestions for missing keywords
 */
export function generateKeywordSuggestions(
    missingKeywords: string[],
    jobKeywords: ExtractedKeywords
): KeywordSuggestion[] {
    const suggestions: KeywordSuggestion[] = [];

    for (const keyword of missingKeywords) {
        const isCritical = CRITICAL_KEYWORDS.has(keyword);

        // Determine best section based on keyword category
        let suggestedSection: KeywordSuggestion['suggestedSection'] = 'skills';
        let suggestedPhrase = keyword;

        // Database/cloud keywords -> skills
        if (jobKeywords.categories.databases?.includes(keyword) ||
            jobKeywords.categories.cloud?.includes(keyword)) {
            suggestedSection = 'skills';
            suggestedPhrase = keyword;
        }
        // Framework/language -> could be in projects
        else if (jobKeywords.categories.frameworks?.includes(keyword)) {
            suggestedSection = 'projects';
            suggestedPhrase = `Implemented using ${keyword}`;
        }
        // Concepts -> summary
        else if (jobKeywords.categories.concepts?.includes(keyword)) {
            suggestedSection = 'summary';
            suggestedPhrase = `Experience with ${keyword}`;
        }
        // Tools -> skills
        else if (jobKeywords.categories.tools?.includes(keyword)) {
            suggestedSection = 'skills';
            suggestedPhrase = keyword;
        }

        suggestions.push({
            keyword,
            suggestedSection,
            suggestedPhrase,
            isCritical,
        });
    }

    // Sort: critical first
    return suggestions.sort((a, b) => (b.isCritical ? 1 : 0) - (a.isCritical ? 1 : 0));
}

/**
 * Main function: analyze job description against resume
 */
export function analyzeJobForATS(
    jobDescription: string,
    resumeText: string,
    linkedInText?: string
): {
    keywords: ExtractedKeywords;
    match: KeywordMatch;
    score: ATSScore;
    suggestions: KeywordSuggestion[];
} {
    const keywords = extractKeywords(jobDescription);
    const match = matchKeywords(keywords, resumeText, linkedInText);
    const score = calculateATSScore(keywords, match);
    const suggestions = generateKeywordSuggestions(match.missing, keywords);

    return { keywords, match, score, suggestions };
}
