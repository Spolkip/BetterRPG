require('dotenv').config();
const pool = require('./database/db');

// Modified classes with IDs
const classes = [
  {
    id: "warrior",
    name: "Warrior",
    emoji: "🛡️",
    description: "Strong and durable frontline fighters.",
    base_strength: 8,
    base_agility: 3,
    base_intelligence: 2,
    base_vitality: 7,
    base_durability: 6,
    base_charisma: 2,
    base_dexterity: 3,
    base_constitution: 6,
    base_wisdom: 2,
    image_url: "https://example.com/warrior.png"
  },
  {
    id: "mage",
    name: "Mage",
    emoji: "🪄",
    description: "Masters of arcane and elemental power.",
    base_strength: 1,
    base_agility: 3,
    base_intelligence: 8,
    base_vitality: 3,
    base_durability: 2,
    base_charisma: 4,
    base_dexterity: 3,
    base_constitution: 2,
    base_wisdom: 7,
    image_url: "https://example.com/mage.png"
  }
];

// Modified races with IDs
const races = [
  {
    id: "human",
    name: "Human",
    emoji: "🧍",
    description: "Balanced and adaptable.",
    strength_mod: 1,
    agility_mod: 1,
    intelligence_mod: 1,
    vitality_mod: 1,
    durability_mod: 1,
    charisma_mod: 1,
    dexterity_mod: 1,
    constitution_mod: 1,
    wisdom_mod: 1
  },
  {
    id: "elf",
    name: "Elf",
    emoji: "🌲",
    description: "Graceful and wise, but physically frail.",
    strength_mod: -1,
    agility_mod: 3,
    intelligence_mod: 2,
    vitality_mod: 1,
    durability_mod: 0,
    charisma_mod: 2,
    dexterity_mod: 2,
    constitution_mod: 0,
    wisdom_mod: 3
  }
];

async function seedClasses() {
  for (const c of classes) {
    await pool.query(
      `INSERT INTO classes (
        id, name, emoji, description,
        base_strength, base_agility, base_intelligence, base_vitality,
        base_durability, base_charisma, base_dexterity, base_constitution, base_wisdom,
        image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.name, c.emoji, c.description,
        c.base_strength, c.base_agility, c.base_intelligence, c.base_vitality,
        c.base_durability, c.base_charisma, c.base_dexterity, c.base_constitution, c.base_wisdom,
        c.image_url
      ]
    );
  }
  console.log("✅ Seeded classes");
}

async function seedRaces() {
  for (const r of races) {
    await pool.query(
      `INSERT INTO races (
        id, name, emoji, description,
        strength_mod, agility_mod, intelligence_mod, vitality_mod,
        durability_mod, charisma_mod, dexterity_mod, constitution_mod, wisdom_mod
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, r.name, r.emoji, r.description,
        r.strength_mod, r.agility_mod, r.intelligence_mod, r.vitality_mod,
        r.durability_mod, r.charisma_mod, r.dexterity_mod, r.constitution_mod, r.wisdom_mod
      ]
    );
  }
  console.log("✅ Seeded races");
}

async function run() {
  try {
    await seedClasses();
    await seedRaces();
    console.log("🌱 Seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

run();