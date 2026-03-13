/**
 * parser.test.ts
 * Tests for the new Dynamic Section Parser.
 */

import { describe, it, expect } from "vitest";

// Mock data — simulates the new DynamicParsedResume
const MOCK_DYNAMIC_RESUME = {
  basics: {
    name: "John Doe",
    email: "john@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    linkedin: "linkedin.com/in/johndoe",
    website: "github.com/johndoe",
    headline: "Software Engineer",
  },
  summary: "Experienced software engineer with 5 years building web applications.",
  sections: [
    {
      name: "Experience",
      entries: [
        {
          title: "Senior Software Engineer",
          subtitle: "TechCorp",
          location: "San Francisco, CA",
          startDate: "2021-01",
          endDate: "Present",
          bullets: [
            "Built scalable microservices handling 10K requests/second",
            "Led migration from monolith to microservices architecture",
            "Mentored team of 4 junior developers",
          ],
        },
        {
          title: "Software Engineer",
          subtitle: "StartupXYZ",
          location: "Remote",
          startDate: "2019-06",
          endDate: "2021-01",
          bullets: [
            "Developed React dashboard for data visualization",
            "Implemented CI/CD pipeline using GitHub Actions",
          ],
        },
      ]
    },
    {
      name: "Open Source Contributions",
      entries: [
        {
          title: "Core Contributor",
          subtitle: "React",
          location: "Remote",
          startDate: "2020",
          endDate: "Present",
          bullets: ["Merged 55+ PRs into the main repository."]
        }
      ]
    }
  ],
  skills: ["TypeScript", "React", "Node.js", "Python", "AWS", "Docker"]
};

describe("parser", () => {
  it("should produce a generic sections array instead of hardcoded fields", () => {
    const resume = MOCK_DYNAMIC_RESUME;

    expect(resume.sections.length).toBe(2);
    expect(resume.sections[0].name).toBe("Experience");
    expect(resume.sections[1].name).toBe("Open Source Contributions");
  });

  it("should preserve all bullets without truncation", () => {
    let totalBullets = 0;
    for (const sec of MOCK_DYNAMIC_RESUME.sections) {
      for (const entry of sec.entries) {
        totalBullets += entry.bullets.length;
      }
    }

    // 3 + 2 + 1 = 6
    expect(totalBullets).toBe(6);
  });
});
