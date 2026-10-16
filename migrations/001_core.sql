-- Initial ZoKivo database (idempotent; run before 002+)
CREATE TABLE IF NOT EXISTS quiz_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS questions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quiz_set_id uuid NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
 question text NOT NULL,choices jsonb NOT NULL CHECK(jsonb_typeof(choices)='array' AND jsonb_array_length(choices)=4),
 correct_index smallint NOT NULL CHECK(correct_index BETWEEN 0 AND 3),
 position integer NOT NULL, UNIQUE(quiz_set_id,position));
CREATE TABLE IF NOT EXISTS rooms(pin char(6) PRIMARY KEY CHECK(pin ~ '^[0-9]{6}$'),
 quiz_set_id uuid NOT NULL REFERENCES quiz_sets(id),host_token_hash char(64) NOT NULL,
 status text NOT NULL DEFAULT 'lobby' CHECK(status IN('lobby','playing','finished')),
 current_index integer NOT NULL DEFAULT 0,deadline timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_pin char(6) NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,
 nickname varchar(24) NOT NULL,token_hash char(64) NOT NULL,score integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(room_pin,nickname));
CREATE TABLE IF NOT EXISTS answers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,room_pin char(6) NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,
 question_index integer NOT NULL,chosen_index smallint NOT NULL CHECK(chosen_index BETWEEN 0 AND 3),
 is_correct boolean NOT NULL,points integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(player_id,question_index));
INSERT INTO quiz_sets(id,title) VALUES('b91f4600-1000-4000-8000-000000000001','World Explorer 🌍') ON CONFLICT(id) DO NOTHING;
INSERT INTO questions(quiz_set_id,position,question,choices,correct_index) VALUES
('b91f4600-1000-4000-8000-000000000001',0,'What is the capital of Malaysia?','["Johor Bahru","Kuala Lumpur","Penang","Kuching"]'::jsonb,1),
('b91f4600-1000-4000-8000-000000000001',1,'What planet is called the Red Planet?','["Venus","Mars","Jupiter","Neptune"]'::jsonb,1),
('b91f4600-1000-4000-8000-000000000001',2,'How many continents are there?','["5","6","7","8"]'::jsonb,2),
('b91f4600-1000-4000-8000-000000000001',3,'What is 12 × 8?','["86","96","108","112"]'::jsonb,1)
ON CONFLICT(quiz_set_id,position) DO NOTHING;
