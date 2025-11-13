-- Appraiser Hub core schema for registration, verification, booking operations,
-- appraisal decisions, NFT issuance, and auditability.

CREATE TABLE IF NOT EXISTS appraiser_organizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legal_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  country_code VARCHAR(8) NULL,
  website_url VARCHAR(255) NULL,
  status ENUM('pending', 'verified', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
  verification_status ENUM('not_started', 'submitted', 'in_review', 'approved', 'rejected') NOT NULL DEFAULT 'not_started',
  registered_license_no VARCHAR(128) NULL,
  license_authority VARCHAR(255) NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appraiser_org_email (email),
  KEY idx_appraiser_org_status (status),
  KEY idx_appraiser_org_verification_status (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NULL,
  wallet_address VARCHAR(128) NULL,
  role ENUM('owner', 'manager', 'staff', 'viewer') NOT NULL DEFAULT 'staff',
  status ENUM('active', 'invited', 'disabled') NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appraiser_user_email (email),
  UNIQUE KEY uq_appraiser_user_wallet (wallet_address),
  KEY idx_appraiser_user_org (organization_id),
  CONSTRAINT fk_appraiser_user_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_token_hash VARCHAR(128) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appraiser_session_token_hash (session_token_hash),
  KEY idx_appraiser_session_user (user_id),
  KEY idx_appraiser_session_expires (expires_at),
  CONSTRAINT fk_appraiser_session_user
    FOREIGN KEY (user_id) REFERENCES appraiser_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_branches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  branch_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NULL,
  contact_phone VARCHAR(40) NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NULL,
  postal_code VARCHAR(40) NULL,
  country VARCHAR(120) NOT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appraiser_branch_org (organization_id),
  KEY idx_appraiser_branch_primary (organization_id, is_primary),
  CONSTRAINT fk_appraiser_branch_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_verification_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  submitted_by_user_id BIGINT UNSIGNED NULL,
  submission_type ENUM('kyb', 'branch_license', 'identity', 'other') NOT NULL DEFAULT 'kyb',
  document_url VARCHAR(1024) NOT NULL,
  metadata_json JSON NULL,
  review_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT NULL,
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appraiser_verify_org (organization_id),
  KEY idx_appraiser_verify_status (review_status),
  CONSTRAINT fk_appraiser_verify_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_appraiser_verify_submitter
    FOREIGN KEY (submitted_by_user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_appraiser_verify_reviewer
    FOREIGN KEY (reviewed_by_user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prevaluation_id BIGINT NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  booking_date DATE NOT NULL,
  booking_slot ENUM('morning', 'afternoon', 'evening') NOT NULL,
  booking_status ENUM('requested', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'requested',
  customer_notes TEXT NULL,
  internal_notes TEXT NULL,
  source_channel ENUM('web', 'mobile', 'api') NOT NULL DEFAULT 'web',
  confirmed_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appraiser_booking_prevaluation (prevaluation_id),
  KEY idx_appraiser_booking_org_status (organization_id, booking_status),
  KEY idx_appraiser_booking_date (booking_date),
  CONSTRAINT fk_appraiser_booking_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_appraiser_booking_branch
    FOREIGN KEY (branch_id) REFERENCES appraiser_branches(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_appraiser_booking_user
    FOREIGN KEY (assigned_user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraisal_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  prevaluation_id BIGINT NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  appraiser_user_id BIGINT UNSIGNED NULL,
  decision ENUM('approved', 'revised', 'rejected') NOT NULL,
  verified_value DECIMAL(18, 2) NULL,
  verified_currency VARCHAR(16) NULL,
  verified_weight_grams DECIMAL(12, 4) NULL,
  verified_purity VARCHAR(32) NULL,
  notes TEXT NULL,
  media_json JSON NULL,
  report_hash VARCHAR(66) NULL,
  onchain_chain_key VARCHAR(32) NULL,
  onchain_tx_hash VARCHAR(128) NULL,
  onchain_record_id VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appraisal_report_booking (booking_id),
  KEY idx_appraisal_report_prevaluation (prevaluation_id),
  KEY idx_appraisal_report_org (organization_id),
  CONSTRAINT fk_appraisal_report_booking
    FOREIGN KEY (booking_id) REFERENCES appraiser_bookings(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_appraisal_report_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_appraisal_report_user
    FOREIGN KEY (appraiser_user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nft_issuances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prevaluation_id BIGINT NOT NULL,
  appraisal_report_id BIGINT UNSIGNED NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NULL,
  owner_wallet_address VARCHAR(128) NOT NULL,
  chain_key VARCHAR(32) NOT NULL DEFAULT 'bnb',
  token_standard ENUM('ERC721', 'ERC1155', 'SPL', 'TON') NOT NULL DEFAULT 'ERC721',
  contract_address VARCHAR(128) NULL,
  token_id VARCHAR(128) NULL,
  tx_hash VARCHAR(128) NULL,
  metadata_uri VARCHAR(1024) NULL,
  status ENUM('queued', 'processing', 'minted', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
  failure_reason TEXT NULL,
  minted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_nft_issuance_prevaluation (prevaluation_id),
  KEY idx_nft_issuance_status (status),
  KEY idx_nft_issuance_org (organization_id),
  CONSTRAINT fk_nft_issuance_report
    FOREIGN KEY (appraisal_report_id) REFERENCES appraisal_reports(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_nft_issuance_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_nft_issuance_user
    FOREIGN KEY (requested_by_user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraiser_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(120) NOT NULL,
  target_type VARCHAR(120) NULL,
  target_id VARCHAR(120) NULL,
  payload_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appraiser_audit_org (organization_id),
  KEY idx_appraiser_audit_user (user_id),
  KEY idx_appraiser_audit_action (action_type),
  CONSTRAINT fk_appraiser_audit_org
    FOREIGN KEY (organization_id) REFERENCES appraiser_organizations(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_appraiser_audit_user
    FOREIGN KEY (user_id) REFERENCES appraiser_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
