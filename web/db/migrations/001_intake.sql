CREATE TABLE relay_applications (
  id uuid PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'nuevo'
    CHECK (status IN ('nuevo', 'precalificado', 'revision', 'no_elegible')),
  classification jsonb,
  crm_status text NOT NULL DEFAULT 'pending'
    CHECK (crm_status IN ('pending', 'synced', 'mocked')),
  ghl_contact_id text,
  ghl_note_id text,
  received_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE relay_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES relay_applications(id),
  kind text NOT NULL CHECK (kind IN ('classify', 'sync_ghl')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind)
);
CREATE INDEX relay_jobs_ready ON relay_jobs (available_at, id)
  WHERE status IN ('pending', 'processing');

-- Audit stores safe codes and identifiers, never upstream response bodies.
CREATE TABLE relay_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES relay_applications(id),
  kind text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relay_events_application ON relay_events (application_id, created_at);
