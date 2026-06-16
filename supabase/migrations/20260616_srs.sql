-- Spaced Repetition: card progress per user per deck
CREATE TABLE IF NOT EXISTS card_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  deck_id       text NOT NULL,
  card_id       text NOT NULL,
  due_date      date NOT NULL DEFAULT CURRENT_DATE,
  interval_days integer NOT NULL DEFAULT 1,
  ease_factor   numeric(4,2) NOT NULL DEFAULT 2.50,
  repetitions   integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, deck_id, card_id)
);

ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own card progress"
  ON card_progress FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Study sessions history per user per deck
CREATE TABLE IF NOT EXISTS study_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  deck_id       text NOT NULL,
  studied_at    timestamptz NOT NULL DEFAULT now(),
  cards_studied integer NOT NULL,
  correct       integer NOT NULL,
  wrong         integer NOT NULL,
  duration_ms   integer NOT NULL
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own study sessions"
  ON study_sessions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
