import { v4 as uuidv4 } from 'uuid';
import { executeWithUser, getPostgresPool } from '@/lib/postgres';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { getSQLiteDB } from '@/lib/sqlite';
import {
  ONBOARDING_QUESTIONS,
  getOnboardingQuestion,
  type OnboardingAnswerRecord,
  type OnboardingQuestion,
  type OnboardingQuestionType,
  type OnboardingStepId,
} from '@/lib/onboarding';

type DbType = 'postgres' | 'supabase' | 'sqlite';

export interface OnboardingStateRecord {
  status: 'in_progress' | 'complete';
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  profileSetupComplete: boolean;
}

export interface OnboardingSnapshot {
  state: OnboardingStateRecord;
  answers: OnboardingAnswerRecord[];
  answersByKey: Record<string, OnboardingAnswerRecord>;
  requiredAnswered: number;
  requiredTotal: number;
  progress: number;
  completed: boolean;
  profileSetupComplete: boolean;
  allRequiredAnswered: boolean;
}

export interface SaveOnboardingAnswerInput {
  questionKey: string;
  value: unknown;
}

function resolveDbType(): DbType {
  if (process.env.USE_SUPABASE_REST === 'true' && isSupabaseConfigured()) {
    return 'supabase';
  }

  if (process.env.DATABASE_URL) {
    return 'postgres';
  }

  if (process.env.USE_SQLITE === 'true') {
    return 'sqlite';
  }

  throw new Error('No database configured. Set DATABASE_URL, SUPABASE_URL/KEY, or USE_SQLITE=true');
}

function getStepKey(step: OnboardingStepId): string {
  return `step_${step}`;
}

function normalizeMultiValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
    )
  );
}

function normalizeSingleValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTextValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFileValue(value: unknown): { resumeId?: string; filename?: string } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const typed = value as Record<string, unknown>;
  const resumeId = typeof typed.resumeId === 'string' ? typed.resumeId.trim() : '';
  const filename = typeof typed.filename === 'string' ? typed.filename.trim() : '';

  if (!resumeId && !filename) {
    return null;
  }

  return {
    ...(resumeId ? { resumeId } : {}),
    ...(filename ? { filename } : {}),
  };
}

function formatAnswerText(question: OnboardingQuestion, value: unknown): string | null {
  if (question.type === 'multi_select') {
    const selected = normalizeMultiValue(value);
    if (!selected.length) return null;
    const labels = selected
      .map((selectedValue) => question.options?.find((option) => option.value === selectedValue)?.label ?? selectedValue)
      .filter(Boolean);
    return labels.join(', ');
  }

  if (question.type === 'single_select') {
    const selected = normalizeSingleValue(value);
    if (!selected) return null;
    return question.options?.find((option) => option.value === selected)?.label ?? selected;
  }

  if (question.type === 'text') {
    return normalizeTextValue(value);
  }

  if (question.type === 'file') {
    const fileValue = normalizeFileValue(value);
    return fileValue?.filename || fileValue?.resumeId || null;
  }

  return null;
}

function normalizeValue(question: OnboardingQuestion, value: unknown): unknown {
  if (question.type === 'multi_select') {
    return normalizeMultiValue(value);
  }

  if (question.type === 'single_select') {
    return normalizeSingleValue(value);
  }

  if (question.type === 'text') {
    return normalizeTextValue(value);
  }

  if (question.type === 'file') {
    // Allow 'skipped' sentinel value to pass through for optional file questions (e.g. linkedin_pdf)
    if (value === 'skipped') return 'skipped';
    return normalizeFileValue(value);
  }

  return value;
}

function emptyState(): OnboardingStateRecord {
  return {
    status: 'in_progress',
    currentStep: 1,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
    profileSetupComplete: false,
  };
}

function computeProgress(answers: OnboardingAnswerRecord[]): { requiredAnswered: number; requiredTotal: number; progress: number } {
  const requiredQuestions = ONBOARDING_QUESTIONS.filter((question) => question.required);
  const answeredKeys = new Set(
    answers
      .filter((answer) => {
        const question = getOnboardingQuestion(answer.questionKey);
        return !!question?.required && !isEmptyAnswer(answer.value);
      })
      .map((answer) => answer.questionKey)
  );

  const requiredAnswered = requiredQuestions.filter((question) => answeredKeys.has(question.key)).length;
  const requiredTotal = requiredQuestions.length;
  const progress = requiredTotal === 0 ? 0 : Math.round((requiredAnswered / requiredTotal) * 100);

  return { requiredAnswered, requiredTotal, progress };
}

