ALTER TABLE server_state ADD COLUMN epoch uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE server_changes ADD COLUMN media_status text;

-- Rejected requests may name a missing owner/event. Keep their durable receipts
-- without weakening ownership foreign keys on the actual domain records.
ALTER TABLE server_operations DROP CONSTRAINT server_operations_profile_id_fkey;
ALTER TABLE server_operations DROP CONSTRAINT server_operations_event_id_fkey;

CREATE OR REPLACE FUNCTION record_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kind text := TG_ARGV[0];
  identity text;
  scope_event text;
  scope_profile text;
  media text;
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
  IF TG_TABLE_NAME = 'photos' THEN
    media := NEW.media_status;
  END IF;
  identity := coalesce(NEW.data->>'id', NEW.data->>'categoryId',
    jsonb_build_array(NEW.data->'standRef'->>'source',NEW.data->'standRef'->>'standId')::text);
  UPDATE server_state SET revision=revision+1 WHERE singleton RETURNING revision INTO NEW.revision;
  INSERT INTO server_changes(revision,entity_type,profile_id,event_id,entity_id,data,media_status)
    VALUES (NEW.revision,kind,scope_profile,scope_event,identity,NEW.data,media);
  RETURN NEW;
END $$;
