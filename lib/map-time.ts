// Local clock hours, intentionally independent of location/sunrise permissions.
const stops = [
  [0, .6, .9],
  [5, .6, .9],
  [7, 1.04, 1.02],
  [12, 1.08, 1.08],
  [16, 1.03, 1.03],
  [18, .85, 1.02],
  [20, .6, .9],
  [24, .6, .9],
];
export function mapTime(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const index = stops.findIndex(stop => stop[0] > hour);
  const from = stops[index - 1];
  const to = stops[index];
  const blend = (hour - from[0]) / (to[0] - from[0]);
  const values = from.slice(1).map((value, i) => (value + (to[i + 1] - value) * blend).toFixed(3));
  return {
    isNight: hour < 6 || hour >= 20,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    filter: `brightness(${values[0]}) saturate(${values[1]})`,
  };
}
