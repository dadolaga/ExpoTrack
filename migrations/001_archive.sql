CREATE TABLE catalog_snapshots (
  hash text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE server_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0 AND revision <= 9007199254740991),
  catalog_hash text REFERENCES catalog_snapshots(hash)
);
INSERT INTO server_state(singleton) VALUES (true);
CREATE TABLE events (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE categories (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE profiles (
  id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('json', 'personal')),
  data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  deleted_at text,
  revision bigint NOT NULL DEFAULT 0,
  CHECK (data->>'id' IS NOT DISTINCT FROM id),
  CHECK (data->>'origin' IS NOT DISTINCT FROM origin),
  CHECK (data->>'name' IS NOT NULL AND jsonb_typeof(data->'name') = 'string'
    AND length(btrim(data->>'name')) > 0)
);
CREATE TABLE pavilions (
  event_id text NOT NULL REFERENCES events(id),
  id text NOT NULL,
  data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (event_id, id)
);
CREATE TABLE catalog_stands (
  event_id text NOT NULL REFERENCES events(id),
  id text NOT NULL,
  data jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (event_id, id)
);
CREATE TABLE stand_categories (
  event_id text NOT NULL,
  stand_id text NOT NULL,
  category_id text NOT NULL REFERENCES categories(id),
  PRIMARY KEY (event_id, stand_id, category_id),
  FOREIGN KEY (event_id, stand_id) REFERENCES catalog_stands(event_id, id)
);
CREATE TABLE questionnaire_definitions (
  profile_id text NOT NULL REFERENCES profiles(id),
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  category_id text NOT NULL REFERENCES categories(id),
  data jsonb NOT NULL,
  PRIMARY KEY (profile_id, id, version)
);
CREATE TABLE personal_stands (
  profile_id text NOT NULL REFERENCES profiles(id),
  event_id text NOT NULL REFERENCES events(id),
  id text NOT NULL,
  data jsonb NOT NULL,
  deleted_at text GENERATED ALWAYS AS (data->>'deletedAt') STORED,
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, event_id, id),
  CHECK (data->>'name' IS NOT NULL AND jsonb_typeof(data->'name') = 'string'
    AND length(btrim(data->>'name')) > 0),
  CHECK (jsonb_typeof(data->'categoryIds') = 'array' AND data ? 'categoryIds')
);
CREATE TABLE products (
  profile_id text NOT NULL REFERENCES profiles(id),
  event_id text NOT NULL REFERENCES events(id),
  id text NOT NULL,
  data jsonb NOT NULL,
  category_id text GENERATED ALWAYS AS (data->>'categoryId') STORED NOT NULL REFERENCES categories(id),
  stand_source text GENERATED ALWAYS AS (data->'standRef'->>'source') STORED NOT NULL
    CHECK (stand_source IN ('catalog', 'personal')),
  stand_id text GENERATED ALWAYS AS (data->'standRef'->>'standId') STORED NOT NULL,
  deleted_at text GENERATED ALWAYS AS (data->>'deletedAt') STORED,
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, event_id, id),
  CHECK (data->>'name' IS NOT NULL AND jsonb_typeof(data->'name') = 'string'
    AND length(btrim(data->>'name')) > 0),
  CHECK (data->'standRef'->>'eventId' IS NOT DISTINCT FROM event_id),
  CHECK (data->>'description' IS NOT NULL AND jsonb_typeof(data->'description') = 'string'),
  CHECK (data->>'price' IS NULL OR (jsonb_typeof(data->'price') = 'number'
    AND (data->>'price')::numeric >= 0
    AND (data->>'price')::numeric = round((data->>'price')::numeric, 2))),
  CHECK (data->>'rating' IS NULL OR (jsonb_typeof(data->'rating') = 'number'
    AND (data->>'rating')::numeric BETWEEN 1 AND 10
    AND (data->>'rating')::numeric = trunc((data->>'rating')::numeric)))
);
CREATE TABLE stand_preferences (
  profile_id text NOT NULL REFERENCES profiles(id),
  event_id text NOT NULL REFERENCES events(id),
  stand_source text GENERATED ALWAYS AS (data->'standRef'->>'source') STORED NOT NULL
    CHECK (stand_source IN ('catalog', 'personal')),
  stand_id text GENERATED ALWAYS AS (data->'standRef'->>'standId') STORED NOT NULL,
  data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, event_id, stand_source, stand_id),
  CHECK (data->'standRef'->>'eventId' IS NOT DISTINCT FROM event_id),
  CHECK (NOT data ? 'interested' OR jsonb_typeof(data->'interested') = 'boolean'),
  CHECK (data->>'priority' IS NULL OR (jsonb_typeof(data->'priority') = 'number'
    AND (data->>'priority')::numeric BETWEEN 1 AND 10
    AND (data->>'priority')::numeric = trunc((data->>'priority')::numeric))),
  CHECK (NOT data ? 'visitStatus' OR (jsonb_typeof(data->'visitStatus') = 'string'
    AND data->>'visitStatus' IN ('to_visit','visited','to_revisit'))),
  CHECK (NOT data ? 'checklistDone' OR jsonb_typeof(data->'checklistDone') = 'object')
);
CREATE TABLE budget_overrides (
  profile_id text NOT NULL REFERENCES profiles(id),
  category_id text NOT NULL REFERENCES categories(id),
  data jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, category_id),
  CHECK (data->>'categoryId' IS NOT DISTINCT FROM category_id),
  CHECK (data->>'currency' = 'EUR' AND data ? 'currency'),
  CHECK (jsonb_typeof(data->'removed') = 'boolean' AND data ? 'removed'),
  CHECK (data ? 'amount' AND (data->>'amount' IS NULL OR (jsonb_typeof(data->'amount') = 'number'
    AND (data->>'amount')::numeric >= 0
    AND (data->>'amount')::numeric = round((data->>'amount')::numeric, 2))))
);
CREATE TABLE photos (
  profile_id text NOT NULL,
  event_id text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  product_id text GENERATED ALWAYS AS (data->>'productId') STORED NOT NULL,
  deleted_at text GENERATED ALWAYS AS (data->>'deletedAt') STORED,
  is_primary boolean GENERATED ALWAYS AS ((data->>'isPrimary')::boolean) STORED NOT NULL,
  storage_key text UNIQUE,
  media_status text NOT NULL DEFAULT 'pending' CHECK (media_status IN ('pending','ready')),
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, event_id, id),
  FOREIGN KEY (profile_id, event_id, product_id) REFERENCES products(profile_id, event_id, id),
  CHECK (data->>'sha256' ~ '^[a-f0-9]{64}$' AND data ? 'sha256'),
  CHECK ((data->>'byteSize')::bigint > 0 AND data ? 'byteSize'),
  CHECK ((data->>'width')::integer > 0 AND data ? 'width'),
  CHECK ((data->>'height')::integer > 0 AND data ? 'height'),
  CHECK (data->>'contentType' IN ('image/jpeg','image/png','image/webp') AND data ? 'contentType'),
  CHECK (media_status <> 'ready' OR storage_key IS NOT NULL)
);
CREATE UNIQUE INDEX photos_primary ON photos(profile_id,event_id,product_id)
  WHERE is_primary AND deleted_at IS NULL;