function isEmptyAnswer(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

async function ensureStatePostgres(userId: string) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO user_onboarding_state (user_id, status, current_step, started_at, updated_at)
      VALUES ($1, 'in_progress', 1, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
}

async function ensureStateSupabase(userId: string) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('user_onboarding_state')
    .upsert({ user_id: userId, status: 'in_progress', current_step: 1, started_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

function ensureStateSQLite(userId: string) {
  const db = getSQLiteDB();
  db.prepare(
    `
      INSERT INTO user_onboarding_state (user_id, status, current_step, started_at, updated_at)
      VALUES (?, 'in_progress', 1, datetime('now'), datetime('now'))
      ON CONFLICT(user_id) DO NOTHING
    `
  ).run(userId);
}

async function fetchState(userId: string): Promise<OnboardingStateRecord> {
  const dbType = resolveDbType();

  if (dbType === 'postgres') {
    return executeWithUser(userId, async (client) => {
      await ensureStatePostgres(userId);
      const result = await client.query(
        `
          SELECT status, current_step, started_at, completed_at, updated_at, profile_setup_complete
          FROM user_onboarding_state
          WHERE user_id = $1
        `,
        [userId]
      );

      const row = result.rows[0];
      return {
        status: row?.status === 'complete' ? 'complete' : 'in_progress',
        currentStep: row?.current_step ?? 1,
        startedAt: row?.started_at ? new Date(row.started_at).toISOString() : null,
        completedAt: row?.completed_at ? new Date(row.completed_at).toISOString() : null,
        updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
        profileSetupComplete: Boolean(row?.profile_setup_complete),
      };
    });
  }

  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    await ensureStateSupabase(userId);
    const { data, error } = await client
      .from('user_onboarding_state')
      .select('status, current_step, started_at, completed_at, updated_at, profile_setup_complete')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return emptyState();

    return {
      status: data.status === 'complete' ? 'complete' : 'in_progress',
      currentStep: data.current_step ?? 1,
      startedAt: data.started_at || null,
      completedAt: data.completed_at || null,
      updatedAt: data.updated_at || null,
      profileSetupComplete: Boolean(data.profile_setup_complete),
    };
  }

  ensureStateSQLite(userId);
  const db = getSQLiteDB();
  const row = db
    .prepare(
      `
        SELECT status, current_step, started_at, completed_at, updated_at, profile_setup_complete
        FROM user_onboarding_state
        WHERE user_id = ?
      `
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) return emptyState();

  return {
    status: row.status === 'complete' ? 'complete' : 'in_progress',
    currentStep: Number(row.current_step || 1),
    startedAt: typeof row.started_at === 'string' ? row.started_at : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    profileSetupComplete: Boolean(row.profile_setup_complete),
  };
}

async function fetchAnswers(userId: string): Promise<OnboardingAnswerRecord[]> {
  const dbType = resolveDbType();

  if (dbType === 'postgres') {
    return executeWithUser(userId, async (client) => {
      const result = await client.query(
        `
          SELECT question_key, step_key, question_label, answer_type, answer_json, answer_text, order_index, updated_at
          FROM user_onboarding_answers
          WHERE user_id = $1
          ORDER BY order_index ASC, question_key ASC
        `,
        [userId]
      );

      return result.rows.map((row) => ({
        questionKey: row.question_key,
        step: row.step_key === 'step_2' ? 2 : 1,
        order: row.order_index ?? 0,
        type: row.answer_type,
        title: row.question_label,
        value: row.answer_json,
        answerText: row.answer_text ?? null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      }));
    });
  }

  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_onboarding_answers')
      .select('question_key, step_key, question_label, answer_type, answer_json, answer_text, order_index, updated_at')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      questionKey: row.question_key,
      step: row.step_key === 'step_2' ? 2 : 1,
      order: row.order_index ?? 0,
      type: row.answer_type,
      title: row.question_label,
      value: row.answer_json,
      answerText: row.answer_text ?? null,
      updatedAt: row.updated_at || null,
    }));
  }

  ensureStateSQLite(userId);
  const db = getSQLiteDB();
  const rows = db
    .prepare(
      `
        SELECT question_key, step_key, question_label, answer_type, answer_json, answer_text, order_index, updated_at
        FROM user_onboarding_answers
        WHERE user_id = ?
        ORDER BY order_index ASC, question_key ASC
      `
    )
    .all(userId) as Record<string, unknown>[];

  return rows.map((row) => ({
    questionKey: String(row.question_key),
    step: String(row.step_key) === 'step_2' ? 2 : 1,
    order: Number(row.order_index || 0),
    type: row.answer_type as OnboardingQuestionType,
    title: String(row.question_label),
    value: typeof row.answer_json === 'string' ? JSON.parse(row.answer_json as string) : row.answer_json,
    answerText: typeof row.answer_text === 'string' ? row.answer_text : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }));
}

