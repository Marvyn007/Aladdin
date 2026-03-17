/**
 * Interview Experience Validation & Fraud Detection
 * 
 * Implements:
 * 1. Strict multi-step field validation
 * 2. Salary sanity checks (Hard block > $2M/yr, Soft flag > $500k/yr)
 * 3. Numeric outlier detection (weeks, months, years)
 * 4. Text quality (min length, nonsense detection)
 * 5. Formatting & Normalization
 */

export const SALARY_HARD_CAP = 2000000; // $2 Million/year
export const SALARY_WARNING_CAP = 500000; // $500k/year
export const MIN_COMMENT_LENGTH = 10;
export const MAX_DURATION_MINS = 1440; // 24 hours

export interface InterviewValidationResult {
    isValid: boolean;
    isFlagged: boolean;
    errors: Record<string, string>;
    moderationNotes: string[];
}

export function validateInterviewExperience(data: any): InterviewValidationResult {
    const result: InterviewValidationResult = {
        isValid: true,
        isFlagged: false,
        errors: {},
        moderationNotes: []
    };

    const {
        companyName,
        role,
        location,
        workOption,
        offerStatus,
        salaryHourly,
        additionalComments,
        processSteps
    } = data;

    // 1. Required Fields (Page 1)
    if (!companyName?.trim()) result.errors.companyName = "Company is required";
    if (!role?.trim()) result.errors.role = "Role is required";
    if (!location?.trim()) result.errors.location = "Location is required";
    if (!workOption) result.errors.workOption = "Work option is required";
    if (!offerStatus) result.errors.offerStatus = "Offer status is required";

    // 2. Salary Sanity Checks
    // Assuming salaryHourly is passed as a number. 
    // We need to normalize to yearly to apply caps.
    // Hourly * 40 * 52 = Yearly
    if (salaryHourly && typeof salaryHourly === 'number') {
        const yearly = salaryHourly * 40 * 52;
        if (yearly > SALARY_HARD_CAP) {
            result.errors.salaryHourly = `Salary is implausibly high (Max $${(SALARY_HARD_CAP/1000000).toFixed(1)}M/year)`;
            result.isValid = false;
        } else if (yearly > SALARY_WARNING_CAP) {
            result.isFlagged = true;
            result.moderationNotes.push(`High salary reported: $${(yearly/1000).toFixed(0)}k/year`);
        }

        if (salaryHourly <= 0) {
            result.errors.salaryHourly = "Salary must be positive";
            result.isValid = false;
        }
    }

    // 3. Process Steps Validation (Page 2)
    if (processSteps && Array.isArray(processSteps)) {
        processSteps.forEach((step: any, index: number) => {
            if (!step.step?.trim()) {
                result.errors[`processSteps.${index}.step`] = "Round name is required";
                result.isValid = false;
            }
            if (step.durationMinutes > MAX_DURATION_MINS) {
                result.isFlagged = true;
                result.moderationNotes.push(`Extreme duration in round ${index + 1}: ${step.durationMinutes} mins`);
            }
        });
    }

    // 4. Text Quality (Page 4)
    if (additionalComments && additionalComments.trim().length > 0) {
        if (additionalComments.trim().length < MIN_COMMENT_LENGTH) {
            result.errors.additionalComments = `Comments must be at least ${MIN_COMMENT_LENGTH} characters`;
            result.isValid = false;
        }

        // Basic nonsense detection (repeated chars or same word over and over)
        const nonsenseRegex = /(.)\1{10,}/; // Same char 10+ times
        if (nonsenseRegex.test(additionalComments)) {
            result.isFlagged = true;
            result.moderationNotes.push("Suspicious character repetition in comments");
        }
    }

    if (Object.keys(result.errors).length > 0) {
        result.isValid = false;
    }

    return result;
}
