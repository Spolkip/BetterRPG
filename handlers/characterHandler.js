const db = require('../database/db');
this.skillHandler = require('./abilities');

class CharacterHandler {
    constructor() {
        this.xpConfig = {
            baseXP: 100,
            xpPerLevel: 50,
            statPointsPerLevel: 3 
        };
    }

    async executeQuery(sql, params = []) {
        try {
            // Use execute for SELECT queries with parameters, query for others
            const method = sql.includes('SELECT') && params.length > 0 ? 'execute' : 'query';
            const rows = await db[method](sql, params);
            return Array.isArray(rows) ? rows : [rows].filter(Boolean);
        } catch (error) {
            console.error('Database operation failed:', { sql, error });
            throw error;
        }
    }

    async useCharacterSkill(userId, skillId, target = null) {
        const character = await this.getCharacter(userId);
        if (!character) return { success: false, message: "Character not found" };
        
        return this.skillHandler.useSkill(character.id, skillId, target);
    }
    
    async getCharacter(userId) {
        try {
            const characters = await this.executeQuery(`
                SELECT c.*, cl.name AS class_name, cl.emoji AS class_emoji, 
                       r.name AS race_name, r.emoji AS race_emoji
                FROM characters c
                JOIN classes cl ON c.class_id = cl.id
                JOIN races r ON c.race_id = r.id
                WHERE c.user_id = ?
            `, [userId]);
            
            return characters[0] || null;
        } catch (error) {
            console.error('Error in getCharacter:', error);
            return null;
        }
    }
async getCharacterById(characterId) {
    try {
        const [rows] = await db.query(`
            SELECT c.*, cl.name AS class_name, cl.emoji AS class_emoji, 
                   r.name AS race_name, r.emoji AS race_emoji
            FROM characters c
            JOIN classes cl ON c.class_id = cl.id
            JOIN races r ON c.race_id = r.id
            WHERE c.id = ?
            LIMIT 1
        `, [characterId]);
        
        return rows[0] || null;
    } catch (error) {
        console.error('Error in getCharacterById:', error);
        return null;
    }
}
        async verifyCharacter(characterId) {
        try {
            const [rows] = await db.query(
                'SELECT id, class_id, level FROM characters WHERE id = ? LIMIT 1',
                [characterId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Failed to verify character:', error);
            return null;
        }
    }
    async getClasses() {
        try {
            const classes = await this.executeQuery('SELECT * FROM classes');
            console.log(`Loaded ${classes.length} classes from database`);
            return classes;
        } catch (error) {
            console.error('Error in getClasses:', error);
            throw error;
        }
    }

    async getRaces() {
        try {
            const races = await this.executeQuery('SELECT * FROM races');
            console.log(`Loaded ${races.length} races from database`);
            return races;
        } catch (error) {
            console.error('Error in getRaces:', error);
            throw error;
        }
    }

    async getClassById(classId) {
        try {
            const classes = await this.executeQuery('SELECT * FROM classes WHERE id = ?', [classId]);
            if (classes.length === 0) {
                console.error('Class not found:', classId);
                return null;
            }
            return classes[0];
        } catch (error) {
            console.error('Error getting class by ID:', error);
            return null;
        }
    }

    async getRaceById(raceId) {
        try {
            const races = await this.executeQuery('SELECT * FROM races WHERE id = ?', [raceId]);
            if (races.length === 0) {
                console.error('Race not found:', raceId);
                return null;
            }
            return races[0];
        } catch (error) {
            console.error('Error getting race by ID:', error);
            return null;
        }
    }

    async createCharacter(characterData) {
        const { userId, name, gender, raceId, classId } = characterData;
        
        try {
            // Verify class and race exist
            const [classData, raceData] = await Promise.all([
                this.getClassById(classId),
                this.getRaceById(raceId)
            ]);

            if (!classData || !raceData) {
                throw new Error(`Invalid class (${classId}) or race (${raceId})`);
            }

            // Calculate stats
            const stats = {
                strength: classData.base_strength + (raceData.strength_mod || 0),
                agility: classData.base_agility + (raceData.agility_mod || 0),
                intelligence: classData.base_intelligence + (raceData.intelligence_mod || 0),
                vitality: classData.base_vitality + (raceData.vitality_mod || 0),
                durability: classData.base_durability + (raceData.durability_mod || 0),
                charisma: classData.base_charisma + (raceData.charisma_mod || 0),
                dexterity: classData.base_dexterity + (raceData.dexterity_mod || 0),
                constitution: classData.base_constitution + (raceData.constitution_mod || 0),
                wisdom: classData.base_wisdom + (raceData.wisdom_mod || 0)
            };

            // Calculate derived stats
            const maxHealth = 100 + (stats.vitality * 5) + (stats.constitution * 2);
            const maxMana = 50 + (stats.intelligence * 3) + (stats.wisdom * 2);

            // Insert character - initial stat_points value remains 5
            await this.executeQuery(`
                INSERT INTO characters (
                    user_id, name, gender, race_id, class_id,
                    strength, agility, intelligence, vitality,
                    durability, charisma, dexterity, constitution, wisdom,
                    health, max_health, mana, max_mana, stat_points, xp, level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, name, gender, raceId, classId,
                stats.strength, stats.agility, stats.intelligence, stats.vitality,
                stats.durability, stats.charisma, stats.dexterity, stats.constitution, stats.wisdom,
                maxHealth, maxHealth, maxMana, maxMana, 5, 0, 1
            ]);

            return this.getCharacter(userId);
        } catch (error) {
            console.error('Error creating character:', error);
            throw error;
        }
    }

    async upgradeCharacterStat(userId, statName, amount = 1) {
        try {
            // Get character first to validate
            const character = await this.getCharacter(userId);
            if (!character) {
                return { success: false, error: 'Character not found' };
            }

            // Check if character has enough stat points
            if (character.stat_points < amount) {
                return { 
                    success: false, 
                    error: `Not enough stat points (have ${character.stat_points}, need ${amount})`
                };
            }

            // Validate stat name
            const validStats = [
                'strength', 'intelligence', 'dexterity', 'constitution',
                'vitality', 'wisdom', 'agility', 'durability', 'charisma'
            ];

            if (!validStats.includes(statName)) {
                return { success: false, error: `Invalid stat name: ${statName}` };
            }

            // Store the old value for the response
            const oldValue = character[statName];

            // Start transaction
            await this.executeQuery('START TRANSACTION');

            try {
                // Update the stat and deduct points
                await this.executeQuery(`
                    UPDATE characters 
                    SET 
                        ${statName} = ${statName} + ?,
                        stat_points = stat_points - ?
                    WHERE user_id = ?
                `, [amount, amount, userId]);

                // Also update derived statistics based on the stat that was improved
                if (['vitality', 'constitution'].includes(statName)) {
                    // Update max health if vitality or constitution was increased
                    const healthIncrease = statName === 'vitality' ? amount * 5 : amount * 2;
                    await this.executeQuery(`
                        UPDATE characters
                        SET 
                            max_health = max_health + ?,
                            health = health + ?
                        WHERE user_id = ?
                    `, [healthIncrease, healthIncrease, userId]);
                }

                if (['intelligence', 'wisdom'].includes(statName)) {
                    // Update max mana if intelligence or wisdom was increased
                    const manaIncrease = statName === 'intelligence' ? amount * 3 : amount * 2;
                    await this.executeQuery(`
                        UPDATE characters
                        SET 
                            max_mana = max_mana + ?,
                            mana = mana + ?
                        WHERE user_id = ?
                    `, [manaIncrease, manaIncrease, userId]);
                }

                // Commit transaction
                await this.executeQuery('COMMIT');

                return { 
                    success: true, 
                    oldValue: oldValue,
                    newValue: oldValue + amount,
                    remainingPoints: character.stat_points - amount
                };
            } catch (error) {
                // Rollback transaction on error
                await this.executeQuery('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error upgrading character stat:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    async checkDatabaseConnection() {
        try {
            await this.executeQuery('SELECT 1');
            return true;
        } catch (error) {
            console.error('Database connection error:', error);
            return false;
        }
    }

    // XP and level methods
    xpToNextLevel(level) {
        return this.xpConfig.baseXP + (level * this.xpConfig.xpPerLevel);
    }

    async addXP(userId, amount) {
        const character = await this.getCharacter(userId);
        if (!character) {
            return { error: 'Character not found' };
        }

        let xp = character.xp + amount;
        let level = character.level;
        let statPoints = character.stat_points || 0;
        let leveledUp = false;
        let levelsGained = 0;

        // Check if gaining levels
        while (xp >= this.xpToNextLevel(level)) {
            xp -= this.xpToNextLevel(level);
            level++;
            statPoints += this.xpConfig.statPointsPerLevel; // Now gives 3 points per level
            leveledUp = true;
            levelsGained++;
        }

        // Begin transaction for atomicity
        await this.executeQuery('START TRANSACTION');

        try {
            // Update all relevant fields
            await this.executeQuery(
                'UPDATE characters SET xp = ?, level = ?, stat_points = ?, health = max_health WHERE user_id = ?',
                [xp, level, statPoints, userId]
            );

            // Commit changes
            await this.executeQuery('COMMIT');

            return {
                leveledUp,
                levelsGained,
                newLevel: level,
                remainingXP: xp,
                statPoints,
                pointsGained: leveledUp ? levelsGained * this.xpConfig.statPointsPerLevel : 0
            };
        } catch (error) {
            // Rollback on error
            await this.executeQuery('ROLLBACK');
            console.error('Error adding XP:', error);
            return { error: 'Database error occurred' };
        }
    }

    // Method to add stat points directly (for admin or special events)
    async addStatPoints(userId, amount) {
        try {
            const character = await this.getCharacter(userId);
            if (!character) {
                return { success: false, error: 'Character not found' };
            }

            // Update stat points
            await this.executeQuery(
                'UPDATE characters SET stat_points = stat_points + ? WHERE user_id = ?',
                [amount, userId]
            );

            return {
                success: true,
                oldValue: character.stat_points,
                newValue: character.stat_points + amount
            };
        } catch (error) {
            console.error('Error adding stat points:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // New method to update health after battle
    async updateHealth(userId, newHealth) {
        try {
            await this.executeQuery(
                'UPDATE characters SET health = ? WHERE user_id = ?',
                [newHealth, userId]
            );
            return true;
        } catch (error) {
            console.error('Error updating health:', error);
            return false;
        }
    }

    // New method to fully heal character
    async fullHeal(userId) {
        try {
            await this.executeQuery(
                'UPDATE characters SET health = max_health WHERE user_id = ?',
                [userId]
            );
            return true;
        } catch (error) {
            console.error('Error healing character:', error);
            return false;
        }
    }
}

const characterHandlerInstance = new CharacterHandler();
module.exports = characterHandlerInstance;