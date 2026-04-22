global:
  resolve_timeout: 5m
  smtp_from: alerts@forgentic.io
  smtp_smarthost: "${SMTP_HOST}:587"
  smtp_auth_username: "${SMTP_USER}"
  smtp_auth_password: "${SMTP_PASSWORD}"
  smtp_require_tls: true
  slack_api_url: "${SLACK_WEBHOOK_URL}"

# Routes:
#   - severity=critical → page-now: Slack #forgentic-alerts (immediate,
#     group_wait 10s, repeat every 30m) + email fallback.
#   - severity=warning  → morning-digest: Slack same channel but group
#     across 6h windows (repeat every 12h), email only on resolution.
#   - default           → email-only catch-all.
route:
  receiver: default
  group_by: [alertname, job, severity]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: slack-critical
      group_wait: 10s
      group_interval: 2m
      repeat_interval: 30m
      continue: true
    - match:
        severity: warning
      receiver: slack-digest
      group_wait: 2m
      group_interval: 30m
      repeat_interval: 12h

receivers:
  - name: default
    email_configs:
      - to: alerts@forgentic.io
        send_resolved: true

  - name: slack-critical
    slack_configs:
      - channel: "#forgentic-alerts"
        send_resolved: true
        title: '[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }}'
        text: |-
          {{ range .Alerts }}
          *Severity*: {{ .Labels.severity }} · *Job*: {{ .Labels.job }}{{ if .Labels.instance }} · *Instance*: {{ .Labels.instance }}{{ end }}
          *Summary*: {{ .Annotations.summary }}
          {{ if .Annotations.description }}*Details*: {{ .Annotations.description }}{{ end }}
          {{ if .GeneratorURL }}<{{ .GeneratorURL }}|graph>{{ end }}
          {{ end }}
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
    email_configs:
      - to: alerts@forgentic.io
        send_resolved: true

  - name: slack-digest
    slack_configs:
      - channel: "#forgentic-alerts"
        send_resolved: false
        title: '[WARNING · digest] {{ .Alerts.Firing | len }} alert(s)'
        text: |-
          {{ range .Alerts }}
          • *{{ .Labels.alertname }}* ({{ .Labels.job }}){{ if .Labels.instance }} @ `{{ .Labels.instance }}`{{ end }}
            {{ .Annotations.summary }}
          {{ end }}
        color: warning
    email_configs:
      - to: alerts@forgentic.io
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: [alertname, job]
