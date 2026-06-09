# Vehicle Maintenance Scheduler

Picks the optimal subset of vehicle maintenance tasks for each depot to **maximise total operational impact** without exceeding the depot's daily mechanic-hour budget. The selection problem is solved with a **0/1 Knapsack** dynamic programming algorithm.

## Why Knapsack DP?

| Property | Detail |
|---|---|
| Each task is taken at most once | → 0/1 variant |
| Integer durations | → DP table indexed by integer capacity |
| Time complexity | O(n × W) where n = tasks, W = budget |
| Space complexity | O(n × W) — 2-D table kept for backtracking |

For very large inputs (W > 10 000), a greedy approximation or branch-and-bound can be layered on top without changing the interface.

## Setup

```bash
cd vehicle_maintence_scheduler
npm install
```

Create a `.env` file:

```
API_TOKEN=your_bearer_token_here
```

## Run

```bash
node index.js
```

## Output

The program prints per-depot results (budget, hours used, impact score, selected task list) followed by a summary table across all depots.
