# 🏃‍♂️ Fitness App Backend

Backend API per l'applicazione fitness con sincronizzazione cloud automatica tra dispositivi.

![Status](https://img.shields.io/badge/status-active-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🚀 Deploy su Railway

Questo backend è configurato per il deploy automatico su [Railway](https://railway.app).

### Quick Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## 📊 Caratteristiche

- ✅ **Autenticazione JWT** sicura
- ✅ **Database SQLite** con auto-setup
- ✅ **Sync automatico** tra dispositivi
- ✅ **API REST** complete
- ✅ **CORS configurabile**
- ✅ **Activity logging** per audit
- ✅ **Error handling** robusto
- ✅ **Railway optimized**

## 🔗 API Endpoints

### Autenticazione
```http
POST /api/auth/register    # Registrazione utente
POST /api/auth/login       # Login utente
```

### Sincronizzazione
```http
GET  /api/sync            # Download tutti i dati utente
POST /api/sync            # Upload/salva tutti i dati
```

### Dati Specifici
```http
GET  /api/nutrition       # Piani nutrizionali
POST /api/nutrition/:month

GET  /api/workouts        # Piani allenamento  
POST /api/workouts/:month

GET  /api/settings        # Impostazioni utente
POST /api/settings
```

### Monitoring
```http
GET /api/health           # Health check del server
GET /api/logs             # Activity logs utente
GET /api/admin/stats      # Statistiche (autenticato)
```

## 🔧 Configurazione Environment

Il backend legge queste variabili da Railway:

| Variabile | Valore | Descrizione |
|-----------|--------|-------------|
| `PORT` | `8080` | Porta server (auto-assegnata da Railway) |
| `NODE_ENV` | `production` | Environment di esecuzione |
| `JWT_SECRET` | `your-secret-key` | Secret per token JWT (generane uno sicuro!) |
| `CORS_ORIGIN` | `*` | Domini permessi per CORS |

### Configurazione Railway

1. **Vai nel dashboard Railway**
2. **Seleziona il tuo progetto**
3. **Tab "Variables"**
4. **Aggiungi le variabili sopra**

## 💾 Database

Il backend utilizza **SQLite** per semplicità e portabilità:

### Tabelle Auto-Create
- `users` - Account utenti registrati
- `nutrition_data` - Dati nutrizionali per mese
- `workout_data` - Piani allenamento per mese  
- `user_settings` - Impostazioni personali
- `activity_logs` - Log attività per audit

### Struttura Dati
```sql
-- Nutrition data structure
{
  "2025-07": {
    "phase": { "name": "Deficit", "calories": 1850 },
    "meals": {
      "23": {
        "calories": 1850,
        "meals": [...]
      }
    }
  }
}

-- Workout data structure  
{
  "2025-07": {
    "phase": { "name": "Foundation", "weeklyHours": "6-7h" },
    "workouts": {
      "23": [
        {
          "time": "07:00",
          "type": "Upper Body A", 
          "duration": 45,
          "category": "strength"
        }
      ]
    }
  }
}
```

## 🔐 Sicurezza

### Implementata
- **JWT Authentication** con scadenza 30 giorni
- **Password hashing** con bcrypt (12 rounds)
- **CORS protection** configurabile
- **SQL injection** protection
- **Input validation** su tutti gli endpoint
- **Activity logging** per audit trail

### Best Practices
- Usa sempre HTTPS in produzione
- Regenera JWT_SECRET periodicamente  
- Monitor logs per attività sospette
- Backup regolari del database

## 🚀 Sviluppo Locale

### Prerequisiti
- Node.js >= 18.0.0
- npm >= 8.0.0

### Setup
```bash
# Clone repository
git clone https://github.com/TUONOME/fitness-backend.git
cd fitness-backend

# Install dependencies
npm install

# Set environment variables (opzionale per sviluppo)
echo "JWT_SECRET=dev-secret-key" > .env
echo "NODE_ENV=development" >> .env

# Start development server
npm run dev
```

Il server sarà disponibile su `http://localhost:3000`

### Scripts Disponibili
```bash
npm start       # Avvia server produzione
npm run dev     # Avvia con nodemon (sviluppo)
npm test        # Esegui test (da implementare)
```

## 📊 Monitoring

### Health Check
```bash
curl https://your-app.up.railway.app/api/health
```

Risposta:
```json
{
  "status": "OK",
  "timestamp": "2024-06-23T15:30:45.123Z",
  "uptime": 3600,
  "environment": "production",
  "database": "connected",
  "users_count": 25,
  "version": "1.0.0"
}
```

### Logs Railway
- **Real-time logs**: Dashboard → Deployments → View Logs
- **Metrics**: CPU, Memory, Network usage
- **Crash detection**: Auto-restart su errori

## 🔄 Deploy Process

### Automatico da GitHub
```bash
# Ogni push su main triggera auto-deploy
git add .
git commit -m "✨ New feature"
git push origin main
# → Railway deploy in ~30 secondi
```

### Manual Deploy
1. Railway Dashboard → Settings
2. "Redeploy" button
3. Select commit/branch

## 🐛 Troubleshooting

### Build Failed
```bash
# Causa comune: Node version
# Soluzione: Aggiungi in package.json
"engines": {
  "node": ">=18.0.0"
}
```

### App Crashed  
```bash
# Check Railway logs per errori
# Spesso: PORT not defined o JWT_SECRET mancante
```

### Database Issues
```bash
# SQLite si auto-crea, ma se problemi persistenti:
# Railway → Database → Reset (perde tutti i dati!)
```

### CORS Errors
```bash
# Frontend non può raggiungere API
# Verifica CORS_ORIGIN nelle Railway Variables
# Setting: CORS_ORIGIN=*
```

## 📈 Performance

### Railway Free Tier
- **500 ore/mese** (~20 giorni 24/7)
- **512MB RAM** 
- **1GB storage**
- **Sleep dopo 15min inattività** (wake istantaneo)

### Ottimizzazioni
- Database SQLite locale (veloce)
- JSON compression automatica
- Graceful shutdown
- Connection pooling
- Error caching

## 🔄 Backup & Recovery

### Auto Backup
Railway backup automatici del filesystem (include database SQLite)

### Manual Backup
```bash
# Backup endpoint (implementare se necessario)
GET /api/admin/backup
```

### Data Export
Gli utenti possono esportare i loro dati:
```javascript
// Frontend call
const backup = await fetch('/api/sync', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🤝 Contribuire

1. Fork il repository
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push branch (`git push origin feature/AmazingFeature`)  
5. Apri Pull Request

## 📄 License

Distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/TUONOME/fitness-backend/issues)
- **Documentation**: Questo README
- **Railway Docs**: [railway.app/docs](https://docs.railway.app/)

## 🎯 Roadmap

### v1.1.0
- [ ] Push notifications
- [ ] Real-time sync via WebSockets
- [ ] Advanced analytics
- [ ] PostgreSQL migration

### v1.2.0  
- [ ] Multi-language support
- [ ] Email notifications
- [ ] Social login (Google, Apple)
- [ ] Advanced security headers

---

**Made with ❤️ for fitness enthusiasts**

**Deploy Status**: [![Railway Deploy](https://img.shields.io/badge/railway-deployed-success)](https://railway.app)