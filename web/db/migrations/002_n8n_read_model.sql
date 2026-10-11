DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relay_n8n_reader') THEN
    CREATE ROLE relay_n8n_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

CREATE OR REPLACE VIEW relay_n8n_candidates AS
SELECT
  id AS application_id,
  jsonb_build_object(
    'schemaVersion', payload->'schemaVersion',
    'applicationId', payload->'applicationId',
    'receivedAt', payload->'receivedAt',
    'vacanteId', payload->'vacanteId',
    'vacanteTitulo', payload->'vacanteTitulo',
    'idioma', payload->'idioma',
    'nombre', payload->'nombre',
    'email', payload->'email',
    'telefono', payload->'telefono',
    'ubicacion', payload->'ubicacion',
    'horario', payload->'horario',
    'respuestas', payload->'respuestas',
    'consentimiento', payload->'consentimiento'
  ) AS payload,
  status,
  received_at
FROM relay_applications;

REVOKE ALL ON relay_n8n_candidates FROM PUBLIC;
GRANT CONNECT ON DATABASE relay TO relay_n8n_reader;
GRANT USAGE ON SCHEMA public TO relay_n8n_reader;
GRANT SELECT ON relay_n8n_candidates TO relay_n8n_reader;
ALTER ROLE relay_n8n_reader SET statement_timeout = '10s';

