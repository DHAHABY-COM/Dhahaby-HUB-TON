-- Adds opBNB valuation registry tracking fields.
ALTER TABLE ai_prevaluations
  ADD COLUMN bnb_address VARCHAR(128) NULL,
  ADD COLUMN bnb_tx_hash VARCHAR(128) NULL,
  ADD COLUMN bnb_chain_id INT NULL DEFAULT 5611,
  ADD COLUMN onchain_record_id BIGINT NULL,
  ADD COLUMN valuation_hash VARCHAR(66) NULL,
  ADD COLUMN report_uri VARCHAR(512) NULL;

CREATE INDEX idx_ai_prevaluations_bnb_tx_hash ON ai_prevaluations (bnb_tx_hash);
CREATE INDEX idx_ai_prevaluations_onchain_record_id ON ai_prevaluations (onchain_record_id);
