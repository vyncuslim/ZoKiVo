-- 012: Original ZoKivo classroom mini-game engines. Virtual credits have no monetary value.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'quiz_party';
ALTER TABLE players ADD COLUMN IF NOT EXISTS defense_code SMALLINT NOT NULL DEFAULT 0 CHECK(defense_code BETWEEN 0 AND 2);
CREATE TABLE IF NOT EXISTS mode_wallets(player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,room_pin CHAR(6) NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,credits INTEGER NOT NULL DEFAULT 0 CHECK(credits>=0),fish_count INTEGER NOT NULL DEFAULT 0,served_count INTEGER NOT NULL DEFAULT 0,cafe_level INTEGER NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mode_events(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),room_pin CHAR(6) NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,question_index INTEGER NOT NULL CHECK(question_index>=0),action TEXT NOT NULL,target_player_id UUID REFERENCES players(id) ON DELETE SET NULL,delta INTEGER NOT NULL DEFAULT 0,target_delta INTEGER NOT NULL DEFAULT 0,detail JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(player_id,question_index));
CREATE INDEX IF NOT EXISTS mode_events_room_idx ON mode_events(room_pin,question_index);
CREATE INDEX IF NOT EXISTS mode_events_target_idx ON mode_events(target_player_id);
CREATE OR REPLACE FUNCTION zokivo_claim_reward(p_pin CHAR(6),p_player UUID,p_action TEXT,p_option INTEGER,p_target UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r rooms%ROWTYPE; p players%ROWTYPE; w mode_wallets%ROWTYPE;
earn INTEGER:=0;loss INTEGER:=0;dice INTEGER;outcome TEXT:='';victim UUID:=NULL;
BEGIN
SELECT * INTO r FROM rooms WHERE pin=p_pin FOR UPDATE;
IF NOT FOUND OR r.game_mode='quiz_party' OR r.status<>'playing' THEN RAISE EXCEPTION 'Mode is not active';END IF;
SELECT * INTO p FROM players WHERE id=p_player AND room_pin=p_pin;
IF NOT FOUND THEN RAISE EXCEPTION 'Player is not in this room';END IF;
IF NOT EXISTS(SELECT 1 FROM answers WHERE player_id=p_player AND room_pin=p_pin AND question_index=r.current_index AND is_correct)
 THEN RAISE EXCEPTION 'A correct answer is required'; END IF;
IF EXISTS(SELECT 1 FROM mode_events WHERE player_id=p_player AND question_index=r.current_index)
 THEN RAISE EXCEPTION 'Reward already claimed'; END IF;
INSERT INTO mode_wallets(player_id,room_pin) VALUES(p_player,p_pin) ON CONFLICT(player_id) DO NOTHING;
dice:=floor(random()*100)::INTEGER;
IF r.game_mode='gold_quest' THEN
 IF p_action<>'chest' OR p_option NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'Select one treasure chest';END IF;
 earn:=25+((dice+p_option*13)%6)*25;outcome:='Chest '||(p_option+1)||' opened';
 IF p_target IS NOT NULL AND p_target<>p_player AND dice%5=0 THEN
  IF NOT EXISTS(SELECT 1 FROM players WHERE id=p_target AND room_pin=p_pin) THEN RAISE EXCEPTION 'Invalid rival';END IF;
  INSERT INTO mode_wallets(player_id,room_pin) VALUES(p_target,p_pin) ON CONFLICT(player_id) DO NOTHING;
  SELECT LEAST(40,credits) INTO loss FROM mode_wallets WHERE player_id=p_target;
  UPDATE mode_wallets SET credits=credits-loss,updated_at=now() WHERE player_id=p_target;
  victim:=p_target;earn:=earn+loss;outcome:=outcome||' · bonus rival challenge';
 END IF;
ELSIF r.game_mode='crypto_hack' THEN
 IF p_action='mine' THEN earn:=35+(dice%6)*15;outcome:='Virtual credits mined';
 ELSIF p_action='hack' THEN
  IF p_target IS NULL OR p_target=p_player OR p_option NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'Choose another player and a code';END IF;
  IF NOT EXISTS(SELECT 1 FROM players WHERE id=p_target AND room_pin=p_pin) THEN RAISE EXCEPTION 'Invalid rival';END IF;
  INSERT INTO mode_wallets(player_id,room_pin) VALUES(p_target,p_pin) ON CONFLICT(player_id) DO NOTHING;
  IF (SELECT defense_code FROM players WHERE id=p_target)=p_option THEN
   SELECT LEAST(60,credits/3) INTO loss FROM mode_wallets WHERE player_id=p_target;
   UPDATE mode_wallets SET credits=credits-loss,updated_at=now() WHERE player_id=p_target;
   victim:=p_target;earn:=loss+15;outcome:='Code challenge successful';
  ELSE earn:=10;outcome:='Incorrect code, consolation credits';END IF;
 ELSE RAISE EXCEPTION 'Choose mining or a code challenge';END IF;
ELSIF r.game_mode='fishing_frenzy' THEN
 IF p_action<>'fish' OR p_option NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Choose a fishing zone';END IF;
 IF p_option=0 THEN earn:=30+(dice%5)*10;outcome:='Lagoon fish caught';
 ELSE earn:=10+(dice%8)*20;outcome:='Deep-water fish caught';END IF;
ELSIF r.game_mode='cafe' THEN
 IF p_action<>'serve' OR p_option NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'Choose a cafe order';END IF;
 earn:=CASE p_option WHEN 0 THEN 30 WHEN 1 THEN 55 ELSE 85 END;
 outcome:=CASE p_option WHEN 0 THEN 'Juice served' WHEN 1 THEN 'Sandwich served' ELSE 'Cake served' END;
ELSE RAISE EXCEPTION 'Unsupported game mode'; END IF;
UPDATE mode_wallets SET credits=credits+earn,
 fish_count=fish_count+(CASE WHEN r.game_mode='fishing_frenzy' THEN 1 ELSE 0 END),
 served_count=served_count+(CASE WHEN r.game_mode='cafe' THEN 1 ELSE 0 END),
 cafe_level=CASE WHEN r.game_mode='cafe' THEN 1+((served_count+1)/4) ELSE cafe_level END,
 updated_at=now()
 WHERE player_id=p_player RETURNING * INTO w;
INSERT INTO mode_events(room_pin,player_id,question_index,action,target_player_id,delta,target_delta,detail)
 VALUES(p_pin,p_player,r.current_index,p_action,victim,earn,-loss,jsonb_build_object('outcome',outcome,'option',p_option));
RETURN jsonb_build_object('credits',w.credits,'earned',earn,'outcome',outcome,'fish',w.fish_count,'served',w.served_count,'level',w.cafe_level);
END $$;
