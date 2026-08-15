// Кожен модуль - незалежний файл, що експортує:
//   { id, title, description, render(container, locationData, ctx), isApplicable?(locationData) }
// Додати новий модуль = створити файл у modules/ + один import + один рядок у масиві нижче.

import summaryTiles from './modules/summary-tiles.js';
import lastAlertInfo from './modules/last-alert-info.js';
import hourlyHistogram from './modules/hourly-histogram.js';
import dailyTrend from './modules/daily-trend.js';
import durationHistogram from './modules/duration-histogram.js';
import dayOfWeek from './modules/day-of-week.js';
import gapDistribution from './modules/gap-distribution.js';
import calendarHeatmap from './modules/calendar-heatmap.js';
import monthlyTrend from './modules/monthly-trend.js';
import leaderboard from './modules/leaderboard.js';
import cumulativeHours from './modules/cumulative-hours.js';

export default [
  summaryTiles,
  lastAlertInfo,
  hourlyHistogram,
  dailyTrend,
  dayOfWeek,
  durationHistogram,
  gapDistribution,
  calendarHeatmap,
  monthlyTrend,
  leaderboard,
  cumulativeHours,
];