async function saveSingleAnswer(userId: string, question: OnboardingQuestion, value: unknown): Promise<void> {
  const normalizedValue = normalizeValue(question, value);
  const answerText = formatAnswerText(question, value);
  const stepKey = getStepKey(question.step);
  const now = new Date().toISOString();

  const dbType = resolveDbType();

    if (dbType === 'postgres') {
    await executeWithUser(userId, async (client) => {
      await client.query(
        `
          INSERT INTO user_onboarding_answers (
            id, user_id, question_key, step_key, question_label, answer_type, answer_json, answer_text, order_index, question_version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, NOW(), NOW())
          ON CONFLICT (user_id, question_key) DO UPDATE SET
            step_key = EXCLUDED.step_key,
            question_label = EXCLUDED.question_label,
            answer_type = EXCLUDED.answer_type,
            answer_json = EXCLUDED.answer_json,
            answer_text = EXCLUDED.answer_text,
            order_index = EXCLUDED.order_index,
            question_version = EXCLUDED.question_version,
            updated_at = NOW()
        `,
        [
          uuidv4(),
          userId,
          question.key,
          stepKey,
          question.title,
          question.type,
          JSON.stringify(normalizedValue),
          answerText,
          question.order,
          'v1',
        ]
      );
    });
    // Auto-create version history
    await saveAnswerVersion(userId, question, normalizedValue, 'user_update');
    return;
  }

  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { error } = await client.from('user_onboarding_answers').upsert(
      {
        user_id: userId,
        question_key: question.key,
        step_key: stepKey,
        question_label: question.title,
        answer_type: question.type,
        answer_json: normalizedValue,
        answer_text: answerText,
        order_index: question.order,
        question_version: 'v1',
        updated_at: now,
      },
      { onConflict: 'user_id,question_key' }
    );

    if (error) throw error;
    // Auto-create version history
    await saveAnswerVersion(userId, question, normalizedValue, 'user_update');
    return;
  }

  const db = getSQLiteDB();
  db.prepare(
    `
      INSERT INTO user_onboarding_answers (
        id, user_id, question_key, step_key, question_label, answer_type, answer_json, answer_text, order_index, question_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id, question_key) DO UPDATE SET
        step_key = excluded.step_key,
        question_label = excluded.question_label,
        answer_type = excluded.answer_type,
        answer_json = excluded.answer_json,
        answer_text = excluded.answer_text,
        order_index = excluded.order_index,
        question_version = excluded.question_version,
        updated_at = datetime('now')
    `
  ).run(
    uuidv4(),
    userId,
    question.key,
    stepKey,
    question.title,
    question.type,
    JSON.stringify(normalizedValue),
    answerText,
    question.order,
    'v1'
  );
  // Auto-create version history
  await saveAnswerVersion(userId, question, normalizedValue, 'user_update');
}

