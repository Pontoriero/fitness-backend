// server.js - Fitness App Backend per Railway
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

// Configurazione
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Logging utility
const log = (message, level = 'INFO') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
};

log(`🚀 Starting Fitness App Backend`);
log(`📊 Environment: ${NODE_ENV}`);
log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
log(`🌐 CORS Origin: ${CORS_ORIGIN}`);

// Middleware Configuration
app.use(cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    log(`${req.method} ${req.path} from ${req.ip}`);
    next();
});

// Database Setup per Railway
const DB_PATH = process.env.DATABASE_URL || './fitness.db';
log(`💾 Database path: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        log(`❌ Database connection failed: ${err.message}`, 'ERROR');
        process.exit(1);
    }
    log('✅ Connected to SQLite database');
});

// Initialize Database Tables
db.serialize(() => {
    log('🔧 Initializing database tables...');
    
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
    )`);

    // Nutrition data table
    db.run(`CREATE TABLE IF NOT EXISTS nutrition_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        month_key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, month_key)
    )`);

    // Workout data table
    db.run(`CREATE TABLE IF NOT EXISTS workout_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        month_key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, month_key)
    )`);

    // User settings table
    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        settings TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id)
    )`);

    // Activity logs
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`);

    log('✅ Database tables initialized');
});

// Utility Functions
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (user) => {
    return jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
};

const logActivity = (userId, action, details, req) => {
    db.run(
        'INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
        [userId, action, details, req.ip, req.get('User-Agent')]
    );
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Token di accesso richiesto',
            code: 'NO_TOKEN'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            log(`🔒 Token verification failed: ${err.message}`, 'WARN');
            return res.status(403).json({ 
                error: 'Token non valido o scaduto',
                code: 'INVALID_TOKEN'
            });
        }
        req.user = user;
        next();
    });
};

// Error handling middleware
const handleError = (res, error, message = 'Errore interno del server') => {
    log(`❌ Error: ${error.message}`, 'ERROR');
    res.status(500).json({ 
        error: message,
        code: 'INTERNAL_ERROR',
        ...(NODE_ENV === 'development' && { details: error.message })
    });
};

// API Routes

// 🏥 Health Check
app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        database: 'connected',
        version: '1.0.0'
    };
    
    // Quick database test
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
            healthData.database = 'error';
            healthData.status = 'WARNING';
        } else {
            healthData.users_count = row.count;
        }
        
        res.json(healthData);
    });
});

// 🔐 Authentication Routes

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email e password sono richiesti',
                code: 'MISSING_FIELDS'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'La password deve avere almeno 6 caratteri',
                code: 'PASSWORD_TOO_SHORT'
            });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                return handleError(res, err, 'Errore controllo utente esistente');
            }

            if (existingUser) {
                return res.status(400).json({ 
                    error: 'Email già registrata',
                    code: 'EMAIL_EXISTS'
                });
            }

            try {
                const passwordHash = await hashPassword(password);
                
                db.run(
                    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                    [email, passwordHash, name || ''],
                    function(err) {
                        if (err) {
                            return handleError(res, err, 'Errore nella creazione utente');
                        }

                        const user = { id: this.lastID, email, name };
                        const token = generateToken(user);
                        
                        logActivity(user.id, 'REGISTER', 'Nuovo utente registrato', req);
                        log(`✅ New user registered: ${email} (ID: ${user.id})`);
                        
                        res.status(201).json({
                            message: 'Registrazione completata con successo',
                            token,
                            user: { id: user.id, email, name }
                        });
                    }
                );
            } catch (hashError) {
                handleError(res, hashError, 'Errore nella generazione password');
            }
        });

    } catch (error) {
        handleError(res, error, 'Errore nella registrazione');
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email e password sono richiesti',
                code: 'MISSING_FIELDS'
            });
        }

        db.get(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email],
            async (err, user) => {
                if (err) {
                    return handleError(res, err, 'Errore controllo credenziali');
                }

                if (!user) {
                    logActivity(null, 'LOGIN_FAILED', `Email not found: ${email}`, req);
                    return res.status(400).json({ 
                        error: 'Credenziali non valide',
                        code: 'INVALID_CREDENTIALS'
                    });
                }

                try {
                    const validPassword = await comparePassword(password, user.password_hash);
                    
                    if (!validPassword) {
                        logActivity(user.id, 'LOGIN_FAILED', 'Password sbagliata', req);
                        return res.status(400).json({ 
                            error: 'Credenziali non valide',
                            code: 'INVALID_CREDENTIALS'
                        });
                    }

                    // Update last login
                    db.run(
                        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                        [user.id]
                    );

                    const token = generateToken(user);
                    
                    logActivity(user.id, 'LOGIN', 'Login completato', req);
                    log(`✅ User logged in: ${email} (ID: ${user.id})`);
                    
                    res.json({
                        message: 'Login completato',
                        token,
                        user: { id: user.id, email: user.email, name: user.name }
                    });

                } catch (compareError) {
                    handleError(res, compareError, 'Errore verifica password');
                }
            }
        );

    } catch (error) {
        handleError(res, error, 'Errore nel login');
    }
});

