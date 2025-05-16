const db = require('../database/db');

class SkillHandler {
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
                    is_passive: false
                },
                {
                    id: 102,
                    name: "Regeneration",
                    description: "Heals 15% of max HP over 10 seconds",
                    cooldown: 20,
                    level_required: 3,
                    mana_cost: 15,
                    is_passive: false
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
                    is_passive: true
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
                    is_passive: false
                }
            ],
            mage: []
        };
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

    async getSkillsForClass(classId) {
        try {
            const [skills] = await db.query(
                'SELECT * FROM skills WHERE class_id = ? ORDER BY level_required ASC',
                [classId]
            );
            
            if (skills?.length > 0) {
                return skills.map(this._formatSkill);
            }
            return this.fallbackSkills[classId] || [];
        } catch (error) {
            console.error('Failed to get skills for class:', error);
            return this.fallbackSkills[classId] || [];
        }
    }

    async getCharacterSkills(characterId) {
        const character = await this.verifyCharacter(characterId);
        if (!character) {
            throw new Error(`Character ${characterId} not found`);
        }

        try {
            const [skills] = await db.query(`
                SELECT 
                    s.skills_id as id, 
                    s.name, 
                    s.description,
                    s.level_required,
                    s.mana_cost,
                    s.cooldown,
                    s.is_passive,
                    cs.unlocked,
                    cs.skill_level
                FROM character_skills cs
                JOIN skills s ON cs.skill_id = s.skills_id
                WHERE cs.character_id = ?
                ORDER BY s.level_required ASC
            `, [characterId]);

            return skills || [];
        } catch (error) {
            console.error('Failed to get character skills:', error);
            return [];
        }
    }

async learnSkill(characterId, skillId) {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Validate inputs
        characterId = parseInt(characterId);
        skillId = parseInt(skillId);
        
        if (isNaN(characterId)) {
            return {
                success: false,
                message: "Invalid character ID"
            };
        }

        if (isNaN(skillId)) {
            return {
                success: false,
                message: "Invalid skill ID"
            };
        }

        // Get character with lock
        const [charRows] = await connection.query(
            'SELECT * FROM characters WHERE id = ? LIMIT 1 FOR UPDATE',
            [characterId]
        );
        
        if (!charRows?.length) {
            return {
                success: false,
                message: "Character not found"
            };
        }
        
        const character = charRows[0];
        
        // Get skill data
        const skill = await this._getSkillById(skillId, character.class_id);
        if (!skill) {
            return {
                success: false,
                message: "Skill not available for your class"
            };
        }

        // Check if already learned
        const [existingRows] = await connection.query(
            'SELECT 1 FROM character_skills WHERE character_id = ? AND skill_id = ? LIMIT 1',
            [characterId, skillId]
        );
        
        if (existingRows?.length) {
            await connection.rollback();
            return {
                success: false,
                message: `You already know ${skill.name}`
            };
        }

        // Check level requirement
        if (character.level < (skill.level_required || 1)) {
            await connection.rollback();
            return {
                success: false,
                message: `Requires level ${skill.level_required} (you're level ${character.level})`
            };
        }

        // Learn the skill
        await connection.query(
            'INSERT INTO character_skills (character_id, skill_id, unlocked, skill_level) VALUES (?, ?, 1, 1)',
            [characterId, skillId]
        );

        await connection.commit();
        
        return {
            success: true,
            message: `🎉 Successfully learned: ${skill.name}`,
            skillName: skill.name,
            skillId: skillId
        };

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Failed to learn skill:', error);
        return {
            success: false,
            message: error.message || 'Failed to learn skill'
        };
    } finally {
        if (connection) await connection.release();
    }
}

async _getSkillById(skillId, classId = null) {
    try {
        let query = 'SELECT * FROM skills WHERE skills_id = ?';
        const params = [skillId];
        
        if (classId) {
            query += ' AND class_id = ?';
            params.push(classId);
        }

        // Fix the query execution
        const [rows] = await db.query(query, params);
        const dbSkill = rows[0];

        if (dbSkill) return this._formatSkill(dbSkill);

        // Fallback to hardcoded skills
        for (const classKey in this.fallbackSkills) {
            if (classId && classKey !== classId) continue;
            
            const skill = this.fallbackSkills[classKey].find(s => s.id === skillId);
            if (skill) return skill;
        }

        return null;
    } catch (error) {
        console.error('Failed to get skill by ID:', error);
        return null;
    }
}

    _formatSkill(dbSkill) {
        return {
            id: dbSkill.skills_id,
            name: dbSkill.name,
            description: dbSkill.description,
            class_id: dbSkill.class_id,
            level_required: dbSkill.level_required || 1,
            mana_cost: dbSkill.mana_cost || 0,
            cooldown: dbSkill.cooldown || 0,
            is_passive: dbSkill.is_passive || false
        };
    }
}

module.exports = new SkillHandler();