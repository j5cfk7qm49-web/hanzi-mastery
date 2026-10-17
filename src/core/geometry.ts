export interface Point { x: number; y: number }
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.y-b.y);
export function resample(points: Point[], count = 32): Point[] {
  if (!points.length) return [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i-1] + distance(points[i-1], points[i]));
  const total = lengths.at(-1)!;
  if (!total) return Array.from({ length: count }, () => points[0]);
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const at = total * i / (count-1);
    while (segment < lengths.length-1 && lengths[segment] < at) segment++;
    const start = points[segment-1], end = points[segment];
    const t = (at-lengths[segment-1]) / (lengths[segment]-lengths[segment-1] || 1);
    return { x: start.x + (end.x-start.x)*t, y: start.y + (end.y-start.y)*t };
  });
}
/** Diagnostic only: absolute position is preserved; never center/scale each stroke independently. */
export function geometryFeedback(drawn: Point[], median: number[][]) {
  const reference = median.map(([x,y]) => ({ x, y }));
  const a = resample(drawn), b = resample(reference);
  if (!a.length || !b.length) return undefined;
  const trajectoryError = a.reduce((sum, p, i) => sum + distance(p, b[i]), 0) / a.length / 1024;
  const length = (p: Point[]) => p.slice(1).reduce((sum, v, i) => sum + distance(p[i], v), 0);
  return { trajectoryError, lengthRatio: length(drawn) / (length(reference) || 1),
    endpointError: (distance(a[0], b[0]) + distance(a.at(-1)!, b.at(-1)!)) / 2048 };
}
