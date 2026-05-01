import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const ranks = [
  { rank: "Member", maintenance: 580, target: 6380, bonus: 650, salary: 0, active: 2, levels: "1" },
  { rank: "Associate", maintenance: 1160, target: 20000, bonus: 2100, salary: 0, active: 4, levels: "1 & 2" },
  { rank: "Team Leader", maintenance: 1740, target: 65000, bonus: 4500, salary: 2000, active: 6, levels: "1 - 3" },
  { rank: "Manager", maintenance: 2900, target: 180000, bonus: 10000, salary: 5000, active: 8, levels: "1 - 4" },
  { rank: "Director", maintenance: 4060, target: 400000, bonus: 25000, salary: 15000, active: 10, levels: "1 - 5" },
  { rank: "Senior Director", maintenance: 5800, target: 1200000, bonus: 55000, salary: 20000, active: 12, levels: "1 - 6" },
  { rank: "Executive Director", maintenance: 8120, target: 2500000, bonus: 100000, salary: 35000, active: 14, levels: "1 - 7" }
];

function money(value) {
  return Number(value || 0);
}

function calculateRank(affiliate) {
  let achieved = ranks[0];

  for (const rank of ranks) {
    if (
      money(affiliate.personalSales) >= rank.maintenance &&
      money(affiliate.teamSales) >= rank.target &&
      money(affiliate.activeLevel1Members) >= rank.active
    ) {
      achieved = rank;
    }
  }

  return achieved;
}

function getNextRank(currentRank) {
  const index = ranks.findIndex(r => r.rank === currentRank.rank);
  return ranks[index + 1] || null;
}

function buildDashboard(affiliate) {
  const rank = calculateRank(affiliate);
  const next = getNextRank(rank);

  const qualifies =
    money(affiliate.personalSales) >= rank.maintenance &&
    money(affiliate.teamSales) >= rank.target &&
    money(affiliate.activeLevel1Members) >= rank.active;

  const progressTarget = next ? next.target : rank.target;
  const progressPercent = Math.min((money(affiliate.teamSales) / progressTarget) * 100, 100);

  return {
    affiliateName: affiliate.name || "Affiliate",
    currentRank: rank.rank,
    nextRank: next ? next.rank : "Top Rank",
    qualifiesForCommission: qualifies,

    personalSales: money(affiliate.personalSales),
    teamSales: money(affiliate.teamSales),
    activeLevel1Members: money(affiliate.activeLevel1Members),

    requiredMaintenance: rank.maintenance,
    requiredTeamSales: rank.target,
    requiredActiveMembers: rank.active,

    levelsUnlocked: rank.levels,
    bonus: qualifies ? rank.bonus : 0,
    salary: qualifies ? rank.salary : 0,
    progressPercent: Number(progressPercent.toFixed(2)),

    message: qualifies
      ? `Congratulations! You qualify for ${rank.rank} commission.`
      : "You do not qualify yet. Reach maintenance, team sales target, and active Level 1 members."
  };
}

app.get("/", (req, res) => {
  res.send("MLM Compensation Backend is running.");
});

app.get("/api/dashboard", (req, res) => {
  const testAffiliate = {
    name: "Test Affiliate",
    personalSales: 3000,
    teamSales: 180000,
    activeLevel1Members: 8
  };

  res.json(buildDashboard(testAffiliate));
});

app.post("/api/dashboard", (req, res) => {
  res.json(buildDashboard(req.body));
});

app.get("/api/ranks", (req, res) => {
  res.json(ranks);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MLM Compensation Backend running on port ${PORT}`);
});