async function upsertState(userId: string, currentStep: number, complete: boolean): Promise<void> {
  const dbType = resolveDbType();

  if (dbType === 'postgres') {
    await executeWithUser(userId, async (client) => {
      await client.query(
        `
          INSERT INTO user_onboarding_state (user_id, status, current_step, started_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            status = EXCLUDED.status,
            current_step = EXCLUDED.current_step,
            completed_at = CASE
              WHEN EXCLUDED.status = 'complete' THEN COALESCE(user_onboarding_state.completed_at, NOW())
              ELSE user_onboarding_state.completed_at
            END,
            updated_at = NOW()
        `,
        [userId, complete ? 'complete' : 'in_progress', currentStep]
      );
    });
    return;
  }

  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { error } = await client.from('user_onboarding_state').upsert(
      {
        user_id: userId,
        status: complete ? 'complete' : 'in_progress',
        current_step: currentStep,
        updated_at: new Date().toISOString(),
        ...(complete ? { completed_at: new Date().toISOString() } : {}),
      },
      { onConflict: 'user_id' }
    );

    if (error) throw error;
    return;
  }

  const db = getSQLiteDB();
  db.prepare(
    `
      INSERT INTO user_onboarding_state (user_id, status, current_step, started_at, updated_at, completed_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
      ON CONFLICT(user_id) DO UPDATE SET
        status = excluded.status,
        current_step = excluded.current_step,
        completed_at = CASE
          WHEN excluded.status = 'complete' THEN COALESCE(user_onboarding_state.completed_at, datetime('now'))
          ELSE user_onboarding_state.completed_at
        END,
        updated_at = datetime('now')
    `
  ).run(userId, complete ? 'complete' : 'in_progress', currentStep, complete ? new Date().toISOString() : null);
}

export async function getOnboardingSnapshot(userId: string): Promise<OnboardingSnapshot> {
  const [state, answers] = await Promise.all([fetchState(userId), fetchAnswers(userId)]);
  const { requiredAnswered, requiredTotal, progress } = computeProgress(answers);

  return {
    state,
    answers,
    answersByKey: Object.fromEntries(answers.map((answer) => [answer.questionKey, answer])),
    requiredAnswered,
    requiredTotal,
    progress,
    completed: state.status === 'complete' || progress >= 100,
    profileSetupComplete: state.profileSetupComplete,
    allRequiredAnswered: requiredTotal > 0 && requiredAnswered === requiredTotal,
  };
}

export async function saveOnboardingAnswers(
  userId: string,
  inputs: SaveOnboardingAnswerInput[],
  options?: { currentStep?: number; complete?: boolean }
): Promise<OnboardingSnapshot> {
  const filteredInputs = inputs.filter((input) => !!getOnboardingQuestion(input.questionKey));

  for (const input of filteredInputs) {
    const question = getOnboardingQuestion(input.questionKey);
    if (!question) continue;
    await saveSingleAnswer(userId, question, input.value);
  }

  await upsertState(userId, options?.currentStep ?? 1, !!options?.complete);
  // Recompute setup flag after any answer/state change (non-blocking on error)
  await recomputeProfileSetupComplete(userId).catch(() => undefined);
  return getOnboardingSnapshot(userId);
}

export async function markOnboardingComplete(userId: string, currentStep: number = 2): Promise<OnboardingSnapshot> {
  await upsertState(userId, currentStep, true);
  await recomputeProfileSetupComplete(userId).catch(() => undefined);
  return getOnboardingSnapshot(userId);
}

/**
 * Recomputes and persists the profile_setup_complete flag for a user.
 * Setup is complete when: resume uploaded + (linkedin uploaded OR skipped) + preferences completed.
 * Call this after any action that could change these conditions.
 */
