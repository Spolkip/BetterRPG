require('dotenv').config();
const mysql = require('mysql2/promise');

class Database {
    constructor() {
        console.log('Attempting to connect to MySQL with:', {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            database: process.env.DB_NAME || 'rpg_bot'
        });

        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'rpg_bot',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Test connection immediately
        this.testConnection();
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            console.log('✅ Successfully connected to MySQL database');
            connection.release();
            return true;
        } catch (err) {
            console.error('❌ Database connection failed:', err);
            throw err;
        }
    }

    // Standard query method that returns rows
    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.query(sql, params);
            return rows;
        } catch (err) {
            console.error('Database query error:', { sql, error: err });
            throw err;
        }
    }

    // Execute method for prepared statements
    async execute(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (err) {
            console.error('Database execute error:', { sql, error: err });
            throw err;
        }
    }
}

module.exports = new Database();