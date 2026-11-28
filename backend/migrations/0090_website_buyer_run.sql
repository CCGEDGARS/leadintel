CREATE UNIQUE INDEX buyer_research_scan_company ON buyer_research_jobs
 (workspace_id,domain,json_extract(input_json,'$.websiteScanId'))
 WHERE json_extract(input_json,'$.websiteScanId') IS NOT NULL;
