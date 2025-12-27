-- Track which contract version each game belongs to
-- This allows keeping history across contract upgrades

ALTER TABLE games ADD COLUMN IF NOT EXISTS contract_address TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS contract_version INTEGER DEFAULT 1;

-- Update existing games (from V2 contract)
UPDATE games
SET contract_address = '0x268621cc45d591079ac53e934fbcb8fedcc0fb0f',
    contract_version = 2
WHERE contract_address IS NULL;

-- Create index for filtering by contract
CREATE INDEX IF NOT EXISTS idx_games_contract_address ON games(contract_address);
CREATE INDEX IF NOT EXISTS idx_games_contract_version ON games(contract_version);

COMMENT ON COLUMN games.contract_address IS 'Address of the contract this game was created on';
COMMENT ON COLUMN games.contract_version IS 'Version of the contract (1, 2, etc.)';