export async function recomputeProfileSetupComplete(userId: string): Promise<boolean> {
  const dbType = resolveDbType();

  if (dbType === 'postgres') {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{
        has_resume: boolean;
        has_linkedin: boolean;
        linkedin_skipped: boolean;
        onboarding_done: boolean;
      }>(`
        SELECT
          EXISTS(SELECT 1 FROM resumes WHERE user_id = $1) AS has_resume,
          EXISTS(SELECT 1 FROM linkedin_profiles WHERE user_id = $1) AS has_linkedin,
          EXISTS(
            SELECT 1 FROM user_onboarding_answers
            WHERE user_id = $1 AND question_key = 'linkedin_pdf'
              AND answer_json::text = '"skipped"'
          ) AS linkedin_skipped,
          COALESCE(
            (SELECT (status = 'complete') FROM user_onboarding_state WHERE user_id = $1),
            false
          ) AS onboarding_done
      `, [userId]);

      const row = result.rows[0];
      const isComplete =
        Boolean(row?.has_resume) &&
        (Boolean(row?.has_linkedin) || Boolean(row?.linkedin_skipped)) &&
        Boolean(row?.onboarding_done);

      await client.query(`
        INSERT INTO user_onboarding_state
          (user_id, status, current_step, started_at, updated_at, profile_setup_complete)
        VALUES ($1, 'in_progress', 1, NOW(), NOW(), $2)
        ON CONFLICT (user_id) DO UPDATE SET
          profile_setup_complete = $2,
          updated_at = NOW()
      `, [userId, isComplete]);

      return isComplete;
    } finally {
      client.release();
    }
  }

  if (dbType === 'supabase') {
    const supabase = getSupabaseClient();
    const [resumeRes, linkedinRes, answerRes, stateRes] = await Promise.all([
      supabase.from('resumes').select('id').eq('user_id', userId).limit(1),
      supabase.from('linkedin_profiles').select('id').eq('user_id', userId).limit(1),
      supabase.from('user_onboarding_answers')
        .select('answer_json')
        .eq('user_id', userId)
        .eq('question_key', 'linkedin_pdf')
        .limit(1),
      supabase.from('user_onboarding_state').select('status').eq('user_id', userId).maybeSingle(),
    ]);

    const hasResume = (resumeRes.data?.length ?? 0) > 0;
    const hasLinkedin = (linkedinRes.data?.length ?? 0) > 0;
    const linkedinAnswer = answerRes.data?.[0]?.answer_json;
    const linkedinSkipped = linkedinAnswer === 'skipped';
    const onboardingDone = stateRes.data?.status === 'complete';
    const isComplete = hasResume && (hasLinkedin || linkedinSkipped) && onboardingDone;

    await supabase.from('user_onboarding_state').upsert(
      {
        user_id: userId,
        status: stateRes.data?.status ?? 'in_progress',
        current_step: 1,
        profile_setup_complete: isComplete,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return isComplete;
  }

  // SQLite
  const db = getSQLiteDB();
  const resumeRow = db.prepare('SELECT id FROM resumes WHERE user_id = ? LIMIT 1').get(userId);
  const linkedinRow = db.prepare('SELECT id FROM linkedin_profiles WHERE user_id = ? LIMIT 1').get(userId);
  const answerRow = db
    .prepare("SELECT answer_json FROM user_onboarding_answers WHERE user_id = ? AND question_key = 'linkedin_pdf'")
    .get(userId) as Record<string, unknown> | undefined;
  const stateRow = db
    .prepare('SELECT status FROM user_onboarding_state WHERE user_id = ?')
    .get(userId) as Record<string, unknown> | undefined;

  const hasResume = !!resumeRow;
  const hasLinkedin = !!linkedinRow;
  const rawAnswer = answerRow?.answer_json;
  const linkedinSkipped =
    rawAnswer === '"skipped"' ||
    rawAnswer === 'skipped' ||
    (typeof rawAnswer === 'string' && JSON.parse(rawAnswer) === 'skipped');
  const onboardingDone = stateRow?.status === 'complete';
  const isComplete = hasResume && (hasLinkedin || linkedinSkipped) && onboardingDone;

  db.prepare(`
    INSERT INTO user_onboarding_state
      (user_id, status, current_step, started_at, updated_at, profile_setup_complete)
    VALUES (?, 'in_progress', 1, datetime('now'), datetime('now'), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      profile_setup_complete = excluded.profile_setup_complete,
      updated_at = datetime('now')
  `).run(userId, isComplete ? 1 : 0);

  return isComplete;
}

export function getRequiredOnboardingQuestionCount(): number {
  return ONBOARDING_QUESTIONS.filter((question) => question.required).length;
}

export interface AnswerHistoryRecord {
  id: string;
  questionKey: string;
  version: number;
  answerJson: unknown;
  answerText: string | null;
  changedAt: string;
  changeReason: string | null;
}

export async function getAnswerHistory(userId: string, questionKey: string): Promise<AnswerHistoryRecord[]> {
  const dbType = resolveDbType();
  
  if (dbType === 'postgres') {
    return executeWithUser(userId, async (client) => {
      const result = await client.query(
        `SELECT id, question_key, version, answer_json, answer_text, changed_at, change_reason
         FROM user_onboarding_answer_history
         WHERE user_id = $1 AND question_key = $2
         ORDER BY version DESC`,
        [userId, questionKey]
      );
      return result.rows.map(row => ({
        id: row.id,
        questionKey: row.question_key,
        version: row.version,
        answerJson: row.answer_json,
        answerText: row.answer_text,
        changedAt: row.changed_at,
        changeReason: row.change_reason,
      }));
    });
  }
  
  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_onboarding_answer_history')
      .select('id, question_key, version, answer_json, answer_text, changed_at, change_reason')
      .eq('user_id', userId)
      .eq('question_key', questionKey)
      .order('version', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      questionKey: row.question_key,
      version: row.version,
      answerJson: row.answer_json,
      answerText: row.answer_text,
      changedAt: row.changed_at,
      changeReason: row.change_reason,
    }));
  }
  
  const db = getSQLiteDB();
  const rows = db
    .prepare(`SELECT id, question_key, version, answer_json, answer_text, changed_at, change_reason
              FROM user_onboarding_answer_history
              WHERE user_id = ? AND question_key = ?
              ORDER BY version DESC`)
    .all(userId, questionKey) as Record<string, unknown>[];
  return rows.map(row => ({
    id: String(row.id),
    questionKey: String(row.question_key),
    version: Number(row.version),
    answerJson: typeof row.answer_json === 'string' ? JSON.parse(row.answer_json) : row.answer_json,
    answerText: row.answer_text ? String(row.answer_text) : null,
    changedAt: String(row.changed_at),
    changeReason: row.change_reason ? String(row.change_reason) : null,
  }));
}