CREATE TABLE server_operations (
  operation_id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id),
  event_id text REFERENCES events(id),
  entity_type text NOT NULL CHECK (entity_type IN
    ('profile','budget','personal-stand','stand-preferences','product','photo')),
  entity_id text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE server_changes (
  revision bigint PRIMARY KEY,
  entity_type text NOT NULL,
  profile_id text NOT NULL REFERENCES profiles(id),
  event_id text REFERENCES events(id),
  entity_id text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX changes_scope ON server_changes(profile_id,event_id,revision);

-- Reject physical deletes: accepted identities and tombstones must remain stable.
CREATE FUNCTION protect_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Use a tombstone instead of DELETE';
  END IF;
  IF NEW.data->>'profileId' IS DISTINCT FROM NEW.profile_id THEN
    RAISE EXCEPTION 'Payload profile mismatch';
  END IF;
  IF TG_TABLE_NAME <> 'budget_overrides' THEN
    IF NEW.data->>'eventId' IS DISTINCT FROM NEW.event_id THEN
      RAISE EXCEPTION 'Payload event mismatch';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('products','personal_stands','photos') THEN
    IF NEW.data->>'id' IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Payload identity mismatch';
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.data->>'deletedAt' IS NOT NULL AND NEW.data IS DISTINCT FROM OLD.data) THEN
      RAISE EXCEPTION 'Tombstones cannot be updated';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.data->>'eventId' IS DISTINCT FROM OLD.data->>'eventId'
      OR NEW.data->>'id' IS DISTINCT FROM OLD.data->>'id'
      OR NEW.data->>'categoryId' IS DISTINCT FROM OLD.data->>'categoryId' THEN
      RAISE EXCEPTION 'Immutable identity or category';
    END IF;
    IF TG_TABLE_NAME IN ('products','stand_preferences')
      AND NEW.data->'standRef' IS DISTINCT FROM OLD.data->'standRef' THEN
      RAISE EXCEPTION 'Immutable stand';
    END IF;
    IF TG_TABLE_NAME = 'photos' AND NEW.data->>'productId' IS DISTINCT FROM OLD.data->>'productId' THEN
      RAISE EXCEPTION 'Immutable photo parent';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION validate_stand_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  stand jsonb := NEW.data->'standRef';
