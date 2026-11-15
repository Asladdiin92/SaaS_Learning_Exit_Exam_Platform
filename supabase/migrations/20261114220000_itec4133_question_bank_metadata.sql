ALTER TABLE public.learning_outcomes
    ADD COLUMN IF NOT EXISTS outcome_code VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_outcomes_course_code
    ON public.learning_outcomes (course_id, outcome_code)
    WHERE outcome_code IS NOT NULL;

ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS option_explanations JSONB NOT NULL DEFAULT '{}'::jsonb;
