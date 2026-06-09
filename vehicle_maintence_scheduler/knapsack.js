/**
 * knapsack.js
 *
 * Solves the 0/1 knapsack problem using bottom-up dynamic programming.
 * Each vehicle task can either be scheduled or skipped — it cannot be split.
 *
 * Why DP here instead of greedy?
 * Greedy (sort by impact/duration ratio) gives a good approximation but can
 * miss the true optimum when task durations don't divide evenly into the budget.
 * DP guarantees the exact maximum impact within the mechanic-hour limit.
 *
 * Complexity:
 *   Time  — O(n × W)  where n = number of tasks, W = mechanic-hour budget
 *   Space — O(n × W)  kept 2-D so we can backtrack and identify which tasks were picked
 */

function solveKnapsack(tasks, budget) {
  const taskCount = tasks.length;

  // Build the DP table row by row.
  // dp[i][w] holds the highest achievable impact using any subset of
  // the first i tasks while staying within w mechanic-hours.
  const dp = Array.from({ length: taskCount + 1 }, () => new Int32Array(budget + 1));

  for (let i = 1; i <= taskCount; i++) {
    const task = tasks[i - 1];
    const dur  = task.Duration;
    const imp  = task.Impact;

    for (let hrs = 0; hrs <= budget; hrs++) {
      // Default: don't schedule this task — inherit the value from the row above
      dp[i][hrs] = dp[i - 1][hrs];

      // Try scheduling it if there's room; keep whichever option scores higher
      if (dur <= hrs) {
        const scoreWithTask = dp[i - 1][hrs - dur] + imp;
        if (scoreWithTask > dp[i][hrs]) {
          dp[i][hrs] = scoreWithTask;
        }
      }
    }
  }

  // Walk backwards through the table to find which tasks ended up selected
  const chosenTasks = [];
  let remainingHours = budget;

  for (let i = taskCount; i > 0; i--) {
    // If the value at this row differs from the row above, task i-1 was included
    if (dp[i][remainingHours] !== dp[i - 1][remainingHours]) {
      chosenTasks.push(tasks[i - 1]);
      remainingHours -= tasks[i - 1].Duration;
    }
  }

  return {
    totalImpact:   dp[taskCount][budget],
    hoursUsed:     budget - remainingHours,
    selectedTasks: chosenTasks.reverse(),   // restore chronological order
  };
}

module.exports = { solveKnapsack };