BEGIN
  IF stand->>'source' = 'catalog' THEN
    IF NOT EXISTS (SELECT FROM catalog_stands WHERE event_id=NEW.event_id AND id=stand->>'standId') THEN
      RAISE EXCEPTION 'Missing catalog stand';
    END IF;
  ELSIF stand->>'source' = 'personal' THEN
    IF NOT EXISTS (SELECT FROM personal_stands WHERE profile_id=NEW.profile_id
      AND event_id=NEW.event_id AND id=stand->>'standId') THEN
      RAISE EXCEPTION 'Missing personal stand in this profile/event';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid stand source';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION validate_visit_data() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  entry jsonb;
  seen text[] := '{}';
BEGIN
  IF TG_TABLE_NAME = 'personal_stands' THEN
    FOR entry IN SELECT jsonb_array_elements(NEW.data->'categoryIds') LOOP
      IF NOT EXISTS (SELECT FROM categories WHERE id=entry#>>'{}') THEN
        RAISE EXCEPTION 'Missing category';
      END IF;
    END LOOP;
  ELSE
    IF NEW.data ? 'checklist' THEN
      IF jsonb_typeof(NEW.data->'checklist') <> 'array' THEN
        RAISE EXCEPTION 'Invalid checklist';
      END IF;
      FOR entry IN SELECT jsonb_array_elements(NEW.data->'checklist') LOOP
        IF coalesce(entry->>'id','') = '' OR coalesce(btrim(entry->>'text'),'') = ''
          OR entry->>'id' = ANY(seen) THEN
          RAISE EXCEPTION 'Invalid checklist item';
        END IF;
        seen := array_append(seen, entry->>'id');
      END LOOP;
    END IF;
    IF NEW.data ? 'checklistDone' THEN
      FOR entry IN SELECT value FROM jsonb_each(NEW.data->'checklistDone') LOOP
        IF jsonb_typeof(entry) <> 'boolean' THEN
          RAISE EXCEPTION 'Invalid checklist completion';
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A transactional counter serializes acceptance, avoiding sequence/commit-order gaps.
CREATE FUNCTION record_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kind text := TG_ARGV[0];
  identity text;
  scope_event text;
  scope_profile text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.origin = 'json' THEN
      RETURN NEW;
    END IF;
    scope_profile := NEW.id;
  ELSE
    scope_profile := NEW.profile_id;
    scope_event := NEW.data->>'eventId';
  END IF;
  identity := coalesce(NEW.data->>'id', NEW.data->>'categoryId',
    jsonb_build_array(NEW.data->'standRef'->>'source',NEW.data->'standRef'->>'standId')::text);
  UPDATE server_state SET revision=revision+1 WHERE singleton RETURNING revision INTO NEW.revision;
  INSERT INTO server_changes(revision,entity_type,profile_id,event_id,entity_id,data)
    VALUES (NEW.revision,kind,scope_profile,scope_event,identity,NEW.data);
  RETURN NEW;
END $$;

-- AFTER logging would not set NEW.revision. Defer the self-reference on new profiles.
ALTER TABLE server_changes DROP CONSTRAINT server_changes_profile_id_fkey;
ALTER TABLE server_changes ADD FOREIGN KEY (profile_id) REFERENCES profiles(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER profiles_revision BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION record_revision('profile');
DO $$
DECLARE
  item text;
  kind text;
BEGIN
  FOR item,kind IN SELECT * FROM (VALUES
    ('personal_stands','personal-stand'),('products','product'),
    ('stand_preferences','stand-preferences'),('budget_overrides','budget'),('photos','photo')) AS kinds LOOP
    EXECUTE format('CREATE TRIGGER protect BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_record()',item);
    EXECUTE format('CREATE TRIGGER revision BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION record_revision(%L)',item,kind);
  END LOOP;
END $$;
CREATE TRIGGER stand_link BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION validate_stand_link();
CREATE TRIGGER stand_link BEFORE INSERT OR UPDATE ON stand_preferences
  FOR EACH ROW EXECUTE FUNCTION validate_stand_link();
CREATE TRIGGER visit_data BEFORE INSERT OR UPDATE ON stand_preferences
  FOR EACH ROW EXECUTE FUNCTION validate_visit_data();
CREATE TRIGGER visit_data BEFORE INSERT OR UPDATE ON personal_stands
  FOR EACH ROW EXECUTE FUNCTION validate_visit_data();

CREATE FUNCTION protect_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Use a profile tombstone instead of DELETE';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.origin IS DISTINCT FROM OLD.origin) THEN
    RAISE EXCEPTION 'Immutable profile identity and origin';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND NEW.data IS DISTINCT FROM OLD.data THEN
    RAISE EXCEPTION 'Profile tombstones cannot be updated';
  END IF;
  NEW.deleted_at := NEW.data->>'deletedAt';
  RETURN NEW;
END $$;
CREATE TRIGGER protect BEFORE INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile();

CREATE FUNCTION validate_product_answers() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  entry jsonb;
  definition jsonb;
BEGIN
  IF NEW.data ? 'questionnaireAnswers' THEN
    IF jsonb_typeof(NEW.data->'questionnaireAnswers') <> 'array' THEN
      RAISE EXCEPTION 'Invalid questionnaire answers';
    END IF;
    FOR entry IN SELECT jsonb_array_elements(NEW.data->'questionnaireAnswers') LOOP
      definition := entry->'definitionSnapshot';
      IF definition->>'profileId' IS DISTINCT FROM NEW.profile_id
        OR definition->>'categoryId' IS DISTINCT FROM NEW.data->>'categoryId'
        OR NOT EXISTS (SELECT FROM questionnaire_definitions WHERE profile_id=NEW.profile_id
          AND id=definition->>'id' AND version=(definition->>'version')::integer
          AND data=definition) THEN
        RAISE EXCEPTION 'Missing or mismatched questionnaire definition';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER questionnaire_answers BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION validate_product_answers();
