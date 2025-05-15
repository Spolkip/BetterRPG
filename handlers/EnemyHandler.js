const db = require('../database/db');

class EnemyHandler {
    constructor() {
        this.enemyTypes = [
            { 
                id: 1, 
                name: "Goblin", 
                level: 1, 
                health: 30, 
                attack: 5, 
                defense: 2, 
                xp: 15, 
                gold: 10,
                attackPhrases: ["swings a rusty dagger", "throws a rock", "scratches at you"],
                deathPhrase: "collapses in a heap of green limbs"
            },
            { 
                id: 2, 
                name: "Orc", 
                level: 3, 
                health: 60, 
                attack: 8, 
                defense: 4, 
                xp: 30, 
                gold: 20,
                attackPhrases: ["swings a crude axe", "charges with a roar", "punches wildly"],
                deathPhrase: "lets out a final bellow before falling"
            },
            { 
                id: 3, 
                name: "Troll", 
                level: 5, 
                health: 100, 
                attack: 12, 
                defense: 6, 
                xp: 50, 
                gold: 35,
                attackPhrases: ["swings a massive club", "regenerates some health", "stomps the ground"],
                deathPhrase: "slowly crumbles into dust"
            },
            { 
                id: 4, 
                name: "Dragon", 
                level: 10, 
                health: 200, 
                attack: 20, 
                defense: 10, 
                xp: 100, 
                gold: 100,
                attackPhrases: ["breathes a cone of fire", "swipes with razor claws", "tail whips you"],
                deathPhrase: "lets out a final roar before collapsing"
            }
        ];
        this.battleCooldowns = new Map();
        this.maxRounds = 30; // Reduced from 50 for better pacing
    }

    getRandomEnemy(minLevel = 1, maxLevel = 5) {
        const eligibleEnemies = this.enemyTypes.filter(
            enemy => enemy.level >= minLevel && enemy.level <= maxLevel
        );
        
        if (eligibleEnemies.length === 0) {
            return this.enemyTypes[0];
        }
        
        // Weighted random - higher level enemies are slightly less common
        const weightedEnemies = eligibleEnemies.flatMap(enemy => 
            Array(Math.max(1, 5 - enemy.level)).fill(enemy)
        );
        
        return weightedEnemies[Math.floor(Math.random() * weightedEnemies.length)];
    }

    calculateDamage(attacker, defender, isPlayerAttacking) {
        // Base attack calculation
        let baseAttack;
        if (isPlayerAttacking) {
            // Player attack based on stats
            baseAttack = attacker.strength * 0.7 + 
                        attacker.dexterity * 0.3 +
                        (attacker.weaponDamage || 0);
        } else {
            // Enemy attack with some variation
            baseAttack = attacker.attack * (0.9 + Math.random() * 0.2);
        }
        
        // Defense calculation
        const defense = isPlayerAttacking 
            ? defender.defense * (0.8 + Math.random() * 0.4) // Enemy defense varies
            : defender.constitution * 0.6 + 
              defender.dexterity * 0.2 +
              (defender.armorValue || 0);
        
        // Critical hit chance (5% base + dex bonus)
        const critChance = isPlayerAttacking 
            ? 0.05 + (attacker.dexterity * 0.005)
            : 0.05;
            
        const isCritical = Math.random() < critChance;
        
        // Final damage calculation
        let damage = Math.max(1, baseAttack * (isCritical ? 1.5 : 1) - defense * 0.6);
        damage = Math.round(damage);
        
        return {
            damage,
            isCritical,
            wasDodged: !isPlayerAttacking && (Math.random() < (defender.agility * 0.005))
        };
    }

