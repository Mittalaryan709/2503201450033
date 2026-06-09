require('dotenv').config();

const { fetchDepots, fetchVehicles } = require('./apiClient');
const { solveKnapsack } = require('./knapsack');

function printDepotResult(depot, result) {
  console.log('─'.repeat(60));
  console.log(`Depot ID     : ${depot.ID}`);
  console.log(`Budget       : ${depot.MechanicHours} hours`);
  console.log(`Hours Used   : ${result.hoursUsed} hours`);
  console.log(`Total Impact : ${result.totalImpact}`);
  console.log(`Tasks Selected (${result.selectedTasks.length}):`);
  result.selectedTasks.forEach((t, idx) => {
    console.log(
      `  ${idx + 1}. [${t.TaskID}]  Duration: ${t.Duration}h  Impact: ${t.Impact}`
    );
  });
}

async function run() {
  console.log('\n=== Vehicle Maintenance Scheduler ===\n');

  let depots, vehicles;

  try {
    [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
    console.log(`Fetched ${depots.length} depots and ${vehicles.length} vehicles.\n`);
  } catch (err) {
    console.error('Failed to fetch data from APIs:', err.message);
    process.exit(1);
  }

  // Run the knapsack optimisation for each depot independently
  const results = [];

  for (const depot of depots) {
    const result = solveKnapsack(vehicles, depot.MechanicHours);
    results.push({ depot, result });
    printDepotResult(depot, result);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(
    `${'Depot'.padEnd(8)}${'Budget'.padEnd(10)}${'Used'.padEnd(8)}${'Impact'.padEnd(10)}Tasks`
  );
  console.log('─'.repeat(60));
  for (const { depot, result } of results) {
    console.log(
      `${String(depot.ID).padEnd(8)}${String(depot.MechanicHours).padEnd(10)}` +
        `${String(result.hoursUsed).padEnd(8)}${String(result.totalImpact).padEnd(10)}` +
        `${result.selectedTasks.length}`
    );
  }
  console.log('═'.repeat(60));
}

run();
