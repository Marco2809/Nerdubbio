-- ============================================================
-- Nerdubbio – Fase 15: voto personale con mezzo punto (0.5)
-- ============================================================

USE nerdubbio;

-- Da intero 1-10 a decimale 0.5-10.0. I voti interi esistenti restano validi.
ALTER TABLE user_media MODIFY rating DECIMAL(3,1) DEFAULT NULL;
