-- W1-3: SSO connections per workspace (WorkOS SAML/OIDC + Directory Sync)

CREATE TABLE sso_connections (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workos_organization_id  VARCHAR(80)  NOT NULL,
  workos_connection_id    VARCHAR(80),          -- null until SAML configured in WorkOS dashboard
  workos_directory_id     VARCHAR(80),          -- null until SCIM directory configured
  domain                  VARCHAR(253) NOT NULL, -- email domain, e.g. "acme.com"
  enabled                 BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_sso_workspace ON sso_connections(workspace_id);
CREATE INDEX ix_sso_domain ON sso_connections(domain);

ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can read SSO config
CREATE POLICY sso_member_read ON sso_connections
  FOR SELECT
  USING (
    workspace_id = NULLIF(current_setting('synterra.workspace_id', TRUE), '')::UUID
  );
