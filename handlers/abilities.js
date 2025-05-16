const db = require('../database/db');

class AbilityHandler {
    constructor() {
        this.fallbackSkills = {
            warrior: [
                {
                    id: 101,
                    name: "Provoking Shout",
                    description: "Taunts enemies to attack you for 3 rounds (+50% threat generation)",
                    cooldown: 8,
                    level_required: 1,
                    mana_cost: 10,
                    is_passive: false,
                    class_id: 'warrior'
                },
                {
                    id: 102,
                    name: "Regeneration",
                    description: "Heals 15% of max HP over 10 seconds",
                    cooldown: 20,
                    level_required: 3,
                    mana_cost: 15,
                    is_passive: false,
                    class_id: 'warrior'
                }
            ],
            rogue: [
                {
                    id: 301,
                    name: "Backstab",
                    description: "Deals 250% damage when attacking from behind",
                    cooldown: 0,
                    level_required: 1,
                    mana_cost: 0,
                    is_passive: true,
                    class_id: 'rogue'
                }
            ],
            ranged: [
                {
                    id: 201,
                    name: "Explosive Arrow",
                    description: "Shoots an arrow that explodes on impact (150% damage in AoE)",
                    cooldown: 12,
                    level_required: 1,
                    mana_cost: 20,
                    is_passive: false,
                    class_id: 'ranged'
                }
            ],
            mage: []
        };
    }

 async verifyCharacter(characterId) {
        try {
            console.log(`[DEBUG] Verifying character ID: ${characterId}`);
            characterId = parseInt(characterId);
            if (isNaN(characterId)) {
                throw new Error('Invalid character ID - not a number');
            }

            console.log(`[DEBUG] Querying database for character ${characterId}`);
            const [rows] = await db.query(`
                SELECT 
                    c.id, c.user_id, c.name, c.class_id, c.level,
                    cl.name AS class_name
                FROM characters c
                LEFT JOIN classes cl ON c.class_id = cl.id
                WHERE c.id = ?
                LIMIT 1
            `, [characterId]);

            console.log(`[DEBUG] Query results type:`, typeof rows);
            console.log(`[DEBUG] Query results:`, rows);
            
            // Fix: Handle both array and object responses
            let character;
            if (Array.isArray(rows)) {
                if (rows.length === 0) {
                    throw new Error(`Character ${characterId} not found in database`);
                }
                character = rows[0];
            } else if (typeof rows === 'object' && rows !== null) {
                character = rows;
            } else {
                throw new Error('Unexpected database response format');
            }

            console.log(`[DEBUG] Extracted character data:`, character);
            
            if (!character || !character.id || !character.class_id) {
                throw new Error('Character data is incomplete - missing required fields');
            }

            console.log(`[DEBUG] Successfully verified character:`, {
                id: character.id,
                user_id: character.user_id,
                name: character.name,
                class_id: character.class_id,
                level: character.level,
                class_name: character.class_name
            });
            
            return {
                id: character.id,
                user_id: character.user_id,
                name: character.name,
                class_id: character.class_id,
                level: character.level,
                class_name: character.class_name
            };
        } catch (error) {
            console.error(`[ERROR] Failed to verify character ${characterId}:`, error);
            throw error;
        }
    }

async getCharacterSkills(characterId) {
        try {
            console.log(`[DEBUG] Getting skills for character ${characterId}`);
            const character = await this.verifyCharacter(characterId);
            
            if (!character?.id) {
                console.error('[ERROR] Invalid character data received');
                return [];
            }

            console.log(`[DEBUG] Querying skills for character ${character.id}`);
            
            // Modified query to properly handle single row vs array results
            const queryResult = await db.query(`
                SELECT 
                    s.skills_id as id,
                    s.name,
                    s.description,
                    s.level_required,
                    s.mana_cost,
                    s.cooldown,
                    s.is_passive,
                    cs.skill_level,
                    cs.unlocked
                FROM character_skills cs
                JOIN skills s ON cs.skill_id = s.skills_id
                WHERE cs.character_id = ? AND cs.unlocked = 1
            `, [character.id]);

            // Handle both array and object responses
            let skills = [];
            if (Array.isArray(queryResult)) {
                // MySQL2 returns [rows, fields]
                skills = Array.isArray(queryResult[0]) ? queryResult[0] : [queryResult[0]];
            } else if (typeof queryResult === 'object' && queryResult !== null) {
                skills = [queryResult];
            }

            console.log(`[DEBUG] Processed skills from database:`, skills);

            // Get passive skills that are automatically known
            const passiveSkills = this.fallbackSkills[character.class_id]
                ?.filter(s => s.is_passive)
                ?.map(s => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    level_required: s.level_required,
                    mana_cost: s.mana_cost,
                    cooldown: s.cooldown,
                    is_passive: true,
                    skill_level: 1,
                    unlocked: 1
                })) || [];

            // Combine both active and passive skills
            const allSkills = [
                ...skills.filter(s => s), // Remove any null/undefined
                ...passiveSkills
            ];

            console.log(`[DEBUG] Final combined skills list:`, allSkills);
            return allSkills;
        } catch (error) {
            console.error('[ERROR] Failed to get character skills:', error);
            return [];
        }
    }
