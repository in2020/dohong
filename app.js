const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let db;

/**
 * DB 초기화 (SQLite3 호환)
 * rankings: game_id, name, score, created_at
 */
(async () => {
  try {
    db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS rankings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rankings_game_score
      ON rankings (game_id, score DESC, created_at ASC);
    `);

    console.log('DB initialized');
  } catch (err) {
    console.error('DB init error:', err);
    process.exit(1);
  }
})();

/**
 * POST /rankings
 * body: { game_id: "pudding_jump", name: "inho", score: 123 }
 */
app.post('/api/score', async (req, res) => {
  try {
    const { gameId, name, score } = req.body;

    // validation
    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      return res.status(400).json({ message: 'game_id는 필수입니다.' });
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'name은 필수입니다.' });
    }

    const s = Number(score);
    if (!Number.isInteger(s) || s < 0) {
      return res.status(400).json({ message: 'score는 0 이상의 정수여야 합니다.' });
    }

    const cleanGameId = gameId.trim().slice(0, 50);
    const cleanName = name.trim().slice(0, 30);

    const result = await db.run(
      `INSERT INTO rankings (game_id, name, score) VALUES (?, ?, ?)`,
      [cleanGameId, cleanName, s]
    );

    const inserted = await db.get(
      `SELECT id, game_id, name, score, created_at FROM rankings WHERE id = ?`,
      [result.lastID]
    );

    res.status(201).json({ message: '랭킹 등록 완료', data: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * GET /rankings?game_id=pudding_jump&limit=50
 * - 점수 내림차순
 * - 동점이면 created_at 빠른 순
 */
app.get('/api/rankings', async (req, res) => {
  try {
    const { gameId } = req.query;

    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      return res.status(400).json({ message: 'game_id는 필수입니다.' });
    }

    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

    const rows = await db.all(
      `
      SELECT id, game_id, name, score, created_at
      FROM rankings
      WHERE game_id = ?
      ORDER BY score DESC, datetime(created_at) ASC
      LIMIT ?
      `,
      [gameId.trim(), limit]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * (옵션) GET /rankings/latest?game_id=pudding_jump&limit=20
 * - 해당 게임의 최신 등록순
 */
app.get('/rankings/latest', async (req, res) => {
  try {
    const { gameId } = req.query;

    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      return res.status(400).json({ message: 'game_id는 필수입니다.' });
    }

    const limitRaw = parseInt(req.query.limit || '20', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 200);

    const rows = await db.all(
      `
      SELECT id, game_id, name, score, created_at
      FROM rankings
      WHERE game_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [gameId.trim(), limit]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 헬스체크
 */
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

