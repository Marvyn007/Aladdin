// Seed data script - Populate database with sample jobs for testing

import { v4 as uuidv4 } from 'uuid';

// Sample jobs for testing the UI
export const SAMPLE_JOBS = [
    {
        id: uuidv4(),
        title: 'Software Engineering Intern',
        company: 'Google',
        location: 'Mountain View, CA (Hybrid)',
        source_url: 'https://careers.google.com/jobs/software-engineering-intern',
        posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: 'fresh' as const,
        match_score: 92,
        matched_skills: ['Python', 'JavaScript', 'React', 'Machine Learning', 'Data Structures'],
        missing_skills: ['Go', 'Kubernetes'],
        why: 'Strong match - Skills in Python, React align perfectly with requirements. ML experience is a plus.',
        normalized_text: 'software engineering intern google mountain view python javascript react',
        raw_text_summary: 'We are looking for a Software Engineering Intern to join our team. You will work on cutting-edge projects using Python, JavaScript, and React. Experience with machine learning is a plus.',
    },
    {
        id: uuidv4(),
        title: 'Junior Software Developer',
        company: 'Microsoft',
        location: 'Seattle, WA',
        source_url: 'https://careers.microsoft.com/junior-swe',
        posted_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        status: 'fresh' as const,
        match_score: 85,
        matched_skills: ['C#', '.NET', 'Azure', 'SQL'],
        missing_skills: ['TypeScript', 'Node.js'],
        why: 'Good match - Backend skills align well. Consider learning TypeScript for bonus points.',
        normalized_text: 'junior software developer microsoft seattle c# dotnet azure sql',
        raw_text_summary: 'Join Microsoft as a Junior Software Developer. Work with C#, .NET, and Azure cloud services. Strong SQL skills required.',
    },
    {
        id: uuidv4(),
        title: 'Entry-Level Frontend Engineer',
        company: 'Meta',
        location: 'Menlo Park, CA (Remote OK)',
        source_url: 'https://www.metacareers.com/frontend-engineer',
        posted_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        status: 'fresh' as const,
        match_score: 78,
        matched_skills: ['React', 'JavaScript', 'CSS', 'HTML'],
        missing_skills: ['GraphQL', 'Relay', 'Flow'],
        why: 'Strong frontend skills. Learn GraphQL and Relay to improve match score.',
        normalized_text: 'entry level frontend engineer meta menlo park react javascript css html',
        raw_text_summary: 'Build user interfaces at Meta. Requires React, JavaScript, CSS, and HTML. Experience with GraphQL and Relay is a plus.',
    },
    {
        id: uuidv4(),
        title: 'New Grad Software Engineer',
        company: 'Amazon',
        location: 'Austin, TX',
        source_url: 'https://www.amazon.jobs/new-grad-swe',
        posted_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
        status: 'fresh' as const,
        match_score: 71,
        matched_skills: ['Java', 'AWS', 'Algorithms'],
        missing_skills: ['DynamoDB', 'EC2', 'Lambda'],
        why: 'Java experience is great. AWS knowledge needs strengthening for cloud-first role.',
        normalized_text: 'new grad software engineer amazon austin java aws algorithms',
        raw_text_summary: 'Amazon is hiring new grad software engineers. Strong algorithmic skills and Java experience required. AWS experience preferred.',
    },
    {
        id: uuidv4(),
        title: 'Software Engineering Internship - Backend',
        company: 'Stripe',
        location: 'San Francisco, CA (Remote)',
        source_url: 'https://stripe.com/jobs/backend-intern',
        posted_at: null, // Posted date unknown
        status: 'fresh' as const,
        match_score: 88,
        matched_skills: ['Python', 'Ruby', 'PostgreSQL', 'API Design'],
        missing_skills: ['Scala'],
        why: 'Excellent backend skills match. Payment systems experience would be ideal.',
        normalized_text: 'software engineering internship backend stripe san francisco python ruby postgresql',
        raw_text_summary: 'Join Stripe as a backend engineering intern. Work with Python, Ruby, and PostgreSQL on payment infrastructure.',
    },
    {
        id: uuidv4(),
        title: 'Associate Software Engineer',
        company: 'Datadog',
        location: 'New York, NY',
        source_url: 'https://www.datadoghq.com/careers/associate-swe',
        posted_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        status: 'fresh' as const,
        match_score: 65,
        matched_skills: ['Python', 'Go', 'Docker'],
        missing_skills: ['Prometheus', 'Grafana', 'Observability'],
        why: 'Good foundation. Consider learning observability tools for monitoring roles.',
        normalized_text: 'associate software engineer datadog new york python go docker',
        raw_text_summary: 'Datadog is seeking associate software engineers. Experience with Python, Go, and Docker required. Observability knowledge a plus.',
    },
];

// Sample resume for testing
export const SAMPLE_RESUME = {
    name: 'Marvin Chaudhary',
    email: 'marvin@example.com',
    location: 'New York, NY',
    total_experience_years: 1.5,
    roles: [
        {
            title: 'Software Engineering Intern',
            company: 'Tech Startup Inc',
            start: '2024-05',
            end: '2024-08',
            description: 'Developed React frontend and Python backend services.',
        },
        {
            title: 'Research Assistant',
            company: 'University Lab',
            start: '2023-09',
            end: '2024-04',
            description: 'Built ML models for data analysis using Python and TensorFlow.',
        },
    ],
    education: [
        {
            degree: 'B.S. Computer Science',
            school: 'State University',
            start: '2021',
            end: '2025',
            notes: 'GPA: 3.8',
        },
    ],
    skills: [
        { name: 'Python', level: 'advanced', years: 3 },
        { name: 'JavaScript', level: 'advanced', years: 2 },
        { name: 'React', level: 'intermediate', years: 1.5 },
        { name: 'Java', level: 'intermediate', years: 2 },
        { name: 'SQL', level: 'intermediate', years: 1 },
        { name: 'Docker', level: 'beginner', years: 0.5 },
    ],
    projects: [
        {
            title: 'E-commerce Platform',
            description: 'Full-stack e-commerce app with React, Node.js, and PostgreSQL',
            tech: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
            link: 'https://github.com/marvin/ecommerce',
        },
        {
            title: 'ML Image Classifier',
            description: 'CNN-based image classification using TensorFlow',
            tech: ['Python', 'TensorFlow', 'OpenCV'],
            link: 'https://github.com/marvin/image-classifier',
        },
    ],
    certifications: ['AWS Cloud Practitioner'],
    open_to: ['internship', 'entry-level'],
};

// Function to insert seed data (can be called from API or script)
export async function seedDatabase() {
    console.log('Seeding database with sample data...');

    // This would be called via API or direct database connection
    // For now, just export the data for manual insertion or testing

    return {
        jobs: SAMPLE_JOBS,
        resume: SAMPLE_RESUME,
    };
}

export default seedDatabase;
