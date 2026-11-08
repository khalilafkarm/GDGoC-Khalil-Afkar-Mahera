const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'khalil6767';
const GEMINI_API_KEY = 'AQ.Ab8RN6JPiV0fvT3plBgZd5njO8ozXQbUL9Exp_W1cF_RC76FiQ';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let db;

// 1. DATABASE MODELING & SEEDING (20 MOVIES)
(async() => {
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            year INTEGER NOT NULL,
            director TEXT NOT NULL,
            genres TEXT NOT NULL,
            rating REAL NOT NULL,
            duration TEXT NOT NULL,
            synopsis TEXT NOT NULL,
            poster_url TEXT NOT NULL,
            cast_members TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS watchlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, movie_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(movie_id) REFERENCES movies(id)
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            movie_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            review TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(movie_id) REFERENCES movies(id)
        );
    `);

    const check = await db.get("SELECT COUNT(*) as total FROM movies");
    if (check.total < 20) {
        await db.exec(`
            DELETE FROM movies;
            INSERT INTO movies (id, title, year, director, genres, rating, duration, synopsis, poster_url, cast_members) VALUES
            (1, 'Inception', 2010, 'Christopher Nolan', 'Sci-Fi,Action,Thriller', 8.8, '148 min', 'Seorang pencuri ulung yang mengekstrak rahasia perusahaan melalui teknologi berbagi mimpi ditugaskan untuk melakukan inception, menanamkan ide ke dalam alam bawah sadar seorang CEO.', 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', 'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page, Tom Hardy'),
            (2, 'Parasite', 2019, 'Bong Joon-ho', 'Drama,Thriller,Comedy', 8.5, '132 min', 'Keluarga Kim yang miskin secara perlahan menyusup dan bekerja untuk keluarga Park yang kaya raya, namun rahasia gelap di rumah mewah tersebut mengancam kehidupan mereka semua.', 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', 'Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong, Choi Woo-shik'),
            (3, 'The Dark Knight', 2008, 'Christopher Nolan', 'Action,Crime,Drama', 9.0, '152 min', 'Ketika ancaman yang dikenal sebagai Joker menebar teror dan kekacauan di Gotham, Batman harus menerima salah satu ujian psikologis dan fisik terbesar untuk melawan ketidakadilan.', 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 'Christian Bale, Heath Ledger, Aaron Eckhart, Michael Caine'),
            (4, 'Interstellar', 2014, 'Christopher Nolan', 'Sci-Fi,Drama,Adventure', 8.7, '169 min', 'Ketika masa depan bumi terancam oleh krisis pangan dan iklim, sekelompok penjelajah melintasi lubang cacing di luar angkasa demi mencari planet baru yang layak huni bagi umat manusia.', 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', 'Matthew McConaughey, Anne Hathaway, Jessica Chastain, Michael Caine'),
            (5, 'Pulp Fiction', 1994, 'Quentin Tarantino', 'Crime,Drama', 8.9, '154 min', 'Kisah kehidupan dua pembunuh bayaran mafia, seorang petinju, istri seorang gangster, dan sepasang perampok restoran yang saling bertaut dalam alur non-linear yang penuh ironi dan aksi kriminal.', 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', 'John Travolta, Samuel L. Jackson, Uma Thurman, Bruce Willis'),
            (6, 'Spirited Away', 2001, 'Hayao Miyazaki', 'Animation,Adventure,Fantasy', 8.6, '125 min', 'Chihiro, seorang gadis berusia 10 tahun, tanpa sengaja tersesat ke dunia roh. Setelah orang tuanya diubah menjadi babi, ia harus bekerja di pemandian air panas para dewa untuk membebaskan mereka.', 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', 'Rumi Hiiragi, Miyu Irino, Mari Natsuki, Takashi Naito'),
            (7, 'Whiplash', 2014, 'Damien Chazelle', 'Drama,Music', 8.5, '106 min', 'Seorang drummer jazz muda yang ambisius terdaftar di konservatorium musik paling bergengsi, di mana gurunya yang kejam dan perfeksionis mendorongnya hingga ke batas kewarasan.', 'https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg', 'Miles Teller, J.K. Simmons, Paul Reiser, Melissa Benoist'),
            (8, 'The Matrix', 1999, 'Lana Wachowski, Lilly Wachowski', 'Sci-Fi,Action', 8.7, '136 min', 'Seorang peretas komputer bernama Neo menemukan bahwa realitas yang selama ini ia jalani hanyalah simulasi buatan mesin cerdas yang memperbudak manusia, dan ia bergabung dalam pemberontakan.', 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', 'Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving'),
            (9, 'Spider-Man: Into the Spider-Verse', 2018, 'Bob Persichetti, Peter Ramsey, Rodney Rothman', 'Animation,Action,Adventure', 8.4, '117 min', 'Remaja Miles Morales menjadi Spider-Man baru di dimensinya dan harus bekerja sama dengan lima pahlawan bertopeng laba-laba lain dari dimensi berbeda untuk menghentikan ancaman multiverse.', 'https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg', 'Shameik Moore, Jake Johnson, Hailee Steinfeld, Mahershala Ali'),
            (10, 'The Godfather', 1972, 'Francis Ford Coppola', 'Crime,Drama', 9.2, '175 min', 'Kisah kepemimpinan keluarga mafia Corleone di New York pasca Perang Dunia II, di mana sang putra bungsu yang awalnya enggan, Michael Corleone, perlahan terseret menjadi pemimpin baru dinasti kejahatan.', 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', 'Marlon Brando, Al Pacino, James Caan, Robert Duvall'),
            (11, 'Fight Club', 1999, 'David Fincher', 'Drama,Thriller', 8.8, '139 min', 'Seorang pekerja kantoran yang menderita insomnia bertemu dengan penjual sabun misterius bernama Tyler Durden. Keduanya mendirikan klub tarung rahasia bawah tanah yang segera berkembang menjadi sesuatu yang berbahaya.', 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', 'Edward Norton, Brad Pitt, Helena Bonham Carter, Meat Loaf'),
            (12, 'Alien', 1979, 'Ridley Scott', 'Sci-Fi,Horror', 8.5, '117 min', 'Kru kapal kargo luar angkasa komersial Nostromo menyelidiki panggilan darurat dari planet tak dikenal, dan tanpa sadar membawa masuk organisme parasit mematikan yang mulai memangsa mereka satu per satu.', 'https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg', 'Sigourney Weaver, Tom Skerritt, John Hurt, Veronica Cartwright'),
            (13, 'WALL-E', 2008, 'Andrew Stanton', 'Animation,Sci-Fi,Family', 8.4, '98 min', 'Di masa depan di mana bumi ditinggalkan karena tertutup sampah, robot pemadat sampah kecil bernama WALL-E menemukan robot pencari kehidupan bernama EVE dan memulai petualangan kosmik yang menentukan nasib manusia.', 'https://image.tmdb.org/t/p/w500/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg', 'Ben Burtt, Elissa Knight, Jeff Garlin, Fred Willard'),
            (14, 'Memento', 2000, 'Christopher Nolan', 'Mystery,Thriller', 8.4, '113 min', 'Seorang pria yang kehilangan ingatan jangka pendek berusaha melacak pembunuh istrinya dengan bantuan foto polaroid dan tato di tubuhnya, diceritakan dalam dua garis waktu yang bergerak berlawanan.', 'https://image.tmdb.org/t/p/w500/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg', 'Guy Pearce, Carrie-Anne Moss, Joe Pantoliano, Mark Boone Junior'),
            (15, 'Joker', 2019, 'Todd Phillips', 'Crime,Drama,Thriller', 8.4, '122 min', 'Di Gotham City yang penuh ketimpangan pada tahun 1981, Arthur Fleck, seorang badut pesta yang kesepian dan terabaikan oleh masyarakat, perlahan mengalami degradasi mental hingga menjadi sosok ikonik yang memicu revolusi brutal.', 'https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', 'Joaquin Phoenix, Robert De Niro, Zazie Beetz, Frances Conroy'),
            (16, 'Blade Runner 2049', 2017, 'Denis Villeneuve', 'Sci-Fi,Drama,Mystery', 8.0, '164 min', 'Tiga puluh tahun setelah peristiwa film pertama, seorang blade runner baru dari LAPD, Officer K, menemukan rahasia lama yang terkubur yang berpotensi memicu kekacauan besar dalam masyarakat distopia.', 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', 'Ryan Gosling, Harrison Ford, Ana de Armas, Sylvia Hoeks'),
            (17, 'The Shawshank Redemption', 1994, 'Frank Darabont', 'Drama', 9.3, '142 min', 'Seorang bankir sukses dijatuhi hukuman seumur hidup di Penjara Shawshank atas pembunuhan istri dan kekasihnya yang tidak pernah ia lakukan. Selama puluhan tahun, ia menemukan keteguhan dan harapan melalui persahabatan.', 'https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', 'Tim Robbins, Morgan Freeman, Bob Gunton, William Sadler'),
            (18, 'Dune', 2021, 'Denis Villeneuve', 'Sci-Fi,Adventure', 8.0, '155 min', 'Paul Atreides, pemuda berbakat yang ditakdirkan untuk takdir yang melampaui pemahamannya, harus melakukan perjalanan ke planet paling berbahaya di alam semesta demi memastikan masa depan keluarga dan bangsanya.', 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', 'Timothée Chalamet, Rebecca Ferguson, Oscar Isaac, Zendaya'),
            (19, 'Oppenheimer', 2023, 'Christopher Nolan', 'Drama,History,Biography', 8.9, '180 min', 'Kisah fisikawan teoretis J. Robert Oppenheimer yang memimpin Proyek Manhattan di Los Alamos untuk mengembangkan bom atom pertama di dunia selama Perang Dunia II, dan dilema moral yang menghantuinya setelah itu.', 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', 'Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.'),
            (20, 'Goodfellas', 1990, 'Martin Scorsese', 'Crime,Drama', 8.7, '145 min', 'Kisah nyata Henry Hill yang sejak remaja bercita-cita menjadi gangster, naik pangkat melalui hierarki kejahatan terorganisir di New York, hingga akhirnya terjerumus dalam lingkaran kecurigaan dan bahaya narkotika.', 'https://image.tmdb.org/t/p/w500/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg', 'Robert De Niro, Ray Liotta, Joe Pesci, Lorraine Bracco');
        `);
    }
    console.log("Database connected & 20 movies seeded!");
})();

// MIDDLEWARE VERIFIKASI JWT
function verifyToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token provided" });

    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userData = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
}

// ==========================================
// 1. AUTH ENDPOINTS
// ==========================================
app.post('/api/auth/register', async(req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const hashedPw = await bcrypt.hash(password, 10);
        const finalUsername = username || email.split('@')[0];

        const result = await db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [finalUsername, email, hashedPw]
        );
        res.status(201).json({
            msg: "register success",
            user: { id: result.lastID, username: finalUsername, email }
        });
    } catch (e) {
        res.status(400).json({ error: "Email already used" });
    }
});

app.post('/api/auth/login', async(req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Wrong password" });

        const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 2. MOVIES (DISCOVER) ENDPOINTS
// ==========================================
app.get('/api/movies', async(req, res) => {
    try {
        const { genre, search, shuffle } = req.query;
        let query = 'SELECT * FROM movies WHERE 1=1';
        const params = [];

        if (genre && genre !== 'ALL') {
            query += ' AND genres LIKE ?';
            params.push(`%${genre}%`);
        }
        if (search) {
            query += ' AND (title LIKE ? OR director LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (shuffle === 'true') {
            query += ' ORDER BY RANDOM()';
        }

        const movies = await db.all(query, params);
        res.status(200).json(movies);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/movies/:id', async(req, res) => {
    try {
        const movie = await db.get('SELECT * FROM movies WHERE id = ?', [req.params.id]);
        if (!movie) return res.status(404).json({ error: "Movie not found" });
        res.status(200).json(movie);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 3. WATCHLIST ENDPOINTS (PROTECTED)
// ==========================================
app.get('/api/watchlist', verifyToken, async(req, res) => {
    try {
        const list = await db.all(`
            SELECT watchlists.id as watchlist_id, watchlists.movie_id as movieId, movies.* 
            FROM watchlists 
            JOIN movies ON watchlists.movie_id = movies.id 
            WHERE watchlists.user_id = ?
            ORDER BY watchlists.id DESC
        `, [req.userData.id]);
        res.status(200).json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/watchlist', verifyToken, async(req, res) => {
    try {
        const movieId = req.body.movieId || req.body.movie_id;
        if (!movieId) return res.status(400).json({ error: "movieId is required" });

        await db.run(
            'INSERT OR IGNORE INTO watchlists (user_id, movie_id) VALUES (?, ?)', [req.userData.id, movieId]
        );
        res.status(201).json({ msg: "saved to watchlist", data: { movieId } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/watchlist/:movieId', verifyToken, async(req, res) => {
    try {
        await db.run(
            'DELETE FROM watchlists WHERE movie_id = ? AND user_id = ?', [req.params.movieId, req.userData.id]
        );
        res.status(200).json({ msg: "deleted from watchlist" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 4. WATCHED & REVIEWS ENDPOINTS (PROTECTED)
// ==========================================
app.get('/api/watched', verifyToken, async(req, res) => {
    try {
        const watched = await db.all(`
            SELECT reviews.id, reviews.movie_id, reviews.rating, reviews.review, reviews.created_at,
                   movies.title, movies.year, movies.poster_url, movies.director
            FROM reviews
            JOIN movies ON reviews.movie_id = movies.id
            WHERE reviews.user_id = ?
            ORDER BY reviews.created_at DESC
        `, [req.userData.id]);
        res.status(200).json(watched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/watched', verifyToken, async(req, res) => {
    try {
        const movieId = req.body.movieId || req.body.movie_id;
        const rating = Number(req.body.rating);
        const review = req.body.review || req.body.opinion || '';

        if (!movieId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Valid movieId and rating (1-5) are required" });
        }

        await db.run(
            'INSERT INTO reviews (user_id, movie_id, rating, review) VALUES (?, ?, ?, ?)', [req.userData.id, movieId, rating, review]
        );
        res.status(201).json({ msg: "watched logged successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 5. LLM INTEGRATION (GEMINI API GROUNDED)
// ==========================================
app.post('/api/movies/recommend', async(req, res) => {
    try {
        const userPrompt = req.body.prompt || req.body.query || req.body.description;
        if (!userPrompt) return res.status(400).json({ error: "Prompt is required" });

        const movies = await db.all('SELECT id, title, year, director, genres, synopsis FROM movies');

        const systemInstruction = `
Kamu adalah asisten kurator film. Tugasmu adalah memilih SATU film yang paling cocok dengan permintaan pengguna HANYA dari daftar 20 film di database lokal berikut:
${JSON.stringify(movies)}

Permintaan pengguna: "${userPrompt}"

Balas HANYA dengan format JSON murni (tanpa markdown \`\`\`json) dengan struktur persis seperti ini:
{
  "movie_id": <angka ID film dari 1 sampai 20>,
  "reasoning": "<penjelasan singkat dalam Bahasa Indonesia mengapa film ini cocok dengan permintaan pengguna>"
}`;

        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
        const result = await model.generateContent(systemInstruction);
        const rawText = result.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(rawText);

        const matchedMovie = await db.get('SELECT * FROM movies WHERE id = ?', [parsed.movie_id]);

        res.status(200).json({
            movie_id: parsed.movie_id,
            reasoning: parsed.reasoning,
            movie: matchedMovie
        });
    } catch (e) {
        console.error("AI Error:", e.message);
        res.status(500).json({ error: "Gagal memanggil Gemini AI. Pastikan GEMINI_API_KEY sudah diisi dengan benar." });
    }
});

app.listen(8000, () => {
    console.log("Server running on http://localhost:8000");
});