// 📊 Data Routes

// Get all user data (sync)
app.get('/api/sync', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    log(`🔄 Sync request from user ${userId}`);
    
    // Prepare parallel queries
    const queries = {
        nutrition: new Promise((resolve, reject) => {
            db.all(
                'SELECT month_key, data, updated_at FROM nutrition_data WHERE user_id = ? ORDER BY month_key DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const data = {};
                        rows.forEach(row => {
                            try {
                                data[row.month_key] = JSON.parse(row.data);
                            } catch (parseErr) {
                                log(`⚠️ JSON parse error for nutrition ${row.month_key}: ${parseErr.message}`, 'WARN');
                            }
                        });
                        resolve(data);
                    }
                }
            );
        }),

        workouts: new Promise((resolve, reject) => {
            db.all(
                'SELECT month_key, data, updated_at FROM workout_data WHERE user_id = ? ORDER BY month_key DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const data = {};
                        rows.forEach(row => {
                            try {
                                data[row.month_key] = JSON.parse(row.data);
                            } catch (parseErr) {
                                log(`⚠️ JSON parse error for workout ${row.month_key}: ${parseErr.message}`, 'WARN');
                            }
                        });
                        resolve(data);
                    }
                }
            );
        }),

        settings: new Promise((resolve, reject) => {
            db.get(
                'SELECT settings FROM user_settings WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            const settings = row ? JSON.parse(row.settings) : {
                                height: 177,
                                targetBodyFat: 15,
                                currentBodyFat: 22
                            };
                            resolve(settings);
                        } catch (parseErr) {
                            log(`⚠️ JSON parse error for settings: ${parseErr.message}`, 'WARN');
                            resolve({
                                height: 177,
                                targetBodyFat: 15,
                                currentBodyFat: 22
                            });
                        }
                    }
                }
            );
        })
    };

    Promise.all([queries.nutrition, queries.workouts, queries.settings])
        .then(([nutrition, workouts, settings]) => {
            logActivity(userId, 'SYNC_GET', `Retrieved ${Object.keys(nutrition).length} nutrition months, ${Object.keys(workouts).length} workout months`, req);
            
            res.json({
                nutrition,
                workouts,
                settings,
                lastSync: new Date().toISOString(),
                user: { id: userId, email: req.user.email }
            });
        })
        .catch(error => {
            logActivity(userId, 'SYNC_ERROR', error.message, req);
            handleError(res, error, 'Errore nella sincronizzazione');
        });
});

