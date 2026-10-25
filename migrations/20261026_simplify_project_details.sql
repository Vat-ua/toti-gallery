BEGIN;

-- These three fictional demo projects may use the GitHub homepage as a placeholder.
-- Preserve any real link supplied after their creation.
UPDATE "gallery_projects"
SET "github_url" = 'https://github.com/'
WHERE "slug" IN ('rede-de-trocas-demo', 'caderno-demo', 'paleta-demo')
  AND ("github_url" IS NULL OR btrim("github_url") = '');

-- Other publications need a GitHub link before this constraint can be applied.
ALTER TABLE "gallery_projects" ALTER COLUMN "github_url" SET NOT NULL;
ALTER TABLE "gallery_projects" DROP COLUMN IF EXISTS "summary";

COMMIT;
