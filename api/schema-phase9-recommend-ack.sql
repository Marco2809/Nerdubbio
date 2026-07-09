-- Feedback al mittente: quando il destinatario aggiunge il consiglio, il
-- mittente lo vede finché non conferma (ack). Idempotente.
USE nerdubbio;

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS ack_by_sender TINYINT(1) NOT NULL DEFAULT 0;