    async battle(player, enemy) {
        const battleLog = [];
        let playerHP = player.health;
        let enemyHP = enemy.health;
        let round = 1;
        
        // Battle introduction
        battleLog.push(`⚔️ **Battle against ${enemy.name} (Level ${enemy.level})** begins!`);
        battleLog.push(`You have ${playerHP} HP | ${enemy.name} has ${enemyHP} HP`);

        // Battle loop
        while (playerHP > 0 && enemyHP > 0 && round <= this.maxRounds) {
            // Player's turn
            const playerAttack = this.calculateDamage(player, enemy, true);
            
            if (!playerAttack.wasDodged) {
                enemyHP = Math.max(0, enemyHP - playerAttack.damage);
                const attackPhrase = playerAttack.isCritical 
                    ? `**CRITICAL HIT!** You strike for ${playerAttack.damage} damage!`
                    : `You attack for ${playerAttack.damage} damage.`;
                battleLog.push(`🎯 **Round ${round}:** ${attackPhrase} (${enemy.name}: ${enemyHP}/${enemy.health} HP)`);
                
                if (enemyHP <= 0) break;
            } else {
                battleLog.push(`🌀 **Round ${round}:** ${enemy.name} dodges your attack!`);
            }

            // Enemy's turn
            const enemyAttack = this.calculateDamage(enemy, player, false);
            
            if (!enemyAttack.wasDodged) {
                playerHP = Math.max(0, playerHP - enemyAttack.damage);
                const attackMethod = enemy.attackPhrases[Math.floor(Math.random() * enemy.attackPhrases.length)];
                const attackPhrase = enemyAttack.isCritical
                    ? `**DEVASTATING BLOW!** ${enemy.name} ${attackMethod} for ${enemyAttack.damage} damage!`
                    : `${enemy.name} ${attackMethod} for ${enemyAttack.damage} damage.`;
                battleLog.push(`💥 **Round ${round}:** ${attackPhrase} (You: ${playerHP}/${player.max_health} HP)`);
            } else {
                battleLog.push(`🍃 **Round ${round}:** You deftly dodge ${enemy.name}'s attack!`);
            }
            
            round++;
        }

        // Battle conclusion
        let result;
        if (enemyHP <= 0) {
            result = {
                victory: true,
                message: `🏆 **VICTORY!** You defeated the ${enemy.name}! ${enemy.deathPhrase}.`,
                xpEarned: enemy.xp,
                goldEarned: enemy.gold
            };
        } else if (playerHP <= 0) {
            result = {
                victory: false,
                message: `☠️ **DEFEAT!** The ${enemy.name} has bested you...`,
                xpEarned: Math.floor(enemy.xp * 0.3), // Some XP even for losing
                goldEarned: 0
            };
        } else {
            result = {
                victory: false,
                message: `🕒 The battle was interrupted after ${round} rounds!`,
                xpEarned: Math.floor(enemy.xp * 0.5 * (round/this.maxRounds)),
                goldEarned: 0
            };
        }

        battleLog.push(result.message);
        battleLog.push(`Final HP - You: ${playerHP}/${player.max_health} | ${enemy.name}: ${enemyHP}/${enemy.health}`);

        return {
            ...result,
            playerHP,
            enemyHP,
            battleLog,
            roundsFought: round - 1,
            // Split the log into chunks that won't exceed Discord's limits
            getBattleLogChunks: () => {
                const fullLog = battleLog.join('\n');
                const chunks = [];
                const chunkSize = 1500; // Conservative chunk size
                
                for (let i = 0; i < fullLog.length; i += chunkSize) {
                    chunks.push(fullLog.substring(i, i + chunkSize));
                }
                
                return chunks;
            }
        };
    }

    isOnCooldown(userId) {
        if (!this.battleCooldowns.has(userId)) return false;
        
        const remaining = this.battleCooldowns.get(userId) - Date.now();
        return remaining > 0;
    }

    getCooldown(userId) {
        if (!this.isOnCooldown(userId)) return 0;
        return Math.ceil((this.battleCooldowns.get(userId) - Date.now()) / 1000);
    }

    setCooldown(userId, seconds) {
        this.battleCooldowns.set(userId, Date.now() + seconds * 1000);
        
        // Clean up old cooldowns periodically
        if (Math.random() < 0.1) { // 10% chance to clean up
            for (const [id, time] of this.battleCooldowns) {
                if (time < Date.now()) {
                    this.battleCooldowns.delete(id);
                }
            }
        }
    }
}

module.exports = new EnemyHandler();