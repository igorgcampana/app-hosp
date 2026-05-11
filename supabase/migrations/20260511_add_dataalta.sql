ALTER TABLE patients ADD COLUMN IF NOT EXISTS dataalta date;

UPDATE patients
SET dataalta = dataultimavisita
WHERE statusmanual = 'Alta'
  AND dataalta IS NULL;
