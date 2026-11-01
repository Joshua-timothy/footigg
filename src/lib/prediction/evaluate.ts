import { clamp } from "@/lib/utils";
import type { CalibrationBucket, Conviction } from "@/types/domain";

export function scorePrediction(probabilityYes: number, actualBtts: boolean) {
  const outcome = actualBtts ? 1 : 0;
  const probability = clamp(probabilityYes, 0.001, 0.999);
  return {
    brier: (probability - outcome) ** 2,
    logLoss: -(outcome * Math.log(probability) + (1 - outcome) * Math.log(1 - probability)),
    correct: (probability >= 0.5) === actualBtts,
  };
}

/** 10 equally sized probability buckets, from 0-10% to 90-100%. */
export function buildCalibration(
  items: Array<{ probabilityYes: number; actualBtts: boolean }>,
  bucketCount = 10,
): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const lower = index / bucketCount;
    const upper = (index + 1) / bucketCount;
    return {
      lower,
      upper,
      label: `${Math.round(lower * 100)}–${Math.round(upper * 100)}%`,
      predicted: 0,
      actual: 0,
      count: 0,
    };
  });

  for (const item of items) {
    const index = Math.min(bucketCount - 1, Math.floor(item.probabilityYes * bucketCount));
    const bucket = buckets[index];
    bucket.predicted += item.probabilityYes;
    bucket.actual += item.actualBtts ? 1 : 0;
    bucket.count += 1;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    predicted: bucket.count > 0 ? bucket.predicted / bucket.count : 0,
    actual: bucket.count > 0 ? bucket.actual / bucket.count : 0,
  }));
}

/** Expected calibration error, weighted by bucket size. */
export function calibrationError(buckets: CalibrationBucket[]): number {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return 0;
  return buckets.reduce(
    (sum, bucket) => sum + (bucket.count / total) * Math.abs(bucket.actual - bucket.predicted),
    0,
  );
}

export function convictionRank(conviction: Conviction): number {
  return conviction === "HIGH" ? 3 : conviction === "MEDIUM" ? 2 : 1;
}
