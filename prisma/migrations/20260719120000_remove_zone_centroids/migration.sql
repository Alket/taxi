-- Bake distance-based fares into minFare (TIA → zone centroid), then drop lat/lng.

WITH zone_dist AS (
  SELECT
    id,
    CASE
      WHEN "centroidLat" = 0 AND "centroidLng" = 0 THEN 0::double precision
      ELSE (
        6371 * 2 * asin(
          sqrt(
            power(sin(radians(("centroidLat" - 41.414742) / 2)), 2) +
            cos(radians(41.414742)) * cos(radians("centroidLat")) *
            power(sin(radians(("centroidLng" - 19.720544) / 2)), 2)
          )
        )
      )
    END AS dist_km
  FROM "Zone"
)
UPDATE "PricingRule" AS pr
SET "minFare" = GREATEST(
  pr."minFare",
  ROUND((pr."baseFare" + pr."perKmRate" * zd.dist_km)::numeric, 2)
)
FROM zone_dist AS zd
WHERE pr."zoneId" = zd.id;

ALTER TABLE "Zone" DROP COLUMN "centroidLat";
ALTER TABLE "Zone" DROP COLUMN "centroidLng";