// In AbilityHandler class
async useSkill(characterId, skillId, enemy) {
    try {
        const character = await this.verifyCharacter(characterId);
        if (!character) {
            return { success: false, message: "Character not found" };
        }

        const skill = await this.getSkillById(skillId, character.class_id);
        if (!skill) {
            return { success: false, message: "Skill not found" };
        }

        // Check if character knows the skill
        const [knownSkill] = await db.query(
            'SELECT * FROM character_skills WHERE character_id = ? AND skill_id = ? AND unlocked = 1',
            [characterId, skillId]
        );

        if (!knownSkill?.length && !this.fallbackSkills[character.class_id]?.some(s => s.id === skillId)) {
            return { success: false, message: "You haven't learned this skill" };
        }

        // Check mana cost
        if (character.mana < (skill.mana_cost || 0)) {
            return { success: false, message: "Not enough mana" };
        }

        // Calculate damage/healing based on skill type
        let result = { success: true, message: skill.description };
        
        if (!skill.is_passive) {
            // Active skill effects
            const baseDamage = character.strength * 0.5 + character.dexterity * 0.3;
            result.damage = Math.round(baseDamage * (Math.random() * 0.5 + 0.75));
            
            if (skill.id === 102) { // Regeneration skill
                result.healing = Math.round(character.max_health * 0.15);
            }
            
            // Deduct mana
            await db.query(
                'UPDATE characters SET mana = mana - ? WHERE id = ?',
                [skill.mana_cost, characterId]
            );
        }

        return result;
    } catch (error) {
        console.error('Failed to use skill:', error);
        return { success: false, message: "Failed to use skill" };
    }
}
    async getSkillsForClass(classId) {
        try {
            if (!classId) throw new Error('No class specified');
            
            // Get skills from database
            const [dbSkills] = await db.query(
                'SELECT * FROM skills WHERE class_id = ? ORDER BY level_required ASC',
                [classId]
            );

            // Get fallback skills for this class
            const fallbackSkills = this.fallbackSkills[classId] || [];

            // Combine and format all skills
            const combinedSkills = [
                ...(Array.isArray(dbSkills) ? dbSkills.map(skill => this.formatSkill(skill)) : []),
                ...fallbackSkills.map(skill => this.formatSkill(skill))
            ];

            return combinedSkills;
        } catch (error) {
            console.error(`Failed to get skills for class ${classId}:`, error);
            return this.fallbackSkills[classId]?.map(skill => this.formatSkill(skill)) || [];
        }
    }

async learnSkill(characterId, skillId) {
        let connection;
        try {
            console.log(`[DEBUG] Attempting to learn skill ${skillId} for character ${characterId}`);
            connection = await db.getConnection();
            await connection.beginTransaction();

            characterId = parseInt(characterId);
            skillId = parseInt(skillId);
            
            if (isNaN(characterId)) throw new Error("Invalid character ID");
            if (isNaN(skillId)) throw new Error("Invalid skill ID");

            console.log(`[DEBUG] Verifying character ${characterId}`);
            const character = await this.verifyCharacter(characterId);
            if (!character?.class_id) {
                throw new Error("Character data is invalid - missing class information");
            }

            console.log(`[DEBUG] Getting skill ${skillId} for class ${character.class_id}`);
            const skill = await this.getSkillById(skillId, character.class_id, connection);
            if (!skill) {
                throw new Error(`Skill ${skillId} not available for class ${character.class_id}`);
            }

            console.log(`[DEBUG] Checking if skill is already learned`);
            const [existing] = await connection.query(
                'SELECT 1 FROM character_skills WHERE character_id = ? AND skill_id = ? LIMIT 1',
                [characterId, skillId]
            );
            
            if (existing?.length) {
                throw new Error(`You already know ${skill.name}`);
            }

            if (character.level < skill.level_required) {
                throw new Error(`Requires level ${skill.level_required} (current: ${character.level})`);
            }

            console.log(`[DEBUG] Learning skill ${skillId} for character ${characterId}`);
            await connection.query(
                'INSERT INTO character_skills (character_id, skill_id, unlocked, skill_level) VALUES (?, ?, 1, 1)',
                [characterId, skillId]
            );

            await connection.commit();
            console.log(`[DEBUG] Successfully learned skill ${skillId}`);
            
            return {
                success: true,
                message: `🎉 Successfully learned: ${skill.name}`,
                skillName: skill.name,
                skillId: skillId
            };

        } catch (error) {
            console.error('[ERROR] Failed to learn skill:', error);
            if (connection) {
                try {
                    await connection.rollback();
                    console.log('[DEBUG] Transaction rolled back');
                } catch (rollbackError) {
                    console.error('[ERROR] Failed to rollback transaction:', rollbackError);
                }
            }
            return {
                success: false,
                message: error.message
            };
        } finally {
            if (connection) {
                try {
                    await connection.release();
                    console.log('[DEBUG] Connection released');
                } catch (releaseError) {
                    console.error('[ERROR] Failed to release connection:', releaseError);
                }
            }
        }
    }


    async getSkillById(skillId, classId = null, connection = null) {
        try {
            skillId = parseInt(skillId);
            if (isNaN(skillId)) return null;

            const queryFn = connection ? connection.query.bind(connection) : db.query;
            const [dbSkills] = await queryFn(
                'SELECT * FROM skills WHERE skills_id = ? AND class_id = ? LIMIT 1',
                [skillId, classId]
            );

            if (dbSkills?.length) return this.formatSkill(dbSkills[0]);

            const fallbackSkill = this.fallbackSkills[classId]?.find(s => s.id === skillId);
            return fallbackSkill ? this.formatSkill(fallbackSkill) : null;
        } catch (error) {
            console.error('Failed to get skill by ID:', error);
            return null;
        }
    }

    formatSkill(skill) {
        return {
            id: skill.skills_id || skill.id,
            name: skill.name,
            description: skill.description,
            class_id: skill.class_id,
            level_required: skill.level_required || 1,
            mana_cost: skill.mana_cost || 0,
            cooldown: skill.cooldown || 0,
            is_passive: Boolean(skill.is_passive)
        };
    }
}

module.exports = new AbilityHandler();