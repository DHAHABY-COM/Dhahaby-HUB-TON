-- Adds AVAX C-Chain valuation registry tracking fields.
ALTER TABLE ai_prevaluations
  ADD COLUMN avax_address VARCHAR(128) NULL,
  ADD COLUMN avax_tx_hash VARCHAR(128) NULL,
  ADD COLUMN avax_chain_id INT NULL DEFAULT 43113;

CREATE INDEX idx_ai_prevaluations_avax_tx_hash ON ai_prevaluations (avax_tx_hash);
