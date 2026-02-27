import { db } from "./index";
import { strategies } from "./schema";

const DEFAULT_STRATEGY = {
  categories: {
    allowed: ["weather", "economics", "sports", "entertainment", "science"],
    blocked: ["politics"],
    weights: { weather: 1.5, economics: 1.0, sports: 1.0 },
  },
  filters: {
    min_volume_24h: 100,
    min_time_to_expiration_hours: 24,
    max_yes_price: 0.85,
    min_yes_price: 0.15,
  },
  position_sizing: {
    default_contracts: 10,
    max_contracts: 50,
    confidence_scaling: true,
    scale_map: { "90": 50, "80": 30, "70": 15, "60": 10 },
  },
  notifications: {
    min_confidence_to_alert: 75,
  },
};

async function seed() {
  console.log("Seeding default strategy...");

  await db.insert(strategies).values({
    name: "Default Strategy",
    rules: DEFAULT_STRATEGY,
    changeReason: "Initial strategy — all categories except politics",
    status: "active",
  });

  console.log("Done! Default strategy created.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
