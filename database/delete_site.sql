-- =====================================================================
-- DELETE A SITE AND ALL ITS RELATED RECORDS  (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Django's on_delete=CASCADE only works in Python, NOT in the database,
-- so this script deletes the child rows manually, deepest first.
--
-- HOW TO USE:
--   1. Change the site id on the line marked  <<< SET SITE ID HERE
--      (it appears in STEP 1 and STEP 2)
--   2. Run STEP 1 (preview) to see what will be removed.
--   3. Run STEP 2 (delete). It runs as a single transaction, so if any
--      statement fails, nothing is deleted.
-- =====================================================================


-- =====================================================================
-- STEP 1: PREVIEW (read-only). Shows how many rows will be deleted.
-- =====================================================================
WITH s AS (SELECT 1::bigint AS id),              -- <<< SET SITE ID HERE
apps AS (
  SELECT application_id FROM tree_planting_programs_application
  WHERE site_id = (SELECT id FROM s)
),
prs AS (
  SELECT progress_report_id FROM tree_planting_programs_progressreport
  WHERE site_id = (SELECT id FROM s)
     OR application_id IN (SELECT application_id FROM apps)
),
srs AS (
  SELECT seedling_request_id FROM tree_planting_programs_seedlingrequest
  WHERE application_id IN (SELECT application_id FROM apps)
)
SELECT 'site'                       AS item, COUNT(*) FROM sites_sites WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'applications',            COUNT(*) FROM apps
UNION ALL SELECT 'seedling requests',       COUNT(*) FROM srs
UNION ALL SELECT 'seedling request species',COUNT(*) FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id IN (SELECT seedling_request_id FROM srs)
UNION ALL SELECT 'progress reports',        COUNT(*) FROM prs
UNION ALL SELECT 'progress report species', COUNT(*) FROM tree_planting_programs_progressreportspecies WHERE progress_report_id IN (SELECT progress_report_id FROM prs)
UNION ALL SELECT 'reasons',                 COUNT(*) FROM tree_planting_programs_reason WHERE application_id IN (SELECT application_id FROM apps)
UNION ALL SELECT 'closure requests',        COUNT(*) FROM tree_planting_programs_programclosurerequest WHERE application_id IN (SELECT application_id FROM apps) OR site_id = (SELECT id FROM s)
UNION ALL SELECT 'site data versions',      COUNT(*) FROM sites_site_data WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'species recommendations', COUNT(*) FROM sites_site_species_recommendation WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'site images',             COUNT(*) FROM sites_site_images WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'permit documents',        COUNT(*) FROM sites_permitdocument WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'meta verification',       COUNT(*) FROM sites_sitemetadataverification WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'field assessments (unlinked, kept)', COUNT(*) FROM "Field_assessment_field_assessment" WHERE site_id = (SELECT id FROM s)
UNION ALL SELECT 'potential sites (unlinked, kept)',   COUNT(*) FROM sites_potential_sites WHERE site_id = (SELECT id FROM s);


-- =====================================================================
-- STEP 2: DELETE
-- =====================================================================
DO $$
DECLARE
  v_site_id bigint := 1;                         -- <<< SET SITE ID HERE
  v_app_ids int[];
  v_pr_ids  int[];
  v_sr_ids  int[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sites_sites WHERE site_id = v_site_id) THEN
    RAISE EXCEPTION 'Site % does not exist', v_site_id;
  END IF;

  -- Collect related ids
  SELECT COALESCE(array_agg(application_id), '{}') INTO v_app_ids
  FROM tree_planting_programs_application
  WHERE site_id = v_site_id;

  SELECT COALESCE(array_agg(progress_report_id), '{}') INTO v_pr_ids
  FROM tree_planting_programs_progressreport
  WHERE site_id = v_site_id OR application_id = ANY(v_app_ids);

  SELECT COALESCE(array_agg(seedling_request_id), '{}') INTO v_sr_ids
  FROM tree_planting_programs_seedlingrequest
  WHERE application_id = ANY(v_app_ids);

  -- 1. Progress reports (and their species)
  DELETE FROM tree_planting_programs_progressreportspecies WHERE progress_report_id = ANY(v_pr_ids);
  DELETE FROM tree_planting_programs_progressreport        WHERE progress_report_id = ANY(v_pr_ids);

  -- 2. Seedling requests (and their species)
  DELETE FROM tree_planting_programs_seedlingrequestspecies WHERE seedling_request_id = ANY(v_sr_ids);
  DELETE FROM tree_planting_programs_seedlingrequest        WHERE seedling_request_id = ANY(v_sr_ids);

  -- 3. Reasons and closure requests tied to the applications or the site
  DELETE FROM tree_planting_programs_reason WHERE application_id = ANY(v_app_ids);
  DELETE FROM tree_planting_programs_programclosurerequest
  WHERE application_id = ANY(v_app_ids) OR site_id = v_site_id;

  -- 4. Tree grower applications
  DELETE FROM tree_planting_programs_application WHERE application_id = ANY(v_app_ids);

  -- 5. Site child tables
  DELETE FROM site_verified_animals
  WHERE verification_id IN (SELECT id FROM sites_sitemetadataverification WHERE site_id = v_site_id);
  DELETE FROM sites_sitemetadataverification    WHERE site_id = v_site_id;
  DELETE FROM sites_permitdocument              WHERE site_id = v_site_id;
  DELETE FROM sites_site_data                   WHERE site_id = v_site_id;
  DELETE FROM sites_site_species_recommendation WHERE site_id = v_site_id;
  DELETE FROM sites_site_images                 WHERE site_id = v_site_id;

  -- 6. Unlink records that Django keeps (on_delete=SET_NULL)
  UPDATE "Field_assessment_field_assessment" SET site_id = NULL WHERE site_id = v_site_id;
  UPDATE sites_potential_sites               SET site_id = NULL WHERE site_id = v_site_id;

  -- 7. The site itself
  DELETE FROM sites_sites WHERE site_id = v_site_id;

  RAISE NOTICE 'Deleted site %: % applications, % seedling requests, % progress reports',
    v_site_id,
    COALESCE(array_length(v_app_ids, 1), 0),
    COALESCE(array_length(v_sr_ids, 1), 0),
    COALESCE(array_length(v_pr_ids, 1), 0);
END $$;