// Save all user data (bulk sync)
app.post('/api/sync', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { nutrition, workouts, settings } = req.body;
    
    log(`💾 Bulk save request from user ${userId}`);
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let hasError = false;
        let operationsCount = 0;

        const handleTransactionError = (error) => {
            if (!hasError) {
                hasError = true;
                db.run('ROLLBACK');
                logActivity(userId, 'SYNC_SAVE_ERROR', error.message, req);
                handleError(res, error, 'Errore nel salvataggio bulk');
            }
        };

        try {
            // Save nutrition data
            if (nutrition && typeof nutrition === 'object') {
                Object.entries(nutrition).forEach(([monthKey, data]) => {
                    const dataString = JSON.stringify(data);
                    db.run(
                        `INSERT OR REPLACE INTO nutrition_data (user_id, month_key, data, updated_at) 
                         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                        [userId, monthKey, dataString],
                        function(err) {
                            if (err && !hasError) {
                                handleTransactionError(err);
                            } else {
                                operationsCount++;
                            }
                        }
                    );
                });
            }

            // Save workout data
            if (workouts && typeof workouts === 'object') {
                Object.entries(workouts).forEach(([monthKey, data]) => {
                    const dataString = JSON.stringify(data);
                    db.run(
                        `INSERT OR REPLACE INTO workout_data (user_id, month_key, data, updated_at) 
                         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                        [userId, monthKey, dataString],
                        function(err) {
                            if (err && !hasError) {
                                handleTransactionError(err);
                            } else {
                                operationsCount++;
                            }
                        }
                    );
                });
            }

            // Save settings
            if (settings && typeof settings === 'object') {
                const settingsString = JSON.stringify(settings);
                db.run(
                    `INSERT OR REPLACE INTO user_settings (user_id, settings, updated_at) 
                     VALUES (?, ?, CURRENT_TIMESTAMP)`,
                    [userId, settingsString],
                    function(err) {
                        if (err && !hasError) {
                            handleTransactionError(err);
                        } else {
                            operationsCount++;
                        }
                    }
                );
            }

            // Commit transaction
            db.run('COMMIT', (err) => {
                if (err && !hasError) {
                    handleTransactionError(err);
                } else if (!hasError) {
                    logActivity(userId, 'SYNC_SAVE', `Saved ${operationsCount} items`, req);
                    log(`✅ Bulk save completed for user ${userId}: ${operationsCount} operations`);
                    
                    res.json({
                        message: 'Sincronizzazione completata',
                        operations: operationsCount,
                        timestamp: new Date().toISOString()
                    });
                }
            });

        } catch (error) {
            handleTransactionError(error);
        }
    });
});

// Individual data endpoints

// Nutrition endpoints
app.get('/api/nutrition', authenticateToken, (req, res) => {
    db.all(
        'SELECT month_key, data, updated_at FROM nutrition_data WHERE user_id = ? ORDER BY month_key DESC',
        [req.user.userId],
        (err, rows) => {
            if (err) {
                return handleError(res, err, 'Errore recupero dati nutrizionali');
            }

            const nutritionData = {};
            rows.forEach(row => {
                try {
                    nutritionData[row.month_key] = JSON.parse(row.data);
                } catch (parseErr) {
                    log(`⚠️ JSON parse error for nutrition ${row.month_key}: ${parseErr.message}`, 'WARN');
                }
            });

            res.json({ nutrition: nutritionData });
        }
    );
});

app.post('/api/nutrition/:monthKey', authenticateToken, (req, res) => {
    const { monthKey } = req.params;
    const { data } = req.body;
    const userId = req.user.userId;

    if (!data) {
        return res.status(400).json({ 
            error: 'Dati nutrizionali richiesti',
            code: 'MISSING_DATA'
        });
    }

    const dataString = JSON.stringify(data);

    db.run(
        `INSERT OR REPLACE INTO nutrition_data (user_id, month_key, data, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, monthKey, dataString],
        function(err) {
            if (err) {
                return handleError(res, err, 'Errore salvataggio dati nutrizionali');
            }

            logActivity(userId, 'NUTRITION_SAVE', `Saved nutrition data for ${monthKey}`, req);
            res.json({ 
                message: 'Dati nutrizionali salvati',
                monthKey,
                rowId: this.lastID 
            });
        }
    );
});

// Workout endpoints
app.get('/api/workouts', authenticateToken, (req, res) => {
    db.all(
        'SELECT month_key, data, updated_at FROM workout_data WHERE user_id = ? ORDER BY month_key DESC',
        [req.user.userId],
        (err, rows) => {
            if (err) {
                return handleError(res, err, 'Errore recupero dati allenamenti');
            }

            const workoutData = {};
            rows.forEach(row => {
                try {
                    workoutData[row.month_key] = JSON.parse(row.data);
                } catch (parseErr) {
                    log(`⚠️ JSON parse error for workout ${row.month_key}: ${parseErr.message}`, 'WARN');
                }
            });

            res.json({ workouts: workoutData });
        }
    );
});

app.post('/api/workouts/:monthKey', authenticateToken, (req, res) => {
    const { monthKey } = req.params;
    const { data } = req.body;
    const userId = req.user.userId;

    if (!data) {
        return res.status(400).json({ 
            error: 'Dati allenamenti richiesti',
            code: 'MISSING_DATA'
        });
    }

    const dataString = JSON.stringify(data);

    db.run(
        `INSERT OR REPLACE INTO workout_data (user_id, month_key, data, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, monthKey, dataString],
        function(err) {
            if (err) {
                return handleError(res, err, 'Errore salvataggio dati allenamenti');
            }

            logActivity(userId, 'WORKOUT_SAVE', `Saved workout data for ${monthKey}`, req);
            res.json({ 
                message: 'Dati allenamenti salvati',
                monthKey,
                rowId: this.lastID 
            });
        }
    );
});

