import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const GOAFFPRO_TOKEN = process.env.GOAFFPRO_TOKEN;
const GOAFFPRO_API = "https://api.goaffpro.com/admin";

const ranks = [
  { rank: "Member", maintenance: 580, target: 6380, bonus: 650, salary: 0, active: 2, levels: "1" },
  { rank: "Associate", maintenance: 1160, target: 20000, bonus: 2100, salary: 0, active: 4, levels: "1 & 2" },
  { rank: "Team Leader", maintenance: 1740, target: 65000, bonus: 4500, salary: 2000, active: 6, levels: "1 - 3" },
  { rank: "Manager", maintenance: 2900, target: 180000, bonus: 10000, salary: 5000, active: 8, levels: "1 - 4" },
  { rank: "Director", maintenance: 4060, target: 400000, bonus: 25000, salary: 15000, active: 10, levels: "1 - 5" },
  { rank: "Senior Director", maintenance: 5800, target: 1200000, bonus: 55000, salary: 20000, active: 12, levels: "1 - 6" },
  { rank: "Executive Director", maintenance: 8120, target: 2500000, bonus: 100000, salary: 35000, active: 14, levels: "1 - 7" }
];

async function goaffpro(path) {
  const res = await fetch(`${GOAFFPRO_API}${path}`, {
    headers: {
      Authorization: `Bearer ${GOAFFPRO_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`GoAffPro API error ${res.status}`);
  }

  return res.json();
}

function arr(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function amount(x) {
  return Number(
    x?.total ||
    x?.total_price ||
    x?.amount ||
    x?.order_total ||
    x?.sale_amount ||
    x?.revenue ||
    x?.commission ||
    0
  );
}

function idOf(x) {
  return String(x?.id || x?._id || x?.affiliate_id || x?.partner_id || "");
}

function affiliateKey(x) {
  return String(x?.affiliate_id || x?.partner_id || x?.referrer_id || x?.affiliate?.id || "");
}

function sponsorKey(x) {
  return String(x?.parent_id || x?.referrer_id || x?.sponsor_id || x?.upline_id || x?.parent?.id || "");
}

function calculateRank(data) {
  let achieved = ranks[0];

  for (const r of ranks) {
    if (
      data.personalSales >= r.maintenance &&
      data.teamSales >= r.target &&
      data.activeLevel1Members >= r.active
    ) {
      achieved = r;
    }
  }

  return achieved;
}

function nextRank(rank) {
  const i = ranks.findIndex(r => r.rank === rank.rank);
  return ranks[i + 1] || null;
}

app.get("/", (req, res) => {
  res.send("MLM GoAffPro backend is running.");
});

app.get("/api/affiliates", async (req, res) => {
  const data = await goaffpro("/affiliates");
  res.json(data);
});

app.get("/api/orders", async (req, res) => {
  const data = await goaffpro("/orders");
  res.json(data);
});

app.get("/api/commissions", async (req, res) => {
  const data = await goaffpro("/rewards");
  res.json(data);
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase();
    const affiliateIdQuery = String(req.query.affiliateId || "");

    const affiliatesRaw = await goaffpro("/affiliates");
    const ordersRaw = await goaffpro("/orders");
    const rewardsRaw = await goaffpro("/rewards");

    const affiliates = arr(affiliatesRaw, "affiliates");
    const orders = arr(ordersRaw, "orders");
    const rewards = arr(rewardsRaw, "rewards");

    let affiliate = null;

    if (email) {
      affiliate = affiliates.find(a => String(a.email || "").toLowerCase() === email);
    }

    if (!affiliate && affiliateIdQuery) {
      affiliate = affiliates.find(a => idOf(a) === affiliateIdQuery);
    }

    if (!affiliate) {
      return res.status(404).json({
        error: true,
        message: "Affiliate not found. Pass email or affiliateId."
      });
    }

    const affiliateId = idOf(affiliate);

    const directReferrals = affiliates.filter(a => sponsorKey(a) === affiliateId);
    const directReferralIds = directReferrals.map(idOf);

    const personalOrders = orders.filter(o => affiliateKey(o) === affiliateId);
    const personalSales = personalOrders.reduce((sum, o) => sum + amount(o), 0);

    const teamOrders = orders.filter(o => directReferralIds.includes(affiliateKey(o)));
    const teamSalesFromDirects = teamOrders.reduce((sum, o) => sum + amount(o), 0);
    const teamSales = personalSales + teamSalesFromDirects;

    const activeLevel1Members = directReferralIds.filter(refId =>
      orders.some(o => affiliateKey(o) === refId)
    ).length;

    const affiliateRewards = rewards.filter(r => affiliateKey(r) === affiliateId);
    const commissions = affiliateRewards.reduce((sum, r) => sum + amount(r), 0);

    const rank = calculateRank({ personalSales, teamSales, activeLevel1Members });
    const next = nextRank(rank);

    const qualifies =
      personalSales >= rank.maintenance &&
      teamSales >= rank.target &&
      activeLevel1Members >= rank.active;

    const target = next ? next.target : rank.target;
    const progressPercent = Math.min((teamSales / target) * 100, 100);

    res.json({
      affiliateId,
      affiliateName: affiliate.name || affiliate.first_name || affiliate.email,
      currentRank: rank.rank,
      nextRank: next ? next.rank : "Top Rank",
      qualifiesForCommission: qualifies,
      personalSales,
      teamSales,
      activeLevel1Members,
      commissions,
      requiredMaintenance: rank.maintenance,
      requiredTeamSales: rank.target,
      requiredActiveMembers: rank.active,
      levelsUnlocked: rank.levels,
      bonus: qualifies ? rank.bonus : 0,
      salary: qualifies ? rank.salary : 0,
      progressPercent: Number(progressPercent.toFixed(2)),
      message: qualifies
        ? `Congratulations! You qualify for ${rank.rank}.`
        : "You do not qualify yet. Reach maintenance, team sales, and active Level 1 members."
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MLM backend running on port ${PORT}`));
    