async function getNextVersion(userId: string, questionKey: string): Promise<number> {
  const dbType = resolveDbType();
  
  if (dbType === 'postgres') {
    return executeWithUser(userId, async (client) => {
      const result = await client.query(
        `SELECT MAX(version) as max_version FROM user_onboarding_answer_history 
         WHERE user_id = $1 AND question_key = $2`,
        [userId, questionKey]
      );
      return (result.rows[0]?.max_version || 0) + 1;
    });
  }
  
  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { data } = await client
      .from('user_onboarding_answer_history')
      .select('version')
      .eq('user_id', userId)
      .eq('question_key', questionKey)
      .order('version', { ascending: false })
      .limit(1);
    return ((data?.[0]?.version) || 0) + 1;
  }
  
  const db = getSQLiteDB();
  const row = db
    .prepare(`SELECT MAX(version) as max_version FROM user_onboarding_answer_history WHERE user_id = ? AND question_key = ?`)
    .get(userId, questionKey) as Record<string, unknown> | undefined;
  return ((row?.max_version as number) || 0) + 1;
}

export async function saveAnswerVersion(
  userId: string,
  question: OnboardingQuestion,
  value: unknown,
  changeReason?: string
): Promise<void> {
  const normalizedValue = normalizeValue(question, value);
  const answerText = formatAnswerText(question, value);
  const version = await getNextVersion(userId, question.key);
  const now = new Date().toISOString();
  
  const dbType = resolveDbType();
  
  if (dbType === 'postgres') {
    await executeWithUser(userId, async (client) => {
      await client.query(
        `INSERT INTO user_onboarding_answer_history 
         (id, user_id, question_key, version, answer_json, answer_text, changed_at, change_reason)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), $7)`,
        [uuidv4(), userId, question.key, version, JSON.stringify(normalizedValue), answerText, changeReason || null]
      );
    });
    return;
  }
  
  if (dbType === 'supabase') {
    const client = getSupabaseClient();
    const { error } = await client.from('user_onboarding_answer_history').insert({
      user_id: userId,
      question_key: question.key,
      version,
      answer_json: normalizedValue,
      answer_text: answerText,
      changed_at: now,
      change_reason: changeReason || null,
    });
    if (error) throw error;
    return;
  }

  const db = getSQLiteDB();
  db.prepare(
    `INSERT INTO user_onboarding_answer_history 
     (id, user_id, question_key, version, answer_json, answer_text, changed_at, change_reason)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
  ).run(
    uuidv4(),
    userId,
    question.key,
    version,
    JSON.stringify(normalizedValue),
    answerText,
    changeReason || null
  );
}