// Settings endpoints
app.get('/api/settings', authenticateToken, (req, res) => {
    db.get(
        'SELECT settings FROM user_settings WHERE user_id = ?',
        [req.user.userId],
        (err, row) => {
            if (err) {
                return handleError(res, err, 'Errore recupero impostazioni');
            }

            let settings;
            try {
                settings = row ? JSON.parse(row.settings) : {
                    height: 177,
                    targetBodyFat: 15,
                    currentBodyFat: 22
                };
            } catch (parseErr) {
                log(`⚠️ JSON parse error for settings: ${parseErr.message}`, 'WARN');
                settings = {
                    height: 177,
                    targetBodyFat: 15,
                    currentBodyFat: 22
                };
            }

            res.json({ settings });
        }
    );
});

app.post('/api/settings', authenticateToken, (req, res) => {
    const { settings } = req.body;
    const userId = req.user.userId;

    if (!settings) {
        return res.status(400).json({ 
            error: 'Impostazioni richieste',
            code: 'MISSING_SETTINGS'
        });
    }

    const settingsString = JSON.stringify(settings);

    db.run(
        `INSERT OR REPLACE INTO user_settings (user_id, settings, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [userId, settingsString],
        function(err) {
            if (err) {
                return handleError(res, err, 'Errore salvataggio impostazioni');
            }

            logActivity(userId, 'SETTINGS_SAVE', 'Settings updated', req);
            res.json({ 
                message: 'Impostazioni salvate',
                rowId: this.lastID 
            });
        }
    );
});

// 📊 Admin/Stats Routes (protected)
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    // Simple stats endpoint
    db.all(`
        SELECT 
            (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users,
            (SELECT COUNT(*) FROM activity_logs WHERE DATE(timestamp) = DATE('now')) as today_activity,
            (SELECT COUNT(*) FROM nutrition_data) as nutrition_months,
            (SELECT COUNT(*) FROM workout_data) as workout_months
    `, (err, rows) => {
        if (err) {
            return handleError(res, err, 'Errore recupero statistiche');
        }

        res.json({
            stats: rows[0],
            server_uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });
});

// Activity logs for user
app.get('/api/logs', authenticateToken, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    db.all(
        'SELECT action, details, timestamp FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
        [req.user.userId, limit],
        (err, rows) => {
            if (err) {
                return handleError(res, err, 'Errore recupero logs');
            }

            res.json({ logs: rows });
        }
    );
});

// 🌐 Default Routes
app.get('/', (req, res) => {
    res.json({
        message: '🏃‍♂️ Fitness App Backend API',
        version: '1.0.0',
        status: 'active',
        endpoints: {
            health: 'GET /api/health',
            auth: ['POST /api/auth/register', 'POST /api/auth/login'],
            sync: ['GET /api/sync', 'POST /api/sync'],
            data: [
                'GET/POST /api/nutrition',
                'GET/POST /api/workouts', 
                'GET/POST /api/settings'
            ]
        },
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Catch all API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint non trovato',
        code: 'NOT_FOUND',
        path: req.path 
    });
});

// Global error handler
app.use((err, req, res, next) => {
    log(`💥 Unhandled error: ${err.message}`, 'ERROR');
    res.status(500).json({ 
        error: 'Errore interno del server',
        code: 'INTERNAL_ERROR',
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Graceful shutdown
const gracefulShutdown = () => {
    log('🛑 Graceful shutdown initiated...');
    
    db.close((err) => {
        if (err) {
            log(`❌ Error closing database: ${err.message}`, 'ERROR');
        } else {
            log('✅ Database connection closed');
        }
        
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
    log(`🚀 Server running on port ${PORT}`);
    log(`🌐 Environment: ${NODE_ENV}`);
    log(`💾 Database: SQLite (${DB_PATH})`);
    log(`🔐 JWT configured: ${JWT_SECRET ? 'Yes' : 'No'}`);
    log('✅ Fitness App Backend ready!');
    
    // Log initial database state
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err) {
            log(`👥 Current users: ${row.count}`);
        }
    });
});

// Export for testing
module.exports = { app, db };