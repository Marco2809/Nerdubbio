-- ============================================================
-- Nerdubbio – Fase 16: apprendimento del Nerdacolo sincronizzato
-- ============================================================
-- Il bias dal feedback ("troppo pesante", "troppo lungo"…) stava solo nel
-- localStorage del dispositivo: ora segue l'account.

USE nerdubbio;

ALTER TABLE user_stats ADD COLUMN nerdacolo_bias JSON NULL;
