CREATE TABLE IF NOT EXISTS legal_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  policy_slug VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  header_title VARCHAR(255) DEFAULT NULL,
  document_title VARCHAR(255) DEFAULT NULL,
  body LONGTEXT NOT NULL,
  effective_date DATE DEFAULT NULL,
  last_updated_date DATE DEFAULT NULL,
  display_order INT NOT NULL DEFAULT 1000,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_legal_policies_slug (policy_slug),
  KEY idx_legal_policies_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
